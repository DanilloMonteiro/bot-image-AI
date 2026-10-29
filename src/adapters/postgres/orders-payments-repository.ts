import type {
  CreateOrderRequestV1,
  OrderV1,
  PixInstructionsV1,
  ProviderEventResultV1,
  ProviderPaymentEventV1,
  PaymentReconciliationRequestV1,
  PaymentReconciliationResultV1,
  OrphanPaymentReconciliationRequestV1,
  OrphanPaymentReconciliationResultV1,
  OrphanProviderEventV1,
} from '../../contracts/orders-payments/v1';
import { SANDBOX_OFFER_V1 } from '../../contracts/orders-payments/v1';
import type {
  BeginPaymentWrite,
  OrderCreateWrite,
  OrdersPaymentsRepository,
  PaymentAttempt,
  ReadinessDecision,
} from '../../modules/orders-payments/repository';
import { getPool } from './runtime';

let ready: Promise<void> | undefined;

export function ensureOrdersPaymentsReady(): Promise<void> {
  ready ??= (async () => {
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_payments_orders (
      order_id uuid PRIMARY KEY,
      idempotency_key text NOT NULL UNIQUE,
      customer_id text NOT NULL,
      conversation_id text NOT NULL,
      consent_policy_version text NOT NULL,
      consent_recorded_at timestamptz NOT NULL,
      package_id text NOT NULL,
      amount_minor integer NOT NULL CHECK (amount_minor >= 0),
      currency char(3) NOT NULL CHECK (currency = 'BRL'),
      state text NOT NULL CHECK (state IN ('pending_payment', 'paid', 'payment_exception', 'fulfillment_authorized', 'cancelled')),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )`);
    await pool.query('DROP INDEX IF EXISTS orders_payments_one_pending_per_customer');
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS orders_payments_one_unresolved_per_customer
      ON orders_payments_orders (customer_id) WHERE state IN ('pending_payment', 'payment_exception')`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_payments_attempts (
      payment_id uuid PRIMARY KEY,
      order_id uuid NOT NULL UNIQUE REFERENCES orders_payments_orders(order_id),
      request_id text NOT NULL UNIQUE,
      external_order_id text NOT NULL UNIQUE,
      mode text NOT NULL CHECK (mode IN ('sandbox', 'production')),
      state text NOT NULL CHECK (state IN ('creating', 'pending', 'paid', 'exception')),
      account_id text NOT NULL,
      amount_minor integer NOT NULL CHECK (amount_minor >= 0),
      currency char(3) NOT NULL CHECK (currency = 'BRL'),
      provider_reference text,
      instructions jsonb,
      expires_at timestamptz,
      readiness_reservation_id text,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_payments_provider_events (
      event_id text PRIMARY KEY,
      event_type text NOT NULL,
      external_order_id text,
      external_payment_id text,
      account_id text,
      amount_minor integer,
      currency text,
      paid_at timestamptz,
      environment text,
      outcome jsonb NOT NULL,
      processed_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`ALTER TABLE orders_payments_provider_events
      ADD COLUMN IF NOT EXISTS external_order_id text,
      ADD COLUMN IF NOT EXISTS external_payment_id text,
      ADD COLUMN IF NOT EXISTS account_id text,
      ADD COLUMN IF NOT EXISTS amount_minor integer,
      ADD COLUMN IF NOT EXISTS currency text,
      ADD COLUMN IF NOT EXISTS paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS environment text`);
    await pool.query(`CREATE INDEX IF NOT EXISTS orders_payments_unmatched_events_idx
      ON orders_payments_provider_events (processed_at DESC)
      WHERE outcome->>'reason' = 'order_missing'`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_payments_orphan_reconciliations (
      reconciliation_id text PRIMARY KEY,
      event_id text NOT NULL UNIQUE REFERENCES orders_payments_provider_events(event_id),
      operator_id text NOT NULL,
      evidence_ref text NOT NULL,
      provider_outcome text NOT NULL CHECK (provider_outcome IN ('unpaid', 'refunded')),
      request_data jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_payments_reconciliations (
      reconciliation_id text PRIMARY KEY,
      order_id uuid NOT NULL UNIQUE REFERENCES orders_payments_orders(order_id),
      payment_id uuid NOT NULL REFERENCES orders_payments_attempts(payment_id),
      operator_id text NOT NULL,
      evidence_ref text NOT NULL,
      decision text NOT NULL CHECK (decision IN ('confirm_paid', 'close_unpaid')),
      request_data jsonb NOT NULL,
      outcome jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_payments_readiness_release_outbox (
      reconciliation_id text PRIMARY KEY REFERENCES orders_payments_reconciliations(reconciliation_id),
      order_id uuid NOT NULL REFERENCES orders_payments_orders(order_id),
      reservation_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      released_at timestamptz
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_fulfillment_authorizations (
      authorization_id text PRIMARY KEY,
      order_id uuid NOT NULL UNIQUE REFERENCES orders_payments_orders(order_id),
      payment_id uuid NOT NULL UNIQUE REFERENCES orders_payments_attempts(payment_id),
      issued_at timestamptz NOT NULL,
      consumed_at timestamptz,
      consumed_by text
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders_fulfillment_outbox (
      authorization_id text PRIMARY KEY REFERENCES orders_fulfillment_authorizations(authorization_id),
      order_id uuid NOT NULL UNIQUE REFERENCES orders_payments_orders(order_id),
      created_at timestamptz NOT NULL DEFAULT now(),
      consumed_at timestamptz,
      consumed_by text
    )`);
  })().catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

function toOrder(row: Record<string, unknown>): OrderV1 {
  return {
    version: 'v1',
    orderId: String(row.order_id),
    customerId: String(row.customer_id),
    conversationId: String(row.conversation_id),
    consentPolicyVersion: String(row.consent_policy_version),
    consentRecordedAt: new Date(String(row.consent_recorded_at)).toISOString(),
    packageId: String(row.package_id),
    amountMinor: Number(row.amount_minor),
    currency: 'BRL',
    state: row.state as OrderV1['state'],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function toPayment(row: Record<string, unknown>): PaymentAttempt {
  const instructions = row.instructions && typeof row.instructions === 'object'
    ? row.instructions as PixInstructionsV1
    : null;
  return {
    paymentId: String(row.payment_id),
    orderId: String(row.order_id),
    requestId: String(row.request_id),
    externalOrderId: String(row.external_order_id),
    mode: row.mode as PaymentAttempt['mode'],
    amountMinor: Number(row.amount_minor),
    currency: 'BRL',
    state: row.state as PaymentAttempt['state'],
    providerReference: row.provider_reference === null ? null : String(row.provider_reference),
    accountId: String(row.account_id),
    instructions,
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    readinessReservationId: row.readiness_reservation_id === null ? null : String(row.readiness_reservation_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

async function loadOrder(pool: ReturnType<typeof getPool>, orderId: string): Promise<OrderV1 | null> {
  const result = await pool.query('SELECT * FROM orders_payments_orders WHERE order_id = $1', [orderId]);
  return result.rows[0] ? toOrder(result.rows[0]) : null;
}

export class PostgresOrdersPaymentsRepository implements OrdersPaymentsRepository {
  async createOrder(request: CreateOrderRequestV1, orderId: string, occurredAt: string): Promise<OrderCreateWrite> {
    await ensureOrdersPaymentsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const prior = await client.query('SELECT * FROM orders_payments_orders WHERE idempotency_key = $1 FOR UPDATE', [request.idempotencyKey]);
      if (prior.rows[0]) {
        const order = toOrder(prior.rows[0]);
        const same = order.customerId === request.customerId
          && order.conversationId === request.conversationId
          && order.packageId === request.packageId
          && order.consentPolicyVersion === request.consent.policyVersion
          && order.consentRecordedAt === request.consent.recordedAt;
        await client.query('COMMIT');
        return same ? { status: 'already_created', order } : { status: 'conflict', reason: 'idempotency_key_reused' };
      }
      const pending = await client.query(
        `SELECT * FROM orders_payments_orders
         WHERE customer_id = $1 AND state IN ('pending_payment', 'payment_exception') FOR UPDATE`,
        [request.customerId],
      );
      if (pending.rows[0]) {
        await client.query('COMMIT');
        return { status: 'conflict', reason: 'pending_order_exists' };
      }
      await client.query(
        `INSERT INTO orders_payments_orders (
          order_id, idempotency_key, customer_id, conversation_id, consent_policy_version,
          consent_recorded_at, package_id, amount_minor, currency, state, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'BRL','pending_payment',$9,$9)`,
        [orderId, request.idempotencyKey, request.customerId, request.conversationId,
          request.consent.policyVersion, request.consent.recordedAt, SANDBOX_OFFER_V1.offerId,
          SANDBOX_OFFER_V1.amountMinor, occurredAt],
      );
      const created = await client.query('SELECT * FROM orders_payments_orders WHERE order_id = $1', [orderId]);
      await client.query('COMMIT');
      return { status: 'created', order: toOrder(created.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        const existingByKey = await getPool().query('SELECT * FROM orders_payments_orders WHERE idempotency_key = $1', [request.idempotencyKey]);
        if (existingByKey.rows[0]) {
          const order = toOrder(existingByKey.rows[0]);
          const same = order.customerId === request.customerId
            && order.conversationId === request.conversationId
            && order.packageId === request.packageId
            && order.consentPolicyVersion === request.consent.policyVersion
          && order.consentRecordedAt === request.consent.recordedAt;
          return same ? { status: 'already_created', order } : { status: 'conflict', reason: 'idempotency_key_reused' };
        }
        return { status: 'conflict', reason: 'pending_order_exists' };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async findOrder(orderId: string): Promise<OrderV1 | null> {
    await ensureOrdersPaymentsReady();
    return loadOrder(getPool(), orderId);
  }

  async findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderV1 | null> {
    await ensureOrdersPaymentsReady();
    const result = await getPool().query('SELECT * FROM orders_payments_orders WHERE idempotency_key = $1', [idempotencyKey]);
    return result.rows[0] ? toOrder(result.rows[0]) : null;
  }

  async beginPayment(input: {
    orderId: string; paymentId: string; requestId: string; externalOrderId: string;
    mode: 'sandbox' | 'production'; accountId: string; readinessReservationId: string | null; occurredAt: string;
  }): Promise<BeginPaymentWrite> {
    await ensureOrdersPaymentsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query('SELECT * FROM orders_payments_orders WHERE order_id = $1 FOR UPDATE', [input.orderId]);
      if (!orderResult.rows[0]) {
        await client.query('COMMIT');
        return { status: 'order_missing' };
      }
      if (orderResult.rows[0].state !== 'pending_payment') {
        await client.query('COMMIT');
        return { status: 'order_not_payable' };
      }
      const prior = await client.query('SELECT * FROM orders_payments_attempts WHERE order_id = $1 FOR UPDATE', [input.orderId]);
      if (prior.rows[0]) {
        const attempt = toPayment(prior.rows[0]);
        await client.query('COMMIT');
        return attempt.requestId === input.requestId
          ? { status: attempt.instructions ? 'already_created' : 'already_started', attempt }
          : { status: 'conflict' };
      }
      const sameRequest = await client.query('SELECT * FROM orders_payments_attempts WHERE request_id = $1', [input.requestId]);
      if (sameRequest.rows[0]) {
        await client.query('COMMIT');
        return { status: 'conflict' };
      }
      const order = toOrder(orderResult.rows[0]);
      const inserted = await client.query(
        `INSERT INTO orders_payments_attempts (
          payment_id, order_id, request_id, external_order_id, mode, state, account_id,
          amount_minor, currency, readiness_reservation_id, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,'creating',$6,$7,'BRL',$8,$9,$9) RETURNING *`,
        [input.paymentId, input.orderId, input.requestId, input.externalOrderId, input.mode,
          input.accountId, order.amountMinor, input.readinessReservationId, input.occurredAt],
      );
      await client.query('COMMIT');
      return { status: 'started', attempt: toPayment(inserted.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async findPaymentForOrder(orderId: string): Promise<PaymentAttempt | null> {
    await ensureOrdersPaymentsReady();
    const result = await getPool().query('SELECT * FROM orders_payments_attempts WHERE order_id = $1', [orderId]);
    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async findPaymentByExternalOrderId(externalOrderId: string): Promise<PaymentAttempt | null> {
    await ensureOrdersPaymentsReady();
    const result = await getPool().query('SELECT * FROM orders_payments_attempts WHERE external_order_id = $1', [externalOrderId]);
    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async completePayment(paymentId: string, instructions: PixInstructionsV1): Promise<void> {
    await ensureOrdersPaymentsReady();
    await getPool().query(
      `UPDATE orders_payments_attempts SET state = 'pending', provider_reference = $2,
       instructions = $3::jsonb, expires_at = $4, updated_at = now()
       WHERE payment_id = $1 AND state = 'creating'`,
      [paymentId, instructions.providerReference, JSON.stringify(instructions), instructions.expiresAt],
    );
  }

  async markPaymentUncertain(paymentId: string): Promise<void> {
    await ensureOrdersPaymentsReady();
    await getPool().query(
      `UPDATE orders_payments_attempts SET state = 'exception', updated_at = now()
       WHERE payment_id = $1 AND state = 'creating'`,
      [paymentId],
    );
  }

  async applyProviderEvent(event: ProviderPaymentEventV1, expectedAccountId: string, authorizationId: string, consumeReadiness?: ReadinessDecision): Promise<ProviderEventResultV1> {
    await ensureOrdersPaymentsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const priorEvent = await client.query('SELECT outcome FROM orders_payments_provider_events WHERE event_id = $1 FOR UPDATE', [event.eventId]);
      if (priorEvent.rows[0]) {
        await client.query('COMMIT');
        const outcome = priorEvent.rows[0].outcome as ProviderEventResultV1;
        return { status: 'already_processed', orderId: 'orderId' in outcome ? outcome.orderId : '', authorizationId: 'authorizationId' in outcome ? outcome.authorizationId : '' };
      }

      const paymentHint = await client.query(
        'SELECT order_id FROM orders_payments_attempts WHERE external_order_id = $1',
        [event.externalOrderId],
      );
      if (!paymentHint.rows[0]) {
        const result: ProviderEventResultV1 = { status: 'exception', reason: 'order_missing' };
        await this.insertEvent(client, event, result);
        await client.query('COMMIT');
        return result;
      }
      const orderResult = await client.query(
        'SELECT * FROM orders_payments_orders WHERE order_id = $1 FOR UPDATE', [paymentHint.rows[0].order_id],
      );
      if (!orderResult.rows[0]) {
        const result: ProviderEventResultV1 = { status: 'exception', reason: 'order_missing' };
        await this.insertEvent(client, event, result);
        await client.query('COMMIT');
        return result;
      }
      const paymentResult = await client.query(
        'SELECT * FROM orders_payments_attempts WHERE external_order_id = $1 FOR UPDATE',
        [event.externalOrderId],
      );
      if (!paymentResult.rows[0]) {
        const result: ProviderEventResultV1 = { status: 'exception', reason: 'order_missing' };
        await this.insertEvent(client, event, result);
        await client.query('COMMIT');
        return result;
      }
      const replayedEvent = await client.query('SELECT outcome FROM orders_payments_provider_events WHERE event_id = $1 FOR UPDATE', [event.eventId]);
      if (replayedEvent.rows[0]) {
        await client.query('COMMIT');
        const outcome = replayedEvent.rows[0].outcome as ProviderEventResultV1;
        return { status: 'already_processed', orderId: 'orderId' in outcome ? outcome.orderId : '', authorizationId: 'authorizationId' in outcome ? outcome.authorizationId : '' };
      }
      const attempt = toPayment(paymentResult.rows[0]);
      if (attempt.state === 'creating') {
        await client.query('COMMIT');
        return { status: 'retry', reason: 'payment_attempt_incomplete' };
      }
      const order = toOrder(orderResult.rows[0]);
      let result: ProviderEventResultV1;
      const matches = event.externalPaymentId === attempt.providerReference
        && event.externalOrderId === attempt.externalOrderId
        && event.accountId === expectedAccountId
        && event.accountId === attempt.accountId
        && event.amountMinor === attempt.amountMinor
        && event.amountMinor === order.amountMinor
        && event.currency === 'BRL'
        && event.environment === attempt.mode;
      if (!matches) {
        result = { status: 'exception', reason: 'payment_mismatch' };
      } else if (!event.paidAt || !Number.isFinite(Date.parse(event.paidAt))) {
        result = { status: 'exception', reason: 'paid_at_untrusted' };
      } else if (!attempt.expiresAt || Date.parse(event.paidAt) < Date.parse(attempt.createdAt)) {
        result = { status: 'exception', reason: 'paid_at_untrusted' };
      } else if (Date.parse(event.paidAt) > Date.parse(attempt.expiresAt)) {
        result = { status: 'exception', reason: 'payment_late' };
      } else if (order.state === 'paid' || order.state === 'fulfillment_authorized') {
        result = { status: 'exception', reason: 'duplicate_payment' };
      } else if (attempt.state !== 'pending') {
        result = { status: 'exception', reason: 'payment_mismatch' };
      } else if (attempt.mode === 'production' && (!attempt.readinessReservationId || !consumeReadiness || !(await consumeReadiness()))) {
        result = { status: 'exception', reason: 'readiness_unavailable' };
      } else {
        result = { status: 'confirmed', orderId: order.orderId, authorizationId };
        await client.query(
          `UPDATE orders_payments_attempts SET state = 'paid', updated_at = now() WHERE payment_id = $1`,
          [attempt.paymentId],
        );
        await client.query(
          `UPDATE orders_payments_orders SET state = 'fulfillment_authorized', updated_at = now() WHERE order_id = $1`,
          [order.orderId],
        );
        await client.query(
          `INSERT INTO orders_fulfillment_authorizations (authorization_id, order_id, payment_id, issued_at)
           VALUES ($1,$2,$3,$4)`,
          [authorizationId, order.orderId, attempt.paymentId, event.paidAt],
        );
        await client.query(
          `INSERT INTO orders_fulfillment_outbox (authorization_id, order_id) VALUES ($1,$2)`,
          [authorizationId, order.orderId],
        );
      }
      if (result.status === 'exception') {
        await client.query(`UPDATE orders_payments_orders SET state = 'payment_exception', updated_at = now() WHERE order_id = $1 AND state = 'pending_payment'`, [order.orderId]);
        await client.query(`UPDATE orders_payments_attempts SET state = 'exception', updated_at = now() WHERE payment_id = $1 AND state <> 'paid'`, [attempt.paymentId]);
      }
      await this.insertEvent(client, event, result);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async reconcilePayment(
    request: PaymentReconciliationRequestV1,
    authorizationId: string,
    readinessDecision?: ReadinessDecision,
  ): Promise<PaymentReconciliationResultV1> {
    await ensureOrdersPaymentsReady();
    const client = await getPool().connect();
    let transactionCommitted = false;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['orders-payments-reconciliation:' + request.reconciliationId]);
      const priorById = await client.query(
        `SELECT request_data = $2::jsonb AS same_request, outcome
         FROM orders_payments_reconciliations WHERE reconciliation_id = $1 FOR UPDATE`,
        [request.reconciliationId, JSON.stringify(request)],
      );
      if (priorById.rows[0]) {
        await client.query('COMMIT');
        transactionCommitted = true;
        const row = priorById.rows[0];
        if (!row.same_request) return { status: 'conflict', reason: 'reconciliation_id_reused' };
        if (request.decision === 'close_unpaid') {
          await this.dispatchReadinessRelease(request.reconciliationId, readinessDecision);
        }
        const prior = row.outcome as PaymentReconciliationResultV1;
        return {
          status: 'already_reconciled',
          orderId: request.orderId,
          decision: request.decision,
          authorizationId: prior.status === 'confirmed' || prior.status === 'already_reconciled' ? prior.authorizationId : null,
        };
      }

      const orderResult = await client.query(
        'SELECT * FROM orders_payments_orders WHERE order_id = $1 FOR UPDATE', [request.orderId],
      );
      if (!orderResult.rows[0]) {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'order_missing' };
      }
      const order = toOrder(orderResult.rows[0]);
      const attemptResult = await client.query(
        'SELECT * FROM orders_payments_attempts WHERE order_id = $1 FOR UPDATE', [request.orderId],
      );
      if (!attemptResult.rows[0]) {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'payment_missing' };
      }
      const attempt = toPayment(attemptResult.rows[0]);
      const priorByOrder = await client.query(
        'SELECT reconciliation_id FROM orders_payments_reconciliations WHERE order_id = $1 FOR UPDATE', [request.orderId],
      );
      if (priorByOrder.rows[0] || order.state === 'paid' || order.state === 'fulfillment_authorized'
        || order.state === 'cancelled' || attempt.state === 'paid') {
        await client.query('COMMIT');
        return { status: 'conflict', reason: 'already_resolved' };
      }
      if (order.state !== 'pending_payment' && order.state !== 'payment_exception') {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'payment_not_reconcilable' };
      }

      let result: PaymentReconciliationResultV1;
      if (request.decision === 'confirm_paid') {
        const proof = request.payment;
        const createdAt = Date.parse(attempt.createdAt);
        const paidAt = Date.parse(proof.paidAt);
        const proofExpiresAt = Date.parse(proof.expiresAt);
        const expectedExpiry = attempt.expiresAt ? Date.parse(attempt.expiresAt) : proofExpiresAt;
        const matches = proof.externalOrderId === attempt.externalOrderId
          && (!attempt.providerReference || proof.providerReference === attempt.providerReference)
          && proof.accountId === attempt.accountId
          && proof.amountMinor === attempt.amountMinor && proof.amountMinor === order.amountMinor
          && proof.currency === attempt.currency && proof.environment === attempt.mode
          && Number.isFinite(createdAt) && Number.isFinite(paidAt) && Number.isFinite(expectedExpiry)
          && (!attempt.expiresAt || proof.expiresAt === attempt.expiresAt);
        if (!matches) {
          await client.query('COMMIT');
          return { status: 'blocked', reason: 'evidence_mismatch' };
        }
        if (paidAt < createdAt || proofExpiresAt < createdAt) {
          await client.query('COMMIT');
          return { status: 'blocked', reason: 'paid_at_untrusted' };
        }
        if (paidAt > expectedExpiry) {
          await client.query('COMMIT');
          return { status: 'blocked', reason: 'payment_late' };
        }
        if (attempt.mode === 'production'
          && (!attempt.readinessReservationId || !readinessDecision || !(await readinessDecision()))) {
          await client.query('ROLLBACK');
          return { status: 'blocked', reason: 'readiness_unavailable' };
        }
        result = { status: 'confirmed', orderId: order.orderId, authorizationId };
        await client.query(
          `UPDATE orders_payments_attempts SET state = 'paid', provider_reference = $2,
           expires_at = $3, updated_at = now() WHERE payment_id = $1`,
          [attempt.paymentId, proof.providerReference, proof.expiresAt],
        );
        await client.query(
          `UPDATE orders_payments_orders SET state = 'fulfillment_authorized', updated_at = now() WHERE order_id = $1`,
          [order.orderId],
        );
        await client.query(
          `INSERT INTO orders_fulfillment_authorizations (authorization_id, order_id, payment_id, issued_at)
           VALUES ($1,$2,$3,$4)`,
          [authorizationId, order.orderId, attempt.paymentId, proof.paidAt],
        );
        await client.query(
          'INSERT INTO orders_fulfillment_outbox (authorization_id, order_id) VALUES ($1,$2)',
          [authorizationId, order.orderId],
        );
      } else {
        const matches = request.externalOrderId === attempt.externalOrderId
          && (!attempt.providerReference || request.providerReference === attempt.providerReference);
        if (!matches) {
          await client.query('COMMIT');
          return { status: 'blocked', reason: 'evidence_mismatch' };
        }
        if (attempt.mode === 'production' && (!attempt.readinessReservationId || !readinessDecision)) {
          await client.query('COMMIT');
          transactionCommitted = true;
          return { status: 'blocked', reason: 'readiness_unavailable' };
        }
        result = { status: 'closed', orderId: order.orderId };
        await client.query(
          `UPDATE orders_payments_attempts SET state = 'exception', updated_at = now() WHERE payment_id = $1`,
          [attempt.paymentId],
        );
        await client.query(
          `UPDATE orders_payments_orders SET state = 'cancelled', updated_at = now() WHERE order_id = $1`,
          [order.orderId],
        );
      }
      await client.query(
        `INSERT INTO orders_payments_reconciliations
         (reconciliation_id, order_id, payment_id, operator_id, evidence_ref, decision, request_data, outcome)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
        [request.reconciliationId, order.orderId, attempt.paymentId, request.operatorId, request.evidenceRef,
          request.decision, JSON.stringify(request), JSON.stringify(result)],
      );
      if (request.decision === 'close_unpaid' && attempt.mode === 'production') {
        await client.query(
          `INSERT INTO orders_payments_readiness_release_outbox
           (reconciliation_id, order_id, reservation_id) VALUES ($1,$2,$3)`,
          [request.reconciliationId, order.orderId, attempt.readinessReservationId],
        );
      }
      await client.query('COMMIT');
      transactionCommitted = true;
      if (request.decision === 'close_unpaid') {
        await this.dispatchReadinessRelease(request.reconciliationId, readinessDecision);
      }
      return result;
    } catch (error) {
      if (!transactionCommitted) await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async listUnmatchedProviderEvents(): Promise<OrphanProviderEventV1[]> {
    await ensureOrdersPaymentsReady();
    const result = await getPool().query(
      `SELECT e.* FROM orders_payments_provider_events e
       LEFT JOIN orders_payments_orphan_reconciliations r ON r.event_id = e.event_id
       WHERE e.outcome->>'reason' = 'order_missing' AND r.event_id IS NULL
         AND e.external_order_id IS NOT NULL AND e.external_payment_id IS NOT NULL
         AND e.account_id IS NOT NULL AND e.amount_minor IS NOT NULL AND e.currency IS NOT NULL
         AND e.environment IS NOT NULL
       ORDER BY e.processed_at DESC LIMIT 100`,
    );
    return result.rows.map((row) => ({
      eventId: String(row.event_id),
      eventType: String(row.event_type),
      externalPaymentId: String(row.external_payment_id),
      externalOrderId: String(row.external_order_id),
      accountId: String(row.account_id),
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency),
      paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : null,
      environment: row.environment as 'sandbox' | 'production',
      processedAt: new Date(String(row.processed_at)).toISOString(),
    }));
  }

  async reconcileUnmatchedProviderEvent(
    request: OrphanPaymentReconciliationRequestV1,
  ): Promise<OrphanPaymentReconciliationResultV1> {
    await ensureOrdersPaymentsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['orders-payments-orphan:' + request.reconciliationId]);
      const priorById = await client.query(
        `SELECT request_data = $2::jsonb AS same_request, provider_outcome
         FROM orders_payments_orphan_reconciliations WHERE reconciliation_id = $1 FOR UPDATE`,
        [request.reconciliationId, JSON.stringify(request)],
      );
      if (priorById.rows[0]) {
        await client.query('COMMIT');
        const prior = priorById.rows[0];
        if (!prior.same_request) return { status: 'conflict', reason: 'reconciliation_id_reused' };
        return {
          status: 'already_reconciled', eventId: request.eventId,
          reconciliationId: request.reconciliationId, providerOutcome: prior.provider_outcome,
        };
      }
      const eventResult = await client.query(
        'SELECT * FROM orders_payments_provider_events WHERE event_id = $1 FOR UPDATE', [request.eventId],
      );
      if (!eventResult.rows[0]) {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'event_missing' };
      }
      const row = eventResult.rows[0];
      const outcome = row.outcome as ProviderEventResultV1;
      if (outcome.status !== 'exception' || outcome.reason !== 'order_missing') {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'event_not_unmatched' };
      }
      const payment = request.payment;
      const storedPaidAt = row.paid_at ? new Date(String(row.paid_at)).toISOString() : null;
      const matches = row.external_order_id === payment.externalOrderId
        && row.external_payment_id === payment.externalPaymentId
        && row.account_id === payment.accountId
        && Number(row.amount_minor) === payment.amountMinor
        && row.currency === payment.currency
        && row.environment === payment.environment
        && storedPaidAt === payment.paidAt
        && (payment.paidAt === null || request.providerOutcome === 'refunded');
      if (!matches) {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'evidence_mismatch' };
      }
      const priorByEvent = await client.query(
        'SELECT reconciliation_id FROM orders_payments_orphan_reconciliations WHERE event_id = $1 FOR UPDATE',
        [request.eventId],
      );
      if (priorByEvent.rows[0]) {
        await client.query('COMMIT');
        return { status: 'conflict', reason: 'already_resolved' };
      }
      const result = {
        status: 'closed' as const, eventId: request.eventId, reconciliationId: request.reconciliationId,
      };
      await client.query(
        `INSERT INTO orders_payments_orphan_reconciliations
         (reconciliation_id, event_id, operator_id, evidence_ref, provider_outcome, request_data)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [request.reconciliationId, request.eventId, request.operatorId, request.evidenceRef,
          request.providerOutcome, JSON.stringify(request)],
      );
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async getAuthorization(orderId: string) {
    await ensureOrdersPaymentsReady();
    const result = await getPool().query(
      `SELECT authorization_id, order_id, payment_id, issued_at
       FROM orders_fulfillment_authorizations WHERE order_id = $1`,
      [orderId],
    );
    const row = result.rows[0];
    return row ? {
      authorizationId: String(row.authorization_id),
      orderId: String(row.order_id),
      paymentId: String(row.payment_id),
      issuedAt: new Date(String(row.issued_at)).toISOString(),
    } : null;
  }

  async consumeAuthorization(orderId: string, consumerId: string): Promise<'consumed' | 'already_consumed' | 'not_found' | 'conflict'> {
    await ensureOrdersPaymentsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        'SELECT consumed_at, consumed_by FROM orders_fulfillment_authorizations WHERE order_id = $1 FOR UPDATE',
        [orderId],
      );
      if (!found.rows[0]) {
        await client.query('ROLLBACK');
        return 'not_found';
      }
      const row = found.rows[0];
      if (row.consumed_at) {
        await client.query('COMMIT');
        return row.consumed_by === consumerId ? 'already_consumed' : 'conflict';
      }
      await client.query(
        'UPDATE orders_fulfillment_authorizations SET consumed_at = now(), consumed_by = $2 WHERE order_id = $1',
        [orderId, consumerId],
      );
      await client.query(
        'UPDATE orders_fulfillment_outbox SET consumed_at = now(), consumed_by = $2 WHERE order_id = $1 AND consumed_at IS NULL',
        [orderId, consumerId],
      );
      await client.query('COMMIT');
      return 'consumed';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  private async dispatchReadinessRelease(reconciliationId: string, readinessDecision?: ReadinessDecision): Promise<void> {
    const pool = getPool();
    const pending = await pool.query(
      `SELECT reservation_id FROM orders_payments_readiness_release_outbox
       WHERE reconciliation_id = $1 AND released_at IS NULL`,
      [reconciliationId],
    );
    if (!pending.rows[0]) return;
    const reservationId = String(pending.rows[0].reservation_id);
    if (!readinessDecision || !(await readinessDecision(reservationId))) throw new Error('readiness_release_pending');
    await pool.query(
      `UPDATE orders_payments_readiness_release_outbox SET released_at = now()
       WHERE reconciliation_id = $1 AND released_at IS NULL`,
      [reconciliationId],
    );
  }

  private async insertEvent(client: import('pg').PoolClient, event: ProviderPaymentEventV1, outcome: ProviderEventResultV1): Promise<void> {
    await client.query(
      `INSERT INTO orders_payments_provider_events
       (event_id, event_type, external_order_id, external_payment_id, account_id, amount_minor, currency, paid_at, environment, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.eventType, event.externalOrderId, event.externalPaymentId,
        event.accountId, event.amountMinor, event.currency, event.paidAt, event.environment, JSON.stringify(outcome)],
    );
  }
}

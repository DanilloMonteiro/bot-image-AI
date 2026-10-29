export class MemoryOrdersPaymentsRepository {
  constructor() {
    this.orders = new Map();
    this.byIdempotency = new Map();
    this.attempts = new Map();
    this.byExternalOrderId = new Map();
    this.events = new Map();
    this.providerEvents = new Map();
    this.authorizations = new Map();
    this.reconciliations = new Map();
    this.orphanReconciliations = new Map();
    this.lock = Promise.resolve();
    this.failNextProviderEventCommit = false;
  }

  async createOrder(request, orderId, occurredAt) {
    const priorId = this.byIdempotency.get(request.idempotencyKey);
    if (priorId) {
      const prior = this.orders.get(priorId);
      const same = prior.customerId === request.customerId
        && prior.conversationId === request.conversationId
        && prior.packageId === request.packageId
        && prior.consentPolicyVersion === request.consent.policyVersion
        && prior.consentRecordedAt === request.consent.recordedAt;
      return same ? { status: 'already_created', order: structuredClone(prior) }
        : { status: 'conflict', reason: 'idempotency_key_reused' };
    }
    const pending = [...this.orders.values()].find((row) => row.customerId === request.customerId
      && ['pending_payment', 'payment_exception'].includes(row.state));
    if (pending) return { status: 'conflict', reason: 'pending_order_exists' };
    const order = {
      version: 'v1', orderId, customerId: request.customerId, conversationId: request.conversationId,
      consentPolicyVersion: request.consent.policyVersion, consentRecordedAt: request.consent.recordedAt, packageId: request.packageId,
      amountMinor: 100, currency: 'BRL', state: 'pending_payment', createdAt: occurredAt,
    };
    this.orders.set(orderId, order);
    this.byIdempotency.set(request.idempotencyKey, orderId);
    return { status: 'created', order: structuredClone(order) };
  }

  async findOrder(orderId) { return structuredClone(this.orders.get(orderId) ?? null); }
  async findOrderByIdempotencyKey(key) {
    const id = this.byIdempotency.get(key);
    return id ? this.findOrder(id) : null;
  }

  async beginPayment(input) {
    const order = this.orders.get(input.orderId);
    if (!order) return { status: 'order_missing' };
    if (order.state !== 'pending_payment') return { status: 'order_not_payable' };
    const prior = this.attempts.get(input.orderId);
    if (prior) return prior.requestId === input.requestId
      ? { status: prior.instructions ? 'already_created' : 'already_started', attempt: structuredClone(prior) }
      : { status: 'conflict' };
    if ([...this.attempts.values()].some((attempt) => attempt.requestId === input.requestId)) return { status: 'conflict' };
    const attempt = {
      paymentId: input.paymentId, orderId: input.orderId, requestId: input.requestId,
      externalOrderId: input.externalOrderId, mode: input.mode, amountMinor: order.amountMinor,
      currency: 'BRL', state: 'creating', providerReference: null, accountId: input.accountId,
      instructions: null, expiresAt: null, readinessReservationId: input.readinessReservationId,
      createdAt: input.occurredAt,
    };
    this.attempts.set(input.orderId, attempt);
    this.byExternalOrderId.set(input.externalOrderId, input.orderId);
    return { status: 'started', attempt: structuredClone(attempt) };
  }

  async findPaymentForOrder(orderId) { return structuredClone(this.attempts.get(orderId) ?? null); }
  async findPaymentByExternalOrderId(externalOrderId) {
    const orderId = this.byExternalOrderId.get(externalOrderId);
    return orderId ? this.findPaymentForOrder(orderId) : null;
  }

  async completePayment(paymentId, instructions) {
    const attempt = [...this.attempts.values()].find((row) => row.paymentId === paymentId);
    if (!attempt || attempt.state !== 'creating') return;
    Object.assign(attempt, {
      state: 'pending', providerReference: instructions.providerReference,
      instructions: structuredClone(instructions), expiresAt: instructions.expiresAt,
    });
  }

  async markPaymentUncertain(paymentId) {
    const attempt = [...this.attempts.values()].find((row) => row.paymentId === paymentId);
    if (attempt && attempt.state === 'creating') attempt.state = 'exception';
  }

  async applyProviderEvent(event, expectedAccountId, authorizationId, consumeReadiness) {
    return this.withLock(async () => {
    if (this.events.has(event.eventId)) {
      const prior = this.events.get(event.eventId);
      return {
        status: 'already_processed',
        orderId: prior.orderId ?? '',
        authorizationId: prior.authorizationId ?? '',
      };
    }
    const orderId = this.byExternalOrderId.get(event.externalOrderId);
    const attempt = orderId ? this.attempts.get(orderId) : null;
    const order = orderId ? this.orders.get(orderId) : null;
    if (!attempt || !order) {
      const result = { status: 'exception', reason: 'order_missing' };
      this.events.set(event.eventId, result);
      this.providerEvents.set(event.eventId, structuredClone(event));
      return result;
    }
    if (attempt.state === 'creating') return { status: 'retry', reason: 'payment_attempt_incomplete' };
    const attemptBefore = structuredClone(attempt);
    const orderBefore = structuredClone(order);
    const authorizationBefore = this.authorizations.has(orderId)
      ? structuredClone(this.authorizations.get(orderId)) : null;
    const matches = event.externalPaymentId === attempt.providerReference
      && event.externalOrderId === attempt.externalOrderId
      && event.accountId === expectedAccountId
      && event.accountId === attempt.accountId
      && event.amountMinor === attempt.amountMinor
      && event.amountMinor === order.amountMinor
      && event.currency === 'BRL'
      && event.environment === attempt.mode;
    let result;
    if (!matches) result = { status: 'exception', reason: 'payment_mismatch' };
    else if (!event.paidAt) result = { status: 'exception', reason: 'paid_at_untrusted' };
    else if (!attempt.expiresAt || Date.parse(event.paidAt) < Date.parse(attempt.createdAt)) result = { status: 'exception', reason: 'paid_at_untrusted' };
    else if (Date.parse(event.paidAt) > Date.parse(attempt.expiresAt)) result = { status: 'exception', reason: 'payment_late' };
    else if (order.state === 'paid' || order.state === 'fulfillment_authorized') result = { status: 'exception', reason: 'duplicate_payment' };
    else if (attempt.mode === 'production' && (!attempt.readinessReservationId || !consumeReadiness || !(await consumeReadiness()))) result = { status: 'exception', reason: 'readiness_unavailable' };
    else if (attempt.state !== 'pending') result = { status: 'exception', reason: 'payment_mismatch' };
    else {
      result = { status: 'confirmed', orderId, authorizationId };
      attempt.state = 'paid';
      order.state = 'fulfillment_authorized';
      this.authorizations.set(orderId, { authorizationId, orderId, paymentId: attempt.paymentId, issuedAt: event.paidAt, consumedBy: null });
    }
    if (result.status === 'exception') {
      if (order.state === 'pending_payment') order.state = 'payment_exception';
      if (attempt.state !== 'paid') attempt.state = 'exception';
    }
    if (this.failNextProviderEventCommit) {
      this.failNextProviderEventCommit = false;
      Object.assign(attempt, attemptBefore);
      Object.assign(order, orderBefore);
      if (authorizationBefore) this.authorizations.set(orderId, authorizationBefore);
      else this.authorizations.delete(orderId);
      throw new Error('simulated_provider_event_commit_failure');
    }
    this.events.set(event.eventId, result);
    this.providerEvents.set(event.eventId, structuredClone(event));
    return result;
    });
  }

  async reconcilePayment(request, authorizationId, readinessDecision) {
    return this.withLock(async () => {
      const priorById = this.reconciliations.get(request.reconciliationId);
      if (priorById) {
        if (JSON.stringify(priorById.request) !== JSON.stringify(request)) {
          return { status: 'conflict', reason: 'reconciliation_id_reused' };
        }
        return {
          status: 'already_reconciled', orderId: request.orderId, decision: request.decision,
          authorizationId: priorById.outcome.authorizationId ?? null,
        };
      }
      const order = this.orders.get(request.orderId);
      if (!order) return { status: 'blocked', reason: 'order_missing' };
      const attempt = this.attempts.get(request.orderId);
      if (!attempt) return { status: 'blocked', reason: 'payment_missing' };
      if ([...this.reconciliations.values()].some((entry) => entry.request.orderId === request.orderId)
        || ['paid', 'fulfillment_authorized', 'cancelled'].includes(order.state) || attempt.state === 'paid') {
        return { status: 'conflict', reason: 'already_resolved' };
      }
      if (!['pending_payment', 'payment_exception'].includes(order.state)) {
        return { status: 'blocked', reason: 'payment_not_reconcilable' };
      }

      let outcome;
      if (request.decision === 'confirm_paid') {
        const proof = request.payment;
        const createdAt = Date.parse(attempt.createdAt);
        const paidAt = Date.parse(proof.paidAt);
        const expiresAt = Date.parse(proof.expiresAt);
        const expectedExpiry = Date.parse(attempt.expiresAt ?? proof.expiresAt);
        const matches = proof.externalOrderId === attempt.externalOrderId
          && (!attempt.providerReference || proof.providerReference === attempt.providerReference)
          && proof.accountId === attempt.accountId && proof.amountMinor === attempt.amountMinor
          && proof.amountMinor === order.amountMinor && proof.currency === attempt.currency
          && proof.environment === attempt.mode && Number.isFinite(createdAt)
          && Number.isFinite(paidAt) && Number.isFinite(expectedExpiry)
          && (!attempt.expiresAt || proof.expiresAt === attempt.expiresAt);
        if (!matches) return { status: 'blocked', reason: 'evidence_mismatch' };
        if (paidAt < createdAt || expiresAt < createdAt) return { status: 'blocked', reason: 'paid_at_untrusted' };
        if (paidAt > expectedExpiry) return { status: 'blocked', reason: 'payment_late' };
        if (attempt.mode === 'production'
          && (!attempt.readinessReservationId || !readinessDecision || !(await readinessDecision()))) {
          return { status: 'blocked', reason: 'readiness_unavailable' };
        }
        outcome = { status: 'confirmed', orderId: order.orderId, authorizationId };
        attempt.state = 'paid';
        attempt.providerReference = proof.providerReference;
        attempt.expiresAt = proof.expiresAt;
        order.state = 'fulfillment_authorized';
        this.authorizations.set(order.orderId, {
          authorizationId, orderId: order.orderId, paymentId: attempt.paymentId,
          issuedAt: proof.paidAt, consumedBy: null,
        });
      } else {
        const matches = request.externalOrderId === attempt.externalOrderId
          && (!attempt.providerReference || request.providerReference === attempt.providerReference);
        if (!matches) return { status: 'blocked', reason: 'evidence_mismatch' };
        if (attempt.mode === 'production'
          && (!attempt.readinessReservationId || !readinessDecision || !(await readinessDecision(attempt.readinessReservationId)))) {
          return { status: 'blocked', reason: 'readiness_unavailable' };
        }
        outcome = { status: 'closed', orderId: order.orderId };
        attempt.state = 'exception';
        order.state = 'cancelled';
      }
      this.reconciliations.set(request.reconciliationId, { request: structuredClone(request), outcome });
      return outcome;
    });
  }

  async listUnmatchedProviderEvents() {
    return [...this.events.entries()]
      .filter(([eventId, result]) => result.status === 'exception'
        && result.reason === 'order_missing'
        && ![...this.orphanReconciliations.values()].some((entry) => entry.request.eventId === eventId))
      .map(([eventId]) => ({
        ...structuredClone(this.providerEvents.get(eventId)), processedAt: new Date().toISOString(),
      }));
  }

  async reconcileUnmatchedProviderEvent(request) {
    return this.withLock(async () => {
      const priorById = this.orphanReconciliations.get(request.reconciliationId);
      if (priorById) {
        if (JSON.stringify(priorById.request) !== JSON.stringify(request)) {
          return { status: 'conflict', reason: 'reconciliation_id_reused' };
        }
        return {
          status: 'already_reconciled', eventId: request.eventId,
          reconciliationId: request.reconciliationId, providerOutcome: request.providerOutcome,
        };
      }
      const event = this.providerEvents.get(request.eventId);
      const outcome = this.events.get(request.eventId);
      if (!event || !outcome) return { status: 'blocked', reason: 'event_missing' };
      if (outcome.status !== 'exception' || outcome.reason !== 'order_missing') {
        return { status: 'blocked', reason: 'event_not_unmatched' };
      }
      const proof = request.payment;
      const matches = proof.externalOrderId === event.externalOrderId
        && proof.externalPaymentId === event.externalPaymentId
        && proof.accountId === event.accountId && proof.amountMinor === event.amountMinor
        && proof.currency === event.currency && proof.paidAt === event.paidAt
        && proof.environment === event.environment
        && (proof.paidAt === null || request.providerOutcome === 'refunded');
      if (!matches) return { status: 'blocked', reason: 'evidence_mismatch' };
      if ([...this.orphanReconciliations.values()].some((entry) => entry.request.eventId === request.eventId)) {
        return { status: 'conflict', reason: 'already_resolved' };
      }
      const result = {
        status: 'closed', eventId: request.eventId, reconciliationId: request.reconciliationId,
      };
      this.orphanReconciliations.set(request.reconciliationId, {
        request: structuredClone(request), outcome: result,
      });
      return result;
    });
  }

  async withLock(operation) {
    const prior = this.lock;
    let release;
    this.lock = new Promise((resolve) => { release = resolve; });
    await prior;
    try { return await operation(); } finally { release(); }
  }

  async getAuthorization(orderId) {
    const authorization = this.authorizations.get(orderId);
    if (!authorization) return null;
    const { authorizationId, paymentId, issuedAt } = authorization;
    return { authorizationId, paymentId, orderId, issuedAt };
  }

  async consumeAuthorization(orderId, consumerId) {
    const authorization = this.authorizations.get(orderId);
    if (!authorization) return 'not_found';
    if (authorization.consumedBy) return authorization.consumedBy === consumerId ? 'already_consumed' : 'conflict';
    authorization.consumedBy = consumerId;
    return 'consumed';
  }
}

import { randomUUID } from 'node:crypto';
import {
  ORDERS_PAYMENTS_CONTRACT_VERSION,
  SANDBOX_OFFER_V1,
  isCreateOrderRequestV1,
  isPaymentReconciliationRequestV1,
  type CreateOrderRequestV1,
  type CreateOrderResultV1,
  type CreatePixRequestV1,
  type CreatePixResultV1,
  type ProviderPaymentEventV1,
  type ProviderEventResultV1,
  type PixInstructionsV1,
  type PaymentReconciliationRequestV1,
  type PaymentReconciliationResultV1,
  isOrphanPaymentReconciliationRequestV1,
  type OrphanPaymentReconciliationRequestV1,
  type OrphanPaymentReconciliationResultV1,
  type OrphanProviderEventV1,
} from '../../contracts/orders-payments/v1';
import {
  PORTRAIT_READINESS_CONTRACT_VERSION,
  isPortraitReadinessConsumeResultV1,
  isPortraitReadinessReleaseResultV1,
  isPortraitReadinessReservationResultV1,
  type PortraitReadinessPortV1,
} from '../../contracts/portrait-readiness/v1';
import type { Budget } from '../budget/use-cases';
import type { OrdersPaymentsRepository } from './repository';
import { findSandboxOffer } from './catalog';

export type PixGateway = {
  isConfigured?(mode: 'sandbox' | 'production'): boolean;
  create(input: {
    amountMinor: number;
    externalOrderId: string;
    description: string;
    mode: 'sandbox' | 'production';
  }): Promise<{ providerReference: string; amountMinor: number; copyAndPaste: string; qrCodeBase64: string; expiresAt: string; devMode: boolean }>;
  simulatePayment(providerReference: string): Promise<void>;
};

export type LocalPixSender = {
  send(input: { orderId: string; paymentId: string; copyAndPaste: string; qrCodeBase64: string }): Promise<void>;
};

type Environment = Record<string, string | undefined>;

const PRODUCTION_PIX_APPROVALS = [
  'ORDERS_PIX_PRODUCTION_ENABLED',
  'PRODUCTION_OFFER_APPROVED',
  'PRODUCTION_BUDGET_RECONCILED',
  'PRODUCTION_FULFILLMENT_READY',
  'PRODUCTION_PIX_ACCOUNT_VERIFIED',
  'PRODUCTION_PIX_WEBHOOK_VERIFIED',
  'PRODUCTION_PIX_MANUAL_TEST_VERIFIED',
  'PRODUCTION_PIX_RECONCILIATION_READY',
  'PRODUCTION_PAYMENT_RETENTION_APPROVED',
] as const;

export function isProductionPixApproved(environment: Environment = process.env): boolean {
  return environment.PLATFORM_ENVIRONMENT === 'production'
    && PRODUCTION_PIX_APPROVALS.every((name) => environment[name] === 'true')
    && environment.PRODUCTION_PRIVACY_APPROVED === 'true'
    && environment.PRODUCTION_COST_RECONCILED === 'true'
    && environment.PRODUCTION_BACKUP_RESTORE_VERIFIED === 'true'
    && environment.PRODUCTION_COST_ALERTS_60_80_95_VERIFIED === 'true'
    && environment.PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED === 'true'
    && environment.PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED === 'true';
}

export class OrdersPayments {
  constructor(private readonly dependencies: {
    repository: OrdersPaymentsRepository;
    budget: Budget;
    gateway: PixGateway;
    readiness?: PortraitReadinessPortV1;
    environment?: Environment;
    clock?: () => Date;
  }) {}

  private get environment(): Environment {
    return this.dependencies.environment ?? process.env;
  }

  private now(): Date {
    return this.dependencies.clock?.() ?? new Date();
  }

  async createOrder(request: CreateOrderRequestV1): Promise<CreateOrderResultV1> {
    if (!isCreateOrderRequestV1(request)) throw new Error('invalid_create_order_request');
    const offer = findSandboxOffer(request.packageId);
    if (!offer) return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'blocked', reason: 'offer_unavailable' };
    if (request.consent.status !== 'granted') {
      return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'blocked', reason: 'consent_required' };
    }
    const created = await this.dependencies.repository.createOrder(request, randomUUID(), this.now().toISOString());
    return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, ...created };
  }

  async createPix(request: CreatePixRequestV1): Promise<CreatePixResultV1> {
    if (request.version !== ORDERS_PAYMENTS_CONTRACT_VERSION
      || !request.orderId || !request.requestId
      || (request.mode !== 'sandbox' && request.mode !== 'production')) {
      throw new Error('invalid_create_pix_request');
    }

    const order = await this.dependencies.repository.findOrder(request.orderId);
    if (!order) return blocked('order_missing');
    if (order.state !== 'pending_payment' && order.state !== 'payment_exception') {
      return blocked('order_not_payable');
    }
    const existing = await this.dependencies.repository.findPaymentForOrder(order.orderId);
    if (existing) {
      if (existing.requestId !== request.requestId) return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'conflict', reason: 'request_id_reused' };
      if (order.state === 'payment_exception' || existing.state === 'exception' || existing.state === 'creating') {
        return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'reconciliation_required', reason: 'provider_outcome_unknown' };
      }
      if (existing.instructions) {
        return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'already_created', instructions: existing.instructions };
      }
      return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'reconciliation_required', reason: 'provider_outcome_unknown' };
    }
    if (order.state !== 'pending_payment') return blocked('order_not_payable');

    const providerAccountId = this.environment.ABACATEPAY_ACCOUNT_ID ?? '';
    if (!providerAccountId || this.dependencies.gateway.isConfigured?.(request.mode) === false) {
      return blocked('provider_not_configured');
    }

    if (request.mode === 'production'
      && (order.packageId === SANDBOX_OFFER_V1.offerId
        || !isProductionPixApproved(this.environment) || !this.dependencies.readiness)) {
      return blocked('production_gate_closed');
    }

    const knownCost = request.mode === 'sandbox'
      ? { status: 'known' as const, amountMinor: 0, currency: 'BRL' }
      : this.productionPixCost();
    const reservation = await this.dependencies.budget.reserveAction({
      version: 'v1',
      actionId: 'pix:' + order.orderId,
      category: 'meta_pix_fx_retries',
      cost: knownCost,
      attemptLimit: 1,
    });
    if (reservation.status !== 'reserved' && reservation.status !== 'already_reserved') {
      return blocked('budget_blocked');
    }

    let readinessReservationId: string | null = null;
    if (request.mode === 'production') {
      // Budget reservation comes first so its denial cannot strand portrait readiness.
      const readinessPort = this.dependencies.readiness;
      if (!readinessPort) return blocked('production_gate_closed');
      const readiness = await readinessPort.reserve({
        version: PORTRAIT_READINESS_CONTRACT_VERSION,
        reservationKey: 'order:' + order.orderId + ':' + order.packageId,
        orderId: order.orderId,
        packageId: order.packageId,
        expiresAt: new Date(this.now().getTime() + 60 * 60 * 1000).toISOString(),
      });
      if (!isPortraitReadinessReservationResultV1(readiness)
        || readiness.status === 'blocked'
        || readiness.orderId !== order.orderId
        || readiness.packageId !== order.packageId) return blocked('portrait_readiness_blocked');
      readinessReservationId = readiness.reservationId;
    }

    const paymentId = randomUUID();
    const begun = await this.dependencies.repository.beginPayment({
      orderId: order.orderId,
      paymentId,
      requestId: request.requestId,
      externalOrderId: request.requestId,
      mode: request.mode,
      accountId: providerAccountId,
      readinessReservationId,
      occurredAt: this.now().toISOString(),
    });
    if (begun.status === 'order_missing') return blocked('order_missing');
    if (begun.status === 'order_not_payable') return blocked('order_not_payable');
    if (begun.status === 'conflict') return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'conflict', reason: 'request_id_reused' };
    if (begun.status !== 'started') {
      return begun.attempt.instructions
        ? { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'already_created', instructions: begun.attempt.instructions }
        : { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'reconciliation_required', reason: 'provider_outcome_unknown' };
    }

    try {
      const created = await this.dependencies.gateway.create({
        amountMinor: order.amountMinor,
        externalOrderId: request.requestId,
        description: 'Sandbox order ' + order.orderId,
        mode: request.mode,
      });
      if (created.devMode !== (request.mode === 'sandbox')
        || created.amountMinor !== order.amountMinor
        || !created.providerReference
        || !created.copyAndPaste
        || !created.qrCodeBase64
        || !isUtcTimestamp(created.expiresAt)) {
        await this.dependencies.repository.markPaymentUncertain(paymentId);
        return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'reconciliation_required', reason: 'provider_outcome_unknown' };
      }
      const instructions: PixInstructionsV1 = {
        paymentId,
        providerReference: created.providerReference,
        amountMinor: order.amountMinor,
        currency: 'BRL',
        copyAndPaste: created.copyAndPaste,
        qrCodeBase64: created.qrCodeBase64,
        expiresAt: created.expiresAt,
      };
      await this.dependencies.repository.completePayment(paymentId, instructions);
      return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'created', instructions };
    } catch {
      await this.dependencies.repository.markPaymentUncertain(paymentId);
      return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'reconciliation_required', reason: 'provider_timeout' };
    }
  }

  async processProviderEvent(event: ProviderPaymentEventV1): Promise<ProviderEventResultV1> {
    if (event.eventType !== 'transparent.completed') {
      return { status: 'ignored', reason: 'unsupported_event' };
    }
    const attempt = await this.dependencies.repository.findPaymentByExternalOrderId(event.externalOrderId);
    const expectedAccount = this.environment.ABACATEPAY_ACCOUNT_ID ?? '';
    if (!attempt) return this.dependencies.repository.applyProviderEvent(event, expectedAccount, 'unmatched');
    const order = await this.dependencies.repository.findOrder(attempt.orderId);
    if (!order) return this.dependencies.repository.applyProviderEvent(event, expectedAccount, 'unmatched');
    const authorizationId = 'fulfillment:' + order.orderId;
    const timestamp = event.paidAt ? Date.parse(event.paidAt) : Number.NaN;
    const expiry = attempt.expiresAt ? Date.parse(attempt.expiresAt) : Number.NaN;
    const createdAt = Date.parse(attempt.createdAt);
    const paidAtValid = Number.isFinite(timestamp) && Number.isFinite(createdAt)
      && Number.isFinite(expiry) && timestamp >= createdAt && timestamp <= expiry;
    const matchesAttempt = event.externalPaymentId === attempt.providerReference
      && event.externalOrderId === attempt.externalOrderId
      && event.accountId === expectedAccount
      && event.accountId === attempt.accountId
      && event.amountMinor === attempt.amountMinor
      && event.amountMinor === order.amountMinor
      && event.currency === 'BRL'
      && event.environment === attempt.mode
      && attempt.state === 'pending'
      && order.state === 'pending_payment';

    const readiness = this.dependencies.readiness;
    const consumeReadiness = attempt.mode === 'production' ? async (): Promise<boolean> => {
      if (!readiness || !attempt.readinessReservationId) return false;
      const consumeResult = await readiness.consume({
          version: PORTRAIT_READINESS_CONTRACT_VERSION,
          reservationId: attempt.readinessReservationId,
          authorizationId,
          orderId: order.orderId,
          packageId: order.packageId,
        });
      return isPortraitReadinessConsumeResultV1(consumeResult)
        && consumeResult.status !== 'blocked';
    } : undefined;

    // The repository invokes this only after locking and revalidating the payment.
    if (attempt.mode === 'production' && (!paidAtValid || !matchesAttempt)) {
      return this.dependencies.repository.applyProviderEvent(event, expectedAccount, authorizationId);
    }
    return this.dependencies.repository.applyProviderEvent(event, expectedAccount, authorizationId, consumeReadiness);
  }

  async reconcilePayment(request: PaymentReconciliationRequestV1): Promise<PaymentReconciliationResultV1> {
    if (!isPaymentReconciliationRequestV1(request)) throw new Error('invalid_payment_reconciliation_request');
    const attempt = await this.dependencies.repository.findPaymentForOrder(request.orderId);
    if (!attempt) return { status: 'blocked', reason: 'payment_missing' };
    const order = await this.dependencies.repository.findOrder(request.orderId);
    if (!order) return { status: 'blocked', reason: 'order_missing' };
    const authorizationId = 'fulfillment:' + order.orderId;
    const readiness = this.dependencies.readiness;
    const readinessDecision = attempt.mode === 'production' ? async (releaseReservationId?: string): Promise<boolean> => {
      if (!readiness || !attempt.readinessReservationId) return false;
      if (request.decision === 'confirm_paid') {
        const result = await readiness.consume({
          version: PORTRAIT_READINESS_CONTRACT_VERSION,
          reservationId: attempt.readinessReservationId,
          authorizationId,
          orderId: order.orderId,
          packageId: order.packageId,
        });
        return isPortraitReadinessConsumeResultV1(result) && result.status !== 'blocked';
      }
      if (releaseReservationId !== attempt.readinessReservationId) return false;
      const result = await readiness.release({
        version: PORTRAIT_READINESS_CONTRACT_VERSION,
        reservationId: releaseReservationId,
        orderId: order.orderId,
        providerTerminal: true,
        reconciliationComplete: true,
      });
      return isPortraitReadinessReleaseResultV1(result) && result.status !== 'blocked';
    } : undefined;
    return this.dependencies.repository.reconcilePayment(request, authorizationId, readinessDecision);
  }

  listUnmatchedProviderEvents(): Promise<OrphanProviderEventV1[]> {
    return this.dependencies.repository.listUnmatchedProviderEvents();
  }

  async reconcileUnmatchedProviderEvent(
    request: OrphanPaymentReconciliationRequestV1,
  ): Promise<OrphanPaymentReconciliationResultV1> {
    if (!isOrphanPaymentReconciliationRequestV1(request)) {
      throw new Error('invalid_orphan_payment_reconciliation_request');
    }
    return this.dependencies.repository.reconcileUnmatchedProviderEvent(request);
  }

  async simulateSandboxPayment(orderId: string): Promise<boolean> {
    const attempt = await this.dependencies.repository.findPaymentForOrder(orderId);
    if (!attempt || attempt.mode !== 'sandbox' || attempt.state !== 'pending' || !attempt.providerReference) return false;
    await this.dependencies.gateway.simulatePayment(attempt.providerReference);
    return true;
  }

  async readFulfillmentAuthorization(orderId: string) {
    return this.dependencies.repository.getAuthorization(orderId);
  }

  async consumeFulfillmentAuthorization(orderId: string, consumerId: string) {
    if (!consumerId.trim()) throw new Error('invalid_fulfillment_consumer');
    return this.dependencies.repository.consumeAuthorization(orderId, consumerId);
  }

  async sendInstructionsLocally(orderId: string, sender: LocalPixSender): Promise<boolean> {
    const attempt = await this.dependencies.repository.findPaymentForOrder(orderId);
    if (!attempt?.instructions || attempt.mode !== 'sandbox') return false;
    await sender.send({
      orderId,
      paymentId: attempt.paymentId,
      copyAndPaste: attempt.instructions.copyAndPaste,
      qrCodeBase64: attempt.instructions.qrCodeBase64,
    });
    return true;
  }

  private productionPixCost() {
    const amount = Number(this.environment.ABACATEPAY_ESTIMATED_FEE_MINOR);
    if (this.environment.PRODUCTION_PIX_COST_APPROVED !== 'true'
      || !Number.isSafeInteger(amount) || amount < 0) {
      return { status: 'unknown' as const, reason: 'pix_provider_cost_not_approved' };
    }
    return { status: 'known' as const, amountMinor: amount, currency: 'BRL' };
  }
}

function blocked(reason: Extract<CreatePixResultV1, { status: 'blocked' }>['reason']): CreatePixResultV1 {
  return { version: ORDERS_PAYMENTS_CONTRACT_VERSION, status: 'blocked', reason };
}

function isUtcTimestamp(value: string): boolean {
  if (!value.endsWith('Z')) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export const SANDBOX_OFFER = SANDBOX_OFFER_V1;

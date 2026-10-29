export const ORDERS_PAYMENTS_CONTRACT_VERSION = 'v1' as const;

export const SANDBOX_OFFER_V1 = Object.freeze({
  version: ORDERS_PAYMENTS_CONTRACT_VERSION,
  offerId: 'sandbox-portrait-five',
  label: 'Pacote sintético de cinco retratos (somente sandbox)',
  imageCount: 5,
  amountMinor: 100,
  currency: 'BRL',
  environment: 'sandbox',
  productionOffer: false,
} as const);

export const ORDER_STATES_V1 = ['pending_payment', 'paid', 'payment_exception', 'fulfillment_authorized', 'cancelled'] as const;
export type OrderStateV1 = typeof ORDER_STATES_V1[number];
export const PIX_STATES_V1 = ['reserved', 'creating', 'pending', 'paid', 'expired', 'exception'] as const;
export type PixStateV1 = typeof PIX_STATES_V1[number];

export type CreateOrderRequestV1 = {
  version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION;
  idempotencyKey: string;
  customerId: string;
  conversationId: string;
  packageId: typeof SANDBOX_OFFER_V1.offerId;
  consent: { status: 'granted' | 'revoked'; policyVersion: string; recordedAt: string };
};

export type OrderV1 = {
  version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION;
  orderId: string;
  customerId: string;
  conversationId: string;
  consentPolicyVersion: string;
  consentRecordedAt: string;
  packageId: string;
  amountMinor: number;
  currency: 'BRL';
  state: OrderStateV1;
  createdAt: string;
};

export type CreateOrderResultV1 =
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'created' | 'already_created'; order: OrderV1 }
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'blocked'; reason: 'consent_required' | 'offer_unavailable' }
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'conflict'; reason: 'idempotency_key_reused' | 'pending_order_exists' };

export type CreatePixRequestV1 = {
  version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION;
  orderId: string;
  requestId: string;
  mode: 'sandbox' | 'production';
};

export type PixInstructionsV1 = {
  paymentId: string;
  providerReference: string;
  amountMinor: number;
  currency: 'BRL';
  copyAndPaste: string;
  qrCodeBase64: string;
  expiresAt: string;
};

export type CreatePixResultV1 =
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'created' | 'already_created'; instructions: PixInstructionsV1 }
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'reconciliation_required'; reason: 'provider_timeout' | 'provider_outcome_unknown' }
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'blocked'; reason: 'order_missing' | 'order_not_payable' | 'budget_blocked' | 'production_gate_closed' | 'portrait_readiness_blocked' | 'provider_not_configured' }
  | { version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION; status: 'conflict'; reason: 'request_id_reused' };

export type ProviderPaymentEventV1 = {
  eventId: string;
  eventType: string;
  externalPaymentId: string;
  externalOrderId: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  paidAt: string | null;
  environment: 'sandbox' | 'production';
};

export type ProviderEventResultV1 =
  | { status: 'confirmed' | 'already_processed'; orderId: string; authorizationId: string }
  | { status: 'exception'; reason: 'duplicate_payment' | 'payment_mismatch' | 'payment_late' | 'paid_at_untrusted' | 'order_missing' | 'readiness_unavailable' }
  | { status: 'ignored'; reason: 'unsupported_event' }
  | { status: 'retry'; reason: 'payment_attempt_incomplete' };

export type PaymentReconciliationRequestV1 =
  | {
      version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION;
      orderId: string;
      reconciliationId: string;
      operatorId: string;
      evidenceRef: string;
      decision: 'confirm_paid';
      providerTerminal: true;
      reconciliationComplete: true;
      payment: {
        externalOrderId: string;
        providerReference: string;
        accountId: string;
        amountMinor: number;
        currency: 'BRL';
        environment: 'sandbox' | 'production';
        paidAt: string;
        expiresAt: string;
      };
    }
  | {
      version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION;
      orderId: string;
      reconciliationId: string;
      operatorId: string;
      evidenceRef: string;
      decision: 'close_unpaid';
      providerTerminal: true;
      reconciliationComplete: true;
      externalOrderId: string;
      providerReference: string | null;
      providerOutcome: 'unpaid' | 'refunded';
    };

export type PaymentReconciliationResultV1 =
  | { status: 'confirmed'; orderId: string; authorizationId: string }
  | { status: 'closed'; orderId: string }
  | { status: 'already_reconciled'; orderId: string; decision: 'confirm_paid' | 'close_unpaid'; authorizationId: string | null }
  | { status: 'blocked'; reason: 'order_missing' | 'payment_missing' | 'payment_not_reconcilable' | 'evidence_mismatch' | 'paid_at_untrusted' | 'payment_late' | 'readiness_unavailable' }
  | { status: 'conflict'; reason: 'reconciliation_id_reused' | 'already_resolved' };

export type OrphanProviderEventV1 = {
  eventId: string;
  eventType: string;
  externalPaymentId: string;
  externalOrderId: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  paidAt: string | null;
  environment: 'sandbox' | 'production';
  processedAt: string;
};

export type OrphanPaymentReconciliationRequestV1 = {
  version: typeof ORDERS_PAYMENTS_CONTRACT_VERSION;
  eventId: string;
  reconciliationId: string;
  operatorId: string;
  evidenceRef: string;
  providerTerminal: true;
  reconciliationComplete: true;
  providerOutcome: 'unpaid' | 'refunded';
  payment: Omit<OrphanProviderEventV1, 'eventId' | 'eventType' | 'processedAt'>;
};

export type OrphanPaymentReconciliationResultV1 =
  | { status: 'closed'; eventId: string; reconciliationId: string }
  | { status: 'already_reconciled'; eventId: string; reconciliationId: string; providerOutcome: 'unpaid' | 'refunded' }
  | { status: 'blocked'; reason: 'event_missing' | 'event_not_unmatched' | 'evidence_mismatch' }
  | { status: 'conflict'; reason: 'reconciliation_id_reused' | 'already_resolved' };

export function isPaymentReconciliationRequestV1(value: unknown): value is PaymentReconciliationRequestV1 {
  if (!isRecord(value) || value.version !== ORDERS_PAYMENTS_CONTRACT_VERSION
    || !isIdentifier(value.orderId) || !isIdentifier(value.reconciliationId)
    || !isIdentifier(value.operatorId) || !isIdentifier(value.evidenceRef)
    || value.providerTerminal !== true || value.reconciliationComplete !== true) return false;
  if (value.decision === 'confirm_paid') {
    if (!hasOnlyKeys(value, ['version', 'orderId', 'reconciliationId', 'operatorId', 'evidenceRef', 'decision', 'providerTerminal', 'reconciliationComplete', 'payment'])
      || !isRecord(value.payment)
      || !hasOnlyKeys(value.payment, ['externalOrderId', 'providerReference', 'accountId', 'amountMinor', 'currency', 'environment', 'paidAt', 'expiresAt'])) return false;
    const payment = value.payment;
    return isIdentifier(payment.externalOrderId) && isIdentifier(payment.providerReference)
      && isIdentifier(payment.accountId) && Number.isSafeInteger(payment.amountMinor)
      && Number(payment.amountMinor) >= 0 && payment.currency === 'BRL'
      && (payment.environment === 'sandbox' || payment.environment === 'production')
      && isUtcTimestamp(payment.paidAt) && isUtcTimestamp(payment.expiresAt);
  }
  return value.decision === 'close_unpaid'
    && hasOnlyKeys(value, ['version', 'orderId', 'reconciliationId', 'operatorId', 'evidenceRef', 'decision', 'providerTerminal', 'reconciliationComplete', 'externalOrderId', 'providerReference', 'providerOutcome'])
    && isIdentifier(value.externalOrderId)
    && (value.providerReference === null || isIdentifier(value.providerReference))
    && (value.providerOutcome === 'unpaid' || value.providerOutcome === 'refunded');
}

export function isOrphanPaymentReconciliationRequestV1(value: unknown): value is OrphanPaymentReconciliationRequestV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'version', 'eventId', 'reconciliationId', 'operatorId', 'evidenceRef',
    'providerTerminal', 'reconciliationComplete', 'providerOutcome', 'payment',
  ]) || value.version !== ORDERS_PAYMENTS_CONTRACT_VERSION
    || !isIdentifier(value.eventId) || !isIdentifier(value.reconciliationId)
    || !isIdentifier(value.operatorId) || !isIdentifier(value.evidenceRef)
    || value.providerTerminal !== true || value.reconciliationComplete !== true
    || (value.providerOutcome !== 'unpaid' && value.providerOutcome !== 'refunded')
    || !isRecord(value.payment) || !hasOnlyKeys(value.payment, [
      'externalPaymentId', 'externalOrderId', 'accountId', 'amountMinor',
      'currency', 'paidAt', 'environment',
    ])) return false;
  const payment = value.payment;
  return isIdentifier(payment.externalPaymentId) && isIdentifier(payment.externalOrderId)
    && isIdentifier(payment.accountId) && Number.isSafeInteger(payment.amountMinor)
    && Number(payment.amountMinor) >= 0 && typeof payment.currency === 'string'
    && payment.currency.length > 0 && payment.currency.length <= 8
    && (payment.paidAt === null || isUtcTimestamp(payment.paidAt))
    && (payment.environment === 'sandbox' || payment.environment === 'production');
}
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function isCreateOrderRequestV1(value: unknown): value is CreateOrderRequestV1 {
  if (!isRecord(value) || value.version !== ORDERS_PAYMENTS_CONTRACT_VERSION) return false;
  if (!isIdentifier(value.idempotencyKey)
    || !isSyntheticIdentifier(value.customerId)
    || !isSyntheticIdentifier(value.conversationId)
    || value.packageId !== SANDBOX_OFFER_V1.offerId
    || !isRecord(value.consent)) return false;
  const consent = value.consent;
  return (consent.status === 'granted' || consent.status === 'revoked')
    && typeof consent.policyVersion === 'string' && consent.policyVersion.startsWith('synthetic-')
    && isUtcTimestamp(consent.recordedAt);
}

export function isCreatePixRequestV1(value: unknown): value is CreatePixRequestV1 {
  return isRecord(value)
    && value.version === ORDERS_PAYMENTS_CONTRACT_VERSION
    && isIdentifier(value.orderId)
    && isIdentifier(value.requestId)
    && (value.mode === 'sandbox' || value.mode === 'production');
}

export function isProviderPaymentEventV1(value: unknown): value is ProviderPaymentEventV1 {
  return isRecord(value)
    && isIdentifier(value.eventId)
    && typeof value.eventType === 'string'
    && isIdentifier(value.externalPaymentId)
    && isIdentifier(value.externalOrderId)
    && isIdentifier(value.accountId)
    && Number.isSafeInteger(value.amountMinor)
    && Number(value.amountMinor) >= 0
    && typeof value.currency === 'string'
    && (value.paidAt === null || isUtcTimestamp(value.paidAt))
    && (value.environment === 'sandbox' || value.environment === 'production');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isSyntheticIdentifier(value: unknown): value is string {
  return isIdentifier(value) && value.startsWith('synthetic-');
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !value.endsWith('Z')) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

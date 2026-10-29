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

export type ReadinessDecision = (reservationId?: string) => Promise<boolean>;

export type OrderCreateWrite =
  | { status: 'created' | 'already_created'; order: OrderV1 }
  | { status: 'conflict'; reason: 'idempotency_key_reused' | 'pending_order_exists' };

export type PaymentAttempt = {
  paymentId: string;
  orderId: string;
  requestId: string;
  externalOrderId: string;
  mode: 'sandbox' | 'production';
  amountMinor: number;
  currency: 'BRL';
  state: 'creating' | 'pending' | 'paid' | 'exception';
  providerReference: string | null;
  accountId: string;
  instructions: PixInstructionsV1 | null;
  expiresAt: string | null;
  readinessReservationId: string | null;
  createdAt: string;
};

export type BeginPaymentWrite =
  | { status: 'started'; attempt: PaymentAttempt }
  | { status: 'already_started'; attempt: PaymentAttempt }
  | { status: 'already_created'; attempt: PaymentAttempt }
  | { status: 'conflict' }
  | { status: 'order_missing' }
  | { status: 'order_not_payable' };

export interface OrdersPaymentsRepository {
  createOrder(request: CreateOrderRequestV1, orderId: string, occurredAt: string): Promise<OrderCreateWrite>;
  findOrder(orderId: string): Promise<OrderV1 | null>;
  findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderV1 | null>;
  beginPayment(input: {
    orderId: string;
    paymentId: string;
    requestId: string;
    externalOrderId: string;
    mode: 'sandbox' | 'production';
    accountId: string;
    readinessReservationId: string | null;
    occurredAt: string;
  }): Promise<BeginPaymentWrite>;
  findPaymentForOrder(orderId: string): Promise<PaymentAttempt | null>;
  findPaymentByExternalOrderId(externalOrderId: string): Promise<PaymentAttempt | null>;
  completePayment(paymentId: string, instructions: PixInstructionsV1): Promise<void>;
  markPaymentUncertain(paymentId: string): Promise<void>;
  applyProviderEvent(event: ProviderPaymentEventV1, expectedAccountId: string, authorizationId: string, consumeReadiness?: ReadinessDecision): Promise<ProviderEventResultV1>;
  reconcilePayment(request: PaymentReconciliationRequestV1, authorizationId: string, readinessDecision?: ReadinessDecision): Promise<PaymentReconciliationResultV1>;
  listUnmatchedProviderEvents(): Promise<OrphanProviderEventV1[]>;
  reconcileUnmatchedProviderEvent(request: OrphanPaymentReconciliationRequestV1): Promise<OrphanPaymentReconciliationResultV1>;
  getAuthorization(orderId: string): Promise<{ authorizationId: string; orderId: string; paymentId: string; issuedAt: string } | null>;
  consumeAuthorization(orderId: string, consumerId: string): Promise<'consumed' | 'already_consumed' | 'not_found' | 'conflict'>;
}

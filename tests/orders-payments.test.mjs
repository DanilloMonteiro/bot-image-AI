import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { MemoryOrdersPaymentsRepository } from './fixtures/orders-payments/memory-repository.mjs';

const require = createRequire(import.meta.url);
const { OrdersPayments, isProductionPixApproved } = require('../dist/modules/orders-payments/use-cases.js');
const { SANDBOX_OFFER_V1, isCreateOrderRequestV1 } = require('../dist/contracts/orders-payments/v1.js');
const { handleAbacatePayWebhook } = require('../dist/adapters/http/abacatepay-webhook-handler.js');
const {
  handleReconcilePaymentRequest,
  handleListUnmatchedProviderEventsRequest,
  handleReconcileUnmatchedProviderEventRequest,
} = require('../dist/adapters/http/orders-payments-handler.js');
const { isPublicStoryPath, isProductionPixTrafficApproved } = require('../dist/adapters/http/production-traffic-gate.js');

const NOW = new Date('2026-10-28T12:00:00.000Z');

function makeHarness({ gateway, readiness, environment = {}, budget: budgetOverride } = {}) {
  const repository = new MemoryOrdersPaymentsRepository();
  const calls = { reserve: 0, create: 0, simulate: 0, sent: [] };
  const budget = budgetOverride ?? {
    async reserveAction(request) {
      calls.reserve += 1;
      if (request.cost.status === 'unknown') return { status: 'blocked', reason: 'unknown_cost' };
      return { status: 'reserved', actionId: request.actionId, reservationId: 'reservation-' + request.actionId };
    },
  };
  const actualGateway = gateway ?? {
    async create(input) {
      calls.create += 1;
      return {
        providerReference: 'provider-pix-001',
        amountMinor: input.amountMinor,
        copyAndPaste: '000201-synthetic-pix',
        qrCodeBase64: 'data:image/png;base64,AAAA',
        expiresAt: '2026-10-28T13:00:00.000Z',
        devMode: input.mode === 'sandbox',
      };
    },
    async simulatePayment() { calls.simulate += 1; },
  };
  const service = new OrdersPayments({
    repository, budget, gateway: actualGateway, readiness, environment: { ABACATEPAY_ACCOUNT_ID: 'merchant-sandbox', ...environment },
    clock: () => new Date(NOW),
  });
  return { repository, service, calls };
}

function orderRequest(overrides = {}) {
  return {
    version: 'v1',
    idempotencyKey: 'order-key-001',
    customerId: 'synthetic-customer-001',
    conversationId: 'synthetic-conversation-001',
    packageId: SANDBOX_OFFER_V1.offerId,
    consent: { status: 'granted', policyVersion: 'synthetic-consent-v1', recordedAt: NOW.toISOString() },
    ...overrides,
  };
}

async function createSandboxPayment(harness, requestId = 'pix-request-001') {
  const created = await harness.service.createOrder(orderRequest());
  assert.equal(created.status, 'created');
  const payment = await harness.service.createPix({ version: 'v1', orderId: created.order.orderId, requestId, mode: 'sandbox' });
  return { order: created.order, payment };
}

function paidEvent({ eventId = 'log-event-001', externalOrderId = 'pix-request-001', paidAt = '2026-10-28T12:30:00.000Z', amountMinor = 100 } = {}) {
  return {
    eventId, eventType: 'transparent.completed', externalPaymentId: 'provider-pix-001',
    externalOrderId, accountId: 'merchant-sandbox', amountMinor, currency: 'BRL',
    paidAt, environment: 'sandbox',
  };
}

function productionApprovals() {
  return {
    PLATFORM_ENVIRONMENT: 'production',
    ABACATEPAY_ACCOUNT_ID: 'merchant-production',
    ABACATEPAY_ESTIMATED_FEE_MINOR: '10',
    PRODUCTION_PIX_COST_APPROVED: 'true',
    ORDERS_PIX_PRODUCTION_ENABLED: 'true',
    PRODUCTION_OFFER_APPROVED: 'true',
    PRODUCTION_BUDGET_RECONCILED: 'true',
    PRODUCTION_PAYMENT_RETENTION_APPROVED: 'true',
    PRODUCTION_FULFILLMENT_READY: 'true',
    PRODUCTION_PIX_ACCOUNT_VERIFIED: 'true',
    PRODUCTION_PIX_WEBHOOK_VERIFIED: 'true',
    PRODUCTION_PIX_MANUAL_TEST_VERIFIED: 'true',
    PRODUCTION_PIX_RECONCILIATION_READY: 'true',
    PRODUCTION_PRIVACY_APPROVED: 'true',
    PRODUCTION_COST_RECONCILED: 'true',
    PRODUCTION_BACKUP_RESTORE_VERIFIED: 'true',
    PRODUCTION_COST_ALERTS_60_80_95_VERIFIED: 'true',
    PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED: 'true',
    PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED: 'true',
  };
}

test('public contracts expose a synthetic-only catalog and require explicit consent', async () => {
  assert.equal(SANDBOX_OFFER_V1.productionOffer, false);
  assert.equal(SANDBOX_OFFER_V1.environment, 'sandbox');
  assert.equal(isCreateOrderRequestV1(orderRequest()), true);
  assert.equal(isCreateOrderRequestV1({ ...orderRequest(), consent: undefined }), false);
  const harness = makeHarness();
  assert.equal((await harness.service.createOrder(orderRequest({ consent: { ...orderRequest().consent, status: 'revoked' } }))).reason,
    'consent_required');
});

test('order idempotency returns the same order, conflicts on changed input, and allows one open order', async () => {
  const harness = makeHarness();
  const first = await harness.service.createOrder(orderRequest());
  const replay = await harness.service.createOrder(orderRequest());
  assert.equal(replay.status, 'already_created');
  assert.equal(replay.order.orderId, first.order.orderId);

  const changed = await harness.service.createOrder(orderRequest({ customerId: 'synthetic-other-customer' }));
  assert.deepEqual(changed, { version: 'v1', status: 'conflict', reason: 'idempotency_key_reused' });

  const secondPending = await harness.service.createOrder(orderRequest({
    idempotencyKey: 'order-key-002',
    conversationId: 'synthetic-conversation-002',
  }));
  assert.deepEqual(secondPending, { version: 'v1', status: 'conflict', reason: 'pending_order_exists' });
});

test('sandbox tracer creates one Pix, sends only through local fake sender and authorizes fulfillment once', async () => {
  const harness = makeHarness();
  const { order, payment } = await createSandboxPayment(harness);
  assert.equal(payment.status, 'created');
  assert.equal(payment.instructions.amountMinor, 100);

  const sent = [];
  assert.equal(await harness.service.sendInstructionsLocally(order.orderId, {
    async send(message) { sent.push(message); },
  }), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].orderId, order.orderId);
  assert.equal(await harness.service.simulateSandboxPayment(order.orderId), true);
  assert.equal(harness.calls.simulate, 1);

  const confirmed = await harness.service.processProviderEvent(paidEvent());
  assert.equal(confirmed.status, 'confirmed');
  const replay = await harness.service.processProviderEvent(paidEvent());
  assert.equal(replay.status, 'already_processed');
  assert.equal((await harness.service.readFulfillmentAuthorization(order.orderId)).authorizationId, 'fulfillment:' + order.orderId);
  assert.equal(await harness.service.consumeFulfillmentAuthorization(order.orderId, 'epic6-worker'), 'consumed');
  assert.equal(await harness.service.consumeFulfillmentAuthorization(order.orderId, 'epic6-worker'), 'already_consumed');
  assert.equal(await harness.service.consumeFulfillmentAuthorization(order.orderId, 'other-worker'), 'conflict');

  const newProviderEvent = await harness.service.processProviderEvent(paidEvent({ eventId: 'log-replayed-new-id' }));
  assert.deepEqual(newProviderEvent, { status: 'exception', reason: 'duplicate_payment' });
  assert.equal(harness.repository.authorizations.size, 1);
});

test('provider timeout is recorded as uncertain and never creates a second charge on replay', async () => {
  const harness = makeHarness({
    gateway: {
      async create() { harness.calls.create += 1; throw new Error('timeout'); },
      async simulatePayment() {},
    },
  });
  const created = await harness.service.createOrder(orderRequest());
  const request = { version: 'v1', orderId: created.order.orderId, requestId: 'pix-timeout-001', mode: 'sandbox' };
  const first = await harness.service.createPix(request);
  const replay = await harness.service.createPix(request);
  assert.equal(first.status, 'reconciliation_required');
  assert.equal(first.reason, 'provider_timeout');
  assert.equal(replay.status, 'reconciliation_required');
  assert.equal(harness.calls.create, 1);
});

test('provider configuration is checked before readiness, Budget, or payment attempt writes', async () => {
  let readinessReservations = 0;
  const harness = makeHarness({
    environment: productionApprovals(),
    readiness: {
      async reserve() { readinessReservations += 1; return { version: 'v1', status: 'blocked', reason: 'unknown' }; },
      async consume() { throw new Error('not reached'); },
      async release() { throw new Error('not reached'); },
    },
    gateway: {
      isConfigured() { return false; },
      async create() { harness.calls.create += 1; throw new Error('must not call provider'); },
      async simulatePayment() {},
    },
  });
  const order = {
    version: 'v1', orderId: 'prod-order-unconfigured', customerId: 'synthetic-customer',
    conversationId: 'synthetic-conversation', consentPolicyVersion: 'synthetic-consent-v1',
    consentRecordedAt: NOW.toISOString(), packageId: 'approved-production-offer',
    amountMinor: 100, currency: 'BRL', state: 'pending_payment', createdAt: NOW.toISOString(),
  };
  harness.repository.orders.set(order.orderId, order);
  const result = await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-unconfigured', mode: 'production',
  });
  assert.deepEqual(result, { version: 'v1', status: 'blocked', reason: 'provider_not_configured' });
  assert.equal(readinessReservations, 0);
  assert.equal(harness.calls.reserve, 0);
  assert.equal(harness.calls.create, 0);
  assert.equal(harness.repository.attempts.size, 0);

  const missingAccount = makeHarness({ environment: { ABACATEPAY_ACCOUNT_ID: '' } });
  const created = await missingAccount.service.createOrder(orderRequest());
  const blocked = await missingAccount.service.createPix({
    version: 'v1', orderId: created.order.orderId, requestId: 'pix-no-account', mode: 'sandbox',
  });
  assert.equal(blocked.reason, 'provider_not_configured');
  assert.equal(missingAccount.calls.reserve, 0);
  assert.equal(missingAccount.repository.attempts.size, 0);
});

test('authorized reconciliation confirms one matching payment and is idempotent', async () => {
  const harness = makeHarness();
  const { order } = await createSandboxPayment(harness, 'pix-reconcile-confirm');
  await harness.service.processProviderEvent(paidEvent({
    eventId: 'log-reconcile-mismatch', externalOrderId: 'pix-reconcile-confirm', amountMinor: 101,
  }));
  const request = {
    version: 'v1', orderId: order.orderId, reconciliationId: 'reconcile-confirm-001',
    operatorId: 'synthetic-operator-001', evidenceRef: 'case-evidence-001',
    decision: 'confirm_paid', providerTerminal: true, reconciliationComplete: true,
    payment: {
      externalOrderId: 'pix-reconcile-confirm', providerReference: 'provider-pix-001',
      accountId: 'merchant-sandbox', amountMinor: 100, currency: 'BRL', environment: 'sandbox',
      paidAt: '2026-10-28T12:30:00.000Z', expiresAt: '2026-10-28T13:00:00.000Z',
    },
  };
  const confirmed = await harness.service.reconcilePayment(request);
  assert.deepEqual(confirmed, {
    status: 'confirmed', orderId: order.orderId, authorizationId: 'fulfillment:' + order.orderId,
  });
  assert.equal((await harness.service.reconcilePayment(request)).status, 'already_reconciled');
  assert.deepEqual(await harness.service.reconcilePayment({
    ...request, evidenceRef: 'different-evidence-ref',
  }), { status: 'conflict', reason: 'reconciliation_id_reused' });
  await assert.rejects(harness.service.reconcilePayment({ ...request, secret: 'must-not-be-stored' }),
    /invalid_payment_reconciliation_request/);
  assert.equal((await harness.service.readFulfillmentAuthorization(order.orderId)).authorizationId,
    'fulfillment:' + order.orderId);
  assert.equal(harness.repository.authorizations.size, 1);
});

test('unmatched provider events are quarantined, inspectable, and closable without fulfillment', async () => {
  const harness = makeHarness();
  const event = {
    eventId: 'orphan-event-001', eventType: 'transparent.completed',
    externalPaymentId: 'orphan-provider-payment-001', externalOrderId: 'orphan-external-order-001',
    accountId: 'merchant-sandbox', amountMinor: 100, currency: 'BRL',
    paidAt: null, environment: 'sandbox',
  };
  assert.deepEqual(await harness.service.processProviderEvent(event), {
    status: 'exception', reason: 'order_missing',
  });
  const open = await harness.service.listUnmatchedProviderEvents();
  assert.equal(open.length, 1);
  assert.equal(open[0].eventId, event.eventId);
  assert.equal(open[0].externalOrderId, event.externalOrderId);
  assert.equal('rawBody' in open[0], false);

  const request = {
    version: 'v1', eventId: event.eventId, reconciliationId: 'orphan-reconcile-001',
    operatorId: 'synthetic-operator-001', evidenceRef: 'provider-query-001',
    providerTerminal: true, reconciliationComplete: true, providerOutcome: 'unpaid',
    payment: {
      externalPaymentId: event.externalPaymentId, externalOrderId: event.externalOrderId,
      accountId: event.accountId, amountMinor: event.amountMinor, currency: event.currency,
      paidAt: null, environment: event.environment,
    },
  };
  assert.deepEqual(await harness.service.reconcileUnmatchedProviderEvent({
    ...request, payment: { ...request.payment, amountMinor: 101 },
  }), { status: 'blocked', reason: 'evidence_mismatch' });
  assert.deepEqual(await harness.service.reconcileUnmatchedProviderEvent(request), {
    status: 'closed', eventId: event.eventId, reconciliationId: request.reconciliationId,
  });
  assert.equal((await harness.service.listUnmatchedProviderEvents()).length, 0);
  assert.equal((await harness.service.reconcileUnmatchedProviderEvent(request)).status, 'already_reconciled');
  assert.equal(harness.repository.authorizations.size, 0);
});

test('unpaid terminal reconciliation releases production readiness once and closes the order', async () => {
  const released = [];
  const readiness = {
    async reserve(request) {
      return { version: 'v1', status: 'reserved', reservationId: 'portrait-reservation-close', orderId: request.orderId, packageId: request.packageId };
    },
    async consume() { throw new Error('unpaid payment must not consume readiness'); },
    async release(request) {
      released.push(request);
      return { version: 'v1', status: 'released' };
    },
  };
  const harness = makeHarness({ environment: productionApprovals(), readiness });
  const order = {
    version: 'v1', orderId: 'prod-order-close', customerId: 'synthetic-customer',
    conversationId: 'synthetic-conversation', consentPolicyVersion: 'synthetic-consent-v1',
    consentRecordedAt: NOW.toISOString(), packageId: 'approved-production-offer',
    amountMinor: 100, currency: 'BRL', state: 'pending_payment', createdAt: NOW.toISOString(),
  };
  harness.repository.orders.set(order.orderId, order);
  const created = await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-close', mode: 'production',
  });
  assert.equal(created.status, 'created');
  const request = {
    version: 'v1', orderId: order.orderId, reconciliationId: 'reconcile-close-001',
    operatorId: 'synthetic-operator-001', evidenceRef: 'case-unpaid-001',
    decision: 'close_unpaid', providerTerminal: true, reconciliationComplete: true,
    externalOrderId: 'prod-pix-close', providerReference: 'provider-pix-001', providerOutcome: 'unpaid',
  };
  assert.deepEqual(await harness.service.reconcilePayment(request), { status: 'closed', orderId: order.orderId });
  assert.equal(released.length, 1);
  assert.equal(released[0].providerTerminal, true);
  assert.equal(released[0].reconciliationComplete, true);
  assert.equal((await harness.repository.findOrder(order.orderId)).state, 'cancelled');
  assert.equal((await harness.service.reconcilePayment(request)).status, 'already_reconciled');
  assert.equal(released.length, 1);
  assert.deepEqual(await harness.service.reconcilePayment({
    ...request, reconciliationId: 'reconcile-close-002',
  }), { status: 'conflict', reason: 'already_resolved' });
  assert.deepEqual(await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-close', mode: 'production',
  }), { version: 'v1', status: 'blocked', reason: 'order_not_payable' });
});

test('missing or late provider timestamps and mismatched amount stay in exception', async () => {
  const missing = makeHarness();
  const a = await createSandboxPayment(missing, 'pix-missing-timestamp');
  const missingResult = await missing.service.processProviderEvent(paidEvent({
    externalOrderId: 'pix-missing-timestamp', paidAt: null,
  }));
  assert.deepEqual(missingResult, { status: 'exception', reason: 'paid_at_untrusted' });
  assert.equal(await missing.service.readFulfillmentAuthorization(a.order.orderId), null);
  assert.equal((await missing.service.createPix({
    version: 'v1', orderId: a.order.orderId, requestId: 'pix-missing-timestamp', mode: 'sandbox',
  })).status, 'reconciliation_required');
  assert.deepEqual(await missing.service.createOrder(orderRequest({
    idempotencyKey: 'order-after-payment-exception',
    conversationId: 'synthetic-conversation-after-exception',
  })), { version: 'v1', status: 'conflict', reason: 'pending_order_exists' });

  const late = makeHarness();
  const b = await createSandboxPayment(late, 'pix-late-timestamp');
  const lateResult = await late.service.processProviderEvent(paidEvent({
    eventId: 'log-late', externalOrderId: 'pix-late-timestamp', paidAt: '2026-10-28T13:00:00.001Z',
  }));
  assert.deepEqual(lateResult, { status: 'exception', reason: 'payment_late' });
  assert.equal(await late.service.readFulfillmentAuthorization(b.order.orderId), null);

  const mismatched = makeHarness();
  const c = await createSandboxPayment(mismatched, 'pix-mismatch');
  const mismatchResult = await mismatched.service.processProviderEvent(paidEvent({
    eventId: 'log-mismatch', externalOrderId: 'pix-mismatch', amountMinor: 101,
  }));
  assert.deepEqual(mismatchResult, { status: 'exception', reason: 'payment_mismatch' });
  assert.equal(await mismatched.service.readFulfillmentAuthorization(c.order.orderId), null);
});

test('production blocks the sandbox offer before readiness, Budget, or provider calls', async () => {
  const harness = makeHarness({
    environment: {
      PLATFORM_ENVIRONMENT: 'production',
      ORDERS_PIX_PRODUCTION_ENABLED: 'true',
      PRODUCTION_OFFER_APPROVED: 'true',
      PRODUCTION_BUDGET_RECONCILED: 'true',
      PRODUCTION_PAYMENT_RETENTION_APPROVED: 'true',
      PRODUCTION_FULFILLMENT_READY: 'true',
      PRODUCTION_PIX_ACCOUNT_VERIFIED: 'true',
      PRODUCTION_PIX_WEBHOOK_VERIFIED: 'true',
      PRODUCTION_PIX_MANUAL_TEST_VERIFIED: 'true',
      PRODUCTION_PIX_RECONCILIATION_READY: 'true',
      PRODUCTION_PRIVACY_APPROVED: 'true',
      PRODUCTION_COST_RECONCILED: 'true',
      PRODUCTION_BACKUP_RESTORE_VERIFIED: 'true',
      PRODUCTION_COST_ALERTS_60_80_95_VERIFIED: 'true',
      PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED: 'true',
      PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED: 'true',
    },
    readiness: { async reserve() { throw new Error('must not reserve for a sandbox offer'); } },
  });
  const created = await harness.service.createOrder(orderRequest());
  const blocked = await harness.service.createPix({
    version: 'v1', orderId: created.order.orderId, requestId: 'pix-prod-001', mode: 'production',
  });
  assert.deepEqual(blocked, { version: 'v1', status: 'blocked', reason: 'production_gate_closed' });
  assert.equal(harness.calls.create, 0);
  assert.equal(harness.calls.reserve, 0);
});

test('portrait readiness denial blocks provider after the Budget reservation', async () => {
  const approvals = {
    PLATFORM_ENVIRONMENT: 'production',
    ABACATEPAY_ESTIMATED_FEE_MINOR: '10',
    PRODUCTION_PIX_COST_APPROVED: 'true',
    ORDERS_PIX_PRODUCTION_ENABLED: 'true',
    PRODUCTION_OFFER_APPROVED: 'true',
    PRODUCTION_BUDGET_RECONCILED: 'true',
    PRODUCTION_PAYMENT_RETENTION_APPROVED: 'true',
    PRODUCTION_FULFILLMENT_READY: 'true',
    PRODUCTION_PIX_ACCOUNT_VERIFIED: 'true',
    PRODUCTION_PIX_WEBHOOK_VERIFIED: 'true',
    PRODUCTION_PIX_MANUAL_TEST_VERIFIED: 'true',
    PRODUCTION_PIX_RECONCILIATION_READY: 'true',
    PRODUCTION_PRIVACY_APPROVED: 'true',
    PRODUCTION_COST_RECONCILED: 'true',
    PRODUCTION_BACKUP_RESTORE_VERIFIED: 'true',
    PRODUCTION_COST_ALERTS_60_80_95_VERIFIED: 'true',
    PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED: 'true',
    PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED: 'true',
    ABACATEPAY_ACCOUNT_ID: 'merchant-production',
  };
  const harness = makeHarness({
    environment: approvals,
    readiness: { async reserve() { return { version: 'v1', status: 'blocked', reason: 'unknown' }; } },
  });
  const order = {
    version: 'v1', orderId: 'prod-order-001', customerId: 'customer', conversationId: 'conversation',
    consentPolicyVersion: 'synthetic-approved-v1', consentRecordedAt: NOW.toISOString(), packageId: 'approved-production-five', amountMinor: 100,
    currency: 'BRL', state: 'pending_payment', createdAt: NOW.toISOString(),
  };
  harness.repository.orders.set(order.orderId, order);
  const result = await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-001', mode: 'production',
  });
  assert.deepEqual(result, { version: 'v1', status: 'blocked', reason: 'portrait_readiness_blocked' });
  assert.equal(harness.calls.reserve, 1);
  assert.equal(harness.calls.create, 0);
  assert.equal(harness.repository.attempts.size, 0);
});

test('Budget denial never creates a portrait readiness reservation or payment attempt', async () => {
  let budgetCalls = 0;
  let readinessCalls = 0;
  const harness = makeHarness({
    environment: productionApprovals(),
    budget: {
      async reserveAction(request) {
        budgetCalls += 1;
        return { version: 'v1', actionId: request.actionId, status: 'blocked', reason: 'unknown_cost' };
      },
    },
    readiness: {
      async reserve() {
        readinessCalls += 1;
        return { version: 'v1', status: 'reserved', reservationId: 'must-not-be-reserved', orderId: 'prod-order-budget-block', packageId: 'approved-production-offer' };
      },
      async consume() { throw new Error('not reached'); },
      async release() { throw new Error('not reached'); },
    },
  });
  const order = {
    version: 'v1', orderId: 'prod-order-budget-block', customerId: 'synthetic-customer',
    conversationId: 'synthetic-conversation', consentPolicyVersion: 'synthetic-consent-v1',
    consentRecordedAt: NOW.toISOString(), packageId: 'approved-production-offer',
    amountMinor: 100, currency: 'BRL', state: 'pending_payment', createdAt: NOW.toISOString(),
  };
  harness.repository.orders.set(order.orderId, order);
  const result = await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-budget-block', mode: 'production',
  });
  assert.equal(result.reason, 'budget_blocked');
  assert.equal(budgetCalls, 1);
  assert.equal(readinessCalls, 0);
  assert.equal(harness.repository.attempts.size, 0);
  assert.equal(harness.calls.create, 0);
});

test('webhook arriving before the create response gets a retry and is not marked processed', async () => {
  const harness = makeHarness();
  const created = await harness.service.createOrder(orderRequest());
  await harness.repository.beginPayment({
    orderId: created.order.orderId,
    paymentId: 'payment-creating-001',
    requestId: 'pix-creating-001',
    externalOrderId: 'pix-creating-001',
    mode: 'sandbox',
    accountId: 'merchant-sandbox',
    readinessReservationId: null,
    occurredAt: NOW.toISOString(),
  });
  const event = paidEvent({ eventId: 'log-early', externalOrderId: 'pix-creating-001' });
  const result = await harness.service.processProviderEvent(event);
  assert.deepEqual(result, { status: 'retry', reason: 'payment_attempt_incomplete' });
  assert.equal(harness.repository.events.has(event.eventId), false);
});

test('production webhook consumes readiness only after all payment fields match', async () => {
  const approvals = {
    PLATFORM_ENVIRONMENT: 'production',
    ABACATEPAY_ACCOUNT_ID: 'merchant-production',
    ABACATEPAY_ESTIMATED_FEE_MINOR: '10',
    PRODUCTION_PIX_COST_APPROVED: 'true',
    ORDERS_PIX_PRODUCTION_ENABLED: 'true',
    PRODUCTION_OFFER_APPROVED: 'true',
    PRODUCTION_BUDGET_RECONCILED: 'true',
    PRODUCTION_PAYMENT_RETENTION_APPROVED: 'true',
    PRODUCTION_FULFILLMENT_READY: 'true',
    PRODUCTION_PIX_ACCOUNT_VERIFIED: 'true',
    PRODUCTION_PIX_WEBHOOK_VERIFIED: 'true',
    PRODUCTION_PIX_MANUAL_TEST_VERIFIED: 'true',
    PRODUCTION_PIX_RECONCILIATION_READY: 'true',
    PRODUCTION_PRIVACY_APPROVED: 'true',
    PRODUCTION_COST_RECONCILED: 'true',
    PRODUCTION_BACKUP_RESTORE_VERIFIED: 'true',
    PRODUCTION_COST_ALERTS_60_80_95_VERIFIED: 'true',
    PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED: 'true',
    PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED: 'true',
  };
  const consumed = [];
  const readiness = {
    async reserve(request) {
      return {
        version: 'v1', status: 'reserved', reservationId: 'portrait-reservation-001',
        orderId: request.orderId, packageId: request.packageId,
      };
    },
    async consume(request) {
      consumed.push(request);
      return { version: 'v1', status: 'consumed' };
    },
    async release() { throw new Error('expiry or webhook processing must not release readiness'); },
  };
  const harness = makeHarness({
    environment: approvals,
    readiness,
    gateway: {
      async create(input) {
        harness.calls.create += 1;
        return {
          providerReference: 'provider-pix-001', amountMinor: input.amountMinor,
          copyAndPaste: 'pix-copy', qrCodeBase64: 'data:image/png;base64,AAAA',
          expiresAt: '2026-10-28T13:00:00.000Z', devMode: false,
        };
      },
      async simulatePayment() { throw new Error('production has no simulator'); },
    },
  });
  const order = {
    version: 'v1', orderId: 'prod-order-ready-001', customerId: 'synthetic-customer',
    conversationId: 'synthetic-conversation', consentPolicyVersion: 'synthetic-consent-v1',
    consentRecordedAt: NOW.toISOString(), packageId: 'approved-production-offer',
    amountMinor: 100, currency: 'BRL', state: 'pending_payment', createdAt: NOW.toISOString(),
  };
  harness.repository.orders.set(order.orderId, order);
  const payment = await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-ready-001', mode: 'production',
  });
  assert.equal(payment.status, 'created');
  assert.equal(consumed.length, 0);

  const mismatch = await harness.service.processProviderEvent({
    eventId: 'log-prod-mismatch', eventType: 'transparent.completed',
    externalPaymentId: 'provider-pix-001', externalOrderId: 'prod-pix-ready-001',
    accountId: 'merchant-production', amountMinor: 101, currency: 'BRL',
    paidAt: '2026-10-28T12:30:00.000Z', environment: 'production',
  });
  assert.deepEqual(mismatch, { status: 'exception', reason: 'payment_mismatch' });
  assert.equal(consumed.length, 0);

  const nextHarness = makeHarness({ environment: approvals, readiness });
  const nextOrder = { ...order, orderId: 'prod-order-ready-002', state: 'pending_payment' };
  nextHarness.repository.orders.set(nextOrder.orderId, nextOrder);
  const nextPayment = await nextHarness.service.createPix({
    version: 'v1', orderId: nextOrder.orderId, requestId: 'prod-pix-ready-002', mode: 'production',
  });
  assert.equal(nextPayment.status, 'created');
  const confirmed = await nextHarness.service.processProviderEvent({
    eventId: 'log-prod-paid', eventType: 'transparent.completed',
    externalPaymentId: 'provider-pix-001', externalOrderId: 'prod-pix-ready-002',
    accountId: 'merchant-production', amountMinor: 100, currency: 'BRL',
    paidAt: '2026-10-28T12:30:00.000Z', environment: 'production',
  });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(consumed.length, 1);
  assert.equal(consumed[0].reservationId, 'portrait-reservation-001');
  assert.equal(consumed[0].authorizationId, 'fulfillment:' + nextOrder.orderId);
});

test('readiness consumption can be retried after a payment transaction rollback', async () => {
  const consumed = new Set();
  let consumeCalls = 0;
  const readiness = {
    async reserve(request) {
      return { version: 'v1', status: 'reserved', reservationId: 'portrait-reservation-retry', orderId: request.orderId, packageId: request.packageId };
    },
    async consume(request) {
      consumeCalls += 1;
      const key = request.reservationId + ':' + request.authorizationId;
      if (consumed.has(key)) return { version: 'v1', status: 'already_consumed' };
      consumed.add(key);
      return { version: 'v1', status: 'consumed' };
    },
    async release() { throw new Error('not reached'); },
  };
  const harness = makeHarness({ environment: productionApprovals(), readiness });
  const order = {
    version: 'v1', orderId: 'prod-order-rollback', customerId: 'synthetic-customer',
    conversationId: 'synthetic-conversation', consentPolicyVersion: 'synthetic-consent-v1',
    consentRecordedAt: NOW.toISOString(), packageId: 'approved-production-offer',
    amountMinor: 100, currency: 'BRL', state: 'pending_payment', createdAt: NOW.toISOString(),
  };
  harness.repository.orders.set(order.orderId, order);
  await harness.service.createPix({
    version: 'v1', orderId: order.orderId, requestId: 'prod-pix-rollback', mode: 'production',
  });
  const event = {
    eventId: 'log-prod-rollback', eventType: 'transparent.completed',
    externalPaymentId: 'provider-pix-001', externalOrderId: 'prod-pix-rollback',
    accountId: 'merchant-production', amountMinor: 100, currency: 'BRL',
    paidAt: '2026-10-28T12:30:00.000Z', environment: 'production',
  };
  harness.repository.failNextProviderEventCommit = true;
  await assert.rejects(harness.service.processProviderEvent(event), /simulated_provider_event_commit_failure/);
  assert.equal(harness.repository.events.has(event.eventId), false);
  assert.equal(harness.repository.authorizations.size, 0);
  assert.equal((await harness.repository.findOrder(order.orderId)).state, 'pending_payment');

  const [confirmed, conflicting] = await Promise.all([
    harness.service.processProviderEvent(event),
    harness.service.processProviderEvent({ ...event, eventId: 'log-prod-concurrent-conflict', amountMinor: 101 }),
  ]);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(conflicting.status, 'exception');
  assert.equal(consumeCalls, 2);
  assert.equal(consumed.size, 1);
  assert.equal(harness.repository.authorizations.size, 1);
});

test('HMAC webhook authenticates raw bytes, rejects forged signature, and stores no body in handler', async () => {
  const secret = 'synthetic-webhook-secret-0123456789';
  const hmacKey = 'synthetic-hmac-key-0123456789012';
  let calls = 0;
  let received;
  const service = {
    async processProviderEvent(event) {
      calls += 1;
      received = event;
      return { status: 'ignored', reason: 'unsupported_event' };
    },
  };
  const environment = {
    ABACATEPAY_WEBHOOK_SECRET: secret,
    ABACATEPAY_WEBHOOK_HMAC_KEY: hmacKey,
    ABACATEPAY_ACCOUNT_ID: 'merchant-sandbox',
  };
  const raw = JSON.stringify({
    id: 'log-hook-001',
    event: 'transparent.completed',
    devMode: true,
    data: {
      id: 'provider-hook-001', externalId: 'pix-hook-001', amount: 100,
      currency: 'BRL', accountId: 'merchant-sandbox',
    },
  });
  const signature = createHmac('sha256', hmacKey).update(Buffer.from(raw, 'utf8')).digest('base64');
  const forged = await handleAbacatePayWebhook(new Request(
    'https://local/api/webhooks/abacatepay?webhookSecret=' + secret,
    { method: 'POST', headers: { 'x-webhook-signature': 'forged' }, body: raw },
  ), service, environment);
  assert.equal(forged.status, 401);
  assert.equal(calls, 0);

  const accepted = await handleAbacatePayWebhook(new Request(
    'https://local/api/webhooks/abacatepay?webhookSecret=' + secret,
    { method: 'POST', headers: { 'x-webhook-signature': signature }, body: raw },
  ), service, environment);
  assert.equal(accepted.status, 200);
  assert.equal(calls, 1);
  assert.equal(received.paidAt, null);
  assert.equal(received.externalOrderId, 'pix-hook-001');
});

test('signed webhook with malformed paidAt is quarantined as an untrusted timestamp exception', async () => {
  const harness = makeHarness();
  const { order } = await createSandboxPayment(harness, 'pix-invalid-paid-at');
  const environment = {
    ABACATEPAY_WEBHOOK_SECRET: 'synthetic-webhook-secret-0123456789',
    ABACATEPAY_WEBHOOK_HMAC_KEY: 'synthetic-hmac-key-0123456789012',
    ABACATEPAY_ACCOUNT_ID: 'merchant-sandbox',
  };
  const raw = JSON.stringify({
    id: 'log-invalid-paid-at', event: 'transparent.completed', devMode: true,
    data: {
      id: 'provider-pix-001', externalId: 'pix-invalid-paid-at', amount: 100,
      currency: 'BRL', accountId: 'merchant-sandbox', paidAt: 'not-a-utc-timestamp',
    },
  });
  const signature = createHmac('sha256', environment.ABACATEPAY_WEBHOOK_HMAC_KEY)
    .update(Buffer.from(raw, 'utf8')).digest('base64');
  const response = await handleAbacatePayWebhook(new Request(
    'https://local/api/webhooks/abacatepay?webhookSecret=' + environment.ABACATEPAY_WEBHOOK_SECRET,
    { method: 'POST', headers: { 'x-webhook-signature': signature }, body: raw },
  ), harness.service, environment);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.result, { status: 'exception', reason: 'paid_at_untrusted' });
  assert.equal(harness.repository.events.has('log-invalid-paid-at'), true);
  assert.equal((await harness.repository.findOrder(order.orderId)).state, 'payment_exception');
  assert.equal(await harness.service.readFulfillmentAuthorization(order.orderId), null);
});

test('webhook rejects oversized bodies before parsing or calling the payment service', async () => {
  let calls = 0;
  const service = { async processProviderEvent() { calls += 1; return { status: 'ignored', reason: 'unsupported_event' }; } };
  const environment = {
    ABACATEPAY_WEBHOOK_SECRET: 'synthetic-webhook-secret-0123456789',
    ABACATEPAY_WEBHOOK_HMAC_KEY: 'synthetic-hmac-key-0123456789012',
    ABACATEPAY_ACCOUNT_ID: 'merchant-sandbox',
  };
  const response = await handleAbacatePayWebhook(new Request(
    'https://local/api/webhooks/abacatepay?webhookSecret=' + environment.ABACATEPAY_WEBHOOK_SECRET,
    { method: 'POST', body: 'x'.repeat(64 * 1024 + 1) },
  ), service, environment);
  assert.equal(response.status, 413);
  assert.equal(calls, 0);
});

test('traffic gate allows only explicit webhook and internal paths and keeps production Pix off by default', () => {
  assert.equal(isPublicStoryPath('/api/webhooks/abacatepay', {}), true);
  assert.equal(isPublicStoryPath('/api/internal/orders', {}), true);
  assert.equal(isPublicStoryPath('/api/internal/orders/00000000-0000-4000-8000-000000000001/reconcile', {}), true);
  assert.equal(isPublicStoryPath('/api/internal/orders/unmatched-events', {}), true);
  assert.equal(isPublicStoryPath('/api/internal/orders/reconcile-unmatched', {}), true);
  assert.equal(isPublicStoryPath('/api/internal/orders/not-a-uuid/pix', {}), false);
  assert.equal(isPublicStoryPath('/api/internal/orders/00000000-0000-4000-8000-000000000001/debug', {}), false);
  assert.equal(isProductionPixApproved({}), false);
  assert.equal(isProductionPixTrafficApproved({}), false);
});

test('reconciliation route requires internal auth and remains hidden in production', async () => {
  const previous = {
    platform: process.env.PLATFORM_ENVIRONMENT,
    staging: process.env.STAGING_SMOKE_SECRET,
    production: process.env.PRODUCTION_SMOKE_SECRET,
  };
  const requestBody = {
    version: 'v1', orderId: 'route-order-001', reconciliationId: 'route-reconciliation-001',
    operatorId: 'synthetic-operator-001', evidenceRef: 'route-evidence-001',
    decision: 'close_unpaid', providerTerminal: true, reconciliationComplete: true,
    externalOrderId: 'route-pix-001', providerReference: null, providerOutcome: 'unpaid',
  };
  const service = { async reconcilePayment() { return { status: 'closed', orderId: requestBody.orderId }; } };
  try {
    process.env.PLATFORM_ENVIRONMENT = 'staging';
    process.env.STAGING_SMOKE_SECRET = 's'.repeat(40);
    const body = JSON.stringify(requestBody);
    const unauthorized = await handleReconcilePaymentRequest(new Request('https://local/reconcile', {
      method: 'POST', body,
    }), requestBody.orderId, service);
    assert.equal(unauthorized.status, 401);
    const authorized = await handleReconcilePaymentRequest(new Request('https://local/reconcile', {
      method: 'POST', body, headers: { authorization: 'Bearer ' + process.env.STAGING_SMOKE_SECRET },
    }), requestBody.orderId, service);
    assert.equal(authorized.status, 200);

    process.env.PLATFORM_ENVIRONMENT = 'production';
    process.env.PRODUCTION_SMOKE_SECRET = 'p'.repeat(40);
    const hidden = await handleReconcilePaymentRequest(new Request('https://local/reconcile', {
      method: 'POST', body, headers: { authorization: 'Bearer ' + process.env.PRODUCTION_SMOKE_SECRET },
    }), requestBody.orderId, service);
    assert.equal(hidden.status, 404);
  } finally {
    if (previous.platform === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.platform;
    if (previous.staging === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.staging;
    if (previous.production === undefined) delete process.env.PRODUCTION_SMOKE_SECRET;
    else process.env.PRODUCTION_SMOKE_SECRET = previous.production;
  }
});

test('unmatched event queue and closure routes require staging auth and stay hidden in production', async () => {
  const previous = {
    platform: process.env.PLATFORM_ENVIRONMENT,
    staging: process.env.STAGING_SMOKE_SECRET,
    production: process.env.PRODUCTION_SMOKE_SECRET,
  };
  const secret = 'staging-orphan-ops-secret-0123456789';
  const orphanRequest = {
    version: 'v1', eventId: 'route-orphan-event-001', reconciliationId: 'route-orphan-reconcile-001',
    operatorId: 'synthetic-operator-001', evidenceRef: 'route-provider-query-001',
    providerTerminal: true, reconciliationComplete: true, providerOutcome: 'unpaid',
    payment: {
      externalPaymentId: 'route-provider-payment-001', externalOrderId: 'route-external-order-001',
      accountId: 'merchant-sandbox', amountMinor: 100, currency: 'BRL', paidAt: null, environment: 'sandbox',
    },
  };
  const service = {
    async listUnmatchedProviderEvents() { return []; },
    async reconcileUnmatchedProviderEvent() {
      return { status: 'closed', eventId: orphanRequest.eventId, reconciliationId: orphanRequest.reconciliationId };
    },
  };
  try {
    process.env.PLATFORM_ENVIRONMENT = 'staging';
    process.env.STAGING_SMOKE_SECRET = secret;
    assert.equal((await handleListUnmatchedProviderEventsRequest(
      new Request('https://local/api/internal/orders/unmatched-events'), service,
    )).status, 401);
    const headers = { authorization: 'Bearer ' + secret };
    assert.equal((await handleListUnmatchedProviderEventsRequest(
      new Request('https://local/api/internal/orders/unmatched-events', { headers }), service,
    )).status, 200);
    assert.equal((await handleReconcileUnmatchedProviderEventRequest(new Request(
      'https://local/api/internal/orders/reconcile-unmatched', {
        method: 'POST', headers, body: JSON.stringify(orphanRequest),
      },
    ), service)).status, 200);

    process.env.PLATFORM_ENVIRONMENT = 'production';
    process.env.PRODUCTION_SMOKE_SECRET = 'production-orphan-ops-secret-012345';
    const productionHeaders = { authorization: 'Bearer ' + process.env.PRODUCTION_SMOKE_SECRET };
    assert.equal((await handleListUnmatchedProviderEventsRequest(
      new Request('https://local/api/internal/orders/unmatched-events', { headers: productionHeaders }), service,
    )).status, 404);
    assert.equal((await handleReconcileUnmatchedProviderEventRequest(new Request(
      'https://local/api/internal/orders/reconcile-unmatched', {
        method: 'POST', headers: productionHeaders, body: JSON.stringify(orphanRequest),
      },
    ), service)).status, 404);
  } finally {
    if (previous.platform === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.platform;
    if (previous.staging === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.staging;
    if (previous.production === undefined) delete process.env.PRODUCTION_SMOKE_SECRET;
    else process.env.PRODUCTION_SMOKE_SECRET = previous.production;
  }
});

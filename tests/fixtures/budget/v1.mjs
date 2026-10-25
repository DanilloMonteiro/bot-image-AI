const knownPlatformUsage = {
  version: 'v1',
  resource: 'execution',
  metric: 'image_generation_count',
  quantity: 1,
  unit: 'image',
  period: { from: '2026-10-25', to: '2026-10-26' },
  origin: 'provider_telemetry',
  cost: { amountMinor: 25, currency: 'USD' },
};

const unknownPlatformUsage = {
  version: 'v1',
  resource: 'hosting',
  metric: 'service_hours',
  quantity: 24,
  unit: 'hour',
  period: { from: '2026-10-25', to: '2026-10-26' },
  origin: 'application_observation',
};

const reserveKnown = {
  version: 'v1',
  actionId: 'synthetic-action-001',
  category: 'ai',
  cost: { status: 'known', amountMinor: 25, currency: 'BRL' },
  attemptLimit: 2,
};

const reserveUnknown = {
  version: 'v1',
  actionId: 'synthetic-action-002',
  category: 'railway',
  cost: { status: 'unknown', reason: 'provider_cost_not_reconciled' },
  attemptLimit: 1,
};

const workerUnknownCostRequest = {
  version: 'v1',
  actionId: 'synthetic-worker-action-unknown-001',
  category: 'ai',
  cost: { status: 'unknown', reason: 'worker_cost_not_reconciled' },
  attemptLimit: 1,
};

const firstReservation = {
  version: 'v1',
  actionId: 'synthetic-action-001',
  status: 'reserved',
  reservationId: 'reservation-001',
};

const repeatedReservation = {
  version: 'v1',
  actionId: 'synthetic-action-001',
  status: 'already_reserved',
  reservationId: 'reservation-001',
};

const unknownAmount = { status: 'unknown', reason: 'awaiting_manual_reconciliation' };
const knownZero = { status: 'known', amountMinor: 0, currency: 'BRL' };

const readSnapshot = {
  version: 'v1',
  generatedAt: '2026-10-25T15:00:00.000Z',
  total: {
    cap: { status: 'known', amountMinor: 50000, currency: 'BRL' },
    incurred: knownZero,
    committed: knownZero,
    reserved: unknownAmount,
    unbilled: unknownAmount,
    available: unknownAmount,
  },
  categories: [
    {
      category: 'ai',
      cap: { status: 'known', amountMinor: 11000, currency: 'BRL' },
      incurred: knownZero,
      committed: knownZero,
      reserved: unknownAmount,
      unbilled: unknownAmount,
      available: unknownAmount,
    },
  ],
};

const unknownCostSignal = {
  version: 'v1',
  signalId: 'signal-001',
  kind: 'unknown_cost',
  source: 'usage',
  sourceId: 'usage-001',
  reason: 'provider_cost_not_reconciled',
  attempts: 0,
  status: 'open',
  occurredAt: '2026-10-25T15:01:00.000Z',
};

export const BUDGET_CONTRACT_FIXTURES_V1 = Object.freeze({
  application: Object.freeze({
    knownPlatformUsage,
    unknownPlatformUsage,
    reserveKnown,
    reserveUnknown,
  }),
  worker: Object.freeze({
    reserveKnown,
    unknownCostRequest: workerUnknownCostRequest,
    firstReservation,
    repeatedReservation,
  }),
  consumer: Object.freeze({
    readSnapshot,
    unknownCostSignal,
  }),
});

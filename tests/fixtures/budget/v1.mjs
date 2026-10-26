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
const budgetCaps = {
  advertising: 22_000,
  ai: 11_000,
  railway: 6_500,
  domain_accessories: 2_500,
  meta_pix_fx_retries: 8_000,
};
const alertThresholds = [60, 80, 95];

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
  categories: Object.entries(budgetCaps).map(([category, capMinor]) => ({
    category,
    cap: { status: 'known', amountMinor: capMinor, currency: 'BRL' },
    incurred: knownZero,
    committed: knownZero,
    reserved: unknownAmount,
    unbilled: unknownAmount,
    available: unknownAmount,
  })),
  alerts: [
    ...alertThresholds.map((thresholdPercent) => ({ scope: 'total', thresholdPercent, status: 'unknown' })),
    ...Object.keys(budgetCaps).flatMap((category) => alertThresholds.map((thresholdPercent) => ({
      scope: 'category', category, thresholdPercent, status: 'unknown',
    }))),
  ],
  blockers: [
    { kind: 'balance_unknown', scope: 'total', reason: 'awaiting_manual_reconciliation' },
    ...Object.keys(budgetCaps).map((category) => ({
      kind: 'balance_unknown', scope: 'category', category, reason: 'awaiting_manual_reconciliation',
    })),
  ],
  illustrativeEconomics: {
    status: 'hypothesis',
    label: 'five_image_package',
    notAnOffer: true,
    currency: 'BRL',
    package: { imageCount: 5, priceMinor: 3_990 },
    premises: [
      { kind: 'images_and_retries', amountMinor: 750 },
      { kind: 'conversational_ai', amountMinor: 70 },
      { kind: 'whatsapp', amountMinor: 100 },
      { kind: 'pix_gateway', amountMinor: 150 },
      { kind: 'allocated_previews', amountMinor: 180 },
      { kind: 'storage_and_operations', amountMinor: 40 },
    ],
    variableCostTotalMinor: 1_290,
    contributionBeforeCacMinor: 2_700,
    cacScenarios: [
      { cacMinor: 800, contributionAfterCacMinor: 1_900 },
      { cacMinor: 1_500, contributionAfterCacMinor: 1_200 },
      { cacMinor: 2_200, contributionAfterCacMinor: 500 },
    ],
    source: { document: 'prd_addendum', section: 'Simulação econômica ilustrativa' },
  },
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

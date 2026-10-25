import type { PlatformUsageRecordV1 } from '../platform-usage/v1.js';

export const BUDGET_CONTRACT_VERSION = 'v1' as const;

export const BUDGET_CATEGORIES_V1 = [
  'advertising',
  'ai',
  'railway',
  'domain_accessories',
  'meta_pix_fx_retries',
  'synthetic_trace',
] as const;

export const BUDGET_CAPPED_CATEGORIES_V1 = [
  'advertising',
  'ai',
  'railway',
  'domain_accessories',
  'meta_pix_fx_retries',
] as const;

export type BudgetCategoryV1 = typeof BUDGET_CATEGORIES_V1[number];
export type BudgetCappedCategoryV1 = typeof BUDGET_CAPPED_CATEGORIES_V1[number];

export const BUDGET_EXPOSURE_STATES_V1 = [
  'incurred',
  'committed',
  'reserved',
  'unbilled',
] as const;
export type BudgetExposureStateV1 = typeof BUDGET_EXPOSURE_STATES_V1[number];

export const BUDGET_SIGNAL_KINDS_V1 = [
  'unknown_cost',
  'insufficient_balance',
  'limit_reached',
  'reservation_stale',
  'reconciliation_required',
] as const;

export const BUDGET_RECONCILIATION_SOURCES_V1 = ['synthetic', 'manual', 'external'] as const;
export const BUDGET_TERMINALITY_STATES_V1 = ['pending', 'unknown', 'terminal'] as const;
export const BUDGET_RECONCILIATION_EVIDENCE_KINDS_V1 = [
  'provider_terminal',
  'invoice',
  'usage_record',
  'manual_attestation',
  'fx_conversion',
  'synthetic_fixture',
] as const;
export const BUDGET_DECISION_KINDS_V1 = ['settle', 'release'] as const;

export type BudgetSignalKindV1 = typeof BUDGET_SIGNAL_KINDS_V1[number];
export type BudgetReconciliationSourceV1 = typeof BUDGET_RECONCILIATION_SOURCES_V1[number];
export type BudgetTerminalityStateV1 = typeof BUDGET_TERMINALITY_STATES_V1[number];
export type BudgetReconciliationEvidenceKindV1 = typeof BUDGET_RECONCILIATION_EVIDENCE_KINDS_V1[number];
export type BudgetDecisionKindV1 = typeof BUDGET_DECISION_KINDS_V1[number];

export type BudgetCostV1 =
  | { status: 'known'; amountMinor: number; currency: string }
  | { status: 'unknown'; reason: string };

/** Amounts in snapshots are BRL minor units; unknown stays distinct from zero. */
export type BudgetAmountV1 =
  | { status: 'known'; amountMinor: number; currency: 'BRL' }
  | { status: 'unknown'; reason: string };

export type BudgetReservationRequestV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  actionId: string;
  category: BudgetCappedCategoryV1;
  cost: BudgetCostV1;
  attemptLimit: number;
};

export type BudgetReservationResultV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  actionId: string;
} & (
  | { status: 'reserved' | 'already_reserved'; reservationId: string }
  | {
    status: 'blocked';
    reason: 'unknown_cost' | 'balance_unknown' | 'insufficient_balance' | 'category_limit' | 'budget_paused';
  }
);

export type BudgetExposureV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  entryId: string;
  actionId: string;
  category: BudgetCappedCategoryV1;
  state: BudgetExposureStateV1;
  amountMinor: number;
  currency: 'BRL';
  occurredAt: string;
};

export type BudgetCategoryBalanceV1 = {
  category: BudgetCappedCategoryV1;
} & BudgetBalanceV1;

export type BudgetBalanceV1 = {
  cap: BudgetAmountV1;
  incurred: BudgetAmountV1;
  committed: BudgetAmountV1;
  reserved: BudgetAmountV1;
  unbilled: BudgetAmountV1;
  available: BudgetAmountV1;
};

export type BudgetReadSnapshotV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  generatedAt: string;
  total: BudgetBalanceV1;
  categories: BudgetCategoryBalanceV1[];
};

export type BudgetSignalV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  signalId: string;
  kind: BudgetSignalKindV1;
  source: 'reservation' | 'usage' | 'reconciliation' | 'system';
  sourceId: string;
  reason: string;
  attempts: number;
  status: 'open' | 'acknowledged' | 'resolved';
  occurredAt: string;
};

/** References to evidence records only; never store customer content or provider secrets here. */
export type BudgetReconciliationEvidenceV1 = {
  evidenceId: string;
  kind: BudgetReconciliationEvidenceKindV1;
  sourceId: string;
  recordedAt: string;
};

/** Conversion ratio is expressed from source minor units to BRL minor units. */
export type BudgetFxConversionV1 = {
  sourceAmountMinor: number;
  sourceCurrency: string;
  rateNumerator: number;
  rateDenominator: number;
  evidenceId: string;
};

export type BudgetReconciledCostV1 =
  | { status: 'unknown'; reason: string }
  | {
    status: 'known';
    amountMinor: number;
    currency: 'BRL';
    billingState: 'incurred' | 'unbilled';
    conversion?: BudgetFxConversionV1;
  };

export type BudgetReconciliationV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  reconciliationId: string;
  actionId: string;
  source: BudgetReconciliationSourceV1;
  terminality: BudgetTerminalityStateV1;
  cost: BudgetReconciledCostV1;
  evidence: BudgetReconciliationEvidenceV1[];
  occurredAt: string;
};

export type BudgetReconciliationWriteResultV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  reconciliationId: string;
  status: 'recorded' | 'already_recorded';
};

export type BudgetOpeningBalanceEvidenceV1 = {
  evidenceId: string;
  sourceId: string;
  recordedAt: string;
};

export type BudgetOpeningBalanceReconciliationV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  reconciliationId: string;
  category: BudgetCappedCategoryV1;
  status: 'pending' | 'complete';
  amounts: Record<BudgetExposureStateV1, BudgetAmountV1>;
  evidence: Record<BudgetExposureStateV1, BudgetOpeningBalanceEvidenceV1[]>;
  actorId: string;
  reason: string;
  occurredAt: string;
};

export type BudgetOpeningBalanceWriteResultV1 =
  | {
    version: typeof BUDGET_CONTRACT_VERSION;
    reconciliationId: string;
    status: 'recorded' | 'already_recorded';
    balanceStatus: 'pending' | 'known';
  }
  | {
    version: typeof BUDGET_CONTRACT_VERSION;
    reconciliationId: string;
    status: 'blocked';
    reason: 'unauthorized';
  };

export type BudgetReservationDecisionRequestV1 = {
  version: typeof BUDGET_CONTRACT_VERSION;
  decisionId: string;
  actionId: string;
  reconciliationId: string;
  decision: BudgetDecisionKindV1;
  actorId: string;
  reason: string;
};

export const BUDGET_DECISION_BLOCK_REASONS_V1 = [
  'unauthorized',
  'reservation_missing',
  'reservation_not_active',
  'reconciliation_missing',
  'reconciliation_mismatch',
  'reconciliation_not_terminal',
  'unknown_cost',
  'release_requires_zero_cost',
  'settlement_requires_positive_cost',
  'exposure_exceeds_reconciled_cost',
] as const;
export type BudgetDecisionBlockReasonV1 = typeof BUDGET_DECISION_BLOCK_REASONS_V1[number];

export type BudgetReservationDecisionResultV1 =
  | {
    version: typeof BUDGET_CONTRACT_VERSION;
    decisionId: string;
    actionId: string;
    status: 'settled';
    reservationId: string;
    reconciliationId: string;
    amountMinor: number;
    state: 'incurred' | 'unbilled';
    actorId: string;
    reason: string;
    decidedAt: string;
  }
  | {
    version: typeof BUDGET_CONTRACT_VERSION;
    decisionId: string;
    actionId: string;
    status: 'released';
    reservationId: string;
    reconciliationId: string;
    amountMinor: 0;
    actorId: string;
    reason: string;
    decidedAt: string;
  }
  | {
    version: typeof BUDGET_CONTRACT_VERSION;
    decisionId: string;
    actionId: string;
    status: 'blocked';
    reason: BudgetDecisionBlockReasonV1;
  };

export type BudgetReservationDecisionWriteResultV1 = BudgetReservationDecisionResultV1;

const CAPPED_CATEGORY_SET = new Set<string>(BUDGET_CAPPED_CATEGORIES_V1);
const SIGNAL_KIND_SET = new Set<string>(BUDGET_SIGNAL_KINDS_V1);
const CURRENCY_PATTERN = /^[A-Z]{3}(?![\s\S])/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function hasOwnKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return required.every((key) => Object.hasOwn(value, key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value);
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !value.endsWith('Z')) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isKnownAmount(value: Record<string, unknown>): boolean {
  return value.status === 'known'
    && typeof value.amountMinor === 'number'
    && Number.isSafeInteger(value.amountMinor)
    && value.amountMinor >= 0
    && value.currency === 'BRL';
}

function isUnknownAmount(value: Record<string, unknown>): boolean {
  return value.status === 'unknown'
    && hasOnlyKeys(value, ['status', 'reason'])
    && hasOwnKeys(value, ['status', 'reason'])
    && isNonEmptyString(value.reason);
}

function isBudgetAmount(value: unknown): value is BudgetAmountV1 {
  if (!isObject(value)) return false;
  if (value.status === 'known') {
    return hasOnlyKeys(value, ['status', 'amountMinor', 'currency'])
      && hasOwnKeys(value, ['status', 'amountMinor', 'currency'])
      && isKnownAmount(value);
  }
  return isUnknownAmount(value);
}

function isBudgetCost(value: unknown): value is BudgetCostV1 {
  if (!isObject(value) || !hasOnlyKeys(value, ['status', 'amountMinor', 'currency', 'reason'])) return false;
  if (value.status === 'unknown') {
    return hasOnlyKeys(value, ['status', 'reason'])
      && hasOwnKeys(value, ['status', 'reason'])
      && isNonEmptyString(value.reason);
  }
  return value.status === 'known'
    && hasOnlyKeys(value, ['status', 'amountMinor', 'currency'])
    && hasOwnKeys(value, ['status', 'amountMinor', 'currency'])
    && typeof value.amountMinor === 'number'
    && Number.isSafeInteger(value.amountMinor)
    && value.amountMinor >= 0
    && typeof value.currency === 'string'
    && CURRENCY_PATTERN.test(value.currency);
}

function isCategoryBalance(value: unknown): value is BudgetCategoryBalanceV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, ['category', 'cap', 'incurred', 'committed', 'reserved', 'unbilled', 'available'])
    || !hasOwnKeys(value, ['category', 'cap', 'incurred', 'committed', 'reserved', 'unbilled', 'available'])) {
    return false;
  }

  return typeof value.category === 'string'
    && CAPPED_CATEGORY_SET.has(value.category)
    && isBudgetAmount(value.cap)
    && isBudgetAmount(value.incurred)
    && isBudgetAmount(value.committed)
    && isBudgetAmount(value.reserved)
    && isBudgetAmount(value.unbilled)
    && isBudgetAmount(value.available);
}

export function isBudgetReservationRequestV1(value: unknown): value is BudgetReservationRequestV1 {
  return isObject(value)
    && hasOnlyKeys(value, ['version', 'actionId', 'category', 'cost', 'attemptLimit'])
    && hasOwnKeys(value, ['version', 'actionId', 'category', 'cost', 'attemptLimit'])
    && value.version === BUDGET_CONTRACT_VERSION
    && isIdentifier(value.actionId)
    && typeof value.category === 'string'
    && CAPPED_CATEGORY_SET.has(value.category)
    && isBudgetCost(value.cost)
    && typeof value.attemptLimit === 'number'
    && Number.isSafeInteger(value.attemptLimit)
    && value.attemptLimit > 0;
}

export function isBudgetReservationResultV1(value: unknown): value is BudgetReservationResultV1 {
  if (!isObject(value)
    || value.version !== BUDGET_CONTRACT_VERSION
    || !isIdentifier(value.actionId)
    || !isNonEmptyString(value.status)) return false;

  if (value.status === 'reserved' || value.status === 'already_reserved') {
    return hasOnlyKeys(value, ['version', 'actionId', 'status', 'reservationId'])
      && hasOwnKeys(value, ['version', 'actionId', 'status', 'reservationId'])
      && isIdentifier(value.reservationId);
  }

  return value.status === 'blocked'
    && hasOnlyKeys(value, ['version', 'actionId', 'status', 'reason'])
    && hasOwnKeys(value, ['version', 'actionId', 'status', 'reason'])
    && ['unknown_cost', 'balance_unknown', 'insufficient_balance', 'category_limit', 'budget_paused']
      .includes(String(value.reason));
}

export function isBudgetExposureV1(value: unknown): value is BudgetExposureV1 {
  return isObject(value)
    && hasOnlyKeys(value, [
      'version', 'entryId', 'actionId', 'category', 'state', 'amountMinor', 'currency', 'occurredAt',
    ])
    && hasOwnKeys(value, [
      'version', 'entryId', 'actionId', 'category', 'state', 'amountMinor', 'currency', 'occurredAt',
    ])
    && value.version === BUDGET_CONTRACT_VERSION
    && isIdentifier(value.entryId)
    && isIdentifier(value.actionId)
    && typeof value.category === 'string'
    && BUDGET_CAPPED_CATEGORIES_V1.includes(value.category as BudgetCappedCategoryV1)
    && typeof value.state === 'string'
    && BUDGET_EXPOSURE_STATES_V1.includes(value.state as BudgetExposureStateV1)
    && typeof value.amountMinor === 'number'
    && Number.isSafeInteger(value.amountMinor)
    && value.amountMinor >= 0
    && value.currency === 'BRL'
    && isUtcTimestamp(value.occurredAt);
}

export function isBudgetReadSnapshotV1(value: unknown): value is BudgetReadSnapshotV1 {
  return isObject(value)
    && hasOnlyKeys(value, ['version', 'generatedAt', 'total', 'categories'])
    && hasOwnKeys(value, ['version', 'generatedAt', 'total', 'categories'])
    && value.version === BUDGET_CONTRACT_VERSION
    && isUtcTimestamp(value.generatedAt)
    && isBudgetBalance(value.total)
    && Array.isArray(value.categories)
    && value.categories.every(isCategoryBalance)
    && new Set(value.categories.map((item) => (item as BudgetCategoryBalanceV1).category)).size === value.categories.length;
}

function isBudgetBalance(value: unknown): value is BudgetBalanceV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, ['cap', 'incurred', 'committed', 'reserved', 'unbilled', 'available'])
    || !hasOwnKeys(value, ['cap', 'incurred', 'committed', 'reserved', 'unbilled', 'available'])) {
    return false;
  }
  return isBudgetAmount(value.cap)
    && isBudgetAmount(value.incurred)
    && isBudgetAmount(value.committed)
    && isBudgetAmount(value.reserved)
    && isBudgetAmount(value.unbilled)
    && isBudgetAmount(value.available);
}

/** Map a validated usage record without treating an omitted cost as zero. */
export function toBudgetCostV1(record: PlatformUsageRecordV1): BudgetCostV1 {
  if (record.cost === undefined) {
    return { status: 'unknown', reason: 'platform_usage_cost_not_reported' };
  }
  return {
    status: 'known',
    amountMinor: record.cost.amountMinor,
    currency: record.cost.currency,
  };
}

export function isBudgetSignalV1(value: unknown): value is BudgetSignalV1 {
  return isObject(value)
    && hasOnlyKeys(value, [
      'version', 'signalId', 'kind', 'source', 'sourceId', 'reason', 'attempts', 'status', 'occurredAt',
    ])
    && hasOwnKeys(value, [
      'version', 'signalId', 'kind', 'source', 'sourceId', 'reason', 'attempts', 'status', 'occurredAt',
    ])
    && value.version === BUDGET_CONTRACT_VERSION
    && isIdentifier(value.signalId)
    && typeof value.kind === 'string'
    && SIGNAL_KIND_SET.has(value.kind)
    && ['reservation', 'usage', 'reconciliation', 'system'].includes(String(value.source))
    && isIdentifier(value.sourceId)
    && isNonEmptyString(value.reason)
    && typeof value.attempts === 'number'
    && Number.isSafeInteger(value.attempts)
    && value.attempts >= 0
    && ['open', 'acknowledged', 'resolved'].includes(String(value.status))
    && isUtcTimestamp(value.occurredAt);
}

function isBudgetReconciliationEvidence(value: unknown): value is BudgetReconciliationEvidenceV1 {
  return isObject(value)
    && hasOnlyKeys(value, ['evidenceId', 'kind', 'sourceId', 'recordedAt'])
    && hasOwnKeys(value, ['evidenceId', 'kind', 'sourceId', 'recordedAt'])
    && isIdentifier(value.evidenceId)
    && typeof value.kind === 'string'
    && BUDGET_RECONCILIATION_EVIDENCE_KINDS_V1.includes(value.kind as BudgetReconciliationEvidenceKindV1)
    && isIdentifier(value.sourceId)
    && isUtcTimestamp(value.recordedAt);
}

function isFxConversion(value: unknown, amountMinor: number, evidence: BudgetReconciliationEvidenceV1[]): boolean {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'sourceAmountMinor', 'sourceCurrency', 'rateNumerator', 'rateDenominator', 'evidenceId',
    ])
    || !hasOwnKeys(value, [
      'sourceAmountMinor', 'sourceCurrency', 'rateNumerator', 'rateDenominator', 'evidenceId',
    ])
    || typeof value.sourceAmountMinor !== 'number'
    || !Number.isSafeInteger(value.sourceAmountMinor)
    || value.sourceAmountMinor < 0
    || typeof value.sourceCurrency !== 'string'
    || !CURRENCY_PATTERN.test(value.sourceCurrency)
    || value.sourceCurrency === 'BRL'
    || typeof value.rateNumerator !== 'number'
    || !Number.isSafeInteger(value.rateNumerator)
    || value.rateNumerator <= 0
    || typeof value.rateDenominator !== 'number'
    || !Number.isSafeInteger(value.rateDenominator)
    || value.rateDenominator <= 0
    || !isIdentifier(value.evidenceId)
    || !evidence.some((item) => item.evidenceId === value.evidenceId && item.kind === 'fx_conversion')) {
    return false;
  }

  const numerator = BigInt(value.sourceAmountMinor) * BigInt(value.rateNumerator);
  const denominator = BigInt(value.rateDenominator);
  const roundedBrlMinor = (numerator + denominator / 2n) / denominator;
  return roundedBrlMinor === BigInt(amountMinor);
}

function hasKnownCostEvidence(
  source: BudgetReconciliationSourceV1,
  evidence: BudgetReconciliationEvidenceV1[],
): boolean {
  if (source === 'external') {
    return evidence.some((item) => item.kind === 'invoice' || item.kind === 'usage_record');
  }
  if (source === 'manual') return evidence.some((item) => item.kind === 'manual_attestation');
  return evidence.some((item) => item.kind === 'synthetic_fixture');
}

function hasTerminalEvidence(
  source: BudgetReconciliationSourceV1,
  evidence: BudgetReconciliationEvidenceV1[],
): boolean {
  if (source === 'external') return evidence.some((item) => item.kind === 'provider_terminal');
  if (source === 'manual') return evidence.some((item) => item.kind === 'manual_attestation');
  return evidence.some((item) => item.kind === 'synthetic_fixture');
}

export function isBudgetReconciliationV1(value: unknown): value is BudgetReconciliationV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'version', 'reconciliationId', 'actionId', 'source', 'terminality', 'cost', 'evidence', 'occurredAt',
    ])
    || !hasOwnKeys(value, [
      'version', 'reconciliationId', 'actionId', 'source', 'terminality', 'cost', 'evidence', 'occurredAt',
    ])
    || value.version !== BUDGET_CONTRACT_VERSION
    || !isIdentifier(value.reconciliationId)
    || !isIdentifier(value.actionId)
    || typeof value.source !== 'string'
    || !BUDGET_RECONCILIATION_SOURCES_V1.includes(value.source as BudgetReconciliationSourceV1)
    || typeof value.terminality !== 'string'
    || !BUDGET_TERMINALITY_STATES_V1.includes(value.terminality as BudgetTerminalityStateV1)
    || !Array.isArray(value.evidence)
    || !value.evidence.every(isBudgetReconciliationEvidence)
    || new Set(value.evidence.map((item) => (item as BudgetReconciliationEvidenceV1).evidenceId)).size !== value.evidence.length
    || !isUtcTimestamp(value.occurredAt)) {
    return false;
  }

  const source = value.source as BudgetReconciliationSourceV1;
  const evidence = value.evidence as BudgetReconciliationEvidenceV1[];
  if (value.terminality === 'terminal' && !hasTerminalEvidence(source, evidence)) return false;

  const cost = value.cost;
  if (!isObject(cost)) return false;
  if (cost.status === 'unknown') {
    return hasOnlyKeys(cost, ['status', 'reason'])
      && hasOwnKeys(cost, ['status', 'reason'])
      && isNonEmptyString(cost.reason);
  }
  if (cost.status !== 'known'
    || !hasOnlyKeys(cost, ['status', 'amountMinor', 'currency', 'billingState', 'conversion'])
    || !hasOwnKeys(cost, ['status', 'amountMinor', 'currency', 'billingState'])
    || typeof cost.amountMinor !== 'number'
    || !Number.isSafeInteger(cost.amountMinor)
    || cost.amountMinor < 0
    || cost.currency !== 'BRL'
    || !['incurred', 'unbilled'].includes(String(cost.billingState))
    || !hasKnownCostEvidence(source, evidence)) {
    return false;
  }

  if (Object.hasOwn(cost, 'conversion')) {
    return isFxConversion(cost.conversion, cost.amountMinor, evidence);
  }
  return true;
}

function isOpeningBalanceEvidence(value: unknown): value is BudgetOpeningBalanceEvidenceV1 {
  return isObject(value)
    && hasOnlyKeys(value, ['evidenceId', 'sourceId', 'recordedAt'])
    && hasOwnKeys(value, ['evidenceId', 'sourceId', 'recordedAt'])
    && isIdentifier(value.evidenceId)
    && isIdentifier(value.sourceId)
    && isUtcTimestamp(value.recordedAt);
}

export function isBudgetOpeningBalanceReconciliationV1(
  value: unknown,
): value is BudgetOpeningBalanceReconciliationV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'version', 'reconciliationId', 'category', 'status', 'amounts', 'evidence', 'actorId', 'reason', 'occurredAt',
    ])
    || !hasOwnKeys(value, [
      'version', 'reconciliationId', 'category', 'status', 'amounts', 'evidence', 'actorId', 'reason', 'occurredAt',
    ])
    || value.version !== BUDGET_CONTRACT_VERSION
    || !isIdentifier(value.reconciliationId)
    || typeof value.category !== 'string'
    || !CAPPED_CATEGORY_SET.has(value.category)
    || !['pending', 'complete'].includes(String(value.status))
    || !isIdentifier(value.actorId)
    || !isNonEmptyString(value.reason)
    || value.reason.length > 500
    || !isUtcTimestamp(value.occurredAt)) {
    return false;
  }

  const amounts = value.amounts;
  const evidence = value.evidence;
  if (!isObject(amounts)
    || !hasOnlyKeys(amounts, BUDGET_EXPOSURE_STATES_V1)
    || !hasOwnKeys(amounts, BUDGET_EXPOSURE_STATES_V1)
    || !BUDGET_EXPOSURE_STATES_V1.every((state) => isBudgetAmount(amounts[state]))
    || !isObject(evidence)
    || !hasOnlyKeys(evidence, BUDGET_EXPOSURE_STATES_V1)
    || !hasOwnKeys(evidence, BUDGET_EXPOSURE_STATES_V1)) return false;

  for (const state of BUDGET_EXPOSURE_STATES_V1) {
    const stateEvidence = evidence[state];
    if (!Array.isArray(stateEvidence) || !stateEvidence.every(isOpeningBalanceEvidence)) return false;
    if (new Set(stateEvidence.map((item) => (item as BudgetOpeningBalanceEvidenceV1).evidenceId)).size
      !== stateEvidence.length) return false;
  }

  if (value.status === 'complete') {
    return BUDGET_EXPOSURE_STATES_V1.every((state) => (
      (amounts[state] as BudgetAmountV1).status === 'known'
      && (evidence[state] as BudgetOpeningBalanceEvidenceV1[]).length > 0
    ));
  }
  return true;
}

export function isBudgetReservationDecisionRequestV1(
  value: unknown,
): value is BudgetReservationDecisionRequestV1 {
  return isObject(value)
    && hasOnlyKeys(value, [
      'version', 'decisionId', 'actionId', 'reconciliationId', 'decision', 'actorId', 'reason',
    ])
    && hasOwnKeys(value, [
      'version', 'decisionId', 'actionId', 'reconciliationId', 'decision', 'actorId', 'reason',
    ])
    && value.version === BUDGET_CONTRACT_VERSION
    && isIdentifier(value.decisionId)
    && isIdentifier(value.actionId)
    && isIdentifier(value.reconciliationId)
    && typeof value.decision === 'string'
    && BUDGET_DECISION_KINDS_V1.includes(value.decision as BudgetDecisionKindV1)
    && isIdentifier(value.actorId)
    && isNonEmptyString(value.reason)
    && value.reason.length <= 500;
}

export function isBudgetReservationDecisionResultV1(
  value: unknown,
): value is BudgetReservationDecisionResultV1 {
  if (!isObject(value)
    || value.version !== BUDGET_CONTRACT_VERSION
    || !isIdentifier(value.decisionId)
    || !isIdentifier(value.actionId)) return false;

  if (value.status === 'blocked') {
    return hasOnlyKeys(value, ['version', 'decisionId', 'actionId', 'status', 'reason'])
      && hasOwnKeys(value, ['version', 'decisionId', 'actionId', 'status', 'reason'])
      && typeof value.reason === 'string'
      && BUDGET_DECISION_BLOCK_REASONS_V1.includes(value.reason as BudgetDecisionBlockReasonV1);
  }

  const commonKeys = [
    'version', 'decisionId', 'actionId', 'status', 'reservationId', 'reconciliationId',
    'amountMinor', 'actorId', 'reason', 'decidedAt',
  ];
  const amountMinor = value.amountMinor;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor < 0) return false;
  const commonValid = isNonEmptyString(value.reservationId)
    && isIdentifier(value.reconciliationId)
    && isIdentifier(value.actorId)
    && isNonEmptyString(value.reason)
    && isUtcTimestamp(value.decidedAt);

  if (value.status === 'settled') {
    return hasOnlyKeys(value, [...commonKeys, 'state'])
      && hasOwnKeys(value, [...commonKeys, 'state'])
      && commonValid
      && amountMinor > 0
      && ['incurred', 'unbilled'].includes(String(value.state));
  }
  if (value.status === 'released') {
    return hasOnlyKeys(value, commonKeys)
      && hasOwnKeys(value, commonKeys)
      && commonValid
      && amountMinor === 0;
  }
  return false;
}

export function isBudgetReconciliationWriteResultV1(value: unknown): value is BudgetReconciliationWriteResultV1 {
  return isObject(value)
    && hasOnlyKeys(value, ['version', 'reconciliationId', 'status'])
    && hasOwnKeys(value, ['version', 'reconciliationId', 'status'])
    && value.version === BUDGET_CONTRACT_VERSION
    && isIdentifier(value.reconciliationId)
    && ['recorded', 'already_recorded'].includes(String(value.status));
}

export function isBudgetOpeningBalanceWriteResultV1(value: unknown): value is BudgetOpeningBalanceWriteResultV1 {
  if (!isObject(value)
    || value.version !== BUDGET_CONTRACT_VERSION
    || !isIdentifier(value.reconciliationId)) return false;

  if (value.status === 'blocked') {
    return hasOnlyKeys(value, ['version', 'reconciliationId', 'status', 'reason'])
      && hasOwnKeys(value, ['version', 'reconciliationId', 'status', 'reason'])
      && value.reason === 'unauthorized';
  }
  return hasOnlyKeys(value, ['version', 'reconciliationId', 'status', 'balanceStatus'])
    && hasOwnKeys(value, ['version', 'reconciliationId', 'status', 'balanceStatus'])
    && ['recorded', 'already_recorded'].includes(String(value.status))
    && ['pending', 'known'].includes(String(value.balanceStatus));
}


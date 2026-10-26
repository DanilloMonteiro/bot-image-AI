import {
  BUDGET_ALERT_THRESHOLDS_V1,
  BUDGET_CAPPED_CATEGORIES_V1,
  BUDGET_ILLUSTRATIVE_ECONOMICS_V1,
  isBudgetLedgerSnapshotV1,
  isBudgetSignalV1,
  type BudgetAmountV1,
  type BudgetBalanceV1,
  type BudgetCappedCategoryV1,
  type BudgetLedgerSnapshotV1,
  type BudgetReadSnapshotV1,
  type BudgetSignalV1,
  type BudgetSnapshotBlockerV1,
  type BudgetThresholdAlertV1,
} from '../../contracts/budget/v1';

const EXPOSURE_KEYS = ['incurred', 'committed', 'reserved', 'unbilled'] as const;

type SnapshotScope =
  | { scope: 'total'; balance: BudgetBalanceV1 }
  | { scope: 'category'; category: BudgetCappedCategoryV1; balance: BudgetBalanceV1 };

type KnownExposure = { status: 'known'; capMinor: number; exposureMinor: number };
type UnknownExposure = { status: 'unknown'; reason: string };

/** Builds the Operations view without changing the ledger snapshot it receives. */
export function projectBudgetSnapshot(
  base: BudgetLedgerSnapshotV1,
  signals: BudgetSignalV1[] = [],
): BudgetReadSnapshotV1 {
  if (!isBudgetLedgerSnapshotV1(base)) throw new Error('invalid_budget_ledger_snapshot');
  if (!signals.every((signal) => isBudgetSignalV1(signal))) throw new Error('invalid_budget_signal');
  const activeSignals = signals.filter((signal) => signal.status !== 'resolved');
  if (new Set(activeSignals.map((signal) => signal.signalId)).size !== activeSignals.length) {
    throw new Error('duplicate_budget_signal');
  }

  const scopes: SnapshotScope[] = [
    { scope: 'total', balance: base.total },
    ...BUDGET_CAPPED_CATEGORIES_V1.map((category) => {
      const balance = base.categories.find((item) => item.category === category);
      if (!balance) throw new Error('budget_category_snapshot_missing');
      return { scope: 'category' as const, category, balance };
    }),
  ];

  const alerts: BudgetThresholdAlertV1[] = [];
  const blockers: BudgetSnapshotBlockerV1[] = [];
  for (const item of scopes) {
    const exposure = exposureFor(item.balance);
    if (exposure.status === 'unknown') {
      const blocker: BudgetSnapshotBlockerV1 = item.scope === 'total'
        ? { kind: 'balance_unknown', scope: 'total', reason: exposure.reason }
        : { kind: 'balance_unknown', scope: 'category', category: item.category, reason: exposure.reason };
      blockers.push(blocker);
      for (const thresholdPercent of BUDGET_ALERT_THRESHOLDS_V1) {
        alerts.push(item.scope === 'total'
          ? { scope: 'total', thresholdPercent, status: 'unknown' }
          : { scope: 'category', category: item.category, thresholdPercent, status: 'unknown' });
      }
      continue;
    }

    for (const thresholdPercent of BUDGET_ALERT_THRESHOLDS_V1) {
      const status = BigInt(exposure.exposureMinor) * 100n >= BigInt(exposure.capMinor) * BigInt(thresholdPercent)
        ? 'reached'
        : 'not_reached';
      alerts.push(item.scope === 'total'
        ? { scope: 'total', thresholdPercent, status }
        : { scope: 'category', category: item.category, thresholdPercent, status });
    }

    if (exposure.exposureMinor >= exposure.capMinor) {
      blockers.push(item.scope === 'total'
        ? {
          kind: 'limit_reached', scope: 'total', reason: 'budget_cap_reached',
          exposureMinor: exposure.exposureMinor, capMinor: exposure.capMinor,
        }
        : {
          kind: 'limit_reached', scope: 'category', category: item.category,
          reason: 'budget_cap_reached', exposureMinor: exposure.exposureMinor, capMinor: exposure.capMinor,
        });
    }
  }

  const snapshot: BudgetReadSnapshotV1 = {
    ...base,
    alerts,
    blockers,
    signals: activeSignals,
    illustrativeEconomics: BUDGET_ILLUSTRATIVE_ECONOMICS_V1,
  };
  return snapshot;
}

function exposureFor(balance: BudgetBalanceV1): KnownExposure | UnknownExposure {
  const necessaryAmounts: BudgetAmountV1[] = [balance.cap, ...EXPOSURE_KEYS.map((key) => balance[key])];
  const unknown = necessaryAmounts.find((amount) => amount.status === 'unknown');
  if (unknown?.status === 'unknown') return { status: 'unknown', reason: unknown.reason };

  const cap = balance.cap;
  if (cap.status !== 'known') throw new Error('budget_cap_unavailable');
  let exposureMinor = 0;
  for (const key of EXPOSURE_KEYS) {
    const amount = balance[key];
    if (amount.status !== 'known') throw new Error('budget_exposure_unavailable');
    exposureMinor += amount.amountMinor;
    if (!Number.isSafeInteger(exposureMinor)) throw new Error('budget_exposure_overflow');
  }
  return { status: 'known', capMinor: cap.amountMinor, exposureMinor };
}

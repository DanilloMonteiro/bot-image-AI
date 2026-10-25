const EXPOSURE_STATES = ['incurred', 'committed', 'reserved', 'unbilled'];
const UNKNOWN_REASON = 'budget_sources_not_reconciled';

function unknownAmount() {
  return { status: 'unknown', reason: UNKNOWN_REASON };
}

function knownAmount(amountMinor) {
  return { status: 'known', amountMinor, currency: 'BRL' };
}

function addMinor(left, right) {
  const total = left + right;
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('budget_ledger_amount_overflow');
  return total;
}

function exposureFor(entries, category, state) {
  return entries
    .filter((entry) => entry.category === category
      && entry.state === state
      && (entry.entryKind !== 'reservation' || entry.reservationStatus === 'active'))
    .reduce((total, entry) => addMinor(total, entry.amountMinor), 0);
}

function sumExposure(amounts) {
  return EXPOSURE_STATES.reduce((total, state) => addMinor(total, amounts[state]), 0);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function blockedDecision(request, reason) {
  return {
    version: 'v1', decisionId: request.decisionId, actionId: request.actionId,
    status: 'blocked', reason,
  };
}

export function createMemoryBudgetRepository({ categories, caps, totalCap, known = false }) {
  const baselines = new Map(categories.map((category) => [category, {
    known,
    incurred: 0,
    committed: 0,
    reserved: 0,
    unbilled: 0,
  }]));
  const entries = new Map();
  const synthetic = new Map();
  const reconciliations = new Map();
  const openingReconciliations = new Map();
  const decisions = new Map();
  const decisionsByAction = new Map();
  let tail = Promise.resolve();

  function recordDecision(request, result, decidedAt) {
    decisions.set(request.decisionId, {
      request: structuredClone(request),
      result: structuredClone(result),
      audit: {
        decisionId: request.decisionId,
        actionId: request.actionId,
        reconciliationId: request.reconciliationId,
        decision: request.decision,
        actorId: request.actorId,
        reason: request.reason,
        decidedAt,
        resultStatus: result.status,
      },
    });
    if (result.status === 'settled' || result.status === 'released') {
      decisionsByAction.set(request.actionId, request.decisionId);
    }
    return structuredClone(result);
  }

  async function exclusively(operation) {
    let release;
    const previous = tail;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  function allKnown() {
    return categories.every((category) => baselines.get(category)?.known === true);
  }

  function categoryAmounts(category) {
    const baseline = baselines.get(category);
    if (!baseline?.known) return null;
    return Object.fromEntries(EXPOSURE_STATES.map((state) => [
      state,
      addMinor(baseline[state], exposureFor([...entries.values()], category, state)),
    ]));
  }

  return {
    async reserveSyntheticTrace(actionId) {
      if (!synthetic.has(actionId)) {
        synthetic.set(actionId, {
          actionId, amountMinor: 1, currency: 'BRL', category: 'synthetic_trace', status: 'reserved',
          createdAt: '2026-10-25T00:00:00.000Z',
        });
      }
      return synthetic.get(actionId);
    },
    async findSyntheticTrace(actionId) {
      return synthetic.get(actionId) ?? null;
    },
    async reserveAction(request) {
      return exclusively(async () => {
        const existing = entries.get(`reservation:${request.actionId}`);
        if (existing) {
          if (existing.category !== request.category
            || existing.unitAmountMinor !== request.cost.amountMinor
            || existing.attemptLimit !== request.attemptLimit
            || request.cost.status !== 'known'
            || request.cost.currency !== 'BRL') {
            throw new Error('budget_action_payload_conflict');
          }
          if (existing.reservationStatus !== 'active') throw new Error('budget_action_already_decided');
          return {
            version: 'v1', actionId: request.actionId, status: 'already_reserved',
            reservationId: existing.entryId,
          };
        }

        if (request.cost.status !== 'known' || request.cost.currency !== 'BRL') {
          return { version: 'v1', actionId: request.actionId, status: 'blocked', reason: 'unknown_cost' };
        }
        const amountMinor = request.cost.amountMinor * request.attemptLimit;
        if (!Number.isSafeInteger(amountMinor)) {
          return { version: 'v1', actionId: request.actionId, status: 'blocked', reason: 'unknown_cost' };
        }
        if (!allKnown()) {
          return { version: 'v1', actionId: request.actionId, status: 'blocked', reason: 'balance_unknown' };
        }

        const current = categoryAmounts(request.category);
        const categoryAvailable = caps[request.category] - sumExposure(current);
        const totalAvailable = totalCap - categories.reduce(
          (sum, category) => sum + sumExposure(categoryAmounts(category)),
          0,
        );
        if (amountMinor > categoryAvailable) {
          return { version: 'v1', actionId: request.actionId, status: 'blocked', reason: 'category_limit' };
        }
        if (amountMinor > totalAvailable) {
          return { version: 'v1', actionId: request.actionId, status: 'blocked', reason: 'insufficient_balance' };
        }

        const entryId = `reservation:${request.actionId}`;
        entries.set(entryId, {
          entryId,
          actionId: request.actionId,
          entryKind: 'reservation',
          category: request.category,
          state: 'reserved',
          amountMinor,
          unitAmountMinor: request.cost.amountMinor,
          attemptLimit: request.attemptLimit,
          reservationStatus: 'active',
          settledAmountMinor: null,
        });
        return { version: 'v1', actionId: request.actionId, status: 'reserved', reservationId: entryId };
      });
    },
    async recordExposure(exposure) {
      return exclusively(async () => {
        const existing = entries.get(exposure.entryId);
        if (existing) {
          const same = existing.entryKind === 'exposure'
            && existing.actionId === exposure.actionId
            && existing.category === exposure.category
            && existing.state === exposure.state
            && existing.amountMinor === exposure.amountMinor
            && existing.currency === exposure.currency
            && existing.occurredAt === exposure.occurredAt;
          if (!same) throw new Error('budget_exposure_payload_conflict');
          return 'already_recorded';
        }
        entries.set(exposure.entryId, {
          ...exposure,
          entryKind: 'exposure',
          unitAmountMinor: null,
          attemptLimit: null,
          reservationStatus: null,
        });
        return 'recorded';
      });
    },
    async recordReconciliation(reconciliation) {
      return exclusively(async () => {
        const existing = reconciliations.get(reconciliation.reconciliationId);
        if (existing) {
          if (stableJson(existing) !== stableJson(reconciliation)) {
            throw new Error('budget_reconciliation_payload_conflict');
          }
          return {
            version: 'v1', reconciliationId: reconciliation.reconciliationId, status: 'already_recorded',
          };
        }
        const hasReservation = [...entries.values()].some((entry) => (
          entry.entryKind === 'reservation' && entry.actionId === reconciliation.actionId
        ));
        if (!hasReservation) throw new Error('budget_reconciliation_reservation_missing');
        reconciliations.set(reconciliation.reconciliationId, structuredClone(reconciliation));
        return { version: 'v1', reconciliationId: reconciliation.reconciliationId, status: 'recorded' };
      });
    },
    async decideReservation(request) {
      return exclusively(async () => {
        const previous = decisions.get(request.decisionId);
        if (previous) {
          if (stableJson(previous.request) !== stableJson(request)) {
            throw new Error('budget_decision_payload_conflict');
          }
          return structuredClone(previous.result);
        }
        if (decisionsByAction.has(request.actionId)) throw new Error('budget_action_already_decided');

        const decidedAt = '2026-10-25T12:00:00.000Z';
        const block = (reason) => recordDecision(request, blockedDecision(request, reason), decidedAt);
        const reservation = entries.get(`reservation:${request.actionId}`);
        if (!reservation) return block('reservation_missing');
        if (reservation.reservationStatus !== 'active') return block('reservation_not_active');

        const reconciliation = reconciliations.get(request.reconciliationId);
        if (!reconciliation) return block('reconciliation_missing');
        if (reconciliation.actionId !== request.actionId) return block('reconciliation_mismatch');
        if (reconciliation.terminality !== 'terminal') {
          return block('reconciliation_not_terminal');
        }
        if (reconciliation.cost.status !== 'known') return block('unknown_cost');
        if (request.decision === 'release' && reconciliation.cost.amountMinor !== 0) {
          return block('release_requires_zero_cost');
        }
        if (request.decision === 'settle' && reconciliation.cost.amountMinor === 0) {
          return block('settlement_requires_positive_cost');
        }

        let existingExposureMinor = 0;
        const actionExposures = [...entries.values()].filter((entry) => (
          entry.entryKind === 'exposure' && entry.actionId === request.actionId
        ));
        for (const exposure of actionExposures) {
          if (exposure.category !== reservation.category) {
            throw new Error('budget_action_exposure_category_conflict');
          }
          existingExposureMinor = addMinor(existingExposureMinor, exposure.amountMinor);
        }
        if (existingExposureMinor > reconciliation.cost.amountMinor) {
          return block('exposure_exceeds_reconciled_cost');
        }

        const result = request.decision === 'settle'
          ? {
            version: 'v1',
            decisionId: request.decisionId,
            actionId: request.actionId,
            status: 'settled',
            reservationId: reservation.entryId,
            reconciliationId: request.reconciliationId,
            amountMinor: reconciliation.cost.amountMinor,
            state: reconciliation.cost.billingState,
            actorId: request.actorId,
            reason: request.reason,
            decidedAt,
          }
          : {
            version: 'v1',
            decisionId: request.decisionId,
            actionId: request.actionId,
            status: 'released',
            reservationId: reservation.entryId,
            reconciliationId: request.reconciliationId,
            amountMinor: 0,
            actorId: request.actorId,
            reason: request.reason,
            decidedAt,
          };

        reservation.reservationStatus = request.decision === 'settle' ? 'settled' : 'released';
        reservation.settledAmountMinor = request.decision === 'settle' ? reconciliation.cost.amountMinor : null;
        if (request.decision === 'settle') {
          for (const exposure of actionExposures) exposure.state = reconciliation.cost.billingState;
          const remainderMinor = reconciliation.cost.amountMinor - existingExposureMinor;
          if (remainderMinor > 0) {
            const entryId = `settlement:${request.decisionId}`;
            entries.set(entryId, {
              entryId,
              actionId: request.actionId,
              entryKind: 'exposure',
              category: reservation.category,
              state: reconciliation.cost.billingState,
              amountMinor: remainderMinor,
              currency: 'BRL',
              occurredAt: reconciliation.occurredAt,
              unitAmountMinor: null,
              attemptLimit: null,
              reservationStatus: null,
            });
          }
        }

        return recordDecision(request, result, decidedAt);
      });
    },
    async reconcileOpeningBalance(reconciliation) {
      return exclusively(async () => {
        const existing = openingReconciliations.get(reconciliation.reconciliationId);
        if (existing) {
          if (stableJson(existing.payload) !== stableJson(reconciliation)) {
            throw new Error('budget_opening_reconciliation_payload_conflict');
          }
          return {
            version: 'v1', reconciliationId: reconciliation.reconciliationId,
            status: 'already_recorded', balanceStatus: existing.balanceStatus,
          };
        }
        const baseline = baselines.get(reconciliation.category);
        if (!baseline) throw new Error('budget_opening_balance_category_missing');
        const balanceStatus = reconciliation.status === 'complete' ? 'known' : 'pending';
        if (reconciliation.status === 'complete' && baseline.known) {
          throw new Error('budget_opening_balance_already_known');
        }
        openingReconciliations.set(reconciliation.reconciliationId, {
          payload: structuredClone(reconciliation), balanceStatus,
        });
        if (reconciliation.status === 'complete') {
          for (const state of EXPOSURE_STATES) {
            baseline[state] = reconciliation.amounts[state].amountMinor;
          }
          baseline.known = true;
        }
        return {
          version: 'v1', reconciliationId: reconciliation.reconciliationId,
          status: 'recorded', balanceStatus,
        };
      });
    },
    async readBudgetSnapshot() {
      return exclusively(async () => {
        const known = allKnown();
        const categoryBalances = categories.map((category) => {
          const cap = knownAmount(caps[category]);
          const amounts = categoryAmounts(category);
          if (!amounts) {
            return {
              category, cap, incurred: unknownAmount(), committed: unknownAmount(),
              reserved: unknownAmount(), unbilled: unknownAmount(), available: unknownAmount(),
            };
          }
          return {
            category,
            cap,
            incurred: knownAmount(amounts.incurred),
            committed: knownAmount(amounts.committed),
            reserved: knownAmount(amounts.reserved),
            unbilled: knownAmount(amounts.unbilled),
            available: knownAmount(Math.max(0, caps[category] - sumExposure(amounts))),
          };
        });

        const totalAmounts = known
          ? Object.fromEntries(EXPOSURE_STATES.map((state) => [
            state,
            categories.reduce((total, category) => addMinor(
              total,
              addMinor(
                baselines.get(category)[state],
                exposureFor([...entries.values()], category, state),
              ),
            ), 0),
          ]))
          : null;
        const total = totalAmounts
          ? {
            cap: knownAmount(totalCap),
            incurred: knownAmount(totalAmounts.incurred),
            committed: knownAmount(totalAmounts.committed),
            reserved: knownAmount(totalAmounts.reserved),
            unbilled: knownAmount(totalAmounts.unbilled),
            available: knownAmount(Math.max(0, totalCap - sumExposure(totalAmounts))),
          }
          : {
            cap: knownAmount(totalCap),
            incurred: unknownAmount(),
            committed: unknownAmount(),
            reserved: unknownAmount(),
            unbilled: unknownAmount(),
            available: unknownAmount(),
          };
        return {
          version: 'v1',
          generatedAt: '2026-10-25T00:00:00.000Z',
          total,
          categories: categoryBalances,
        };
      });
    },
    async markBalancesKnownForSyntheticTest() {
      for (const baseline of baselines.values()) baseline.known = true;
    },
    getLedgerEntriesForSyntheticTest() {
      return [...entries.values()].map((entry) => structuredClone(entry));
    },
    getAuditForSyntheticTest() {
      return [...decisions.values()].map((decision) => structuredClone(decision.audit));
    },
    getReconciliationsForSyntheticTest() {
      return [...reconciliations.values()].map((reconciliation) => structuredClone(reconciliation));
    },
    getOpeningBalanceForSyntheticTest(category) {
      return structuredClone(baselines.get(category) ?? null);
    },
  };
}

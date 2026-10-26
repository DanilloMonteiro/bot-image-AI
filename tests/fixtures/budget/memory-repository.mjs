import { createHash } from 'node:crypto';

const EXPOSURE_STATES = ['incurred', 'committed', 'reserved', 'unbilled'];
const UNKNOWN_REASON = 'budget_sources_not_reconciled';
const BUDGET_SIGNAL_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

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

function signalKey(kind, source, sourceId) {
  return `${kind}\u0000${source}\u0000${sourceId}`;
}

function signalId(kind, source, sourceId) {
  const digest = createHash('sha256').update(`${kind}\u0000${source}\u0000${sourceId}`).digest('hex').slice(0, 32);
  return `signal:${digest}`;
}

function makeSignal(kind, source, sourceId, reason, occurredAt = new Date().toISOString()) {
  return {
    version: 'v1', signalId: signalId(kind, source, sourceId), kind, source, sourceId,
    reason, attempts: 0, status: 'open', occurredAt,
  };
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
  const budgetSignals = new Map();
  const signalRecoveryRequests = new Map();
  const reservationRecoveryRequests = new Map();
  const signalResumptions = new Map();
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

  function upsertSignal(signal, recoveryRequest) {
    if (recoveryRequest && (signal.source !== 'reservation' || signal.sourceId !== recoveryRequest.actionId)) {
      throw new Error('budget_signal_recovery_source_mismatch');
    }
    if (recoveryRequest) {
      const previous = reservationRecoveryRequests.get(recoveryRequest.actionId);
      if (previous && stableJson(previous) !== stableJson(recoveryRequest)) {
        throw new Error('budget_action_payload_conflict');
      }
    }
    const key = signalKey(signal.kind, signal.source, signal.sourceId);
    const existing = budgetSignals.get(key);
    const value = existing
      ? {
        ...existing,
        ...(existing.status === 'resolved'
          ? { attempts: 0, status: 'open', occurredAt: signal.occurredAt }
          : {}),
        reason: signal.reason,
      }
      : structuredClone(signal);
    budgetSignals.set(key, value);
    if (recoveryRequest) {
      reservationRecoveryRequests.set(recoveryRequest.actionId, structuredClone(recoveryRequest));
      signalRecoveryRequests.set(value.signalId, structuredClone(recoveryRequest));
    }
    return structuredClone(value);
  }

  function resolveSignalsFor(sourceId, source, excludedKinds = []) {
    for (const [key, signal] of budgetSignals) {
      if (signal.sourceId === sourceId && (!source || signal.source === source)
        && !excludedKinds.includes(signal.kind) && signal.status !== 'resolved') {
        budgetSignals.set(key, { ...signal, status: 'resolved' });
      }
    }
  }

  function blockedReservation(request, reason) {
    const kind = reason === 'unknown_cost'
      ? 'unknown_cost'
      : reason === 'category_limit'
        ? 'limit_reached'
        : reason === 'insufficient_balance'
          ? 'insufficient_balance'
          : 'reconciliation_required';
    upsertSignal(makeSignal(kind, 'reservation', request.actionId, reason), request);
    return { version: 'v1', actionId: request.actionId, status: 'blocked', reason };
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
          resolveSignalsFor(request.actionId, 'reservation', ['reservation_stale']);
          return {
            version: 'v1', actionId: request.actionId, status: 'already_reserved',
            reservationId: existing.entryId,
          };
        }

        if (request.cost.status !== 'known' || request.cost.currency !== 'BRL') {
          return blockedReservation(request, 'unknown_cost');
        }
        const amountMinor = request.cost.amountMinor * request.attemptLimit;
        if (!Number.isSafeInteger(amountMinor)) {
          return blockedReservation(request, 'unknown_cost');
        }
        if (!allKnown()) {
          return blockedReservation(request, 'balance_unknown');
        }

        const current = categoryAmounts(request.category);
        const categoryAvailable = caps[request.category] - sumExposure(current);
        const totalAvailable = totalCap - categories.reduce(
          (sum, category) => sum + sumExposure(categoryAmounts(category)),
          0,
        );
        if (amountMinor > categoryAvailable) {
          return blockedReservation(request, 'category_limit');
        }
        if (amountMinor > totalAvailable) {
          return blockedReservation(request, 'insufficient_balance');
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
          occurredAt: new Date().toISOString(),
        });
        resolveSignalsFor(request.actionId, 'reservation', ['reservation_stale']);
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
        if (reconciliation.cost.status === 'unknown') {
          upsertSignal(makeSignal(
            'unknown_cost', 'reconciliation', reconciliation.actionId, 'reconciliation_cost_unknown',
            reconciliation.occurredAt,
          ));
        } else if (reconciliation.terminality !== 'terminal') {
          upsertSignal(makeSignal(
            'reconciliation_required', 'reconciliation', reconciliation.actionId,
            'reconciliation_not_terminal', reconciliation.occurredAt,
          ));
        } else {
          for (const [key, signal] of budgetSignals) {
            if (signal.source === 'reconciliation' && signal.sourceId === reconciliation.actionId
              && signal.status === 'open') {
              budgetSignals.set(key, { ...signal, status: 'acknowledged' });
            }
          }
        }
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

        resolveSignalsFor(request.actionId);
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
    async readBudgetLedgerSnapshot() {
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
    async recordBudgetSignal(signal, recoveryRequest) {
      return exclusively(async () => upsertSignal(signal, recoveryRequest));
    },
    async listBudgetSignals() {
      return exclusively(async () => {
        const staleBefore = Date.now() - BUDGET_SIGNAL_STALE_AFTER_MS;
        for (const reservation of entries.values()) {
          if (reservation.entryKind !== 'reservation' || reservation.reservationStatus !== 'active'
            || !reservation.occurredAt || Date.parse(reservation.occurredAt) > staleBefore) continue;
          const hasReconciliation = [...reconciliations.values()].some((reconciliation) => (
            reconciliation.actionId === reservation.actionId
          ));
          if (!hasReconciliation) {
            upsertSignal(makeSignal(
              'reservation_stale', 'reservation', reservation.actionId, 'reservation_active_over_24h',
            ));
          }
        }
        return [...budgetSignals.values()]
          .filter((signal) => signal.status !== 'resolved')
          .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
          .map((signal) => structuredClone(signal));
      });
    },
    async resumeBudgetSignal(request) {
      return exclusively(async () => {
        const previous = signalResumptions.get(request.resumeId);
        if (previous) {
          if (stableJson(previous.request) !== stableJson(request)) {
            throw new Error('budget_signal_resume_payload_conflict');
          }
          return structuredClone(previous.result);
        }

        const signalEntry = [...budgetSignals.entries()].find(([, signal]) => signal.signalId === request.signalId);
        if (!signalEntry) throw new Error('budget_signal_missing');
        const [key, signal] = signalEntry;
        let result;
        if (signal.status === 'resolved') {
          result = {
            version: 'v1', resumeId: request.resumeId, signalId: request.signalId, status: 'already_resolved',
          };
        } else {
          const recoveryRequest = signalRecoveryRequests.get(signal.signalId);
          const retryable = recoveryRequest
            && ['insufficient_balance', 'limit_reached', 'reconciliation_required'].includes(signal.kind)
            && recoveryRequest.cost.status === 'known'
            && recoveryRequest.cost.currency === 'BRL';
          if (!retryable) {
            result = {
              version: 'v1', resumeId: request.resumeId, signalId: request.signalId,
              status: 'manual_action_required', reason: signal.kind,
            };
            budgetSignals.set(key, { ...signal, attempts: signal.attempts + 1, status: 'open' });
          } else {
            let reservationResult;
            const existing = entries.get(`reservation:${recoveryRequest.actionId}`);
            if (existing) {
              if (existing.category !== recoveryRequest.category
                || existing.unitAmountMinor !== recoveryRequest.cost.amountMinor
                || existing.attemptLimit !== recoveryRequest.attemptLimit) {
                throw new Error('budget_action_payload_conflict');
              }
              reservationResult = {
                version: 'v1', actionId: recoveryRequest.actionId,
                status: 'already_reserved', reservationId: existing.entryId,
              };
            } else {
              const amountMinor = recoveryRequest.cost.amountMinor * recoveryRequest.attemptLimit;
              const amounts = allKnown() ? categoryAmounts(recoveryRequest.category) : null;
              const totalAvailable = allKnown() ? totalCap - categories.reduce((sum, category) => (
                addMinor(sum, sumExposure(categoryAmounts(category)))
              ), 0) : null;
              const categoryAvailable = amounts ? caps[recoveryRequest.category] - sumExposure(amounts) : null;
              const reason = !Number.isSafeInteger(amountMinor) ? 'unknown_cost'
                : !allKnown() || totalAvailable === null || categoryAvailable === null ? 'balance_unknown'
                  : amountMinor > categoryAvailable ? 'category_limit'
                    : amountMinor > totalAvailable ? 'insufficient_balance' : null;
              if (reason) {
                reservationResult = {
                  version: 'v1', actionId: recoveryRequest.actionId, status: 'blocked', reason,
                };
              } else {
                const entryId = `reservation:${recoveryRequest.actionId}`;
                entries.set(entryId, {
                  entryId, actionId: recoveryRequest.actionId, entryKind: 'reservation',
                  category: recoveryRequest.category, state: 'reserved', amountMinor,
                  unitAmountMinor: recoveryRequest.cost.amountMinor,
                  attemptLimit: recoveryRequest.attemptLimit, reservationStatus: 'active',
                  settledAmountMinor: null, occurredAt: new Date().toISOString(),
                });
                reservationResult = {
                  version: 'v1', actionId: recoveryRequest.actionId, status: 'reserved', reservationId: entryId,
                };
              }
            }
            if (reservationResult.status === 'blocked') {
              result = {
                version: 'v1', resumeId: request.resumeId, signalId: request.signalId,
                status: 'reservation_blocked', reservation: reservationResult,
              };
              budgetSignals.set(key, {
                ...signal, attempts: signal.attempts + 1, status: 'open', reason: reservationResult.reason,
              });
            } else {
              result = {
                version: 'v1', resumeId: request.resumeId, signalId: request.signalId,
                status: 'reservation_retried', reservation: reservationResult,
              };
              budgetSignals.set(key, { ...signal, attempts: signal.attempts + 1, status: 'resolved' });
            }
          }
        }
        signalResumptions.set(request.resumeId, {
          request: structuredClone(request), result: structuredClone(result),
        });
        return structuredClone(result);
      });
    },
    async markBalancesKnownForSyntheticTest() {
      for (const baseline of baselines.values()) baseline.known = true;
    },
    setReservationOccurredAtForSyntheticTest(actionId, occurredAt) {
      const reservation = entries.get(`reservation:${actionId}`);
      if (reservation) reservation.occurredAt = occurredAt;
    },
    getSignalsForSyntheticTest() {
      return [...budgetSignals.values()].map((signal) => structuredClone(signal));
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

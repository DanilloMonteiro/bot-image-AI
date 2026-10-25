import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMemoryBudgetRepository } from './fixtures/budget/memory-repository.mjs';

const require = createRequire(import.meta.url);
const {
  BUDGET_CAPPED_CATEGORIES_V1,
  BUDGET_EXPOSURE_STATES_V1,
  isBudgetOpeningBalanceReconciliationV1,
  isBudgetReconciliationV1,
  isBudgetReservationDecisionRequestV1,
} = require('../dist/contracts/budget/v1.js');
const {
  BUDGET_CATEGORY_CAPS_MINOR_V1,
  BUDGET_TOTAL_CAP_MINOR_V1,
} = require('../dist/modules/budget/limits.js');
const { Budget } = require('../dist/modules/budget/use-cases.js');

const RECORDED_AT = '2026-10-25T12:00:00.000Z';

function knownAmount(amountMinor = 0) {
  return { status: 'known', amountMinor, currency: 'BRL' };
}

function unknownAmount(reason = 'source_pending') {
  return { status: 'unknown', reason };
}

function makeOpening(category, { status = 'complete', amounts = {}, evidenceStates } = {}) {
  const evidence = {};
  const openingAmounts = {};
  for (const state of BUDGET_EXPOSURE_STATES_V1) {
    openingAmounts[state] = amounts[state] ?? knownAmount();
    evidence[state] = (evidenceStates?.includes(state) || evidenceStates === undefined)
      ? [{
        evidenceId: `opening-${category}-${state}`,
        sourceId: `source-${category}-${state}`,
        recordedAt: RECORDED_AT,
      }]
      : [];
  }
  return {
    version: 'v1',
    reconciliationId: `opening-${category}-${status}`,
    category,
    status,
    amounts: openingAmounts,
    evidence,
    actorId: 'isaac-admin',
    reason: 'Saldo inicial revisado com evidências de origem.',
    occurredAt: RECORDED_AT,
  };
}

function makeReconciliation({
  reconciliationId,
  actionId,
  source = 'external',
  terminality = 'terminal',
  amountMinor = 0,
  billingState = 'incurred',
  costStatus = 'known',
  evidenceKinds,
} = {}) {
  const kinds = evidenceKinds ?? (source === 'external'
    ? [...(terminality === 'terminal' ? ['provider_terminal'] : []), ...(costStatus === 'known' ? ['invoice'] : [])]
    : source === 'manual'
      ? [...(terminality === 'terminal' || costStatus === 'known' ? ['manual_attestation'] : [])]
      : [...(terminality === 'terminal' || costStatus === 'known' ? ['synthetic_fixture'] : [])]);
  const evidence = kinds.map((kind, index) => ({
    evidenceId: `evidence-${reconciliationId}-${index}`,
    kind,
    sourceId: `source-${reconciliationId}-${index}`,
    recordedAt: RECORDED_AT,
  }));
  return {
    version: 'v1',
    reconciliationId,
    actionId,
    source,
    terminality,
    cost: costStatus === 'known'
      ? { status: 'known', amountMinor, currency: 'BRL', billingState }
      : { status: 'unknown', reason: 'foreign_currency_without_documented_conversion' },
    evidence,
    occurredAt: RECORDED_AT,
  };
}

function makeDecision({
  decisionId,
  actionId,
  reconciliationId,
  decision = 'settle',
  actorId = 'isaac-admin',
  reason = 'Reconciliação revisada com evidência.',
} = {}) {
  return { version: 'v1', decisionId, actionId, reconciliationId, decision, actorId, reason };
}

function makeEnvironment({ authorizeAdmin } = {}) {
  const repository = createMemoryBudgetRepository({
    categories: BUDGET_CAPPED_CATEGORIES_V1,
    caps: BUDGET_CATEGORY_CAPS_MINOR_V1,
    totalCap: BUDGET_TOTAL_CAP_MINOR_V1,
  });
  const budget = new Budget(repository, authorizeAdmin);
  return { repository, budget };
}

async function reconcileAllCategories(budget) {
  for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
    const result = await budget.reconcileOpeningBalance(makeOpening(category));
    assert.equal(result.balanceStatus, 'known');
  }
}

async function reserve(budget, actionId, amountMinor, category = 'ai') {
  return budget.reserveAction({
    version: 'v1', actionId, category,
    cost: { status: 'known', amountMinor, currency: 'BRL' },
    attemptLimit: 1,
  });
}

const authorized = (actorId) => actorId === 'isaac-admin' || actorId === 'partner-admin';

test('strict reconciliation and opening contracts require source evidence and preserve unknown balances', () => {
  const valid = makeReconciliation({ reconciliationId: 'rec-contract', actionId: 'action-contract' });
  assert.equal(isBudgetReconciliationV1(valid), true);

  const unprovenTerminal = {
    ...valid,
    evidence: [{
      evidenceId: 'manual-proof', kind: 'manual_attestation', sourceId: 'manual-source', recordedAt: RECORDED_AT,
    }],
  };
  assert.equal(isBudgetReconciliationV1(unprovenTerminal), false);

  const unconvertedCurrency = {
    ...valid,
    cost: { status: 'known', amountMinor: 10, currency: 'USD', billingState: 'incurred' },
  };
  assert.equal(isBudgetReconciliationV1(unconvertedCurrency), false);

  const convertedCurrency = makeReconciliation({
    reconciliationId: 'rec-fx-contract', actionId: 'action-fx-contract',
    amountMinor: 500, evidenceKinds: ['provider_terminal', 'invoice', 'fx_conversion'],
  });
  convertedCurrency.cost.conversion = {
    sourceAmountMinor: 100,
    sourceCurrency: 'USD',
    rateNumerator: 5,
    rateDenominator: 1,
    evidenceId: 'evidence-rec-fx-contract-2',
  };
  assert.equal(isBudgetReconciliationV1(convertedCurrency), true);
  assert.equal(isBudgetReconciliationV1({
    ...convertedCurrency,
    cost: { ...convertedCurrency.cost, amountMinor: 501 },
  }), false);

  const manual = makeReconciliation({
    reconciliationId: 'rec-manual-contract', actionId: 'action-manual-contract', source: 'manual',
  });
  assert.equal(isBudgetReconciliationV1(manual), true);

  const pendingOpening = makeOpening('ai', {
    status: 'pending',
    amounts: { incurred: knownAmount(25), committed: unknownAmount() },
    evidenceStates: ['incurred'],
  });
  assert.equal(isBudgetOpeningBalanceReconciliationV1(pendingOpening), true);
  const incompleteCompleteOpening = { ...makeOpening('ai'), evidence: pendingOpening.evidence };
  assert.equal(isBudgetOpeningBalanceReconciliationV1(incompleteCompleteOpening), false);

  assert.equal(isBudgetReservationDecisionRequestV1(makeDecision({
    decisionId: 'decision-contract', actionId: 'action-contract', reconciliationId: 'rec-contract', reason: '',
  })), false);
});

test('opening balance changes require a verified administrator', async () => {
  const { repository } = makeEnvironment();
  const opening = makeOpening('ai');
  const noVerifier = new Budget(repository);
  assert.deepEqual(await noVerifier.reconcileOpeningBalance(opening), {
    version: 'v1', reconciliationId: opening.reconciliationId, status: 'blocked', reason: 'unauthorized',
  });
  const denied = new Budget(repository, () => false);
  assert.deepEqual(await denied.reconcileOpeningBalance(opening), {
    version: 'v1', reconciliationId: opening.reconciliationId, status: 'blocked', reason: 'unauthorized',
  });
  assert.deepEqual((await noVerifier.readBudgetSnapshot()).categories.find((item) => item.category === 'ai').available,
    unknownAmount('budget_sources_not_reconciled'));

  const authorizedBudget = new Budget(repository, authorized);
  assert.equal((await authorizedBudget.reconcileOpeningBalance(opening)).balanceStatus, 'known');
});

test('pending and unknown external cost keep the reservation active', async () => {
  const { budget } = makeEnvironment({ authorizeAdmin: authorized });
  await reconcileAllCategories(budget);

  assert.equal((await reserve(budget, 'action-pending', 100)).status, 'reserved');
  const pending = makeReconciliation({
    reconciliationId: 'rec-pending', actionId: 'action-pending', terminality: 'pending',
  });
  assert.equal(isBudgetReconciliationV1(pending), true);
  await budget.recordReconciliation(pending);
  const pendingRequest = makeDecision({
    decisionId: 'decision-pending', actionId: 'action-pending', reconciliationId: 'rec-pending',
  });
  const pendingDecision = await budget.decideReservation(pendingRequest);
  assert.deepEqual(pendingDecision, {
    version: 'v1', decisionId: 'decision-pending', actionId: 'action-pending',
    status: 'blocked', reason: 'reconciliation_not_terminal',
  });
  assert.deepEqual(await budget.decideReservation(pendingRequest), pendingDecision);
  await assert.rejects(
    budget.decideReservation({ ...pendingRequest, reason: 'Altered reason.' }),
    { message: 'budget_decision_payload_conflict' },
  );

  const terminalRetry = makeReconciliation({
    reconciliationId: 'rec-pending-terminal', actionId: 'action-pending', amountMinor: 75,
  });
  await budget.recordReconciliation(terminalRetry);
  const retried = await budget.decideReservation(makeDecision({
    decisionId: 'decision-pending-retry', actionId: 'action-pending',
    reconciliationId: 'rec-pending-terminal',
  }));
  assert.equal(retried.status, 'settled');
  assert.deepEqual(await budget.decideReservation(pendingRequest), pendingDecision);

  assert.equal((await reserve(budget, 'action-unknown', 200)).status, 'reserved');
  const unknown = makeReconciliation({
    reconciliationId: 'rec-unknown', actionId: 'action-unknown', costStatus: 'unknown',
  });
  assert.equal(isBudgetReconciliationV1(unknown), true);
  await budget.recordReconciliation(unknown);
  const unknownDecision = await budget.decideReservation(makeDecision({
    decisionId: 'decision-unknown', actionId: 'action-unknown', reconciliationId: 'rec-unknown',
  }));
  assert.equal(unknownDecision.status, 'blocked');
  assert.equal(unknownDecision.reason, 'unknown_cost');

  const snapshot = await budget.readBudgetSnapshot();
  assert.deepEqual(snapshot.categories.find((item) => item.category === 'ai').reserved, {
    status: 'known', amountMinor: 200, currency: 'BRL',
  });
});

test('terminal confirmed cost settles once, transfers full actual cost, and audits the administrator', async () => {
  const { repository, budget } = makeEnvironment({ authorizeAdmin: authorized });
  await reconcileAllCategories(budget);
  assert.equal((await reserve(budget, 'action-overrun', 500)).status, 'reserved');

  const reconciliation = makeReconciliation({
    reconciliationId: 'rec-overrun', actionId: 'action-overrun', amountMinor: 650,
  });
  assert.deepEqual(await budget.recordReconciliation(reconciliation), {
    version: 'v1', reconciliationId: 'rec-overrun', status: 'recorded',
  });
  assert.deepEqual(await budget.recordReconciliation(reconciliation), {
    version: 'v1', reconciliationId: 'rec-overrun', status: 'already_recorded',
  });
  await assert.rejects(
    budget.recordReconciliation({ ...reconciliation, cost: { ...reconciliation.cost, amountMinor: 651 } }),
    { message: 'budget_reconciliation_payload_conflict' },
  );

  const request = makeDecision({
    decisionId: 'decision-overrun', actionId: 'action-overrun', reconciliationId: 'rec-overrun',
  });
  const first = await budget.decideReservation(request);
  assert.equal(first.status, 'settled');
  assert.equal(first.amountMinor, 650);
  assert.equal(first.state, 'incurred');
  assert.equal(first.actorId, 'isaac-admin');
  assert.equal(first.reason, request.reason);
  assert.deepEqual(await budget.decideReservation(request), first);
  assert.equal(repository.getAuditForSyntheticTest().length, 1);
  assert.deepEqual(repository.getAuditForSyntheticTest()[0], {
    decisionId: 'decision-overrun',
    actionId: 'action-overrun',
    reconciliationId: 'rec-overrun',
    decision: 'settle',
    actorId: 'isaac-admin',
    reason: request.reason,
    decidedAt: RECORDED_AT,
    resultStatus: 'settled',
  });

  await assert.rejects(
    budget.decideReservation({ ...request, actorId: 'partner-admin' }),
    { message: 'budget_decision_payload_conflict' },
  );
  await assert.rejects(
    budget.decideReservation({ ...request, reason: 'Motivo alterado.' }),
    { message: 'budget_decision_payload_conflict' },
  );

  const ai = (await budget.readBudgetSnapshot()).categories.find((item) => item.category === 'ai');
  assert.deepEqual(ai.reserved, knownAmount(0));
  assert.deepEqual(ai.incurred, knownAmount(650));
  assert.deepEqual(ai.available, knownAmount(10_350));
  assert.equal((await reserve(budget, 'action-after-overrun', 10_351)).reason, 'category_limit');
});

test('settlement consolidates partial action exposure and blocks when it exceeds the final cost', async () => {
  const { repository, budget } = makeEnvironment({ authorizeAdmin: authorized });
  await reconcileAllCategories(budget);

  assert.equal((await reserve(budget, 'action-partial-exposure', 500)).status, 'reserved');
  await budget.recordExposure({
    version: 'v1',
    entryId: 'partial-usage-record',
    actionId: 'action-partial-exposure',
    category: 'ai',
    state: 'incurred',
    amountMinor: 200,
    currency: 'BRL',
    occurredAt: RECORDED_AT,
  });
  const finalUsage = makeReconciliation({
    reconciliationId: 'rec-partial-exposure',
    actionId: 'action-partial-exposure',
    amountMinor: 650,
    billingState: 'unbilled',
  });
  await budget.recordReconciliation(finalUsage);
  const settled = await budget.decideReservation(makeDecision({
    decisionId: 'decision-partial-exposure',
    actionId: 'action-partial-exposure',
    reconciliationId: finalUsage.reconciliationId,
  }));
  assert.equal(settled.status, 'settled');
  assert.equal(settled.amountMinor, 650);

  const partialEntries = repository.getLedgerEntriesForSyntheticTest()
    .filter((entry) => entry.actionId === 'action-partial-exposure' && entry.entryKind === 'exposure');
  assert.deepEqual(partialEntries.map(({ state, amountMinor }) => ({ state, amountMinor })), [
    { state: 'unbilled', amountMinor: 200 },
    { state: 'unbilled', amountMinor: 450 },
  ]);

  assert.equal((await reserve(budget, 'action-exposure-over-final', 100)).status, 'reserved');
  await budget.recordExposure({
    version: 'v1',
    entryId: 'usage-exceeds-final',
    actionId: 'action-exposure-over-final',
    category: 'ai',
    state: 'committed',
    amountMinor: 150,
    currency: 'BRL',
    occurredAt: RECORDED_AT,
  });
  const lowerFinalCost = makeReconciliation({
    reconciliationId: 'rec-exposure-over-final',
    actionId: 'action-exposure-over-final',
    amountMinor: 100,
  });
  await budget.recordReconciliation(lowerFinalCost);
  const blockedRequest = makeDecision({
    decisionId: 'decision-exposure-over-final',
    actionId: 'action-exposure-over-final',
    reconciliationId: lowerFinalCost.reconciliationId,
  });
  const blocked = await budget.decideReservation(blockedRequest);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, 'exposure_exceeds_reconciled_cost');
  assert.deepEqual(await budget.decideReservation(blockedRequest), blocked);

  const ai = (await budget.readBudgetSnapshot()).categories.find((item) => item.category === 'ai');
  assert.deepEqual(ai.unbilled, knownAmount(650));
  assert.deepEqual(ai.committed, knownAmount(150));
  assert.deepEqual(ai.reserved, knownAmount(100));

  assert.equal((await reserve(budget, 'action-release-with-exposure', 50)).status, 'reserved');
  await budget.recordExposure({
    version: 'v1',
    entryId: 'usage-before-zero-release',
    actionId: 'action-release-with-exposure',
    category: 'ai',
    state: 'incurred',
    amountMinor: 25,
    currency: 'BRL',
    occurredAt: RECORDED_AT,
  });
  const zeroAfterUsage = makeReconciliation({
    reconciliationId: 'rec-zero-after-usage',
    actionId: 'action-release-with-exposure',
    amountMinor: 0,
  });
  await budget.recordReconciliation(zeroAfterUsage);
  const blockedRelease = await budget.decideReservation(makeDecision({
    decisionId: 'decision-release-with-exposure',
    actionId: 'action-release-with-exposure',
    reconciliationId: zeroAfterUsage.reconciliationId,
    decision: 'release',
  }));
  assert.equal(blockedRelease.reason, 'exposure_exceeds_reconciled_cost');
  const afterReleaseBlock = (await budget.readBudgetSnapshot()).categories.find((item) => item.category === 'ai');
  assert.deepEqual(afterReleaseBlock.incurred, knownAmount(25));
  assert.deepEqual(afterReleaseBlock.reserved, knownAmount(150));
});

test('unbilled charges remain unbilled while a zero final cost can be released', async () => {
  const { repository, budget } = makeEnvironment({ authorizeAdmin: authorized });
  await reconcileAllCategories(budget);

  assert.equal((await reserve(budget, 'action-unbilled', 1_000)).status, 'reserved');
  await budget.recordReconciliation(makeReconciliation({
    reconciliationId: 'rec-unbilled', actionId: 'action-unbilled', amountMinor: 250, billingState: 'unbilled',
  }));
  const unbilled = await budget.decideReservation(makeDecision({
    decisionId: 'decision-unbilled', actionId: 'action-unbilled', reconciliationId: 'rec-unbilled',
    actorId: 'partner-admin',
  }));
  assert.equal(unbilled.status, 'settled');
  assert.equal(unbilled.state, 'unbilled');

  assert.equal((await reserve(budget, 'action-zero', 800)).status, 'reserved');
  await budget.recordReconciliation(makeReconciliation({
    reconciliationId: 'rec-zero', actionId: 'action-zero', amountMinor: 0,
  }));
  const positiveSettle = await budget.decideReservation(makeDecision({
    decisionId: 'decision-zero-settle', actionId: 'action-zero', reconciliationId: 'rec-zero',
  }));
  assert.equal(positiveSettle.status, 'blocked');
  assert.equal(positiveSettle.reason, 'settlement_requires_positive_cost');

  const released = await budget.decideReservation(makeDecision({
    decisionId: 'decision-zero-release', actionId: 'action-zero', reconciliationId: 'rec-zero', decision: 'release',
  }));
  assert.equal(released.status, 'released');
  assert.equal(released.amountMinor, 0);
  assert.equal(repository.getAuditForSyntheticTest().length, 3);
  const ai = (await budget.readBudgetSnapshot()).categories.find((item) => item.category === 'ai');
  assert.deepEqual(ai.reserved, knownAmount(0));
  assert.deepEqual(ai.unbilled, knownAmount(250));
});

test('release with positive cost, missing verifier, verifier failure, and missing reason fail closed', async () => {
  const { repository, budget } = makeEnvironment({ authorizeAdmin: authorized });
  await reconcileAllCategories(budget);
  assert.equal((await reserve(budget, 'action-positive-release', 500)).status, 'reserved');
  await budget.recordReconciliation(makeReconciliation({
    reconciliationId: 'rec-positive-release', actionId: 'action-positive-release', amountMinor: 1,
  }));
  const positiveRelease = await budget.decideReservation(makeDecision({
    decisionId: 'decision-positive-release', actionId: 'action-positive-release',
    reconciliationId: 'rec-positive-release', decision: 'release',
  }));
  assert.equal(positiveRelease.status, 'blocked');
  assert.equal(positiveRelease.reason, 'release_requires_zero_cost');

  const denied = new Budget(repository);
  const noVerifier = await denied.decideReservation(makeDecision({
    decisionId: 'decision-no-verifier', actionId: 'action-positive-release',
    reconciliationId: 'rec-positive-release',
  }));
  assert.equal(noVerifier.reason, 'unauthorized');

  const invalidActor = new Budget(repository, () => false);
  const unauthorized = await invalidActor.decideReservation(makeDecision({
    decisionId: 'decision-invalid-actor', actionId: 'action-positive-release',
    reconciliationId: 'rec-positive-release', actorId: 'unknown-admin',
  }));
  assert.equal(unauthorized.reason, 'unauthorized');

  const verifierError = new Budget(repository, () => { throw new Error('identity provider unavailable'); });
  const verifierDenied = await verifierError.decideReservation(makeDecision({
    decisionId: 'decision-verifier-error', actionId: 'action-positive-release',
    reconciliationId: 'rec-positive-release',
  }));
  assert.equal(verifierDenied.reason, 'unauthorized');

  let verifierCalled = false;
  const missingReasonBudget = new Budget(repository, () => { verifierCalled = true; return true; });
  await assert.rejects(
    missingReasonBudget.decideReservation(makeDecision({
      decisionId: 'decision-no-reason', actionId: 'action-positive-release',
      reconciliationId: 'rec-positive-release', reason: '   ',
    })),
    { message: 'invalid_budget_reservation_decision_request' },
  );
  assert.equal(verifierCalled, false);
  assert.equal(repository.getAuditForSyntheticTest().length, 1);
  assert.deepEqual((await budget.readBudgetSnapshot()).categories.find((item) => item.category === 'ai').reserved,
    knownAmount(500));
});

test('partial opening evidence stays unknown and a category becomes usable only after all states are complete', async () => {
  const { budget } = makeEnvironment({ authorizeAdmin: authorized });
  const partial = makeOpening('ai', {
    status: 'pending',
    amounts: { incurred: knownAmount(200), committed: unknownAmount(), reserved: unknownAmount(), unbilled: unknownAmount() },
    evidenceStates: ['incurred'],
  });
  assert.equal(isBudgetOpeningBalanceReconciliationV1(partial), true);
  assert.deepEqual(await budget.reconcileOpeningBalance(partial), {
    version: 'v1', reconciliationId: partial.reconciliationId, status: 'recorded', balanceStatus: 'pending',
  });
  assert.deepEqual(await budget.reconcileOpeningBalance(partial), {
    version: 'v1', reconciliationId: partial.reconciliationId, status: 'already_recorded', balanceStatus: 'pending',
  });
  const pendingSnapshot = await budget.readBudgetSnapshot();
  assert.deepEqual(pendingSnapshot.categories.find((item) => item.category === 'ai').available, unknownAmount('budget_sources_not_reconciled'));
  assert.equal((await reserve(budget, 'action-partial-opening', 1)).reason, 'balance_unknown');

  const completeAi = makeOpening('ai', { reconciliationId: 'opening-ai-complete' });
  assert.equal((await budget.reconcileOpeningBalance(completeAi)).balanceStatus, 'known');
  const partiallyKnownSnapshot = await budget.readBudgetSnapshot();
  assert.deepEqual(partiallyKnownSnapshot.categories.find((item) => item.category === 'ai').available, knownAmount(11_000));
  assert.deepEqual(partiallyKnownSnapshot.total.available, unknownAmount('budget_sources_not_reconciled'));
  assert.equal((await reserve(budget, 'action-other-categories-unknown', 1)).reason, 'balance_unknown');

  for (const category of BUDGET_CAPPED_CATEGORIES_V1.filter((item) => item !== 'ai')) {
    await budget.reconcileOpeningBalance(makeOpening(category));
  }
  assert.equal((await reserve(budget, 'action-after-complete-opening', 1)).status, 'reserved');
});

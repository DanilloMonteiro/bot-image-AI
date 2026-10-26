import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMemoryBudgetRepository } from './fixtures/budget/memory-repository.mjs';

const require = createRequire(import.meta.url);
const { BUDGET_CAPPED_CATEGORIES_V1, isBudgetReadSnapshotV1 } = require('../dist/contracts/budget/v1.js');
const { BUDGET_CATEGORY_CAPS_MINOR_V1, BUDGET_TOTAL_CAP_MINOR_V1 } = require('../dist/modules/budget/limits.js');
const { Budget } = require('../dist/modules/budget/use-cases.js');

function makeEnvironment({ known = false } = {}) {
  const repository = createMemoryBudgetRepository({
    categories: BUDGET_CAPPED_CATEGORIES_V1,
    caps: BUDGET_CATEGORY_CAPS_MINOR_V1,
    totalCap: BUDGET_TOTAL_CAP_MINOR_V1,
    known,
  });
  return { repository, budget: new Budget(repository, () => true) };
}

function reservation(actionId, { amountMinor = 100, costStatus = 'known' } = {}) {
  return {
    version: 'v1', actionId, category: 'ai',
    cost: costStatus === 'known'
      ? { status: 'known', amountMinor, currency: 'BRL' }
      : { status: 'unknown', reason: 'provider_cost_not_reconciled' },
    attemptLimit: 2,
  };
}

function resumeRequest(signalId, resumeId) {
  return { version: 'v1', signalId, resumeId };
}

test('blocked reservations publish one durable signal into the Operations snapshot', async () => {
  const { budget, repository } = makeEnvironment();
  const request = reservation('signal-blocked-action');

  assert.equal((await budget.reserveAction(request)).reason, 'balance_unknown');
  assert.equal((await budget.reserveAction(request)).reason, 'balance_unknown');
  await assert.rejects(
    budget.reserveAction(reservation(request.actionId, { amountMinor: 101 })),
    { message: 'budget_action_payload_conflict' },
  );
  const snapshot = await budget.readBudgetSnapshot();

  assert.equal(isBudgetReadSnapshotV1(snapshot), true);
  assert.equal(snapshot.signals.length, 1);
  assert.equal(snapshot.signals[0].kind, 'reconciliation_required');
  assert.equal(snapshot.signals[0].sourceId, request.actionId);
  assert.equal(snapshot.signals[0].reason, 'balance_unknown');
  assert.equal(snapshot.signals[0].attempts, 0);
  assert.equal(repository.getLedgerEntriesForSyntheticTest().length, 0);
});

test('unknown cost is signaled and remains open for evidence instead of being guessed', async () => {
  const { budget, repository } = makeEnvironment({ known: true });
  const request = reservation('signal-cost-unknown-action', { costStatus: 'unknown' });
  assert.equal((await budget.reserveAction(request)).reason, 'unknown_cost');
  const signal = (await budget.readBudgetSnapshot()).signals[0];
  assert.equal(signal.kind, 'unknown_cost');

  const result = await budget.resumeSignal(resumeRequest(signal.signalId, 'signal-resume-cost-unknown'));
  assert.equal(result.status, 'manual_action_required');
  assert.equal(result.reason, 'unknown_cost');
  const current = (await budget.readBudgetSnapshot()).signals[0];
  assert.equal(current.status, 'open');
  assert.equal(current.attempts, 1);
  assert.equal(repository.getLedgerEntriesForSyntheticTest().length, 0);
});

test('category and total limit blockers receive distinct signals and retries recheck the cap', async () => {
  const { budget: categoryBudget } = makeEnvironment({ known: true });
  await categoryBudget.recordExposure({
    version: 'v1', entryId: 'signal-category-cap-exposure', actionId: 'signal-cap-source',
    category: 'ai', state: 'incurred', amountMinor: BUDGET_CATEGORY_CAPS_MINOR_V1.ai,
    currency: 'BRL', occurredAt: new Date().toISOString(),
  });
  const categoryRequest = reservation('signal-category-limited-action', { amountMinor: 1 });
  assert.equal((await categoryBudget.reserveAction(categoryRequest)).reason, 'category_limit');
  const categorySignal = (await categoryBudget.readBudgetSnapshot()).signals[0];
  assert.equal(categorySignal.kind, 'limit_reached');
  const categoryRetry = await categoryBudget.resumeSignal(
    resumeRequest(categorySignal.signalId, 'signal-resume-category-limit'),
  );
  assert.equal(categoryRetry.status, 'reservation_blocked');
  assert.equal(categoryRetry.reservation.reason, 'category_limit');

  const { budget: totalBudget } = makeEnvironment({ known: true });
  await totalBudget.recordExposure({
    version: 'v1', entryId: 'signal-total-cap-exposure', actionId: 'signal-total-cap-source',
    category: 'advertising', state: 'incurred', amountMinor: BUDGET_TOTAL_CAP_MINOR_V1 + 1,
    currency: 'BRL', occurredAt: new Date().toISOString(),
  });
  const totalRequest = reservation('signal-total-limited-action', { amountMinor: 1 });
  assert.equal((await totalBudget.reserveAction(totalRequest)).reason, 'insufficient_balance');
  assert.equal((await totalBudget.readBudgetSnapshot()).signals[0].kind, 'insufficient_balance');
});

test('reservation retry reuses the action id and the same resume id replays the exact result', async () => {
  const { budget, repository } = makeEnvironment();
  const request = reservation('signal-retry-action');
  assert.equal((await budget.reserveAction(request)).status, 'blocked');
  const signal = (await budget.readBudgetSnapshot()).signals[0];
  await repository.markBalancesKnownForSyntheticTest();

  const resume = resumeRequest(signal.signalId, 'signal-resume-001');
  const first = await budget.resumeSignal(resume);
  const replay = await budget.resumeSignal(resume);
  assert.equal(first.status, 'reservation_retried');
  assert.equal(first.reservation.status, 'reserved');
  assert.deepEqual(replay, first);
  assert.equal((await budget.resumeSignal(resumeRequest(signal.signalId, 'signal-resume-002'))).status, 'already_resolved');
  assert.equal(repository.getLedgerEntriesForSyntheticTest()
    .filter((entry) => entry.entryKind === 'reservation' && entry.actionId === request.actionId).length, 1);
  assert.equal((await budget.readBudgetSnapshot()).signals.length, 0);
  await assert.rejects(
    budget.resumeSignal({ ...resume, signalId: 'different-signal' }),
    { message: 'budget_signal_resume_payload_conflict' },
  );
});

test('a retry that remains blocked records one attempt and keeps the signal actionable', async () => {
  const { budget, repository } = makeEnvironment();
  const request = reservation('signal-still-blocked-action');
  await budget.reserveAction(request);
  const signal = (await budget.readBudgetSnapshot()).signals[0];

  const result = await budget.resumeSignal(resumeRequest(signal.signalId, 'signal-resume-blocked'));
  assert.equal(result.status, 'reservation_blocked');
  assert.equal(result.reservation.reason, 'balance_unknown');
  assert.equal(result.reservation.status, 'blocked');
  assert.deepEqual(await budget.resumeSignal(resumeRequest(signal.signalId, 'signal-resume-blocked')), result);
  const updated = (await budget.readBudgetSnapshot()).signals[0];
  assert.equal(updated.status, 'open');
  assert.equal(updated.attempts, 1);
  assert.equal(repository.getLedgerEntriesForSyntheticTest().length, 0);
});

test('unknown reconciliation cost needs an operator and cannot release the active reservation', async () => {
  const { budget, repository } = makeEnvironment({ known: true });
  const request = reservation('signal-unknown-cost-action');
  assert.equal((await budget.reserveAction(request)).status, 'reserved');
  repository.setReservationOccurredAtForSyntheticTest(
    request.actionId,
    new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  );
  await budget.recordReconciliation({
    version: 'v1',
    reconciliationId: 'signal-unknown-reconciliation',
    actionId: request.actionId,
    source: 'synthetic',
    terminality: 'unknown',
    cost: { status: 'unknown', reason: 'synthetic_cost_pending' },
    evidence: [],
    occurredAt: new Date().toISOString(),
  });
  const signals = (await budget.readBudgetSnapshot()).signals;
  assert.deepEqual(signals.map(({ kind }) => kind), ['unknown_cost']);
  const signal = signals[0];

  const result = await budget.resumeSignal(resumeRequest(signal.signalId, 'signal-resume-unknown'));
  assert.equal(result.status, 'manual_action_required');
  assert.equal(result.reason, 'unknown_cost');
  assert.equal((await budget.readBudgetSnapshot()).signals[0].status, 'open');
  assert.equal(repository.getLedgerEntriesForSyntheticTest()
    .find((entry) => entry.entryKind === 'reservation' && entry.actionId === request.actionId).reservationStatus, 'active');
});

test('stale reservation signal is deduplicated and reading it does not alter the ledger', async () => {
  const { budget, repository } = makeEnvironment({ known: true });
  const request = reservation('signal-stale-action');
  await budget.reserveAction(request);
  repository.setReservationOccurredAtForSyntheticTest(
    request.actionId,
    new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  );
  const ledgerBefore = repository.getLedgerEntriesForSyntheticTest();

  const first = await budget.readBudgetSnapshot();
  const second = await budget.readBudgetSnapshot();
  assert.equal(first.signals.length, 1);
  assert.equal(first.signals[0].kind, 'reservation_stale');
  assert.deepEqual(second.signals, first.signals);
  assert.deepEqual(repository.getLedgerEntriesForSyntheticTest(), ledgerBefore);

  assert.equal((await budget.reserveAction(request)).status, 'already_reserved');
  const afterReservationReplay = await budget.readBudgetSnapshot();
  assert.equal(afterReservationReplay.signals[0].kind, 'reservation_stale');
  assert.equal(afterReservationReplay.signals[0].status, 'open');

  const result = await budget.resumeSignal(resumeRequest(first.signals[0].signalId, 'signal-resume-stale'));
  assert.equal(result.status, 'manual_action_required');
  assert.equal(result.reason, 'reservation_stale');
  assert.equal(repository.getLedgerEntriesForSyntheticTest()
    .find((entry) => entry.entryKind === 'reservation' && entry.actionId === request.actionId).reservationStatus, 'active');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMemoryBudgetRepository } from './fixtures/budget/memory-repository.mjs';

const require = createRequire(import.meta.url);
const { Budget } = require('../dist/modules/budget/use-cases.js');
const {
  BUDGET_CAPPED_CATEGORIES_V1,
  isBudgetExposureV1,
  isBudgetReadSnapshotV1,
  isBudgetReservationRequestV1,
} = require('../dist/contracts/budget/v1.js');
const {
  BUDGET_CATEGORY_CAPS_MINOR_V1,
  BUDGET_TOTAL_CAP_MINOR_V1,
} = require('../dist/modules/budget/limits.js');

function makeBudget({ known = false } = {}) {
  const repository = createMemoryBudgetRepository({
    categories: BUDGET_CAPPED_CATEGORIES_V1,
    caps: BUDGET_CATEGORY_CAPS_MINOR_V1,
    totalCap: BUDGET_TOTAL_CAP_MINOR_V1,
    known,
  });
  return { repository, budget: new Budget(repository) };
}

function reservation(actionId, category, amountMinor, attemptLimit = 1, currency = 'BRL') {
  return {
    version: 'v1',
    actionId,
    category,
    cost: { status: 'known', amountMinor, currency },
    attemptLimit,
  };
}

test('new balances are unknown and block a known-cost reservation until reconciled', async () => {
  const { budget } = makeBudget();

  const result = await budget.reserveAction(reservation('unknown-opening', 'ai', 1));
  const snapshot = await budget.readBudgetSnapshot();

  assert.deepEqual(result, {
    version: 'v1', actionId: 'unknown-opening', status: 'blocked', reason: 'balance_unknown',
  });
  assert.equal(isBudgetReadSnapshotV1(snapshot), true);
  assert.deepEqual(snapshot.total.available, {
    status: 'unknown', reason: 'budget_sources_not_reconciled',
  });
});

test('unknown cost or unconverted foreign currency blocks without writing a reservation', async () => {
  const { budget, repository } = makeBudget({ known: true });
  const unknown = {
    version: 'v1', actionId: 'unknown-cost', category: 'ai',
    cost: { status: 'unknown', reason: 'no_invoice_yet' }, attemptLimit: 1,
  };

  assert.equal(isBudgetReservationRequestV1(unknown), true);
  assert.deepEqual(await budget.reserveAction(unknown), {
    version: 'v1', actionId: 'unknown-cost', status: 'blocked', reason: 'unknown_cost',
  });
  assert.deepEqual(await budget.reserveAction(reservation('unconverted-usd', 'ai', 25, 1, 'USD')), {
    version: 'v1', actionId: 'unconverted-usd', status: 'blocked', reason: 'unknown_cost',
  });
  assert.deepEqual(repository.getLedgerEntriesForSyntheticTest(), []);
});

test('category caps include the cost of every permitted attempt', async () => {
  const { budget } = makeBudget({ known: true });

  const accepted = await budget.reserveAction(reservation('ai-cap', 'ai', 5_500, 2));
  const refused = await budget.reserveAction(reservation('ai-over-cap', 'ai', 1, 1));
  const snapshot = await budget.readBudgetSnapshot();
  const ai = snapshot.categories.find((item) => item.category === 'ai');

  assert.equal(accepted.status, 'reserved');
  assert.deepEqual(refused, {
    version: 'v1', actionId: 'ai-over-cap', status: 'blocked', reason: 'category_limit',
  });
  assert.deepEqual(ai.reserved, { status: 'known', amountMinor: 11_000, currency: 'BRL' });
  assert.deepEqual(ai.available, { status: 'known', amountMinor: 0, currency: 'BRL' });
});

test('concurrent reservations serialize and cannot over-allocate a category', async () => {
  const { budget, repository } = makeBudget({ known: true });

  const outcomes = await Promise.all([
    budget.reserveAction(reservation('ads-a', 'advertising', 13_000)),
    budget.reserveAction(reservation('ads-b', 'advertising', 13_000)),
  ]);
  const reserved = outcomes.filter((item) => item.status === 'reserved');
  const blocked = outcomes.filter((item) => item.status === 'blocked');

  assert.equal(reserved.length, 1);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].reason, 'category_limit');
  assert.equal(repository.getLedgerEntriesForSyntheticTest().length, 1);
});

test('repeated action ids converge, while a changed payload is rejected', async () => {
  const { budget, repository } = makeBudget({ known: true });
  const action = reservation('stable-action', 'meta_pix_fx_retries', 75, 2);

  const first = await budget.reserveAction(action);
  const repeated = await budget.reserveAction(action);
  assert.equal(first.status, 'reserved');
  assert.equal(repeated.status, 'already_reserved');
  assert.equal(first.reservationId, repeated.reservationId);
  assert.equal(repository.getLedgerEntriesForSyntheticTest().length, 1);

  await assert.rejects(
    budget.reserveAction(reservation('stable-action', 'meta_pix_fx_retries', 76, 2)),
    { message: 'budget_action_payload_conflict' },
  );
});

test('all four exposure states count once and duplicate events do not add cost again', async () => {
  const { budget } = makeBudget({ known: true });
  const states = [
    ['incurred', 100],
    ['committed', 200],
    ['reserved', 300],
    ['unbilled', 400],
  ];

  for (const [state, amountMinor] of states) {
    const entry = {
      version: 'v1',
      entryId: `exposure-${state}`,
      actionId: 'synthetic-ledger-action',
      category: 'railway',
      state,
      amountMinor,
      currency: 'BRL',
      occurredAt: '2026-10-25T12:00:00.000Z',
    };
    assert.equal(isBudgetExposureV1(entry), true);
    assert.equal(await budget.recordExposure(entry), 'recorded');
    assert.equal(await budget.recordExposure(entry), 'already_recorded');
  }

  const snapshot = await budget.readBudgetSnapshot();
  const railway = snapshot.categories.find((item) => item.category === 'railway');
  assert.deepEqual(railway.incurred, { status: 'known', amountMinor: 100, currency: 'BRL' });
  assert.deepEqual(railway.committed, { status: 'known', amountMinor: 200, currency: 'BRL' });
  assert.deepEqual(railway.reserved, { status: 'known', amountMinor: 300, currency: 'BRL' });
  assert.deepEqual(railway.unbilled, { status: 'known', amountMinor: 400, currency: 'BRL' });
  assert.deepEqual(railway.available, { status: 'known', amountMinor: 5_500, currency: 'BRL' });
  assert.deepEqual(snapshot.total.incurred, { status: 'known', amountMinor: 100, currency: 'BRL' });
  assert.deepEqual(snapshot.total.committed, { status: 'known', amountMinor: 200, currency: 'BRL' });
  assert.deepEqual(snapshot.total.reserved, { status: 'known', amountMinor: 300, currency: 'BRL' });
  assert.deepEqual(snapshot.total.unbilled, { status: 'known', amountMinor: 400, currency: 'BRL' });
  assert.deepEqual(snapshot.total.available, { status: 'known', amountMinor: 49_000, currency: 'BRL' });
});

test('approved category caps sum to the hard total and no category can borrow another cap', async () => {
  const capTotal = Object.values(BUDGET_CATEGORY_CAPS_MINOR_V1).reduce((sum, value) => sum + value, 0);
  assert.equal(capTotal, BUDGET_TOTAL_CAP_MINOR_V1);

  const { budget } = makeBudget({ known: true });
  for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
    const result = await budget.reserveAction(reservation(
      `fill-${category}`, category, BUDGET_CATEGORY_CAPS_MINOR_V1[category],
    ));
    assert.equal(result.status, 'reserved');
  }
  assert.deepEqual((await budget.readBudgetSnapshot()).total.available, {
    status: 'known', amountMinor: 0, currency: 'BRL',
  });
  const blocked = await budget.reserveAction(reservation('no-transfer', 'ai', 1));
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, 'category_limit');
});

test('settled and released reservations leave reserved exposure, and actual overage is retained', async () => {
  const { repository } = makeBudget({ known: true });
  const authorizedBudget = new Budget(repository, () => true);

  assert.equal((await authorizedBudget.reserveAction(reservation('settle-overage', 'ai', 100))).status, 'reserved');
  const settledEvidence = {
    version: 'v1',
    reconciliationId: 'settled-overage-reconciliation',
    actionId: 'settle-overage',
    source: 'synthetic',
    terminality: 'terminal',
    cost: { status: 'known', amountMinor: 150, currency: 'BRL', billingState: 'incurred' },
    evidence: [{
      evidenceId: 'settled-overage-evidence', kind: 'synthetic_fixture',
      sourceId: 'synthetic-terminal-record', recordedAt: '2026-10-25T12:00:00.000Z',
    }],
    occurredAt: '2026-10-25T12:00:00.000Z',
  };
  await authorizedBudget.recordReconciliation(settledEvidence);
  assert.equal((await authorizedBudget.decideReservation({
    version: 'v1', decisionId: 'settle-overage-decision', actionId: 'settle-overage',
    reconciliationId: settledEvidence.reconciliationId, decision: 'settle',
    actorId: 'test-admin', reason: 'Synthetic terminal usage reconciled.',
  })).status, 'settled');

  assert.equal((await authorizedBudget.reserveAction(reservation('release-zero', 'ai', 200))).status, 'reserved');
  const zeroEvidence = {
    version: 'v1',
    reconciliationId: 'release-zero-reconciliation',
    actionId: 'release-zero',
    source: 'synthetic',
    terminality: 'terminal',
    cost: { status: 'known', amountMinor: 0, currency: 'BRL', billingState: 'incurred' },
    evidence: [{
      evidenceId: 'release-zero-evidence', kind: 'synthetic_fixture',
      sourceId: 'synthetic-zero-record', recordedAt: '2026-10-25T12:00:00.000Z',
    }],
    occurredAt: '2026-10-25T12:00:00.000Z',
  };
  await authorizedBudget.recordReconciliation(zeroEvidence);
  assert.equal((await authorizedBudget.decideReservation({
    version: 'v1', decisionId: 'release-zero-decision', actionId: 'release-zero',
    reconciliationId: zeroEvidence.reconciliationId, decision: 'release',
    actorId: 'test-admin', reason: 'Terminal evidence confirms zero usage.',
  })).status, 'released');

  const ai = (await authorizedBudget.readBudgetSnapshot()).categories.find((item) => item.category === 'ai');
  assert.deepEqual(ai.reserved, { status: 'known', amountMinor: 0, currency: 'BRL' });
  assert.deepEqual(ai.incurred, { status: 'known', amountMinor: 150, currency: 'BRL' });
  assert.deepEqual(ai.available, { status: 'known', amountMinor: 10_850, currency: 'BRL' });
});

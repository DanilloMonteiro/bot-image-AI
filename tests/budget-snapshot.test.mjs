import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMemoryBudgetRepository } from './fixtures/budget/memory-repository.mjs';

const require = createRequire(import.meta.url);
const { Budget } = require('../dist/modules/budget/use-cases.js');
const { projectBudgetSnapshot } = require('../dist/modules/budget/snapshot.js');
const { BUDGET_CAPPED_CATEGORIES_V1, isBudgetReadSnapshotV1 } = require('../dist/contracts/budget/v1.js');
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

let nextExposureId = 0;
async function record(budget, category, state, amountMinor) {
  nextExposureId += 1;
  return budget.recordExposure({
    version: 'v1',
    entryId: `snapshot-exposure-${nextExposureId}`,
    actionId: 'snapshot-synthetic-action',
    category,
    state,
    amountMinor,
    currency: 'BRL',
    occurredAt: '2026-10-25T12:00:00.000Z',
  });
}

function alertFor(snapshot, scope, thresholdPercent, category) {
  return snapshot.alerts.find((item) => item.scope === scope
    && item.thresholdPercent === thresholdPercent
    && (scope === 'total' || item.category === category));
}

test('category alerts use all four exposure states and exact integer thresholds', async () => {
  for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
    const cap = BUDGET_CATEGORY_CAPS_MINOR_V1[category];
    for (const thresholdPercent of [60, 80, 95]) {
      const threshold = cap * thresholdPercent / 100;
      for (const [offset, expected] of [[-1, 'not_reached'], [0, 'reached'], [1, 'reached']]) {
        const { budget } = makeBudget({ known: true });
        const exposureMinor = threshold + offset;
        const parts = [exposureMinor - 3, 1, 1, 1];
        for (const [index, state] of ['incurred', 'committed', 'reserved', 'unbilled'].entries()) {
          await record(budget, category, state, parts[index]);
        }

        const snapshot = await budget.readBudgetSnapshot();
        assert.equal(isBudgetReadSnapshotV1(snapshot), true);
        assert.equal(alertFor(snapshot, 'category', thresholdPercent, category)?.status, expected);
        assert.equal(
          snapshot.categories.find((item) => item.category === category).incurred.amountMinor
            + snapshot.categories.find((item) => item.category === category).committed.amountMinor
            + snapshot.categories.find((item) => item.category === category).reserved.amountMinor
            + snapshot.categories.find((item) => item.category === category).unbilled.amountMinor,
          exposureMinor,
        );
      }
    }
  }
});

test('total alerts use total exposure, including amounts over category caps', async () => {
  for (const thresholdPercent of [60, 80, 95]) {
    const thresholdMinor = BUDGET_TOTAL_CAP_MINOR_V1 * thresholdPercent / 100;
    for (const [offset, expected] of [[-1, 'not_reached'], [0, 'reached'], [1, 'reached']]) {
      const { budget } = makeBudget({ known: true });
      const exposureMinor = thresholdMinor + offset;
      const parts = [exposureMinor - 3, 1, 1, 1];
      for (const [index, state] of ['incurred', 'committed', 'reserved', 'unbilled'].entries()) {
        await record(budget, 'advertising', state, parts[index]);
      }

      const snapshot = await budget.readBudgetSnapshot();
      assert.equal(alertFor(snapshot, 'total', thresholdPercent)?.status, expected);
      assert.equal(
        snapshot.total.incurred.amountMinor + snapshot.total.committed.amountMinor
          + snapshot.total.reserved.amountMinor + snapshot.total.unbilled.amountMinor,
        exposureMinor,
      );
    }
  }
});

test('unknown balances keep availability and all affected threshold states unknown', async () => {
  const { budget } = makeBudget({ known: true });
  const complete = await budget.readBudgetSnapshot();
  const unknown = { status: 'unknown', reason: 'incomplete_ai_baseline' };
  const ledgerSnapshot = {
    version: complete.version,
    generatedAt: complete.generatedAt,
    total: {
      ...complete.total,
      incurred: unknown,
      committed: unknown,
      reserved: unknown,
      unbilled: unknown,
      available: unknown,
    },
    categories: complete.categories.map((category) => category.category === 'ai'
      ? { ...category, reserved: unknown, available: unknown }
      : category),
  };
  const snapshot = projectBudgetSnapshot(ledgerSnapshot);

  assert.equal(isBudgetReadSnapshotV1(snapshot), true);
  assert.deepEqual(snapshot.total.available, unknown);
  assert.ok(snapshot.alerts.filter((item) => item.scope === 'total').every((item) => item.status === 'unknown'));
  assert.ok(snapshot.alerts.filter((item) => item.scope === 'category' && item.category === 'ai')
    .every((item) => item.status === 'unknown'));
  assert.ok(snapshot.alerts.filter((item) => item.scope === 'category' && item.category !== 'ai')
    .every((item) => item.status !== 'unknown'));
  assert.equal(snapshot.blockers.filter((item) => item.kind === 'balance_unknown').length, 2);
  assert.equal(snapshot.blockers.some((item) => item.kind === 'limit_reached'), false);
});

test('exhausted caps produce blockers while preserving exposure above the cap', async () => {
  const { budget } = makeBudget({ known: true });
  for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
    await record(budget, category, 'incurred', BUDGET_CATEGORY_CAPS_MINOR_V1[category]);
  }
  await record(budget, 'ai', 'unbilled', 50);

  const snapshot = await budget.readBudgetSnapshot();
  const totalBlocker = snapshot.blockers.find((item) => item.scope === 'total');
  const aiBlocker = snapshot.blockers.find((item) => item.scope === 'category' && item.category === 'ai');
  assert.deepEqual(snapshot.total.available, { status: 'known', amountMinor: 0, currency: 'BRL' });
  assert.deepEqual(snapshot.categories.find((item) => item.category === 'ai').available, {
    status: 'known', amountMinor: 0, currency: 'BRL',
  });
  assert.equal(totalBlocker.kind, 'limit_reached');
  assert.equal(totalBlocker.exposureMinor, BUDGET_TOTAL_CAP_MINOR_V1 + 50);
  assert.equal(aiBlocker.kind, 'limit_reached');
  assert.equal(aiBlocker.exposureMinor, BUDGET_CATEGORY_CAPS_MINOR_V1.ai + 50);
  assert.equal(alertFor(snapshot, 'total', 95)?.status, 'reached');
});

test('known balances below caps keep four states separate and have no blockers', async () => {
  const { budget } = makeBudget({ known: true });
  for (const [state, amountMinor] of [
    ['incurred', 100], ['committed', 200], ['reserved', 300], ['unbilled', 400],
  ]) {
    await record(budget, 'railway', state, amountMinor);
  }

  const snapshot = await budget.readBudgetSnapshot();
  const railway = snapshot.categories.find((item) => item.category === 'railway');
  assert.deepEqual(railway.incurred, { status: 'known', amountMinor: 100, currency: 'BRL' });
  assert.deepEqual(railway.committed, { status: 'known', amountMinor: 200, currency: 'BRL' });
  assert.deepEqual(railway.reserved, { status: 'known', amountMinor: 300, currency: 'BRL' });
  assert.deepEqual(railway.unbilled, { status: 'known', amountMinor: 400, currency: 'BRL' });
  assert.deepEqual(snapshot.blockers, []);
});

test('only the documented five-image unit economics are shown as an explicit hypothesis', async () => {
  const { budget } = makeBudget({ known: true });
  const snapshot = await budget.readBudgetSnapshot();
  const economics = snapshot.illustrativeEconomics;

  assert.equal(economics.status, 'hypothesis');
  assert.equal(economics.notAnOffer, true);
  assert.equal(economics.currency, 'BRL');
  assert.equal(economics.package.imageCount, 5);
  assert.equal(economics.package.priceMinor, 3_990);
  assert.equal(economics.variableCostTotalMinor, 1_290);
  assert.equal(economics.contributionBeforeCacMinor, 2_700);
  assert.deepEqual(economics.premises.map((item) => item.amountMinor), [750, 70, 100, 150, 180, 40]);
  assert.deepEqual(economics.cacScenarios.map((item) => item.cacMinor), [800, 1_500, 2_200]);
  assert.deepEqual(economics.cacScenarios.map((item) => item.contributionAfterCacMinor), [1_900, 1_200, 500]);
  assert.deepEqual(economics.source, {
    document: 'prd_addendum', section: 'Simulação econômica ilustrativa',
  });
});

test('repeated snapshot reads do not mutate ledger entries or opening balances', async () => {
  const { budget, repository } = makeBudget({ known: true });
  await record(budget, 'ai', 'reserved', 123);
  const entriesBefore = repository.getLedgerEntriesForSyntheticTest();
  const baselinesBefore = BUDGET_CAPPED_CATEGORIES_V1.map((category) => (
    repository.getOpeningBalanceForSyntheticTest(category)
  ));

  const first = await budget.readBudgetSnapshot();
  const second = await budget.readBudgetSnapshot();

  assert.deepEqual(first, second);
  assert.deepEqual(repository.getLedgerEntriesForSyntheticTest(), entriesBefore);
  assert.deepEqual(
    BUDGET_CAPPED_CATEGORIES_V1.map((category) => repository.getOpeningBalanceForSyntheticTest(category)),
    baselinesBefore,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { BUDGET_CONTRACT_FIXTURES_V1 as fixtures } from './fixtures/budget/v1.mjs';

const require = createRequire(import.meta.url);
const {
  isBudgetIllustrativeEconomicsV1,
  isBudgetReadSnapshotV1,
  isBudgetReservationRequestV1,
  isBudgetReservationResultV1,
  isBudgetSnapshotBlockerV1,
  isBudgetSignalV1,
  isBudgetThresholdAlertV1,
  toBudgetCostV1,
} = require('../dist/contracts/budget/v1.js');
const { isPlatformUsageRecordV1 } = require('../dist/contracts/platform-usage/v1.js');

test('application fixtures preserve known cost and cost currency exactly', () => {
  const { knownPlatformUsage, reserveKnown } = fixtures.application;

  assert.equal(isPlatformUsageRecordV1(knownPlatformUsage), true);
  assert.deepEqual(toBudgetCostV1(knownPlatformUsage), {
    status: 'known', amountMinor: 25, currency: 'USD',
  });
  assert.equal(isBudgetReservationRequestV1(reserveKnown), true);
});

test('omitted platform cost remains explicitly unknown instead of becoming zero', () => {
  const { unknownPlatformUsage, reserveUnknown } = fixtures.application;

  assert.equal(isPlatformUsageRecordV1(unknownPlatformUsage), true);
  const cost = toBudgetCostV1(unknownPlatformUsage);
  assert.deepEqual(cost, {
    status: 'unknown', reason: 'platform_usage_cost_not_reported',
  });
  assert.equal(Object.hasOwn(cost, 'amountMinor'), false);
  assert.equal(isBudgetReservationRequestV1(reserveUnknown), true);
  assert.equal(isBudgetReservationRequestV1({
    ...reserveUnknown,
    cost: { status: 'unknown', reason: 'unknown', amountMinor: 0 },
  }), false);
});

test('worker fixtures represent repeated reservations with one stable action and reservation id', () => {
  const { firstReservation, repeatedReservation, unknownCostRequest } = fixtures.worker;

  assert.equal(isBudgetReservationResultV1(firstReservation), true);
  assert.equal(isBudgetReservationResultV1(repeatedReservation), true);
  assert.equal(firstReservation.actionId, repeatedReservation.actionId);
  assert.equal(firstReservation.reservationId, repeatedReservation.reservationId);
  assert.equal(new Set([firstReservation.reservationId, repeatedReservation.reservationId]).size, 1);
  assert.equal(isBudgetReservationRequestV1(unknownCostRequest), true);
  assert.deepEqual(unknownCostRequest.cost, {
    status: 'unknown', reason: 'worker_cost_not_reconciled',
  });
});

test('consumer snapshot preserves unknown amounts and validates its versioned shape', () => {
  const snapshot = fixtures.consumer.readSnapshot;

  assert.equal(isBudgetReadSnapshotV1(snapshot), true);
  assert.deepEqual(snapshot.total.available, {
    status: 'unknown', reason: 'awaiting_manual_reconciliation',
  });
  assert.deepEqual(snapshot.categories[0].reserved, {
    status: 'unknown', reason: 'awaiting_manual_reconciliation',
  });
  assert.equal(isBudgetReadSnapshotV1({ ...snapshot, version: 'v2' }), false);

  const malformedAmount = structuredClone(snapshot);
  malformedAmount.total.available = {
    status: 'unknown', reason: 'awaiting_manual_reconciliation', amountMinor: 0,
  };
  assert.equal(isBudgetReadSnapshotV1(malformedAmount), false);

  const malformedAlert = structuredClone(snapshot);
  malformedAlert.alerts[0].extra = true;
  assert.equal(isBudgetReadSnapshotV1(malformedAlert), false);

  const missingCategory = structuredClone(snapshot);
  missingCategory.categories.pop();
  assert.equal(isBudgetReadSnapshotV1(missingCategory), false);

  const alteredEconomics = structuredClone(snapshot);
  alteredEconomics.illustrativeEconomics.package.imageCount = 10;
  assert.equal(isBudgetReadSnapshotV1(alteredEconomics), false);
});

test('consumer signals retain their source, reason, attempts and state', () => {
  const signal = fixtures.consumer.unknownCostSignal;

  assert.equal(isBudgetSignalV1(signal), true);
  assert.equal(isBudgetSignalV1({ ...signal, attempts: -1 }), false);
  assert.equal(isBudgetSignalV1({ ...signal, status: 'auto_released' }), false);
  assert.equal(isBudgetSignalV1({ ...signal, unreviewedDefault: true }), false);
});

test('snapshot alert, blocker, and illustrative economics guards reject malformed shapes', () => {
  const snapshot = fixtures.consumer.readSnapshot;
  assert.equal(isBudgetThresholdAlertV1(snapshot.alerts[0]), true);
  assert.equal(isBudgetSnapshotBlockerV1(snapshot.blockers[0]), true);
  assert.equal(isBudgetIllustrativeEconomicsV1(snapshot.illustrativeEconomics), true);

  assert.equal(isBudgetThresholdAlertV1({ ...snapshot.alerts[0], thresholdPercent: 70 }), false);
  assert.equal(isBudgetSnapshotBlockerV1({
    kind: 'limit_reached', scope: 'total', reason: 'budget_cap_reached', exposureMinor: 5, capMinor: 10,
  }), false);
  assert.equal(isBudgetIllustrativeEconomicsV1({
    ...snapshot.illustrativeEconomics,
    contributionBeforeCacMinor: 2_701,
  }), false);
});

test('reservation requests reject missing costs, malformed money and invalid retry counts', () => {
  const request = fixtures.application.reserveKnown;

  assert.equal(isBudgetReservationRequestV1({ ...request, cost: undefined }), false);
  assert.equal(isBudgetReservationRequestV1({
    ...request,
    cost: { status: 'known', amountMinor: -1, currency: 'BRL' },
  }), false);
  assert.equal(isBudgetReservationRequestV1({ ...request, attemptLimit: 0 }), false);
  assert.equal(isBudgetReservationRequestV1({ ...request, category: 'unbounded' }), false);
});

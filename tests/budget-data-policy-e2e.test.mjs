import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMemoryBudgetRepository } from './fixtures/budget/memory-repository.mjs';

const require = createRequire(import.meta.url);
const { BUDGET_CAPPED_CATEGORIES_V1 } = require('../dist/contracts/budget/v1.js');
const {
  BUDGET_CATEGORY_CAPS_MINOR_V1,
  BUDGET_TOTAL_CAP_MINOR_V1,
} = require('../dist/modules/budget/limits.js');
const { Budget } = require('../dist/modules/budget/use-cases.js');
const { DATA_POLICY_V1 } = require('../dist/modules/data-policy/policy-v1.js');
const { DATA_POLICY_V2 } = require('../dist/modules/data-policy/policy-v2.js');
const { decideDataUse, readApprovedDataPolicy } = require('../dist/modules/data-policy/use-cases.js');
const { handleBudgetTraceRequest } = require('../dist/adapters/http/budget-trace-handler.js');
const { handleBudgetTraceJob } = require('../dist/worker/budget-trace-handler.js');

const RECORDED_AT = '2026-10-26T12:00:00.000Z';
const authorized = (actorId) => actorId === 'synthetic-admin';

function makeEnvironment({ known = false } = {}) {
  const repository = createMemoryBudgetRepository({
    categories: BUDGET_CAPPED_CATEGORIES_V1,
    caps: BUDGET_CATEGORY_CAPS_MINOR_V1,
    totalCap: BUDGET_TOTAL_CAP_MINOR_V1,
    known,
  });
  return { repository, budget: new Budget(repository, authorized) };
}

function reservation(actionId, { amountMinor = 100, costStatus = 'known', category = 'ai' } = {}) {
  return {
    version: 'v1',
    actionId,
    category,
    cost: costStatus === 'known'
      ? { status: 'known', amountMinor, currency: 'BRL' }
      : { status: 'unknown', reason: 'synthetic_provider_cost_pending' },
    attemptLimit: 1,
  };
}

function makeReconciliation({
  reconciliationId,
  actionId,
  terminality = 'terminal',
  amountMinor = 0,
  costStatus = 'known',
} = {}) {
  return {
    version: 'v1',
    reconciliationId,
    actionId,
    source: 'synthetic',
    terminality,
    cost: costStatus === 'known'
      ? { status: 'known', amountMinor, currency: 'BRL', billingState: 'incurred' }
      : { status: 'unknown', reason: 'synthetic_cost_pending' },
    evidence: costStatus === 'known' || terminality === 'terminal'
      ? [{
        evidenceId: `evidence-${reconciliationId}`,
        kind: 'synthetic_fixture',
        sourceId: `source-${reconciliationId}`,
        recordedAt: RECORDED_AT,
      }]
      : [],
    occurredAt: RECORDED_AT,
  };
}

function decision({ decisionId, actionId, reconciliationId }) {
  return {
    version: 'v1', decisionId, actionId, reconciliationId,
    decision: 'settle', actorId: 'synthetic-admin', reason: 'Synthetic reconciliation evidence reviewed.',
  };
}

test('synthetic tracer, concurrent replay, and worker redelivery share the Budget repository', async () => {
  const previous = {
    environment: process.env.PLATFORM_ENVIRONMENT,
    secret: process.env.STAGING_SMOKE_SECRET,
  };
  process.env.PLATFORM_ENVIRONMENT = 'staging';
  process.env.STAGING_SMOKE_SECRET = 'synthetic-only-secret-with-no-provider-access-0123456789';
  try {
    const { repository, budget } = makeEnvironment({ known: true });
    const actionId = 'a2f1c4d8-71be-4aa8-922a-86ca0d57834a';
    const jobs = new Map();
    const request = () => new Request('http://local/api/internal/budget/trace', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STAGING_SMOKE_SECRET}`,
        'Idempotency-Key': actionId,
      },
    });
    const reserveAndQueue = async (id) => {
      const prior = await repository.findSyntheticTrace(id);
      const reserved = await budget.reserveSyntheticTrace(id);
      if (!prior && !jobs.has(id)) {
        jobs.set(id, { id, actionId: id, kind: 'synthetic-budget-trace' });
      }
      return reserved;
    };

    const responses = await Promise.all(Array.from({ length: 8 }, () => (
      handleBudgetTraceRequest(request(), reserveAndQueue)
    )));
    assert.ok(responses.every((response) => response.status === 202));
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.ok(bodies.every((body) => body.actionId === actionId));
    assert.equal(jobs.size, 1);
    assert.equal((await repository.findSyntheticTrace(actionId)).actionId, actionId);

    const job = jobs.get(actionId);
    await handleBudgetTraceJob({ actionId, jobId: job.id, attemptNumber: 0 }, { budget });
    await handleBudgetTraceJob({ actionId, jobId: job.id, attemptNumber: 1 }, { budget });
    assert.equal(jobs.size, 1);

    const costRequest = reservation('e2e-tracer-budget-action', { amountMinor: 250 });
    const costReservations = await Promise.all(Array.from({ length: 8 }, () => budget.reserveAction(costRequest)));
    assert.equal(new Set(costReservations.map((result) => result.reservationId)).size, 1);
    assert.equal(repository.getLedgerEntriesForSyntheticTest()
      .filter((entry) => entry.entryKind === 'reservation' && entry.actionId === costRequest.actionId).length, 1);
    const snapshot = await budget.readBudgetSnapshot();
    assert.equal(snapshot.categories.find((item) => item.category === 'ai').reserved.amountMinor, 250);
  } finally {
    if (previous.environment === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.environment;
    if (previous.secret === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.secret;
  }
});

test('category/total caps and unknown cost fail closed into actionable snapshot signals', async () => {
  const category = makeEnvironment({ known: true });
  await category.budget.recordExposure({
    version: 'v1', entryId: 'e2e-ai-cap-exposure', actionId: 'e2e-ai-cap-source',
    category: 'ai', state: 'incurred', amountMinor: BUDGET_CATEGORY_CAPS_MINOR_V1.ai,
    currency: 'BRL', occurredAt: RECORDED_AT,
  });
  assert.equal((await category.budget.reserveAction(reservation('e2e-ai-cap-action', { amountMinor: 1 }))).reason,
    'category_limit');
  assert.equal((await category.budget.readBudgetSnapshot()).signals[0].kind, 'limit_reached');

  const total = makeEnvironment({ known: true });
  await total.budget.recordExposure({
    version: 'v1', entryId: 'e2e-total-cap-exposure', actionId: 'e2e-total-cap-source',
    category: 'advertising', state: 'incurred', amountMinor: BUDGET_TOTAL_CAP_MINOR_V1 + 1,
    currency: 'BRL', occurredAt: RECORDED_AT,
  });
  assert.equal((await total.budget.reserveAction(reservation('e2e-total-cap-action', {
    amountMinor: 1,
  }))).reason, 'insufficient_balance');
  assert.equal((await total.budget.readBudgetSnapshot()).signals[0].kind, 'insufficient_balance');

  const unknown = makeEnvironment({ known: true });
  assert.equal((await unknown.budget.reserveAction(reservation('e2e-cost-unknown-action', {
    costStatus: 'unknown', category: 'meta_pix_fx_retries',
  }))).reason, 'unknown_cost');
  const signal = (await unknown.budget.readBudgetSnapshot()).signals[0];
  assert.equal(signal.kind, 'unknown_cost');
  const recovery = await unknown.budget.resumeSignal({
    version: 'v1', signalId: signal.signalId, resumeId: 'e2e-unknown-cost-resume',
  });
  assert.equal(recovery.status, 'manual_action_required');
  assert.equal((await unknown.budget.readBudgetSnapshot()).signals[0].status, 'open');
  assert.equal(unknown.repository.getLedgerEntriesForSyntheticTest()
    .filter((entry) => entry.entryKind === 'reservation').length, 0);
});

test('unknown balance stays blocked until corrected, then same resume is replay-safe', async () => {
  const { repository, budget } = makeEnvironment();
  const request = reservation('e2e-balance-recovery-action');
  assert.equal((await budget.reserveAction(request)).reason, 'balance_unknown');
  const signal = (await budget.readBudgetSnapshot()).signals[0];
  assert.equal(signal.kind, 'reconciliation_required');
  assert.equal(repository.getLedgerEntriesForSyntheticTest().length, 0);

  await repository.markBalancesKnownForSyntheticTest();
  const resume = { version: 'v1', signalId: signal.signalId, resumeId: 'e2e-balance-recovery-resume' };
  const first = await budget.resumeSignal(resume);
  const replay = await budget.resumeSignal(resume);
  assert.equal(first.status, 'reservation_retried');
  assert.deepEqual(replay, first);
  assert.equal(first.reservation.actionId, request.actionId);
  assert.equal(repository.getLedgerEntriesForSyntheticTest()
    .filter((entry) => entry.entryKind === 'reservation' && entry.actionId === request.actionId).length, 1);
  assert.equal((await budget.readBudgetSnapshot()).signals.length, 0);
});

test('unknown reconciliation remains active until terminal evidence and an admin decision', async () => {
  const { repository, budget } = makeEnvironment({ known: true });
  const actionId = 'e2e-reconciliation-action';
  const request = reservation(actionId, { amountMinor: 125 });
  assert.equal((await budget.reserveAction(request)).status, 'reserved');
  repository.setReservationOccurredAtForSyntheticTest(
    actionId, new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  );
  await budget.recordReconciliation(makeReconciliation({
    reconciliationId: 'e2e-unknown-reconciliation', actionId,
    terminality: 'unknown', costStatus: 'unknown',
  }));

  const openSnapshot = await budget.readBudgetSnapshot();
  assert.deepEqual(openSnapshot.signals.map(({ kind }) => kind), ['unknown_cost']);
  const blocked = await budget.decideReservation(decision({
    decisionId: 'e2e-blocked-decision', actionId, reconciliationId: 'e2e-unknown-reconciliation',
  }));
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, 'reconciliation_not_terminal');
  assert.equal(repository.getLedgerEntriesForSyntheticTest()
    .find((entry) => entry.entryKind === 'reservation' && entry.actionId === actionId).reservationStatus, 'active');

  await budget.recordReconciliation(makeReconciliation({
    reconciliationId: 'e2e-terminal-reconciliation', actionId, amountMinor: 125,
  }));
  const terminalDecision = decision({
    decisionId: 'e2e-terminal-decision', actionId, reconciliationId: 'e2e-terminal-reconciliation',
  });
  const settled = await budget.decideReservation(terminalDecision);
  assert.equal(settled.status, 'settled');
  assert.deepEqual(await budget.decideReservation(terminalDecision), settled);
  const finalSnapshot = await budget.readBudgetSnapshot();
  assert.equal(finalSnapshot.signals.length, 0);
  assert.equal(finalSnapshot.categories.find((item) => item.category === 'ai').incurred.amountMinor, 125);
  assert.equal(finalSnapshot.categories.find((item) => item.category === 'ai').reserved.amountMinor, 0);
});

test('Data Policy blocks absent, stale, or locally unverified collect/process callbacks', async () => {
  let serviceCalls = 0;
  const providerCall = async () => { serviceCalls += 1; };
  const runBehindPolicy = async (snapshot, action) => {
    const decision = decideDataUse(snapshot, action);
    if (decision.allowed) await providerCall();
    return decision;
  };

  assert.equal(readApprovedDataPolicy().status, 'available');
  assert.equal(DATA_POLICY_V2.operationalReadiness.localDeletion, 'pending');
  const unapproved = structuredClone(DATA_POLICY_V2);
  unapproved.ownerApproval = { status: 'not_approved', decidedAt: '2026-10-27', approvedAt: null };
  for (const action of ['collect', 'process']) {
    assert.deepEqual(await runBehindPolicy(null, action), {
      allowed: false, action, reason: 'policy_missing',
    });
    assert.deepEqual(await runBehindPolicy(unapproved, action), {
      allowed: false, action, reason: 'policy_not_approved',
    });
    assert.deepEqual(await runBehindPolicy(DATA_POLICY_V1, action), {
      allowed: false, action, reason: 'policy_not_current',
    });
    assert.deepEqual(await runBehindPolicy(DATA_POLICY_V2, action), {
      allowed: false, action, reason: 'local_deletion_unverified',
    });
  }
  assert.equal(serviceCalls, 0);
});

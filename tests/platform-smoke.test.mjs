import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { PlatformSmoke } = require('../dist/modules/platform-smoke/use-cases.js');
const { isAuthorized } = require('../dist/adapters/http/staging-auth.js');
const { handleSmokeSubmitRequest } = require('../dist/adapters/http/smoke-submit-handler.js');
const { getReadinessResult, readinessResponse } = require('../dist/adapters/http/readiness-handler.js');
const { isPublicStoryPath, shouldBlockCustomerMediaPath } = require('../dist/adapters/http/production-traffic-gate.js');
const { mapSmokeRetryResult } = require('../dist/adapters/http/smoke-retry-response.js');
const { handleSmokeRetryRequest } = require('../dist/adapters/http/smoke-retry-handler.js');
const { emitPlatformEvent } = require('../dist/adapters/console/platform-events.js');
const { handlePlatformSmokeJob } = require('../dist/worker/platform-smoke-handler.js');
const { createWorkerHealthServer } = require('../dist/worker/health-server.js');
const { isPlatformUsageRecordV1 } = require('../dist/contracts/platform-usage/v1.js');
const { Budget, SYNTHETIC_TRACE_RESERVATION } = require('../dist/modules/budget/use-cases.js');
const { handleBudgetTraceRequest } = require('../dist/adapters/http/budget-trace-handler.js');
const { handleBudgetTraceJob } = require('../dist/worker/budget-trace-handler.js');

const taskId = 'e5ea330c-48e5-44c2-b383-7382890524be';
const budgetActionId = 'a1ea330c-48e5-44c2-b383-7382890524be';

class DurableFake {
  constructor(rows = new Map()) {
    this.rows = rows;
    this.effects = new Set();
    this.jobs = new Map();
  }
  async create() {
    const task = {
      id: taskId, state: 'queued', createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z', errorCode: null,
    };
    task.attemptNumber = -1;
    this.rows.set(task.id, task);
    this.jobs.set(task.id, { state: 'created', retryCount: 0 });
    const { attemptNumber, ...publicTask } = task;
    return { ...publicTask, attemptNumber: attemptNumber >= 0 ? attemptNumber : null };
  }
  async find(id) {
    const row = this.rows.get(id);
    if (!row) return null;
    const { attemptNumber, ...task } = row;
    return { ...task, attemptNumber: attemptNumber >= 0 ? attemptNumber : null };
  }
  async markProcessing(id, attempt) {
    const row = this.rows.get(id);
    if (!row || !((row.state === 'queued' && row.attemptNumber <= attempt)
      || (row.state === 'processing' && row.attemptNumber < attempt))) return false;
    Object.assign(row, { state: 'processing', attemptNumber: attempt, errorCode: null });
    return true;
  }
  async complete(id, attempt) {
    const row = this.rows.get(id);
    if (!row || row.state !== 'processing' || row.attemptNumber !== attempt) return false;
    this.effects.add(id);
    Object.assign(row, { state: 'completed', errorCode: null });
    return true;
  }
  async markAttemptFailed(id, attempt) {
    const row = this.rows.get(id);
    if (row?.state !== 'processing' || row.attemptNumber !== attempt) return false;
    row.errorCode = 'attempt_failed';
    return true;
  }
  async retry(id) {
    const row = this.rows.get(id);
    if (!row) return { status: 'not_found' };
    if (row.state !== 'failed' || this.jobs.get(id)?.state !== 'failed') return { status: 'not_failed' };
    const job = this.jobs.get(id);
    Object.assign(row, {
      state: 'queued', attemptNumber: Math.max(row.attemptNumber, job.retryCount + 1), errorCode: null,
    });
    job.state = 'retry';
    return { status: 'retried', task: await this.find(id) };
  }
}

class BudgetFake {
  constructor() {
    this.reservations = new Map();
    this.jobs = new Map();
  }
  async reserveSyntheticTrace(actionId) {
    if (!this.reservations.has(actionId)) {
      this.reservations.set(actionId, {
        actionId,
        ...SYNTHETIC_TRACE_RESERVATION,
        createdAt: '2026-10-23T00:00:00.000Z',
      });
      this.jobs.set(actionId, { id: actionId, state: 'created' });
    }
    return this.reservations.get(actionId);
  }
  async findSyntheticTrace(actionId) {
    return this.reservations.get(actionId) ?? null;
  }
}

test('a redelivery after the effect commit keeps the original key and one effect', async () => {
  const repository = new DurableFake();
  const web = new PlatformSmoke(repository);
  const accepted = await web.accept();
  assert.equal(accepted.state, 'queued');
  assert.equal(accepted.attemptNumber, null);

  const firstAttempt = new PlatformSmoke(repository);
  assert.equal(await firstAttempt.start(accepted.id, 0), true);
  assert.equal(await firstAttempt.complete(accepted.id, 0), true);

  const restartedWorker = new PlatformSmoke(repository);
  assert.equal(await restartedWorker.start(accepted.id, 1), false);
  assert.equal(repository.effects.size, 1);
  assert.deepEqual(await web.lookup(accepted.id), { ...accepted, state: 'completed', attemptNumber: 0 });
});

test('terminal recovery reuses the task and idempotency key for one extra attempt', async () => {
  const repository = new DurableFake();
  const smoke = new PlatformSmoke(repository);
  const accepted = await smoke.accept();
  assert.equal(await smoke.start(accepted.id, 0), true);
  assert.equal(await smoke.complete(accepted.id, 0), true);

  const task = repository.rows.get(accepted.id);
  Object.assign(task, { state: 'failed', errorCode: 'retries_exhausted' });
  repository.jobs.set(accepted.id, { state: 'failed', retryCount: 2 });
  assert.deepEqual(await smoke.lookup(accepted.id), {
    ...accepted, state: 'failed', attemptNumber: 0, errorCode: 'retries_exhausted',
  });
  const recovered = await smoke.retry(accepted.id);
  assert.equal(recovered.status, 'retried');
  assert.equal(recovered.task.id, accepted.id);
  assert.equal(recovered.task.state, 'queued');
  assert.equal(recovered.task.attemptNumber, 3);
  assert.equal(repository.rows.get(accepted.id).attemptNumber, 3);

  assert.equal(await smoke.start(accepted.id, 3), true);
  assert.equal(await smoke.complete(accepted.id, 3), true);
  assert.equal(repository.effects.size, 1);
  assert.equal((await smoke.lookup(accepted.id)).id, accepted.id);
  assert.equal(mapSmokeRetryResult(recovered).status, 202);
});

test('a delayed failure from an older attempt cannot replace a newer completion', async () => {
  const repository = new DurableFake();
  const smoke = new PlatformSmoke(repository);
  const accepted = await smoke.accept();
  assert.equal(await smoke.start(accepted.id, 0), true);
  assert.equal(await smoke.start(accepted.id, 1), true);
  assert.equal(await smoke.complete(accepted.id, 1), true);
  assert.equal(await smoke.failAttempt(accepted.id, 0), false);
  assert.equal((await smoke.lookup(accepted.id)).state, 'completed');
});

test('a duplicate delivery cannot reclaim an already processing attempt', async () => {
  const repository = new DurableFake();
  const smoke = new PlatformSmoke(repository);
  const accepted = await smoke.accept();

  assert.equal(await smoke.start(accepted.id, 0), true);
  assert.equal(await smoke.start(accepted.id, 0), false);
  assert.equal(await smoke.start(accepted.id, 1), true);
});

test('a failure before the effect leaves the task retryable without an effect', async () => {
  const repository = new DurableFake();
  const smoke = new PlatformSmoke(repository);
  const accepted = await smoke.accept();
  assert.equal(await smoke.start(accepted.id, 0), true);
  await smoke.failAttempt(accepted.id, 0);
  assert.equal((await smoke.lookup(accepted.id)).state, 'processing');
  assert.equal(repository.effects.size, 0);
  assert.equal(await smoke.start(accepted.id, 1), true);
  assert.equal(await smoke.complete(accepted.id, 1), true);
  assert.equal(repository.effects.size, 1);
});

test('recovery rejects missing, active, and queued tasks without changing them', async () => {
  const repository = new DurableFake();
  const smoke = new PlatformSmoke(repository);
  assert.deepEqual(await smoke.retry(taskId), { status: 'not_found' });
  const accepted = await smoke.accept();
  const before = await smoke.lookup(accepted.id);
  const queuedJobBefore = { ...repository.jobs.get(accepted.id) };
  assert.deepEqual(await smoke.retry(accepted.id), { status: 'not_failed' });
  assert.deepEqual(await smoke.lookup(accepted.id), before);
  assert.deepEqual(repository.jobs.get(accepted.id), queuedJobBefore);
  assert.equal(mapSmokeRetryResult({ status: 'not_found' }).status, 404);
  assert.equal(mapSmokeRetryResult({ status: 'not_failed' }).status, 409);
});

test('retry HTTP handler authorizes before repository access and rejects invalid or queued retries', async () => {
  const previous = {
    environment: process.env.PLATFORM_ENVIRONMENT,
    stagingSecret: process.env.STAGING_SMOKE_SECRET,
  };
  process.env.PLATFORM_ENVIRONMENT = 'staging';
  process.env.STAGING_SMOKE_SECRET = 'a'.repeat(64);
  try {
    const repository = new DurableFake();
    const smoke = new PlatformSmoke(repository);
    let repositoryCalls = 0;
    const retry = async (id) => {
      repositoryCalls += 1;
      return smoke.retry(id);
    };

    const unauthorized = await handleSmokeRetryRequest(
      new Request('http://local', { method: 'POST' }),
      Promise.resolve({ id: taskId }),
      retry,
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get('Cache-Control'), 'no-store');
    assert.equal(repositoryCalls, 0);

    const authorizedRequest = () => new Request('http://local', {
      method: 'POST', headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
    });
    const invalid = await handleSmokeRetryRequest(
      authorizedRequest(), Promise.resolve({ id: 'invalid' }), retry,
    );
    assert.equal(invalid.status, 404);
    assert.equal(invalid.headers.get('Cache-Control'), 'no-store');
    assert.equal(repositoryCalls, 0);

    const queuedTask = await smoke.accept();
    const queuedJobBefore = { ...repository.jobs.get(queuedTask.id) };
    const queued = await handleSmokeRetryRequest(
      authorizedRequest(), Promise.resolve({ id: queuedTask.id }), retry,
    );
    assert.equal(queued.status, 409);
    assert.equal(queued.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await queued.json(), { error: 'not_retryable' });
    assert.equal(repositoryCalls, 1);
    assert.deepEqual(repository.jobs.get(queuedTask.id), queuedJobBefore);
  } finally {
    if (previous.environment === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.environment;
    if (previous.stagingSecret === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.stagingSecret;
  }
});

test('smoke submit uses the environment-specific secret and rejects credentials before writes', async () => {
  const previous = {
    environment: process.env.PLATFORM_ENVIRONMENT,
    stagingSecret: process.env.STAGING_SMOKE_SECRET,
    productionSecret: process.env.PRODUCTION_SMOKE_SECRET,
  };
  process.env.PLATFORM_ENVIRONMENT = 'production';
  process.env.STAGING_SMOKE_SECRET = 's'.repeat(64);
  process.env.PRODUCTION_SMOKE_SECRET = 'p'.repeat(64);
  try {
    let writes = 0;
    const request = (secret, body) => new Request('http://local/api/internal/smoke', {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      ...(body === undefined ? {} : { body }),
    });
    const acceptSynthetic = async () => {
      writes += 1;
      return { id: taskId, state: 'queued', attemptNumber: null };
    };

    const missing = await handleSmokeSubmitRequest(request(), acceptSynthetic);
    const stagingSecret = await handleSmokeSubmitRequest(
      request(process.env.STAGING_SMOKE_SECRET, JSON.stringify({ type: 'customer_upload', payload: 'ignored' })),
      acceptSynthetic,
    );
    assert.equal(missing.status, 401);
    assert.equal(stagingSecret.status, 401);
    assert.equal(missing.headers.get('Cache-Control'), 'no-store');
    assert.equal(writes, 0);

    const bodyBearing = await handleSmokeSubmitRequest(
      request(process.env.PRODUCTION_SMOKE_SECRET, JSON.stringify({ type: 'customer_upload', payload: 'ignored' })),
      acceptSynthetic,
    );
    assert.equal(bodyBearing.status, 400);
    assert.equal(bodyBearing.headers.get('Cache-Control'), 'no-store');
    assert.equal(writes, 0);

    const bodyless = await handleSmokeSubmitRequest(request(process.env.PRODUCTION_SMOKE_SECRET, ''), acceptSynthetic);
    assert.equal(bodyless.status, 202);
    assert.equal(bodyless.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await bodyless.json(), { id: taskId, state: 'queued', attemptNumber: null });
    assert.equal(writes, 1);

    const source = readFileSync(new URL('../src/app/api/internal/smoke/route.ts', import.meta.url), 'utf8');
    assert.match(source, /new PlatformSmoke\(new PostgresSmokeRepository\(\)\)\.accept\(\)/);
    assert.doesNotMatch(source, /request\.json\s*\(/);
  } finally {
    if (previous.environment === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.environment;
    if (previous.stagingSecret === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.stagingSecret;
    if (previous.productionSecret === undefined) delete process.env.PRODUCTION_SMOKE_SECRET;
    else process.env.PRODUCTION_SMOKE_SECRET = previous.productionSecret;
  }
});

test('Budget trace requires staging/production auth, an empty body, and a stable UUID key', async () => {
  const previous = {
    environment: process.env.PLATFORM_ENVIRONMENT,
    stagingSecret: process.env.STAGING_SMOKE_SECRET,
    productionSecret: process.env.PRODUCTION_SMOKE_SECRET,
  };
  process.env.PLATFORM_ENVIRONMENT = 'production';
  process.env.STAGING_SMOKE_SECRET = 's'.repeat(64);
  process.env.PRODUCTION_SMOKE_SECRET = 'p'.repeat(64);
  try {
    const repository = new BudgetFake();
    const budget = new Budget(repository);
    const request = ({ secret, key, body } = {}) => new Request('http://local/api/internal/budget/trace', {
      method: 'POST',
      headers: {
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body === undefined ? {} : { body }),
    });

    const unauthorized = await handleBudgetTraceRequest(
      request({ key: budgetActionId }), (id) => budget.reserveSyntheticTrace(id),
    );
    const wrongEnvironmentSecret = await handleBudgetTraceRequest(
      request({ secret: process.env.STAGING_SMOKE_SECRET, key: budgetActionId }),
      (id) => budget.reserveSyntheticTrace(id),
    );
    const invalidKey = await handleBudgetTraceRequest(
      request({ secret: process.env.PRODUCTION_SMOKE_SECRET, key: 'not-a-uuid' }),
      (id) => budget.reserveSyntheticTrace(id),
    );
    const bodyBearing = await handleBudgetTraceRequest(
      request({ secret: process.env.PRODUCTION_SMOKE_SECRET, key: budgetActionId, body: '{}' }),
      (id) => budget.reserveSyntheticTrace(id),
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(wrongEnvironmentSecret.status, 401);
    assert.equal(invalidKey.status, 400);
    assert.equal(bodyBearing.status, 400);
    for (const response of [unauthorized, wrongEnvironmentSecret, invalidKey, bodyBearing]) {
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(repository.reservations.size, 0);
    assert.equal(repository.jobs.size, 0);

    const accepted = await handleBudgetTraceRequest(
      request({ secret: process.env.PRODUCTION_SMOKE_SECRET, key: budgetActionId.toUpperCase() }),
      (id) => budget.reserveSyntheticTrace(id),
    );
    const replay = await handleBudgetTraceRequest(
      request({ secret: process.env.PRODUCTION_SMOKE_SECRET, key: budgetActionId }),
      (id) => budget.reserveSyntheticTrace(id),
    );
    assert.equal(accepted.status, 202);
    assert.equal(replay.status, 202);
    assert.equal(accepted.headers.get('Cache-Control'), 'no-store');
    const acceptedValue = await accepted.json();
    const replayValue = await replay.json();
    assert.deepEqual(acceptedValue, replayValue);
    assert.equal(acceptedValue.actionId, budgetActionId);
    assert.equal(repository.reservations.size, 1);
    assert.equal(repository.jobs.size, 1);
  } finally {
    if (previous.environment === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.environment;
    if (previous.stagingSecret === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.stagingSecret;
    if (previous.productionSecret === undefined) delete process.env.PRODUCTION_SMOKE_SECRET;
    else process.env.PRODUCTION_SMOKE_SECRET = previous.productionSecret;
  }
});

test('concurrent Budget reservations and worker redelivery retain one synthetic reservation and job', async () => {
  const repository = new BudgetFake();
  const budget = new Budget(repository);
  const actions = await Promise.all(Array.from({ length: 12 }, () => budget.reserveSyntheticTrace(budgetActionId)));
  assert.ok(actions.every((action) => action.actionId === budgetActionId));
  assert.equal(repository.reservations.size, 1);
  assert.equal(repository.jobs.size, 1);
  assert.equal(actions[0].amountMinor, 1);
  assert.equal(actions[0].currency, 'BRL');
  assert.equal(actions[0].category, 'synthetic_trace');

  await handleBudgetTraceJob({ actionId: budgetActionId, jobId: budgetActionId, attemptNumber: 0 }, { budget });
  await handleBudgetTraceJob({ actionId: budgetActionId, jobId: budgetActionId, attemptNumber: 1 }, { budget });
  assert.equal(repository.reservations.size, 1);
  assert.equal(repository.jobs.size, 1);
  await assert.rejects(
    handleBudgetTraceJob({ actionId: budgetActionId, jobId: taskId, attemptNumber: 2 }, { budget }),
    /invalid_budget_trace_job/,
  );
});

test('failed persistence cannot report acceptance', async () => {
  const smoke = new PlatformSmoke({ create: async () => { throw new Error('database unavailable'); } });
  await assert.rejects(smoke.accept(), /database unavailable/);
});

test('missing or wrong secret denies access before state is read', () => {
  const previous = {
    environment: process.env.PLATFORM_ENVIRONMENT,
    stagingSecret: process.env.STAGING_SMOKE_SECRET,
  };
  process.env.PLATFORM_ENVIRONMENT = 'staging';
  process.env.STAGING_SMOKE_SECRET = 'a'.repeat(64);
  try {
    assert.equal(isAuthorized(new Request('http://local')), false);
    assert.equal(isAuthorized(new Request('http://local', { headers: { Authorization: 'Bearer wrong' } })), false);
    assert.equal(isAuthorized(new Request('http://local', { headers: { Authorization: `Bearer ${'a'.repeat(64)}` } })), true);
  } finally {
    if (previous.environment === undefined) delete process.env.PLATFORM_ENVIRONMENT;
    else process.env.PLATFORM_ENVIRONMENT = previous.environment;
    if (previous.stagingSecret === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous.stagingSecret;
  }
});

test('web and worker readiness return safe 200 and 503 responses with no-store', async () => {
  const ready = await getReadinessResult(async () => true);
  const unavailable = await getReadinessResult(async () => { throw new Error('database-password sentinel'); });
  assert.deepEqual(ready, { status: 200, body: { status: 'ok' } });
  assert.deepEqual(unavailable, { status: 503, body: { status: 'unavailable' } });
  assert.equal(JSON.stringify(unavailable).includes('database-password sentinel'), false);
  assert.equal(readinessResponse(ready).headers.get('Cache-Control'), 'no-store');

  let dependencyAvailable = true;
  const server = createWorkerHealthServer(async () => dependencyAvailable);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const healthy = await fetch(`${baseUrl}/health`);
    assert.equal(healthy.status, 200);
    assert.equal(healthy.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await healthy.json(), { status: 'ok' });

    dependencyAvailable = false;
    const unhealthy = await fetch(`${baseUrl}/health`);
    assert.equal(unhealthy.status, 503);
    assert.deepEqual(await unhealthy.json(), { status: 'unavailable' });
    const notPublic = await fetch(`${baseUrl}/`);
    assert.equal(notPublic.status, 404);
    assert.equal(notPublic.headers.get('Cache-Control'), 'no-store');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('customer and media routes remain blocked until privacy, cost, and backup evidence are approved', () => {
  const base = { PLATFORM_ENVIRONMENT: 'production' };
  const approvals = {
    PRODUCTION_PRIVACY_APPROVED: 'true',
    PRODUCTION_COST_RECONCILED: 'true',
    PRODUCTION_BACKUP_RESTORE_VERIFIED: 'true',
    PRODUCTION_COST_ALERTS_60_80_95_VERIFIED: 'true',
    PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED: 'true',
    PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED: 'true',
  };
  for (const missing of Object.keys(approvals)) {
    const environment = { ...base, ...approvals };
    delete environment[missing];
    assert.equal(shouldBlockCustomerMediaPath('/api/customer/profile', environment), true);
    assert.equal(shouldBlockCustomerMediaPath('/api/media/photo', environment), true);
    assert.equal(isPublicStoryPath('/api/customer/profile', environment), false);
    assert.equal(isPublicStoryPath('/api/media/photo', environment), false);
  }
  assert.equal(shouldBlockCustomerMediaPath('/api/customers', base), true);
  assert.equal(shouldBlockCustomerMediaPath('/api/media/photo', base), true);
  assert.equal(shouldBlockCustomerMediaPath('/api/internal/smoke', base), false);
  assert.equal(shouldBlockCustomerMediaPath('/api/media/photo', { ...base, ...approvals }), false);
  assert.equal(shouldBlockCustomerMediaPath('/api/media/photo', { ...approvals, PLATFORM_ENVIRONMENT: 'staging' }), true);
  assert.equal(isPublicStoryPath('/api/health', base), true);
  assert.equal(isPublicStoryPath('/api/internal/smoke', base), true);
  assert.equal(isPublicStoryPath('/api/internal/budget/trace', base), true);
  assert.equal(isPublicStoryPath('/api/internal/budget/trace/extra', base), false);
  assert.equal(isPublicStoryPath(`/api/internal/smoke/${taskId}/retry`, base), true);
  assert.equal(isPublicStoryPath('/', base), false);
  assert.equal(isPublicStoryPath('/api/other', base), false);
  assert.equal(isPublicStoryPath('/api/media/photo', base), false);
  assert.equal(isPublicStoryPath('/api/customer/profile', base), false);
  assert.equal(isPublicStoryPath('/api/media/photo', { ...base, ...approvals }), true);
});

test('worker emits correlated start, retry failure, and completion events', async () => {
  const events = [];
  const smoke = {
    start: async () => true,
    complete: async () => true,
    failAttempt: async () => true,
  };
  const dependencies = {
    smoke,
    emit: (event) => events.push(event),
    now: () => '2026-10-19T12:00:00.000Z',
  };

  await assert.rejects(
    handlePlatformSmokeJob({ correlationId: taskId, attemptNumber: 0, failUntilAttempt: 1 }, dependencies),
    { message: 'processing_failed' },
  );
  await handlePlatformSmokeJob({ correlationId: taskId, attemptNumber: 1, failUntilAttempt: 1 }, dependencies);

  assert.deepEqual(events.map(({ type, correlationId, attemptNumber, state, errorCode }) => ({
    type, correlationId, attemptNumber, state, ...(errorCode ? { errorCode } : {}),
  })), [
    { type: 'smoke_started', correlationId: taskId, attemptNumber: 0, state: 'processing' },
    { type: 'smoke_attempt_failed', correlationId: taskId, attemptNumber: 0, state: 'processing', errorCode: 'attempt_failed' },
    { type: 'smoke_started', correlationId: taskId, attemptNumber: 1, state: 'processing' },
    { type: 'smoke_completed', correlationId: taskId, attemptNumber: 1, state: 'completed' },
  ]);
  assert.ok(events.every((event) => event.occurredAt === '2026-10-19T12:00:00.000Z'));
});

test('terminal failure keeps the final attempt visible with a stable error code', async () => {
  const repository = new DurableFake();
  const smoke = new PlatformSmoke(repository);
  const accepted = await smoke.accept();
  const events = [];

  for (const attemptNumber of [0, 1, 2]) {
    await assert.rejects(handlePlatformSmokeJob({
      correlationId: accepted.id, attemptNumber, failUntilAttempt: 3,
    }, {
      smoke,
      emit: (event) => events.push(event),
      now: () => '2026-10-19T12:00:00.000Z',
    }), { message: 'processing_failed' });
  }
  Object.assign(repository.rows.get(accepted.id), { state: 'failed', errorCode: 'retries_exhausted' });

  const terminal = await smoke.lookup(accepted.id);
  assert.equal(terminal.state, 'failed');
  assert.equal(terminal.attemptNumber, 2);
  assert.equal(terminal.errorCode, 'retries_exhausted');
  assert.deepEqual(events.filter((event) => event.type === 'smoke_attempt_failed')
    .map((event) => [event.correlationId, event.attemptNumber, event.errorCode]), [
    [accepted.id, 0, 'attempt_failed'],
    [accepted.id, 1, 'attempt_failed'],
    [accepted.id, 2, 'attempt_failed'],
  ]);
});

test('infrastructure events and console serialization exclude payloads, credentials, and exception text', async () => {
  const sensitive = 'private payload credential exception stack sentinel';
  const records = [];
  const originalInfo = console.info;
  console.info = (...args) => records.push(args);
  try {
    const smoke = {
      start: async () => true,
      complete: async () => { throw new Error(sensitive); },
      failAttempt: async () => { throw new Error(`failed to persist ${sensitive}`); },
    };
    await assert.rejects(handlePlatformSmokeJob({
      correlationId: taskId,
      attemptNumber: 0,
      failUntilAttempt: 0,
      payload: sensitive,
      credentials: sensitive,
    }, { smoke, emit: emitPlatformEvent, now: () => '2026-10-19T12:00:00.000Z' }), {
      message: 'processing_failed',
    });

    emitPlatformEvent({
      type: 'smoke_attempt_failed',
      correlationId: taskId,
      attemptNumber: 4,
      state: 'processing',
      errorCode: sensitive,
      occurredAt: '2026-10-19T12:00:00.000Z',
      payload: sensitive,
      accessToken: sensitive,
    });
  } finally {
    console.info = originalInfo;
  }

  const serialized = JSON.stringify(records);
  assert.equal(serialized.includes(sensitive), false);
  const emitted = records.map(([line]) => JSON.parse(line));
  assert.deepEqual(emitted.map((event) => event.type), [
    'smoke_started', 'infrastructure_error', 'infrastructure_error', 'smoke_attempt_failed', 'smoke_attempt_failed',
  ]);
  assert.deepEqual(emitted.at(-1), {
    event: 'platform_event',
    service: 'worker',
    type: 'smoke_attempt_failed',
    correlationId: taskId,
    attemptNumber: 4,
    state: 'processing',
    occurredAt: '2026-10-19T12:00:00.000Z',
    errorCode: 'attempt_failed',
  });
  assert.ok(emitted.every((event) => Object.keys(event).every((key) => [
    'event', 'service', 'type', 'correlationId', 'attemptNumber', 'state', 'occurredAt', 'errorCode',
  ].includes(key))));
});

test('a failed attempt is reported with unknown state when its durable state update affects no row', async () => {
  const events = [];
  await assert.rejects(handlePlatformSmokeJob({
    correlationId: taskId,
    attemptNumber: 0,
    failUntilAttempt: 1,
  }, {
    smoke: {
      start: async () => true,
      complete: async () => false,
      failAttempt: async () => false,
    },
    emit: (event) => events.push(event),
    now: () => '2026-10-19T12:00:00.000Z',
  }), { message: 'processing_failed' });

  assert.deepEqual(events.map(({ type, state }) => [type, state]), [
    ['smoke_started', 'processing'],
    ['smoke_attempt_failed', 'unknown'],
  ]);
});

test('platform usage v1 records manual period and unknown cost without converting it to zero', () => {
  const record = {
    version: 'v1',
    resource: 'hosting',
    metric: 'reported_usage',
    quantity: 12.5,
    unit: 'provider_units',
    period: { from: '2026-10-01', to: '2026-11-01' },
    origin: 'manual_reconciliation',
  };

  assert.equal(isPlatformUsageRecordV1(record), true);
  assert.equal(Object.hasOwn(record, 'cost'), false);
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(record)), 'cost'), false);
  assert.equal(isPlatformUsageRecordV1({
    ...record, cost: { amountMinor: 0, currency: 'BRL' },
  }), true);
});

test('platform usage v1 rejects inherited required fields and inherited cost', () => {
  const record = {
    version: 'v1',
    resource: 'hosting',
    metric: 'reported_usage',
    quantity: 12.5,
    unit: 'provider_units',
    period: { from: '2026-10-01', to: '2026-11-01' },
    origin: 'manual_reconciliation',
  };

  assert.equal(isPlatformUsageRecordV1(Object.create(record)), false);
  assert.equal(isPlatformUsageRecordV1(Object.assign(Object.create({
    cost: { amountMinor: 0, currency: 'BRL' },
  }), record)), false);
});

test('platform usage v1 rejects impossible periods and malformed costs', () => {
  const record = {
    version: 'v1',
    resource: 'execution',
    metric: 'duration_seconds',
    quantity: 3.5,
    unit: 'seconds',
    period: { from: '2026-10-01', to: '2026-10-02' },
    origin: 'application_observation',
  };

  assert.equal(isPlatformUsageRecordV1({
    ...record, period: { from: '2026-02-30', to: '2026-03-02' },
  }), false);
  assert.equal(isPlatformUsageRecordV1({
    ...record, period: { from: '2026-10-02', to: '2026-10-02' },
  }), false);
  assert.equal(isPlatformUsageRecordV1({ ...record, cost: null }), false);
  assert.equal(isPlatformUsageRecordV1({
    ...record, cost: { amountMinor: -1, currency: 'BRL' },
  }), false);
  assert.equal(isPlatformUsageRecordV1({
    ...record, cost: { amountMinor: 10, currency: 'brl' },
  }), false);
});

test('platform usage v1 requires whole-number values for count metrics', () => {
  const record = {
    version: 'v1',
    resource: 'queue',
    metric: 'job_count',
    quantity: 1,
    unit: 'jobs',
    period: { from: '2026-10-01', to: '2026-10-02' },
    origin: 'application_observation',
  };

  for (const metric of ['job_count', 'attempt_count']) {
    assert.equal(isPlatformUsageRecordV1({ ...record, metric, quantity: 1 }), true);
    assert.equal(isPlatformUsageRecordV1({ ...record, metric, quantity: 0.5 }), false);
  }
});

test('platform usage v1 rejects trailing line terminators in normalized fields', () => {
  const record = {
    version: 'v1',
    resource: 'hosting',
    metric: 'reported_usage',
    quantity: 1,
    unit: 'provider_units',
    period: { from: '2026-10-01', to: '2026-10-02' },
    origin: 'manual_reconciliation',
  };

  assert.equal(isPlatformUsageRecordV1({ ...record, metric: 'reported_usage\n' }), false);
  assert.equal(isPlatformUsageRecordV1({
    ...record, cost: { amountMinor: 1, currency: 'BRL\r\n' },
  }), false);
  assert.equal(isPlatformUsageRecordV1({
    ...record, period: { from: record.period.from, to: '2026-10-02\n' },
  }), false);
});

test('platform usage v1 has no adapter or Budget implementation dependencies', () => {
  const source = readFileSync(new URL('../src/contracts/platform-usage/v1.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { PlatformSmoke } = require('../dist/modules/platform-smoke/use-cases.js');
const { isAuthorized } = require('../dist/adapters/http/staging-auth.js');
const { mapSmokeRetryResult } = require('../dist/adapters/http/smoke-retry-response.js');
const { handleSmokeRetryRequest } = require('../dist/adapters/http/smoke-retry-handler.js');
const { emitPlatformEvent } = require('../dist/adapters/console/platform-events.js');
const { handlePlatformSmokeJob } = require('../dist/worker/platform-smoke-handler.js');
const { isPlatformUsageRecordV1 } = require('../dist/contracts/platform-usage/v1.js');

const taskId = 'e5ea330c-48e5-44c2-b383-7382890524be';

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
  const previous = process.env.STAGING_SMOKE_SECRET;
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
    if (previous === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous;
  }
});

test('failed persistence cannot report acceptance', async () => {
  const smoke = new PlatformSmoke({ create: async () => { throw new Error('database unavailable'); } });
  await assert.rejects(smoke.accept(), /database unavailable/);
});

test('missing or wrong secret denies access before state is read', () => {
  const previous = process.env.STAGING_SMOKE_SECRET;
  process.env.STAGING_SMOKE_SECRET = 'a'.repeat(64);
  try {
    assert.equal(isAuthorized(new Request('http://local')), false);
    assert.equal(isAuthorized(new Request('http://local', { headers: { Authorization: 'Bearer wrong' } })), false);
    assert.equal(isAuthorized(new Request('http://local', { headers: { Authorization: `Bearer ${'a'.repeat(64)}` } })), true);
  } finally {
    if (previous === undefined) delete process.env.STAGING_SMOKE_SECRET;
    else process.env.STAGING_SMOKE_SECRET = previous;
  }
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
  const emitted = records.map(([, event]) => event);
  assert.deepEqual(emitted.map((event) => event.type), [
    'smoke_started', 'infrastructure_error', 'infrastructure_error', 'smoke_attempt_failed', 'smoke_attempt_failed',
  ]);
  assert.deepEqual(emitted.at(-1), {
    type: 'smoke_attempt_failed',
    correlationId: taskId,
    attemptNumber: 4,
    state: 'processing',
    occurredAt: '2026-10-19T12:00:00.000Z',
    errorCode: 'attempt_failed',
  });
  assert.ok(emitted.every((event) => Object.keys(event).every((key) => [
    'type', 'correlationId', 'attemptNumber', 'state', 'occurredAt', 'errorCode',
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

test('platform usage v1 has no adapter or Budget implementation dependencies', () => {
  const source = readFileSync(new URL('../src/contracts/platform-usage/v1.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m);
});

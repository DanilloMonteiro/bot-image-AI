import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PlatformSmoke } = require('../dist/modules/platform-smoke/use-cases.js');
const { isAuthorized } = require('../dist/adapters/http/staging-auth.js');
const { mapSmokeRetryResult } = require('../dist/adapters/http/smoke-retry-response.js');
const { handleSmokeRetryRequest } = require('../dist/adapters/http/smoke-retry-handler.js');

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
    const { attemptNumber: _attemptNumber, ...publicTask } = task;
    return publicTask;
  }
  async find(id) {
    const row = this.rows.get(id);
    if (!row) return null;
    const { attemptNumber: _attemptNumber, ...task } = row;
    return { ...task };
  }
  async markProcessing(id, attempt) {
    const row = this.rows.get(id);
    if (!row || !['queued', 'processing'].includes(row.state) || row.attemptNumber > attempt) return false;
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
    if (row?.state === 'processing' && row.attemptNumber === attempt) row.errorCode = 'attempt_failed';
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

  const firstAttempt = new PlatformSmoke(repository);
  assert.equal(await firstAttempt.start(accepted.id, 0), true);
  assert.equal(await firstAttempt.complete(accepted.id, 0), true);

  const restartedWorker = new PlatformSmoke(repository);
  assert.equal(await restartedWorker.start(accepted.id, 1), false);
  assert.equal(repository.effects.size, 1);
  assert.deepEqual(await web.lookup(accepted.id), { ...accepted, state: 'completed' });
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
  assert.deepEqual(await smoke.lookup(accepted.id), { ...accepted, state: 'failed', errorCode: 'retries_exhausted' });
  const recovered = await smoke.retry(accepted.id);
  assert.equal(recovered.status, 'retried');
  assert.equal(recovered.task.id, accepted.id);
  assert.equal(recovered.task.state, 'queued');
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
  await smoke.failAttempt(accepted.id, 0);
  assert.equal((await smoke.lookup(accepted.id)).state, 'completed');
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
    assert.equal(repositoryCalls, 0);

    const authorizedRequest = () => new Request('http://local', {
      method: 'POST', headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
    });
    const invalid = await handleSmokeRetryRequest(
      authorizedRequest(), Promise.resolve({ id: 'invalid' }), retry,
    );
    assert.equal(invalid.status, 404);
    assert.equal(repositoryCalls, 0);

    const queuedTask = await smoke.accept();
    const queuedJobBefore = { ...repository.jobs.get(queuedTask.id) };
    const queued = await handleSmokeRetryRequest(
      authorizedRequest(), Promise.resolve({ id: queuedTask.id }), retry,
    );
    assert.equal(queued.status, 409);
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

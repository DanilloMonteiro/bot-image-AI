import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PlatformSmoke } = require('../dist/modules/platform-smoke/use-cases.js');
const { isAuthorized } = require('../dist/adapters/http/staging-auth.js');

class DurableFake {
  constructor(rows = new Map()) { this.rows = rows; }
  async create() {
    const task = { id: 'e5ea330c-48e5-44c2-b383-7382890524be', state: 'queued', errorCode: null };
    this.rows.set(task.id, task);
    return { ...task };
  }
  async find(id) { return this.rows.get(id) ?? null; }
  async markProcessing(id) { this.rows.get(id).state = 'processing'; }
  async markCompleted(id) { this.rows.get(id).state = 'completed'; }
  async markFailed(id, code) { Object.assign(this.rows.get(id), { state: 'failed', errorCode: code }); }
}

test('accepted synthetic task keeps its correlation through a worker restart', async () => {
  const durableRows = new Map();
  const web = new PlatformSmoke(new DurableFake(durableRows));
  const accepted = await web.accept();
  assert.equal(accepted.state, 'queued');
  assert.equal((await web.lookup(accepted.id)).state, 'queued');

  const restartedWorker = new PlatformSmoke(new DurableFake(durableRows));
  await restartedWorker.start(accepted.id);
  await restartedWorker.complete(accepted.id);
  assert.deepEqual(await web.lookup(accepted.id), { ...accepted, state: 'completed' });
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

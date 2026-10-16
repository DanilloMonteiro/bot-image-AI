import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const secret = randomBytes(32).toString('hex');
const project = `imagesystem-smoke-${randomBytes(8).toString('hex')}`;
const env = {
  ...process.env,
  STAGING_SMOKE_SECRET: secret,
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  STAGING_SMOKE_TEST_MODE: '1',
  STAGING_SMOKE_TEST_FAIL_UNTIL_ATTEMPT: '0',
  STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT: '0',
};
const base = 'http://127.0.0.1:3000/api/internal/smoke';
const auth = { Authorization: `Bearer ${secret}` };
const compose = (...args) => execFileSync('docker', ['compose', '-p', project, ...args], { env, stdio: 'inherit' });
const composeOutput = (...args) => execFileSync('docker', ['compose', '-p', project, ...args], { env, encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function request(url, options = {}) {
  try { return await fetch(url, { ...options, signal: AbortSignal.timeout(5000) }); }
  catch { return null; }
}
async function waitFor(check, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await check()) return; await sleep(500); }
  throw new Error(`Timed out: ${label}`);
}
function effectAndJobState(id) {
  const sql = `SELECT COALESCE((SELECT state::text FROM pgboss.job WHERE name = 'platform-smoke' AND id = '${id}'::uuid), 'missing') || ':' || (SELECT count(*)::text FROM platform_smoke_effects WHERE id = '${id}'::uuid)`;
  return composeOutput('exec', '-T', 'db', 'psql', '-U', 'smoke', '-d', 'smoke', '-At', '-c', sql);
}
async function taskState(id) {
  const response = await request(`${base}/${id}`, { headers: auth });
  if (response?.status !== 200) return null;
  return response.json();
}

let started = false;
try {
  compose('up', '-d', '--build', '--wait', 'db', 'web');
  started = true;
  await waitFor(async () => (await request(base, { method: 'POST' }))?.status === 401, 'web ready');

  assert((await request(base, { method: 'POST' }))?.status === 401, 'unauthorized POST must be 401');
  assert((await request(`${base}/00000000-0000-4000-8000-000000000000`))?.status === 401, 'unauthorized GET must be 401');
  assert((await request(base, { method: 'POST', headers: { Authorization: 'Bearer wrong' } }))?.status === 401, 'wrong secret must be 401');

  compose('up', '-d', '--wait', 'worker');
  compose('stop', 'worker');
  const accepted = await request(base, { method: 'POST', headers: auth });
  assert(accepted?.status === 202, 'authorized POST must be 202');
  const task = await accepted.json();
  assert(typeof task.id === 'string' && task.state === 'queued', 'task must be durably queued');
  const queued = await request(`${base}/${task.id}`, { headers: auth });
  assert(queued?.status === 200 && (await queued.json()).state === 'queued', 'queued task must be queryable');
  assert((await request(`${base}/00000000-0000-4000-8000-000000000000/retry`, { method: 'POST', headers: auth }))?.status === 404, 'missing task retry must be 404');
  assert((await request(`${base}/${task.id}/retry`, { method: 'POST' }))?.status === 401, 'unauthorized retry must be 401');
  assert((await request(`${base}/${task.id}/retry`, { method: 'POST', headers: auth }))?.status === 409, 'queued task retry must be 409');

  env.STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT = '1';
  compose('up', '-d', '--force-recreate', '--wait', 'worker');
  await waitFor(async () => {
    try { return effectAndJobState(task.id) === 'completed:1'; } catch { return false; }
  }, 'post-commit crash redelivery and single effect');
  assert((await taskState(task.id))?.state === 'completed', 'crashed task must complete after redelivery');
  assert((await request(`${base}/${task.id}`, { headers: { Authorization: 'Bearer wrong' } }))?.status === 401, 'wrong secret must hide task');

  env.STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT = '0';
  env.STAGING_SMOKE_TEST_FAIL_UNTIL_ATTEMPT = '3';
  compose('up', '-d', '--force-recreate', '--wait', 'worker');
  const failedResponse = await request(base, { method: 'POST', headers: auth });
  assert(failedResponse?.status === 202, 'authorized failure task must be accepted');
  const failedTask = await failedResponse.json();
  await waitFor(async () => (await taskState(failedTask.id))?.state === 'failed', 'terminal failure visibility');
  const terminal = await taskState(failedTask.id);
  assert(terminal.errorCode === 'retries_exhausted', 'terminal failure must expose a safe code');
  assert((await request(`${base}/${failedTask.id}/retry`, { method: 'POST', headers: { Authorization: 'Bearer wrong' } }))?.status === 401, 'unauthorized recovery must be 401');
  const recovered = await request(`${base}/${failedTask.id}/retry`, { method: 'POST', headers: auth });
  assert(recovered?.status === 202, 'failed task recovery must be accepted');
  const recoveredTask = await recovered.json();
  assert(recoveredTask.id === failedTask.id && recoveredTask.state === 'queued', 'recovery must reuse the failed task');
  await waitFor(async () => {
    try { return effectAndJobState(failedTask.id) === 'completed:1'; } catch { return false; }
  }, 'manual terminal recovery with one effect');
  assert((await taskState(failedTask.id))?.state === 'completed', 'recovered task must complete');

  compose('stop', 'db');
  const unavailable = await request(base, { method: 'POST', headers: auth });
  assert(unavailable?.status === 503, 'database loss must return 503');
  assert(!(await unavailable.json()).id, 'failed POST must not return an accepted ID');
  console.log(`Smoke passed: ${task.id} crashed after commit and recovered with one effect; ${failedTask.id} reached terminal failure and recovered with one effect; auth and database failure checked.`);
} finally {
  if (started) compose('down', '-v');
}

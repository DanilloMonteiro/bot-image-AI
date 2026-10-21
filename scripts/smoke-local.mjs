import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const secret = randomBytes(32).toString('hex');
const project = `imagesystem-smoke-${randomBytes(8).toString('hex')}`;
const env = {
  ...process.env,
  PLATFORM_ENVIRONMENT: 'staging',
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
  let response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) }); }
  catch { return null; }
  assert(response.headers.get('Cache-Control')?.toLowerCase() === 'no-store', `private response must disable caching: ${new URL(url).pathname}`);
  return response;
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
function workerHealthStatus() {
  const probe = "fetch('http://127.0.0.1:3001/health').then((response) => process.stdout.write(String(response.status))).catch(() => process.exit(1))";
  return execFileSync('docker', ['compose', '-p', project, 'exec', '-T', 'worker', 'node', '-e', probe], {
    env, encoding: 'utf8',
  }).trim();
}
function hasPlatformEvent(logs, type, correlationId, attemptNumber, state) {
  return logs.split(/\r?\n/).some((line) => {
    const start = line.indexOf('{');
    if (start < 0) return false;
    try {
      const event = JSON.parse(line.slice(start));
      return event.event === 'platform_event'
        && event.type === type
        && event.correlationId === correlationId
        && event.attemptNumber === attemptNumber
        && event.state === state;
    } catch {
      return false;
    }
  });
}
function checkPostgresAttemptGuard() {
  const source = [
    "import assert from 'node:assert/strict';",
    "import { PostgresSmokeRepository, getBoss } from '/app/dist/adapters/postgres/smoke-repository.js';",
    'const repository = new PostgresSmokeRepository();',
    'let initialized = false;',
    'let exitCode = 0;',
    "let output = '';",
    'try {',
    '  const task = await repository.create();',
    '  initialized = true;',
    "  assert.equal(await repository.markProcessing(task.id, 0), true, 'first PostgreSQL attempt must start');",
    "  assert.equal(await repository.markProcessing(task.id, 0), false, 'duplicate PostgreSQL attempt must be ignored');",
    "  assert.equal(await repository.markProcessing(task.id, 1), true, 'newer PostgreSQL attempt must start');",
    "  assert.equal(await repository.complete(task.id, 1), true, 'newer PostgreSQL attempt must complete');",
    "  assert.equal((await repository.find(task.id))?.attemptNumber, 1, 'PostgreSQL read must expose the attempt');",
    '  output = task.id;',
    '} catch (error) {',
    '  console.error(error);',
    '  exitCode = 1;',
    '} finally {',
    '  if (initialized) {',
    '    try { await getBoss().stop(); } catch (error) { console.error(error); exitCode = 1; }',
    '  }',
    '  process.stdout.write(output, () => process.exit(exitCode));',
    '}',
  ].join('\n');
  return execFileSync('docker', ['compose', '-p', project, 'exec', '-T', 'web', 'node', '--input-type=module', '-'], {
    env, input: source, encoding: 'utf8',
  }).trim();
}
function exerciseStaleAttemptFence(id) {
  const program = `const { PostgresSmokeRepository, getBoss } = require('./dist/adapters/postgres/smoke-repository.js');
(async () => {
  let exitCode = 0;
  try {
    const repository = new PostgresSmokeRepository();
    if (!(await repository.markProcessing('${id}', 1))) throw new Error('new_attempt_not_started');
    await repository.markAttemptFailed('${id}', 0);
    const task = await repository.find('${id}');
    if (task?.state !== 'processing' || task.errorCode !== null) throw new Error('stale_failure_overwrote_current_attempt');
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    try { await getBoss().stop(); } catch {}
    process.stdout.write(exitCode === 0 ? 'attempt_fence_ok\\n' : 'attempt_fence_failed\\n', () => process.exit(exitCode));
  }
})();`;
  return execFileSync('docker', ['compose', '-p', project, 'exec', '-T', 'web', 'node', '-e', program], {
    env, encoding: 'utf8',
  }).trim();
}
async function taskState(id) {
  const response = await request(`${base}/${id}`, { headers: auth });
  if (response?.status !== 200) return null;
  return response.json();
}

let cleanupNeeded = false;
try {
  cleanupNeeded = true;
  compose('up', '-d', '--build', '--wait', 'db', 'web');
  await waitFor(async () => (await request(base, { method: 'POST' }))?.status === 401, 'web ready');

  assert((await request(base, { method: 'POST' }))?.status === 401, 'unauthorized POST must be 401');
  assert((await request(`${base}/00000000-0000-4000-8000-000000000000`))?.status === 401, 'unauthorized GET must be 401');
  assert((await request(base, { method: 'POST', headers: { Authorization: 'Bearer wrong' } }))?.status === 401, 'wrong secret must be 401');

  compose('up', '-d', '--wait', 'worker');
  assert(workerHealthStatus() === '200', 'worker internal health must be ready after connecting to PostgreSQL and pg-boss');
  compose('stop', 'worker');
  const postgresAttemptTaskId = checkPostgresAttemptGuard();
  assert(typeof postgresAttemptTaskId === 'string', 'PostgreSQL attempt check must return its task ID');
  const postgresAttemptTask = await taskState(postgresAttemptTaskId);
  assert(postgresAttemptTask?.state === 'completed' && postgresAttemptTask.attemptNumber === 1, 'API must expose the PostgreSQL-backed attempt number');

  const accepted = await request(base, { method: 'POST', headers: auth });
  assert(accepted?.status === 202, 'authorized POST must be 202');
  const task = await accepted.json();
  assert(typeof task.id === 'string' && task.state === 'queued', 'task must be durably queued');
  const queued = await request(`${base}/${task.id}`, { headers: auth });
  const queuedTask = queued?.status === 200 ? await queued.json() : null;
  assert(queuedTask?.state === 'queued' && queuedTask.attemptNumber === null, 'queued task must expose no attempt before processing');
  assert((await request(`${base}/00000000-0000-4000-8000-000000000000/retry`, { method: 'POST', headers: auth }))?.status === 404, 'missing task retry must be 404');
  assert((await request(`${base}/${task.id}/retry`, { method: 'POST' }))?.status === 401, 'unauthorized retry must be 401');
  assert((await request(`${base}/${task.id}/retry`, { method: 'POST', headers: auth }))?.status === 409, 'queued task retry must be 409');

  env.STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT = '1';
  compose('up', '-d', '--force-recreate', '--wait', 'worker');
  await waitFor(async () => {
    try { return effectAndJobState(task.id) === 'completed:1'; } catch { return false; }
  }, 'post-commit crash redelivery and single effect');
  const completedTask = await taskState(task.id);
  assert(completedTask?.state === 'completed' && completedTask.attemptNumber === 0, 'crashed task must expose its completed attempt after redelivery');
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
  assert(Number.isSafeInteger(terminal.attemptNumber) && terminal.attemptNumber >= 2, 'terminal task must expose the last PostgreSQL-backed attempt');
  const failedWorkerLogs = composeOutput('logs', '--no-color', 'worker');
  assert(hasPlatformEvent(failedWorkerLogs, 'smoke_attempt_failed', failedTask.id, 0, 'processing'), 'real worker logs must contain the correlated failure event');
  assert((await request(`${base}/${failedTask.id}/retry`, { method: 'POST', headers: { Authorization: 'Bearer wrong' } }))?.status === 401, 'unauthorized recovery must be 401');
  const recovered = await request(`${base}/${failedTask.id}/retry`, { method: 'POST', headers: auth });
  assert(recovered?.status === 202, 'failed task recovery must be accepted');
  const recoveredTask = await recovered.json();
  assert(recoveredTask.id === failedTask.id && recoveredTask.state === 'queued', 'recovery must reuse the failed task');
  await waitFor(async () => {
    try { return effectAndJobState(failedTask.id) === 'completed:1'; } catch { return false; }
  }, 'manual terminal recovery with one effect');
  const recoveredTerminal = await taskState(failedTask.id);
  assert(recoveredTerminal?.state === 'completed' && recoveredTerminal.attemptNumber > terminal.attemptNumber, 'recovered task must expose its later PostgreSQL-backed attempt');
  const recoveredWorkerLogs = composeOutput('logs', '--no-color', 'worker');
  assert(hasPlatformEvent(recoveredWorkerLogs, 'smoke_completed', failedTask.id, recoveredTerminal.attemptNumber, 'completed'), 'recovered task must emit a correlated completion event from the real worker');

  compose('stop', 'worker');
  const fenceResponse = await request(base, { method: 'POST', headers: auth });
  assert(fenceResponse?.status === 202, 'attempt-fence task must be accepted');
  const fenceTask = await fenceResponse.json();
  assert(exerciseStaleAttemptFence(fenceTask.id).includes('attempt_fence_ok'), 'stale attempt failure must not alter a newer processing attempt');
  const fencedTask = await taskState(fenceTask.id);
  assert(fencedTask?.state === 'processing' && fencedTask.errorCode === null, 'newer processing attempt must keep its own status');

  compose('stop', 'db');
  await waitFor(() => {
    try { return workerHealthStatus() === '503'; } catch { return false; }
  }, 'worker health reports database loss');
  const unavailable = await request(base, { method: 'POST', headers: auth });
  assert(unavailable?.status === 503, 'database loss must return 503');
  assert(!(await unavailable.json()).id, 'failed POST must not return an accepted ID');
  console.log(`Smoke passed: PostgreSQL attempt guard; ${task.id} recovered after a crash following commit without duplicating its effect; ${failedTask.id} emitted failure/completion events and recovered with one effect; stale-attempt fencing, auth and database failure checked.`);
} finally {
  if (cleanupNeeded) compose('down', '-v');
}

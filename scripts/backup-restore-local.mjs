import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupRestoreResources, withCleanup } from './backup-restore-lifecycle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = join(root, 'compose.yaml');
const projectSuffix = randomBytes(12).toString('hex');
const apiBase = 'http://127.0.0.1:3000/api/internal/smoke';
const timeoutMs = 120000;
const dockerCommandTimeoutMs = 30 * 60 * 1000;

function docker(args, options = {}) {
  return execFileSync('docker', args, { cwd: root, timeout: dockerCommandTimeoutMs, ...options });
}

function makeRuntime(label) {
  const secret = randomBytes(32).toString('hex');
  return {
    project: 'imagesystem-restore-' + label + '-' + projectSuffix,
    secret,
    env: {
      ...process.env,
      POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
      STAGING_SMOKE_SECRET: secret,
      STAGING_SMOKE_TEST_MODE: '0',
      STAGING_SMOKE_TEST_FAIL_UNTIL_ATTEMPT: '0',
      STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT: '0',
    },
  };
}

function compose(runtime, ...args) {
  return docker([
    'compose',
    '--project-name', runtime.project,
    '--file', composeFile,
    ...args,
  ], { env: runtime.env, stdio: 'inherit' });
}

function composeOutput(runtime, ...args) {
  return docker([
    'compose',
    '--project-name', runtime.project,
    '--file', composeFile,
    ...args,
  ], { env: runtime.env, encoding: 'utf8' }).trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, secret, options = {}) {
  let response;
  const headers = {
    ...(options.headers ?? {}),
    ...(secret ? { Authorization: 'Bearer ' + secret } : {}),
  };
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
  assert(
    response.headers.get('Cache-Control')?.toLowerCase() === 'no-store',
    'private smoke responses must disable caching',
  );
  return response;
}

async function waitFor(check, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error('Timed out waiting for ' + label);
}

async function taskState(runtime, id) {
  const response = await request(apiBase + '/' + id, runtime.secret);
  if (response?.status !== 200) return null;
  return response.json();
}

function sourceTaskAndJobState(id) {
  const sql = "SELECT (SELECT state::text FROM platform_smoke_tasks WHERE id = '"
    + id
    + "'::uuid) || ':' || (SELECT count(*)::text FROM pgboss.job WHERE name = 'platform-smoke' AND id = '"
    + id
    + "'::uuid) || ':' || (SELECT count(*)::text FROM platform_smoke_effects WHERE id = '"
    + id
    + "'::uuid)";
  return composeOutput(
    source,
    'exec', '-T', 'db',
    'psql', '-U', 'smoke', '-d', 'smoke', '-At', '-c', sql,
  );
}

function assertLocalDockerContext() {
  const context = process.env.DOCKER_CONTEXT;
  const host = context
    ? docker([
      'context',
      'inspect',
      '--format',
      '{{.Endpoints.docker.Host}}',
      context,
    ], { encoding: 'utf8' }).trim()
    : process.env.DOCKER_HOST || docker([
      'context',
      'inspect',
      '--format',
      '{{.Endpoints.docker.Host}}',
    ], { encoding: 'utf8' }).trim();
  if (!host.startsWith('unix://') && !host.startsWith('npipe://')) {
    throw new Error('A local Docker context is required; remote Docker endpoints are not allowed');
  }
}

assertLocalDockerContext();

const source = makeRuntime('source');
const restored = makeRuntime('restored');
const tempDirectory = mkdtempSync(join(tmpdir(), 'imagesystem-restore-'));
const dumpPath = join(tempDirectory, 'synthetic-state.dump');
let passed = false;
let cleanupFailed = false;
let failureMessage;
let successMessage;

async function runRestore() {
  compose(source, 'up', '-d', '--build', '--wait', 'db', 'web');
  await waitFor(
    async () => (await request(apiBase, null, { method: 'POST' }))?.status === 401,
    'source web service',
  );

  const accepted = await request(apiBase, source.secret, { method: 'POST' });
  assert(accepted?.status === 202, 'source must accept a synthetic task');
  const task = await accepted.json();
  assert(
    typeof task.id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(task.id)
      && task.state === 'queued',
    'source must return a queued task with a UUID',
  );
  const sourceTask = await taskState(source, task.id);
  assert(sourceTask?.state === 'queued', 'source task must remain queued while its worker is stopped');

  const dumpFd = openSync(dumpPath, 'wx', 0o600);
  try {
    docker([
      'compose',
      '--project-name', source.project,
      '--file', composeFile,
      'exec', '-T', 'db',
      'pg_dump', '--format=custom', '-U', 'smoke', '-d', 'smoke',
    ], {
      cwd: root,
      env: source.env,
      stdio: ['ignore', dumpFd, 'inherit'],
    });
  } finally {
    closeSync(dumpFd);
  }
  assert(statSync(dumpPath).size > 0, 'PostgreSQL dump must not be empty');

  compose(source, 'stop', 'web');
  compose(restored, 'up', '-d', '--wait', 'db');
  docker([
    'compose',
    '--project-name', restored.project,
    '--file', composeFile,
    'exec', '-T', 'db',
    'pg_restore', '--no-owner', '-U', 'smoke', '-d', 'smoke',
  ], {
    cwd: root,
    env: restored.env,
    input: readFileSync(dumpPath),
    stdio: ['pipe', 'ignore', 'inherit'],
    maxBuffer: 1024 * 1024,
  });

  compose(restored, 'up', '-d', '--build', '--wait', 'web');
  await waitFor(
    async () => (await request(apiBase, null, { method: 'POST' }))?.status === 401,
    'restored web service',
  );
  const restoredTask = await taskState(restored, task.id);
  assert(restoredTask?.state === 'queued', 'restored API must return the original queued task');

  compose(restored, 'up', '-d', '--wait', 'worker');
  const sql = "SELECT COALESCE((SELECT state::text FROM pgboss.job WHERE name = 'platform-smoke' AND id = '"
    + task.id
    + "'::uuid), 'missing') || ':' || (SELECT count(*)::text FROM platform_smoke_effects WHERE id = '"
    + task.id
    + "'::uuid)";
  await waitFor(async () => {
    if ((await taskState(restored, task.id))?.state !== 'completed') return false;
    try {
      return composeOutput(
        restored,
        'exec', '-T', 'db',
        'psql', '-U', 'smoke', '-d', 'smoke', '-At', '-c', sql,
      ) === 'completed:1';
    } catch {
      return false;
    }
  }, 'restored task and job completion with exactly one effect');

  assert(sourceTaskAndJobState(task.id) === 'queued:1:0', 'source task and queue job must remain intact without a committed effect');

  successMessage = 'Backup and isolated restore passed for synthetic task '
    + task.id
    + ': task=completed, job=completed, effects=1.';
  passed = true;
}

try {
  await withCleanup(runRestore, () => {
    cleanupFailed = cleanupRestoreResources([restored, source], tempDirectory, compose);
  });
} catch (error) {
  failureMessage = error instanceof Error ? error.message : 'unknown error';
}

if (failureMessage) {
  console.error('Backup and isolated restore failed: ' + failureMessage);
  process.exitCode = 1;
}
if (cleanupFailed) {
  console.error('The local restore exercise did not clean up every resource it created');
  process.exitCode = 1;
}
if (passed && !cleanupFailed) console.log(successMessage);

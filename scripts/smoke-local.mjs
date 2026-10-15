import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const secret = randomBytes(32).toString('hex');
const project = `imagesystem-smoke-${randomBytes(8).toString('hex')}`;
const env = { ...process.env, STAGING_SMOKE_SECRET: secret, POSTGRES_PASSWORD: randomBytes(24).toString('hex') };
const base = 'http://127.0.0.1:3000/api/internal/smoke';
const auth = { Authorization: `Bearer ${secret}` };
const compose = (...args) => execFileSync('docker', ['compose', '-p', project, ...args], { env, stdio: 'inherit' });
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

  compose('up', '-d', '--wait', 'worker');
  await waitFor(async () => {
    const response = await request(`${base}/${task.id}`, { headers: auth });
    return response?.status === 200 && (await response.json()).state === 'completed';
  }, 'worker completion');
  assert((await request(`${base}/${task.id}`, { headers: { Authorization: 'Bearer wrong' } }))?.status === 401, 'wrong secret must hide task');

  compose('stop', 'db');
  const unavailable = await request(base, { method: 'POST', headers: auth });
  assert(unavailable?.status === 503, 'database loss must return 503');
  assert(!(await unavailable.json()).id, 'failed POST must not return an accepted ID');
  console.log(`Smoke passed: ${task.id}; queued, worker restarted, completed, auth and database failure checked.`);
} finally {
  if (started) compose('down', '-v');
}

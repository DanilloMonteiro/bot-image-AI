import { PostgresSmokeRepository, SMOKE_QUEUE, ensureReady, getBoss } from '../adapters/postgres/smoke-repository.js';
import { PlatformSmoke } from '../modules/platform-smoke/use-cases.js';

async function main(): Promise<void> {
  await ensureReady();
  const smoke = new PlatformSmoke(new PostgresSmokeRepository());
  const boss = getBoss();
  boss.on('error', () => console.error('queue_error'));
  await boss.work(SMOKE_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { correlationId?: unknown; kind?: unknown };
      const id = data.correlationId;
      if (typeof id !== 'string' || data.kind !== 'synthetic') throw new Error('invalid_job');
      const started = await smoke.start(id, job.retryCount);
      if (!started) continue;

      try {
        const failUntilAttempt = process.env.STAGING_SMOKE_TEST_MODE === '1'
          ? Number(process.env.STAGING_SMOKE_TEST_FAIL_UNTIL_ATTEMPT ?? 0)
          : 0;
        if (Number.isSafeInteger(failUntilAttempt) && job.retryCount < failUntilAttempt) {
          throw new Error('synthetic_failure');
        }
        const committed = await smoke.complete(id, job.retryCount);
        if (committed && process.env.STAGING_SMOKE_TEST_MODE === '1'
          && process.env.STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT === '1') {
          process.kill(process.pid, 'SIGKILL');
        }
      } catch {
        try { await smoke.failAttempt(id, job.retryCount); } catch { /* leave the durable state for queue reconciliation */ }
        throw new Error('processing_failed');
      }
      console.info('smoke_completed', { correlationId: id });
    }
  });
  console.info('worker_ready');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void boss.stop().then(() => process.exit(0)); });
  }
}

void main().catch(() => { console.error('worker_start_failed'); process.exit(1); });

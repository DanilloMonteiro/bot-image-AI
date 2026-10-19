import { PostgresSmokeRepository, SMOKE_QUEUE, ensureReady, getBoss } from '../adapters/postgres/smoke-repository.js';
import { emitPlatformEvent } from '../adapters/console/platform-events.js';
import { PlatformSmoke } from '../modules/platform-smoke/use-cases.js';
import { handlePlatformSmokeJob } from './platform-smoke-handler.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  await ensureReady();
  const smoke = new PlatformSmoke(new PostgresSmokeRepository());
  const boss = getBoss();
  boss.on('error', () => console.error('queue_error'));
  await boss.work(SMOKE_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { correlationId?: unknown; kind?: unknown };
      const id = data.correlationId;
      if (typeof id !== 'string' || !UUID_PATTERN.test(id) || data.kind !== 'synthetic') throw new Error('invalid_job');
      const testMode = process.env.STAGING_SMOKE_TEST_MODE === '1';
      const failUntilAttempt = testMode
        ? Number(process.env.STAGING_SMOKE_TEST_FAIL_UNTIL_ATTEMPT ?? 0)
        : 0;
      await handlePlatformSmokeJob({
        correlationId: id,
        attemptNumber: job.retryCount,
        failUntilAttempt,
        crashAfterCommit: testMode && process.env.STAGING_SMOKE_TEST_CRASH_AFTER_COMMIT === '1',
      }, {
        smoke,
        emit: emitPlatformEvent,
        crash: () => { process.kill(process.pid, 'SIGKILL'); },
      });
    }
  });
  console.info('worker_ready');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void boss.stop().then(() => process.exit(0)); });
  }
}

void main().catch(() => { console.error('worker_start_failed'); process.exit(1); });

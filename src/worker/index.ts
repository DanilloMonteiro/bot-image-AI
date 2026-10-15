import { PostgresSmokeRepository, SMOKE_QUEUE, ensureReady, getBoss } from '../adapters/postgres/smoke-repository.js';
import { PlatformSmoke } from '../modules/platform-smoke/use-cases.js';

async function main(): Promise<void> {
  await ensureReady();
  const smoke = new PlatformSmoke(new PostgresSmokeRepository());
  const boss = getBoss();
  boss.on('error', () => console.error('queue_error'));
  await boss.work(SMOKE_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const id = (job.data as { correlationId?: unknown }).correlationId;
      if (typeof id !== 'string') throw new Error('invalid_job');
      await smoke.start(id);
      await smoke.complete(id);
      console.info('smoke_completed', { correlationId: id });
    }
  });
  console.info('worker_ready');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void boss.stop().then(() => process.exit(0)); });
  }
}

void main().catch(() => { console.error('worker_start_failed'); process.exit(1); });

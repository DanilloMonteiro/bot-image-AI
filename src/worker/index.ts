import { PostgresSmokeRepository, SMOKE_QUEUE, checkRuntimeReadiness, ensureReady } from '../adapters/postgres/smoke-repository.js';
import { getBoss } from '../adapters/postgres/runtime.js';
import {
  BUDGET_TRACE_QUEUE,
  checkBudgetRuntimeReadiness,
  ensureBudgetReady,
  PostgresBudgetRepository,
} from '../adapters/postgres/budget-repository.js';
import { emitPlatformEvent } from '../adapters/console/platform-events.js';
import { PlatformSmoke } from '../modules/platform-smoke/use-cases.js';
import { Budget } from '../modules/budget/use-cases.js';
import { handlePlatformSmokeJob } from './platform-smoke-handler.js';
import { handleBudgetTraceJob } from './budget-trace-handler.js';
import { createWorkerHealthServer } from './health-server.js';
import type { Server } from 'node:http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeErrorDetails(error: unknown): { errorName: string; errorCode?: string } {
  const value = typeof error === 'object' && error !== null
    ? error as { name?: unknown; code?: unknown }
    : undefined;
  return {
    errorName: typeof value?.name === 'string' ? value.name : 'UnknownError',
    ...(typeof value?.code === 'string' ? { errorCode: value.code } : {}),
  };
}

let workerReady = false;
let healthServer: Server | undefined;

async function listenForHealth(port: number): Promise<void> {
  healthServer = createWorkerHealthServer(async () => workerReady
    && await checkRuntimeReadiness()
    && await checkBudgetRuntimeReadiness());
  await new Promise<void>((resolve, reject) => {
    healthServer?.once('error', reject);
    healthServer?.listen(port, '0.0.0.0', resolve);
  });
}

function structuredLog(event: string, details: Record<string, string | boolean | undefined> = {}): void {
  console.info(JSON.stringify({ event, service: 'worker', occurredAt: new Date().toISOString(), ...details }));
}

async function stop(boss: ReturnType<typeof getBoss>): Promise<void> {
  workerReady = false;
  const closeHealth = healthServer
    ? new Promise<void>((resolve) => healthServer?.close(() => resolve()))
    : Promise.resolve();
  await Promise.all([closeHealth, boss.stop()]);
}

async function main(): Promise<void> {
  const healthPort = Number(process.env.PORT ?? 3001);
  if (!Number.isSafeInteger(healthPort) || healthPort < 1 || healthPort > 65535) {
    throw new Error('invalid_health_port');
  }
  await listenForHealth(healthPort);
  await ensureReady();
  await ensureBudgetReady();
  const smoke = new PlatformSmoke(new PostgresSmokeRepository());
  const budget = new Budget(new PostgresBudgetRepository());
  const boss = getBoss();
  boss.on('error', (error) => structuredLog('queue_error', safeErrorDetails(error)));
  await boss.work(SMOKE_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const data: unknown = job.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_job');
      const jobData = data as { correlationId?: unknown; kind?: unknown };
      const id = jobData.correlationId;
      if (typeof id !== 'string' || !UUID_PATTERN.test(id) || jobData.kind !== 'synthetic') throw new Error('invalid_job');
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
  await boss.work(BUDGET_TRACE_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const data: unknown = job.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_job');
      const jobData = data as { actionId?: unknown; kind?: unknown };
      if (typeof jobData.actionId !== 'string'
        || jobData.kind !== 'synthetic-budget-trace'
        || job.id !== jobData.actionId) {
        throw new Error('invalid_job');
      }
      await handleBudgetTraceJob({
        actionId: jobData.actionId,
        jobId: job.id,
        attemptNumber: job.retryCount,
      }, { budget });
    }
  });
  workerReady = true;
  structuredLog('worker_ready', { ready: true });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void stop(boss).then(() => process.exit(0));
    });
  }
}

void main().catch((error: unknown) => {
  structuredLog('worker_start_failed', safeErrorDetails(error));
  process.exit(1);
});

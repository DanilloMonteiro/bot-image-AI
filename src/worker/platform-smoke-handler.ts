import type { PlatformEvent } from '../adapters/console/platform-events.js';
import type { PlatformSmoke } from '../modules/platform-smoke/use-cases.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlatformSmokeJob = {
  correlationId: string;
  attemptNumber: number;
  failUntilAttempt: number;
  crashAfterCommit?: boolean;
};

type SmokeOperations = Pick<PlatformSmoke, 'start' | 'complete' | 'failAttempt'>;

export type PlatformSmokeHandlerDependencies = {
  smoke: SmokeOperations;
  emit: (event: PlatformEvent) => void;
  now?: () => string;
  crash?: () => void;
};

export async function handlePlatformSmokeJob(
  job: PlatformSmokeJob,
  dependencies: PlatformSmokeHandlerDependencies,
): Promise<void> {
  const { correlationId, attemptNumber } = job;
  if (!UUID_PATTERN.test(correlationId) || !Number.isSafeInteger(attemptNumber) || attemptNumber < 0) {
    throw new Error('invalid_job');
  }

  const occurredAt = () => (dependencies.now ?? (() => new Date().toISOString()))();
  const emitInfrastructureError = () => dependencies.emit({
    type: 'infrastructure_error', correlationId, attemptNumber,
    state: 'unknown', errorCode: 'infrastructure_error', occurredAt: occurredAt(),
  });

  let started: boolean;
  try {
    started = await dependencies.smoke.start(correlationId, attemptNumber);
  } catch {
    emitInfrastructureError();
    throw new Error('processing_failed');
  }
  if (!started) return;

  dependencies.emit({
    type: 'smoke_started', correlationId, attemptNumber,
    state: 'processing', occurredAt: occurredAt(),
  });

  const failAttempt = async (): Promise<never> => {
    let eventState: 'processing' | 'unknown' = 'unknown';
    try {
      if (await dependencies.smoke.failAttempt(correlationId, attemptNumber)) eventState = 'processing';
    } catch {
      emitInfrastructureError();
    }
    dependencies.emit({
      type: 'smoke_attempt_failed', correlationId, attemptNumber,
      state: eventState, errorCode: 'attempt_failed', occurredAt: occurredAt(),
    });
    throw new Error('processing_failed');
  };

  if (Number.isSafeInteger(job.failUntilAttempt) && attemptNumber < job.failUntilAttempt) {
    return failAttempt();
  }

  let committed: boolean;
  try {
    committed = await dependencies.smoke.complete(correlationId, attemptNumber);
  } catch {
    emitInfrastructureError();
    return failAttempt();
  }
  if (!committed) return;

  dependencies.emit({
    type: 'smoke_completed', correlationId, attemptNumber,
    state: 'completed', occurredAt: occurredAt(),
  });
  if (job.crashAfterCommit) dependencies.crash?.();
}

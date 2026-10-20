import type { SmokeState } from '../../modules/platform-smoke/repository.js';
import type { PlatformEvent } from '../../modules/platform-smoke/events.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set<PlatformEvent['type']>([
  'smoke_started', 'smoke_attempt_failed', 'smoke_completed', 'infrastructure_error',
]);

export function emitPlatformEvent(event: PlatformEvent): void {
  if (!EVENT_TYPES.has(event.type)
    || !UUID_PATTERN.test(event.correlationId)
    || !Number.isSafeInteger(event.attemptNumber)
    || event.attemptNumber < 0) return;

  const occurredAtMs = Date.parse(event.occurredAt);
  if (!Number.isFinite(occurredAtMs) || new Date(occurredAtMs).toISOString() !== event.occurredAt) return;

  const state: SmokeState | 'unknown' = event.type === 'smoke_started'
    ? 'processing'
    : event.type === 'smoke_completed'
      ? 'completed'
      : event.type === 'smoke_attempt_failed' && event.state === 'processing'
        ? 'processing'
        : 'unknown';
  const safeEvent = {
    type: event.type,
    correlationId: event.correlationId,
    attemptNumber: event.attemptNumber,
    state,
    occurredAt: event.occurredAt,
    ...(event.type === 'smoke_attempt_failed' ? { errorCode: 'attempt_failed' } : {}),
    ...(event.type === 'infrastructure_error' ? { errorCode: 'infrastructure_error' } : {}),
  };

  console.info(JSON.stringify({ event: 'platform_event', service: 'worker', ...safeEvent }));
}

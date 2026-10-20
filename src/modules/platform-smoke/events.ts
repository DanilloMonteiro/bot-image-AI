export type PlatformEvent =
  | {
    type: 'smoke_started';
    correlationId: string;
    attemptNumber: number;
    state: 'processing';
    occurredAt: string;
  }
  | {
    type: 'smoke_attempt_failed';
    correlationId: string;
    attemptNumber: number;
    state: 'processing' | 'unknown';
    errorCode: 'attempt_failed';
    occurredAt: string;
  }
  | {
    type: 'smoke_completed';
    correlationId: string;
    attemptNumber: number;
    state: 'completed';
    occurredAt: string;
  }
  | {
    type: 'infrastructure_error';
    correlationId: string;
    attemptNumber: number;
    state: 'unknown';
    errorCode: 'infrastructure_error';
    occurredAt: string;
  };

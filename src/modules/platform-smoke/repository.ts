export type SmokeState = 'queued' | 'processing' | 'completed' | 'failed';

export type SmokeTask = {
  id: string;
  state: SmokeState;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
};

export type SmokeRetryResult =
  | { status: 'retried'; task: SmokeTask }
  | { status: 'not_found' }
  | { status: 'not_failed' };

export interface SmokeRepository {
  create(): Promise<SmokeTask>;
  find(id: string): Promise<SmokeTask | null>;
  markProcessing(id: string, attempt: number): Promise<boolean>;
  complete(id: string, attempt: number): Promise<boolean>;
  markAttemptFailed(id: string, attempt: number): Promise<void>;
  retry(id: string): Promise<SmokeRetryResult>;
}

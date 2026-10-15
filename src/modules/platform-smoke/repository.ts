export type SmokeState = 'queued' | 'processing' | 'completed' | 'failed';

export type SmokeTask = {
  id: string;
  state: SmokeState;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
};

export interface SmokeRepository {
  create(): Promise<SmokeTask>;
  find(id: string): Promise<SmokeTask | null>;
  markProcessing(id: string): Promise<void>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, errorCode: string): Promise<void>;
}

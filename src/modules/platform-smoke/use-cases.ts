import type { SmokeRepository, SmokeTask } from './repository.js';

export class PlatformSmoke {
  constructor(private readonly repository: SmokeRepository) {}

  accept(): Promise<SmokeTask> { return this.repository.create(); }
  lookup(id: string): Promise<SmokeTask | null> { return this.repository.find(id); }
  start(id: string): Promise<void> { return this.repository.markProcessing(id); }
  complete(id: string): Promise<void> { return this.repository.markCompleted(id); }
  fail(id: string, errorCode: string): Promise<void> { return this.repository.markFailed(id, errorCode); }
}

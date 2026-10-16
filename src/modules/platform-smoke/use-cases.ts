import type { SmokeRepository, SmokeTask } from './repository.js';

export class PlatformSmoke {
  constructor(private readonly repository: SmokeRepository) {}

  accept(): Promise<SmokeTask> { return this.repository.create(); }
  lookup(id: string): Promise<SmokeTask | null> { return this.repository.find(id); }
  start(id: string, attempt: number): Promise<boolean> { return this.repository.markProcessing(id, attempt); }
  complete(id: string, attempt: number): Promise<boolean> { return this.repository.complete(id, attempt); }
  failAttempt(id: string, attempt: number): Promise<void> { return this.repository.markAttemptFailed(id, attempt); }
  retry(id: string) { return this.repository.retry(id); }
}

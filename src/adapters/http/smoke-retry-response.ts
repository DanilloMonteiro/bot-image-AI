import type { SmokeRetryResult } from '../../modules/platform-smoke/repository.js';

export function mapSmokeRetryResult(result: SmokeRetryResult): { status: 202 | 404 | 409; body: object } {
  if (result.status === 'not_found') return { status: 404, body: { error: 'not_found' } };
  if (result.status === 'not_failed') return { status: 409, body: { error: 'not_retryable' } };
  return { status: 202, body: result.task };
}

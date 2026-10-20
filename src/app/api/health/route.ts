import { getReadinessResult, readinessResponse } from '@/adapters/http/readiness-handler';
import { checkRuntimeReadiness } from '@/adapters/postgres/smoke-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return readinessResponse(await getReadinessResult(checkRuntimeReadiness));
}

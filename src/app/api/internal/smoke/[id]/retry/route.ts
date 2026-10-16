import { PostgresSmokeRepository } from '@/adapters/postgres/smoke-repository';
import { handleSmokeRetryRequest } from '@/adapters/http/smoke-retry-handler';
import { PlatformSmoke } from '@/modules/platform-smoke/use-cases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleSmokeRetryRequest(request, context.params, (id) => new PlatformSmoke(new PostgresSmokeRepository()).retry(id));
}

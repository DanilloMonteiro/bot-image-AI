import { PostgresSmokeRepository, checkRuntimeReadiness } from '@/adapters/postgres/smoke-repository';
import { handleSmokeSubmitRequest } from '@/adapters/http/smoke-submit-handler';
import { PlatformSmoke } from '@/modules/platform-smoke/use-cases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleSmokeSubmitRequest(request, async () => {
    if (!await checkRuntimeReadiness()) throw new Error('runtime_unavailable');
    const task = await new PlatformSmoke(new PostgresSmokeRepository()).accept();
    return task;
  });
}

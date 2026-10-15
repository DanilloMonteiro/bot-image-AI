import { PostgresSmokeRepository } from '@/adapters/postgres/smoke-repository';
import { isAuthorized } from '@/adapters/http/staging-auth';
import { PlatformSmoke } from '@/modules/platform-smoke/use-cases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const task = await new PlatformSmoke(new PostgresSmokeRepository()).accept();
    return Response.json(task, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

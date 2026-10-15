import { PostgresSmokeRepository } from '@/adapters/postgres/smoke-repository';
import { isAuthorized } from '@/adapters/http/staging-auth';
import { PlatformSmoke } from '@/modules/platform-smoke/use-cases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  try {
    const task = await new PlatformSmoke(new PostgresSmokeRepository()).lookup(id);
    return task
      ? Response.json(task, { headers: { 'Cache-Control': 'no-store' } })
      : Response.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

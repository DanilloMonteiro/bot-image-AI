import { isAuthorized } from './staging-auth';
import { mapSmokeRetryResult } from './smoke-retry-response';
import type { SmokeRetryResult } from '../../modules/platform-smoke/repository.js';

const noStore = { 'Cache-Control': 'no-store' };

export async function handleSmokeRetryRequest(
  request: Request,
  params: Promise<{ id: string }>,
  retry: (id: string) => Promise<SmokeRetryResult>,
): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }

  try {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
    }

    const response = mapSmokeRetryResult(await retry(id));
    return Response.json(response.body, { status: response.status, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

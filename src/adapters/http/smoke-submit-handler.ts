import { isAuthorized } from './staging-auth';
import type { SmokeTask } from '../../modules/platform-smoke/repository.js';
import { hasNonEmptyBody } from './request-body';

const noStore = { 'Cache-Control': 'no-store' };

export async function handleSmokeSubmitRequest(
  request: Request,
  accept: () => Promise<SmokeTask>,
): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }
  if (await hasNonEmptyBody(request)) {
    return Response.json({ error: 'body_not_allowed' }, { status: 400, headers: noStore });
  }
  try {
    return Response.json(await accept(), { status: 202, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

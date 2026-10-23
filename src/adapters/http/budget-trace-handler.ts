import { isAuthorized } from './staging-auth';
import { hasNonEmptyBody } from './request-body';
import type { BudgetReservation } from '../../modules/budget/repository.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { 'Cache-Control': 'no-store' };

export async function handleBudgetTraceRequest(
  request: Request,
  reserve: (actionId: string) => Promise<BudgetReservation>,
): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }
  if (await hasNonEmptyBody(request)) {
    return Response.json({ error: 'body_not_allowed' }, { status: 400, headers: noStore });
  }

  const actionId = request.headers.get('idempotency-key');
  if (!actionId || !UUID_PATTERN.test(actionId)) {
    return Response.json({ error: 'invalid_idempotency_key' }, { status: 400, headers: noStore });
  }

  try {
    return Response.json(await reserve(actionId.toLowerCase()), { status: 202, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

import { createOrdersPaymentsService } from '@/adapters/http/orders-payments-service';
import { handleListUnmatchedProviderEventsRequest } from '@/adapters/http/orders-payments-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleListUnmatchedProviderEventsRequest(request, createOrdersPaymentsService());
}

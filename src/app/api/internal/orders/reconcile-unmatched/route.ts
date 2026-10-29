import { createOrdersPaymentsService } from '@/adapters/http/orders-payments-service';
import { handleReconcileUnmatchedProviderEventRequest } from '@/adapters/http/orders-payments-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleReconcileUnmatchedProviderEventRequest(request, createOrdersPaymentsService());
}

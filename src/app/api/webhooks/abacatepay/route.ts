import { createOrdersPaymentsService } from '@/adapters/http/orders-payments-service';
import { handleAbacatePayWebhook } from '@/adapters/http/abacatepay-webhook-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleAbacatePayWebhook(request, createOrdersPaymentsService());
}

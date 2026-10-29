import { createOrdersPaymentsService } from '@/adapters/http/orders-payments-service';
import { handleReconcilePaymentRequest } from '@/adapters/http/orders-payments-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await context.params;
  return handleReconcilePaymentRequest(request, orderId, createOrdersPaymentsService());
}

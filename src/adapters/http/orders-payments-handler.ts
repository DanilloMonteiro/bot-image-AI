import { isAuthorized } from './staging-auth';
import {
  isCreateOrderRequestV1,
  isCreatePixRequestV1,
  isPaymentReconciliationRequestV1,
  isOrphanPaymentReconciliationRequestV1,
  ORDERS_PAYMENTS_CONTRACT_VERSION,
  type CreatePixRequestV1,
} from '../../contracts/orders-payments/v1';
import type { OrdersPayments } from '../../modules/orders-payments/use-cases';

const noStore = { 'Cache-Control': 'no-store' };

export async function handleCreateOrderRequest(request: Request, service: OrdersPayments): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (process.env.PLATFORM_ENVIRONMENT === 'production') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  if (!isCreateOrderRequestV1(body)) {
    return Response.json({ error: 'invalid_order_request' }, { status: 400, headers: noStore });
  }
  try {
    const result = await service.createOrder(body);
    const status = result.status === 'created' ? 201
      : result.status === 'conflict' ? 409
        : result.status === 'blocked' ? 422 : 200;
    return Response.json(result, { status, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

export async function handleSimulatePixRequest(request: Request, orderId: string, service: OrdersPayments): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (process.env.PLATFORM_ENVIRONMENT === 'production') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  try {
    const simulated = await service.simulateSandboxPayment(orderId);
    return Response.json(simulated ? { status: 'simulated' } : { status: 'not_available' }, {
      status: simulated ? 202 : 409, headers: noStore,
    });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}
export async function handleCreatePixRequest(request: Request, orderId: string, service: OrdersPayments): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (process.env.PLATFORM_ENVIRONMENT === 'production') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  const requestData: CreatePixRequestV1 = {
    version: ORDERS_PAYMENTS_CONTRACT_VERSION,
    orderId,
    requestId: typeof body === 'object' && body !== null && 'requestId' in body ? String(body.requestId) : '',
    mode: typeof body === 'object' && body !== null && 'mode' in body && body.mode === 'production' ? 'production' : 'sandbox',
  };
  if (!isCreatePixRequestV1(requestData)) {
    return Response.json({ error: 'invalid_pix_request' }, { status: 400, headers: noStore });
  }
  try {
    const result = await service.createPix(requestData);
    const status = result.status === 'created' ? 201
      : result.status === 'conflict' ? 409
        : result.status === 'blocked' ? 422
          : result.status === 'reconciliation_required' ? 202 : 200;
    return Response.json(result, { status, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

export async function handleReconcilePaymentRequest(request: Request, orderId: string, service: OrdersPayments): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (process.env.PLATFORM_ENVIRONMENT === 'production') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  if (!isPaymentReconciliationRequestV1(body) || body.orderId !== orderId) {
    return Response.json({ error: 'invalid_reconciliation_request' }, { status: 400, headers: noStore });
  }
  try {
    const result = await service.reconcilePayment(body);
    const status = result.status === 'conflict' ? 409
      : result.status === 'blocked' ? 422 : 200;
    return Response.json(result, { status, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

export async function handleListUnmatchedProviderEventsRequest(request: Request, service: OrdersPayments): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (process.env.PLATFORM_ENVIRONMENT === 'production') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  try {
    return Response.json({ events: await service.listUnmatchedProviderEvents() }, { status: 200, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

export async function handleReconcileUnmatchedProviderEventRequest(request: Request, service: OrdersPayments): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (process.env.PLATFORM_ENVIRONMENT === 'production') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  if (!isOrphanPaymentReconciliationRequestV1(body)) {
    return Response.json({ error: 'invalid_reconciliation_request' }, { status: 400, headers: noStore });
  }
  try {
    const result = await service.reconcileUnmatchedProviderEvent(body);
    const status = result.status === 'conflict' ? 409
      : result.status === 'blocked' ? 422 : 200;
    return Response.json(result, { status, headers: noStore });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

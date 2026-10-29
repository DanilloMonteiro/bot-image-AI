import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ORDERS_PAYMENTS_CONTRACT_VERSION,
  isProviderPaymentEventV1,
  type ProviderPaymentEventV1,
} from '../../contracts/orders-payments/v1';
import type { OrdersPayments } from '../../modules/orders-payments/use-cases';

const noStore = { 'Cache-Control': 'no-store' };
const MAX_WEBHOOK_BYTES = 64 * 1024;

export async function handleAbacatePayWebhook(
  request: Request,
  service: OrdersPayments,
  environment: Record<string, string | undefined> = process.env,
): Promise<Response> {
  const webhookSecret = environment.ABACATEPAY_WEBHOOK_SECRET;
  const hmacKey = environment.ABACATEPAY_WEBHOOK_HMAC_KEY;
  const signature = request.headers.get('x-webhook-signature') ?? '';
  const suppliedSecret = new URL(request.url).searchParams.get('webhookSecret') ?? '';
  if (!webhookSecret || webhookSecret.length < 32 || !safeEqual(suppliedSecret, webhookSecret)
    || !hmacKey || hmacKey.length < 32) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }

  let rawBytes: Uint8Array | null;
  try { rawBytes = await readBodyLimited(request, MAX_WEBHOOK_BYTES); } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400, headers: noStore });
  }
  if (rawBytes === null) {
    return Response.json({ error: 'payload_too_large' }, { status: 413, headers: noStore });
  }
  if (!verifyHmacBytes(rawBytes, signature, hmacKey)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }

  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes); } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400, headers: noStore });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400, headers: noStore });
  }
  const event = normalizeEvent(payload, environment.ABACATEPAY_ACCOUNT_ID ?? '');
  if (!event || !isProviderPaymentEventV1(event)) {
    return Response.json({ error: 'invalid_payload' }, { status: 400, headers: noStore });
  }

  try {
    const result = await service.processProviderEvent(event);
    if (result.status === 'retry') {
      return Response.json({ error: result.reason }, { status: 503, headers: noStore });
    }
    return Response.json({ ok: true, result }, { status: 200, headers: noStore });
  } catch {
    // A non-2xx response asks AbacatePay to retry; no raw body or secret is logged.
    return Response.json({ error: 'unavailable' }, { status: 503, headers: noStore });
  }
}

export function verifyHmac(rawBody: string, signature: string, key: string): boolean {
  return verifyHmacBytes(Buffer.from(rawBody, 'utf8'), signature, key);
}

function verifyHmacBytes(rawBody: Uint8Array, signature: string, key: string): boolean {
  if (!signature || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;
  const expected = createHmac('sha256', key).update(rawBody).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64'); } catch { return false; }
  if (actual.length !== expected.length || actual.toString('base64') !== signature) return false;
  return timingSafeEqual(expected, actual);
}

async function readBodyLimited(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeEvent(value: unknown, accountId: string): ProviderPaymentEventV1 | null {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const data = value.data;
  const externalOrderId = nonEmpty(data.externalId)
    ? data.externalId
    : isRecord(data.metadata) && nonEmpty(data.metadata.externalOrderId) ? data.metadata.externalOrderId : '';
  const amountMinor = typeof data.amount === 'number' ? data.amount : Number.NaN;
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
  const environment = value.devMode === true ? 'sandbox' : value.devMode === false ? 'production' : null;
  if (!environment) return null;
  const currency = nonEmpty(data.currency) ? data.currency : 'UNKNOWN';
  const configuredAccount = nonEmpty(accountId) ? accountId : '';
  const actualAccount = nonEmpty(data.accountId) ? data.accountId : configuredAccount;
  return {
    eventId: nonEmpty(value.id) ? value.id : '',
    eventType: nonEmpty(value.event) ? value.event : '',
    externalPaymentId: nonEmpty(data.id) ? data.id : '',
    externalOrderId,
    accountId: actualAccount,
    amountMinor,
    currency,
    paidAt: normalizedUtcTimestamp(data.paidAt),
    environment,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedUtcTimestamp(value: unknown): string | null {
  if (!nonEmpty(value) || !value.endsWith('Z')) return null;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value ? value : null;
}

export const WEBHOOK_CONTRACT_VERSION = ORDERS_PAYMENTS_CONTRACT_VERSION;

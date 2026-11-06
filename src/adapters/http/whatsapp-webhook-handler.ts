import { timingSafeEqual } from 'node:crypto';
import type { Conversations } from '../../modules/conversations/use-cases';
import {
  normalizeWhatsAppWebhook,
  verifyWhatsAppSignature,
  type WhatsAppWebhookEvent,
} from '../whatsapp/cloud-api';

const noStore = { 'Cache-Control': 'no-store' };
const MAX_WEBHOOK_BYTES = 256 * 1024;

type Environment = Record<string, string | undefined>;
type ConversationWebhookProcessor = Pick<Conversations,
  'handleText' | 'handleVoiceFromProvider' | 'recordDeliveryReceipt'>;

function capEventTimeAtReceipt(eventAt: string, receivedAt: string): string {
  return Date.parse(eventAt) > Date.parse(receivedAt) ? receivedAt : eventAt;
}

async function readBodyBounded(request: Request): Promise<Uint8Array | null> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_WEBHOOK_BYTES) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch { /* The request is rejected on read failure. */ }
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

function constantTimeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function processEvent(
  event: WhatsAppWebhookEvent,
  processor: ConversationWebhookProcessor,
  now: () => string,
): Promise<void> {
  if (event.kind === 'text') {
    const receivedAt = now();
    await processor.handleText({
      providerEventId: event.providerEventId,
      providerMessageId: event.providerMessageId,
      channelId: event.channelId,
      externalCustomerId: event.externalCustomerId,
      occurredAt: capEventTimeAtReceipt(event.occurredAt, receivedAt),
      receivedAt,
      text: event.text,
    });
  } else if (event.kind === 'audio') {
    const receivedAt = now();
    await processor.handleVoiceFromProvider({
      providerEventId: event.providerEventId,
      providerMessageId: event.providerMessageId,
      channelId: event.channelId,
      externalCustomerId: event.externalCustomerId,
      occurredAt: capEventTimeAtReceipt(event.occurredAt, receivedAt),
      receivedAt,
      mediaId: event.mediaId,
      mimeType: event.mimeType,
    });
  } else if (event.kind === 'receipt') {
    await processor.recordDeliveryReceipt({
      providerEventId: event.providerEventId,
      providerMessageId: event.providerMessageId,
      occurredAt: event.occurredAt,
      state: event.state,
    });
  }
  // Unsupported media is acknowledged without downloading, persisting, or forwarding its payload.
}

export function handleWhatsAppVerificationRequest(
  request: Request,
  environment: Environment = process.env,
): Response {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token') ?? undefined;
  const challenge = url.searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || !challenge || challenge.length > 512
    || !constantTimeEqual(token, environment.WHATSAPP_VERIFY_TOKEN)) {
    return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  }
  return new Response(challenge, { status: 200, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function handleWhatsAppWebhookRequest(
  request: Request,
  processor: ConversationWebhookProcessor,
  environment: Environment = process.env,
  now: () => string = () => new Date().toISOString(),
): Promise<Response> {
  const body = await readBodyBounded(request);
  if (body === null) return Response.json({ error: 'payload_too_large' }, { status: 413, headers: noStore });
  if (!verifyWhatsAppSignature(body, request.headers.get('x-hub-signature-256'), environment.WHATSAPP_APP_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }
  let payload: unknown;
  try { payload = JSON.parse(Buffer.from(body).toString('utf8')); }
  catch { return Response.json({ error: 'invalid_payload' }, { status: 400, headers: noStore }); }
  let events: WhatsAppWebhookEvent[];
  try { events = normalizeWhatsAppWebhook(payload); }
  catch { return Response.json({ error: 'invalid_payload' }, { status: 400, headers: noStore }); }
  try {
    for (const event of events) await processEvent(event, processor, now);
  } catch {
    return Response.json({ error: 'retry' }, { status: 503, headers: noStore });
  }
  return Response.json({ status: 'received' }, { status: 200, headers: noStore });
}

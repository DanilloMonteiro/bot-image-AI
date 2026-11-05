import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Budget } from '../../modules/budget/use-cases';
import { isProviderDataProcessingAllowed } from '../../modules/data-policy/use-cases';
import type { OutboundMessage } from '../../modules/conversations/repository';
import { CONVERSATION_OUTBOUND_MAX_ATTEMPTS } from '../../modules/conversations/repository';

export type WhatsAppWebhookEvent =
  | {
    kind: 'text';
    providerEventId: string;
    providerMessageId: string;
    channelId: string;
    externalCustomerId: string;
    occurredAt: string;
    text: string;
  }
  | {
    kind: 'audio';
    providerEventId: string;
    providerMessageId: string;
    channelId: string;
    externalCustomerId: string;
    occurredAt: string;
    mediaId: string;
    mimeType: string;
  }
  | { kind: 'unsupported'; providerEventId: string; providerMessageId: string }
  | {
    kind: 'receipt';
    providerEventId: string;
    providerMessageId: string;
    occurredAt: string;
    state: 'accepted' | 'delivered' | 'read' | 'failed';
  };

type Environment = Record<string, string | undefined>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utcFromUnixSeconds(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) return null;
  const date = new Date(Number(value) * 1_000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeDeliveryState(value: unknown): 'accepted' | 'delivered' | 'read' | 'failed' | null {
  if (value === 'sent') return 'accepted';
  if (value === 'delivered' || value === 'read' || value === 'failed') return value;
  return null;
}

/** Validate only the small subset used by EPIC 3; never return or persist provider payloads. */
export function normalizeWhatsAppWebhook(payload: unknown): WhatsAppWebhookEvent[] {
  if (!isObject(payload) || !Array.isArray(payload.entry)) throw new Error('invalid_whatsapp_webhook');
  const events: WhatsAppWebhookEvent[] = [];
  for (const entry of payload.entry) {
    if (!isObject(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isObject(change) || !isObject(change.value)) continue;
      const value = change.value;
      const metadata = isObject(value.metadata) ? value.metadata : undefined;
      const phoneNumberId = metadata?.phone_number_id;
      const channelId = typeof phoneNumberId === 'string' && phoneNumberId.length <= 100
        ? `whatsapp:${phoneNumberId}` : null;
      if (Array.isArray(value.messages)) {
        if (!channelId) throw new Error('invalid_whatsapp_webhook');
        for (const message of value.messages) {
          if (!isObject(message) || typeof message.id !== 'string' || message.id.length > 255
            || typeof message.from !== 'string' || message.from.length > 255) continue;
          const occurredAt = utcFromUnixSeconds(message.timestamp);
          if (!occurredAt) continue;
          const common = {
            providerEventId: message.id,
            providerMessageId: message.id,
            channelId,
            externalCustomerId: message.from,
            occurredAt,
          };
          if (message.type === 'text' && isObject(message.text) && typeof message.text.body === 'string') {
            events.push({ kind: 'text', ...common, text: message.text.body });
          } else if (message.type === 'audio' && isObject(message.audio)
            && typeof message.audio.id === 'string' && message.audio.id.length <= 40
            && typeof message.audio.mime_type === 'string' && message.audio.mime_type.length <= 100) {
            events.push({
              kind: 'audio', ...common,
              mediaId: message.audio.id,
              mimeType: message.audio.mime_type,
            });
          } else {
            events.push({ kind: 'unsupported', providerEventId: message.id, providerMessageId: message.id });
          }
        }
      }
      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          if (!isObject(status) || typeof status.id !== 'string' || status.id.length > 255) continue;
          const occurredAt = utcFromUnixSeconds(status.timestamp);
          const state = normalizeDeliveryState(status.status);
          if (!occurredAt || !state) continue;
          events.push({
            kind: 'receipt',
            providerEventId: `${status.id}:${String(status.status)}:${status.timestamp}`,
            providerMessageId: status.id,
            occurredAt,
            state,
          });
        }
      }
    }
  }
  return events;
}

export function verifyWhatsAppSignature(rawBody: Uint8Array, supplied: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || appSecret.length < 16 || !supplied || !/^sha256=[0-9a-f]{64}$/i.test(supplied)) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`, 'ascii');
  const actual = Buffer.from(supplied, 'ascii');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isWhatsAppSendRulesVerified(environment: Environment = process.env): boolean {
  return environment.WHATSAPP_SEND_RULES_VERIFIED === 'true';
}

export type WhatsAppSendResult =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'retryable'; reason: 'rate_limited' }
  | { status: 'blocked' | 'failed'; reason: string };

export interface WhatsAppTextSender {
  sendText(message: OutboundMessage): Promise<WhatsAppSendResult>;
}

export function isWhatsAppIngressApproved(environment: Environment = process.env): boolean {
  return environment.WHATSAPP_LIVE_TRAFFIC_ENABLED === 'true'
    && environment.WHATSAPP_ACCOUNT_APPROVED === 'true'
    && environment.WHATSAPP_COST_RECONCILED === 'true';
}

function readWhatsAppSendConfig(environment: Environment) {
  const blocked = (reason: string) => ({ allowed: false as const, reason });
  if (environment.WHATSAPP_LIVE_TRAFFIC_ENABLED !== 'true') return blocked('provider_traffic_disabled');
  if (environment.WHATSAPP_ACCOUNT_APPROVED !== 'true'
    || environment.WHATSAPP_COST_RECONCILED !== 'true'
    || environment.WHATSAPP_SEND_RULES_VERIFIED !== 'true') return blocked('external_checks_pending');
  const accessToken = environment.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = environment.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = environment.WHATSAPP_GRAPH_API_VERSION;
  const costMinor = Number(environment.WHATSAPP_MESSAGE_COST_BRL_MINOR);
  if (!accessToken || !phoneNumberId || !/^[0-9]{1,40}$/.test(phoneNumberId)
    || !/^v\d+\.0$/.test(apiVersion ?? '')
    || !Number.isSafeInteger(costMinor) || costMinor < 0) return blocked('provider_configuration_missing');
  return { allowed: true as const, accessToken, phoneNumberId, apiVersion, costMinor };
}

export class WhatsAppCloudApiAdapter implements WhatsAppTextSender {
  constructor(
    private readonly budget: Pick<Budget, 'reserveAction'>,
    private readonly environment: Environment = process.env,
    private readonly fetcher: typeof fetch = fetch,
    private readonly dataPolicyAllows: () => boolean = isProviderDataProcessingAllowed,
  ) {}

  async sendText(message: OutboundMessage): Promise<WhatsAppSendResult> {
    const config = readWhatsAppSendConfig(this.environment);
    if (!config.allowed) return { status: 'blocked', reason: config.reason };
    if (!this.dataPolicyAllows()) return { status: 'blocked', reason: 'data_policy_blocked' };
    if (message.channelId !== `whatsapp:${config.phoneNumberId}`
      || !/^[0-9]{5,20}$/.test(message.externalCustomerId)) {
      return { status: 'blocked', reason: 'channel_or_recipient_mismatch' };
    }
    const reservation = await this.budget.reserveAction({
      version: 'v1',
      actionId: message.messageId,
      category: 'meta_pix_fx_retries',
      cost: { status: 'known', amountMinor: config.costMinor, currency: 'BRL' },
      attemptLimit: CONVERSATION_OUTBOUND_MAX_ATTEMPTS,
    });
    if (reservation.status === 'blocked') return { status: 'blocked', reason: `budget_${reservation.reason}` };

    try {
      const response = await this.fetcher(
        `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          redirect: 'manual',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: message.externalCustomerId,
            type: 'text',
            text: { body: message.text },
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (response.status === 429) return { status: 'retryable', reason: 'rate_limited' };
      if (!response.ok) return { status: 'failed', reason: 'provider_rejected' };
      const body: unknown = await response.json();
      if (!isObject(body) || !Array.isArray(body.messages) || !isObject(body.messages[0])
        || typeof body.messages[0].id !== 'string') return { status: 'failed', reason: 'provider_response_invalid' };
      return { status: 'accepted', providerMessageId: body.messages[0].id };
    } catch {
      return { status: 'failed', reason: 'provider_unavailable' };
    }
  }
}

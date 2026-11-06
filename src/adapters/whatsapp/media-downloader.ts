import type { Budget } from '../../modules/budget/use-cases.js';
import { isProviderDataProcessingAllowed } from '../../modules/data-policy/use-cases';
import type { VoiceMediaDownloader, VoiceMediaDownloadResult } from '../../modules/conversations/use-cases';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_METADATA_BYTES = 16 * 1024;
const MEDIA_HOST = 'lookaside.fbsbx.com';
type Environment = Record<string, string | undefined>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readConfig(environment: Environment):
  | { allowed: true; accessToken: string; phoneNumberId: string; apiVersion: string; costMinor: number }
  | { allowed: false } {
  if (environment.WHATSAPP_LIVE_TRAFFIC_ENABLED !== 'true'
    || environment.WHATSAPP_ACCOUNT_APPROVED !== 'true'
    || environment.WHATSAPP_COST_RECONCILED !== 'true') return { allowed: false };
  const accessToken = environment.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = environment.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = environment.WHATSAPP_GRAPH_API_VERSION;
  const costValue = environment.WHATSAPP_MEDIA_FETCH_COST_BRL_MINOR;
  if (!accessToken || !phoneNumberId || !/^v\d+\.0$/.test(apiVersion ?? '')
    || !costValue || !/^\d+$/.test(costValue)) return { allowed: false };
  const costMinor = Number(costValue);
  if (!Number.isSafeInteger(costMinor) || costMinor <= 0) return { allowed: false };
  return { allowed: true, accessToken, phoneNumberId, apiVersion: apiVersion!, costMinor };
}

async function readJsonBounded(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_METADATA_BYTES) throw new Error('metadata_too_large');
  if (!response.body) throw new Error('metadata_empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_METADATA_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new Error('metadata_too_large');
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* The response is discarded. */ }
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(Buffer.from(body).toString('utf8')) as unknown;
}

async function readAudioBounded(response: Response): Promise<Uint8Array> {
  const declaredLengthHeader = response.headers.get('content-length');
  if (declaredLengthHeader !== null) {
    const declaredLength = Number(declaredLengthHeader);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > MAX_AUDIO_BYTES) {
      throw new Error('audio_size_invalid');
    }
  }
  if (!response.body) throw new Error('audio_empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_AUDIO_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new Error('audio_size_invalid');
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* The response is discarded. */ }
  }
  const audio = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.byteLength; }
  return audio;
}

function parseOggMetadata(value: unknown, mediaId: string): { url: URL; fileSize: number } | null {
  if (!isObject(value) || value.id !== mediaId || value.messaging_product !== 'whatsapp'
    || typeof value.mime_type !== 'string' || value.mime_type.split(';', 1)[0].trim().toLowerCase() !== 'audio/ogg'
    || typeof value.file_size !== 'number' || !Number.isSafeInteger(value.file_size)
    || value.file_size < 4 || value.file_size > MAX_AUDIO_BYTES || typeof value.url !== 'string') return null;
  try {
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || url.hostname !== MEDIA_HOST || url.port !== ''
      || url.username || url.password || url.hash
      || !url.pathname.startsWith('/whatsapp_business/attachments/')) return null;
    return { url, fileSize: value.file_size };
  } catch {
    return null;
  }
}

export class WhatsAppCloudMediaDownloader implements VoiceMediaDownloader {
  constructor(
    private readonly budget: Pick<Budget, 'reserveAction'>,
    private readonly environment: Environment = process.env,
    private readonly fetcher: typeof fetch = fetch,
    private readonly dataPolicyAllows: () => boolean = isProviderDataProcessingAllowed,
  ) {}

  async downloadOgg(input: { mediaId: string; channelId: string; actionId: string }): Promise<VoiceMediaDownloadResult> {
    const config = readConfig(this.environment);
    if (!config.allowed || !/^[0-9]{1,40}$/.test(input.mediaId)
      || input.channelId !== `whatsapp:${config.phoneNumberId}`
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.actionId)) return { status: 'blocked' };
    if (!this.dataPolicyAllows()) return { status: 'blocked' };
    const reservation = await this.budget.reserveAction({
      version: 'v1',
      actionId: input.actionId,
      category: 'meta_pix_fx_retries',
      cost: { status: 'known', amountMinor: config.costMinor, currency: 'BRL' },
      attemptLimit: 1,
    });
    if (reservation.status !== 'reserved') return { status: 'blocked' };

    try {
      const metadataResponse = await this.fetcher(
        `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(input.mediaId)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${config.accessToken}` },
          redirect: 'manual',
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!metadataResponse.ok || metadataResponse.redirected
        || (metadataResponse.status >= 300 && metadataResponse.status < 400)) return { status: 'failed' };
      const metadata = parseOggMetadata(await readJsonBounded(metadataResponse), input.mediaId);
      if (!metadata) return { status: 'blocked' };
      if (metadata.url.searchParams.get('mid') !== input.mediaId) return { status: 'blocked' };

      const mediaResponse = await this.fetcher(metadata.url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.accessToken}` },
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      });
      if (!mediaResponse.ok || mediaResponse.redirected || (mediaResponse.status >= 300 && mediaResponse.status < 400)) {
        return { status: 'failed' };
      }
      const contentType = (mediaResponse.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'audio/ogg') return { status: 'blocked' };
      const audio = await readAudioBounded(mediaResponse);
      if (audio.byteLength !== metadata.fileSize
        || Buffer.from(audio.subarray(0, 4)).toString('ascii') !== 'OggS') return { status: 'blocked' };
      return { status: 'downloaded', audio };
    } catch {
      return { status: 'failed' };
    }
  }
}

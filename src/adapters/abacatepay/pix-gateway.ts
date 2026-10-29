import type { PixGateway } from '../../modules/orders-payments/use-cases';

type Environment = Record<string, string | undefined>;
type FetchLike = typeof fetch;

const API_ORIGIN = 'https://api.abacatepay.com/v2';

export class AbacatePayPixGateway implements PixGateway {
  constructor(
    private readonly environment: Environment = process.env,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  isConfigured(mode: 'sandbox' | 'production'): boolean {
    return mode === 'sandbox'
      ? this.environment.ABACATEPAY_MODE === 'dev' && Boolean(this.environment.ABACATEPAY_DEV_API_KEY)
      : this.environment.ABACATEPAY_MODE === 'production' && Boolean(this.environment.ABACATEPAY_PROD_API_KEY);
  }

  async create(input: {
    amountMinor: number;
    externalOrderId: string;
    description: string;
    mode: 'sandbox' | 'production';
  }) {
    const key = this.apiKey(input.mode);
    const response = await this.fetcher(API_ORIGIN + '/transparents/create', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'PIX',
        data: {
          amount: input.amountMinor,
          expiresIn: 3600,
          description: input.description,
          externalId: input.externalOrderId,
          metadata: { environment: input.mode },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error('abacatepay_create_failed');
    return this.parsePixResponse(body, input.mode);
  }

  async simulatePayment(providerReference: string): Promise<void> {
    if (!providerReference || this.environment.ABACATEPAY_MODE !== 'dev' || !this.environment.ABACATEPAY_DEV_API_KEY) {
      throw new Error('abacatepay_dev_mode_required');
    }
    const url = new URL(API_ORIGIN + '/transparents/simulate-payment');
    url.searchParams.set('id', providerReference);
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.environment.ABACATEPAY_DEV_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('abacatepay_simulation_failed');
    const body: unknown = await response.json().catch(() => null);
    if (!isRecord(body) || body.success !== true || !isRecord(body.data) || body.data.devMode !== true) {
      throw new Error('abacatepay_simulation_unverified');
    }
  }

  private apiKey(mode: 'sandbox' | 'production'): string {
    if (mode === 'sandbox') {
      if (this.environment.ABACATEPAY_MODE !== 'dev') throw new Error('abacatepay_dev_mode_required');
      const key = this.environment.ABACATEPAY_DEV_API_KEY;
      if (!key) throw new Error('abacatepay_dev_key_missing');
      return key;
    }
    if (this.environment.ABACATEPAY_MODE !== 'production') throw new Error('abacatepay_production_mode_required');
    const key = this.environment.ABACATEPAY_PROD_API_KEY;
    if (!key) throw new Error('abacatepay_production_key_missing');
    return key;
  }

  private parsePixResponse(body: unknown, mode: 'sandbox' | 'production') {
    if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
      throw new Error('abacatepay_invalid_response');
    }
    const data = body.data;
    const providerReference = nonEmpty(data.id) ? data.id : null;
    const amountMinor = Number(data.amount);
    const copyAndPaste = nonEmpty(data.brCode) ? data.brCode : null;
    const qrCodeBase64 = nonEmpty(data.brCodeBase64) ? data.brCodeBase64 : null;
    const expiresAt = nonEmpty(data.expiresAt) ? data.expiresAt : null;
    if (typeof data.devMode !== 'boolean') throw new Error('abacatepay_invalid_response');
    const devMode = data.devMode;
    if (!providerReference || !Number.isSafeInteger(amountMinor) || !copyAndPaste
      || !qrCodeBase64 || !expiresAt || !isUtcTimestamp(expiresAt)) {
      throw new Error('abacatepay_invalid_response');
    }
    return { providerReference, amountMinor, copyAndPaste, qrCodeBase64, expiresAt, devMode };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUtcTimestamp(value: string): boolean {
  if (!value.endsWith('Z')) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

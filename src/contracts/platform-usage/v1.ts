export const PLATFORM_USAGE_CONTRACT_VERSION = 'v1' as const;

export const PLATFORM_USAGE_RESOURCES = [
  'hosting',
  'database',
  'queue',
  'execution',
] as const;

export const PLATFORM_USAGE_ORIGINS = [
  'manual_reconciliation',
  'application_observation',
  'provider_telemetry',
] as const;

export type PlatformUsageResourceV1 = typeof PLATFORM_USAGE_RESOURCES[number];
export type PlatformUsageOriginV1 = typeof PLATFORM_USAGE_ORIGINS[number];

export type PlatformUsageRecordV1 = {
  version: typeof PLATFORM_USAGE_CONTRACT_VERSION;
  resource: PlatformUsageResourceV1;
  metric: string;
  quantity: number;
  unit: string;
  period: {
    from: string;
    to: string;
  };
  origin: PlatformUsageOriginV1;
  /** Omit when no source has verified a price; amounts use the currency's minor unit. */
  cost?: {
    amountMinor: number;
    currency: string;
  };
};

const RESOURCE_SET = new Set<string>(PLATFORM_USAGE_RESOURCES);
const ORIGIN_SET = new Set<string>(PLATFORM_USAGE_ORIGINS);
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,63}(?![\s\S])/;
const CURRENCY_PATTERN = /^[A-Z]{3}(?![\s\S])/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?![\s\S])/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysByMonth[month - 1];
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function hasOwnKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return required.every((key) => Object.hasOwn(value, key));
}

/** Validates an interchange record without adding defaults or turning unknown cost into zero. */
export function isPlatformUsageRecordV1(value: unknown): value is PlatformUsageRecordV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, ['version', 'resource', 'metric', 'quantity', 'unit', 'period', 'origin', 'cost'])
    || !hasOwnKeys(value, ['version', 'resource', 'metric', 'quantity', 'unit', 'period', 'origin'])
    || value.version !== PLATFORM_USAGE_CONTRACT_VERSION
    || typeof value.resource !== 'string'
    || !RESOURCE_SET.has(value.resource)
    || typeof value.metric !== 'string'
    || !IDENTIFIER_PATTERN.test(value.metric)
    || typeof value.unit !== 'string'
    || !IDENTIFIER_PATTERN.test(value.unit)
    || typeof value.quantity !== 'number'
    || !Number.isFinite(value.quantity)
    || value.quantity < 0
    || (value.metric.endsWith('_count') && !Number.isSafeInteger(value.quantity))
    || typeof value.origin !== 'string'
    || !ORIGIN_SET.has(value.origin)
    || !isObject(value.period)
    || !hasOnlyKeys(value.period, ['from', 'to'])
    || !hasOwnKeys(value.period, ['from', 'to'])
    || !isCalendarDate(value.period.from)
    || !isCalendarDate(value.period.to)
    || value.period.from >= value.period.to) return false;

  if ('cost' in value && !Object.hasOwn(value, 'cost')) return false;

  if (Object.hasOwn(value, 'cost')) {
    if (!isObject(value.cost)
      || !hasOnlyKeys(value.cost, ['amountMinor', 'currency'])
      || !hasOwnKeys(value.cost, ['amountMinor', 'currency'])
      || typeof value.cost.amountMinor !== 'number'
      || !Number.isSafeInteger(value.cost.amountMinor)
      || value.cost.amountMinor < 0
      || typeof value.cost.currency !== 'string'
      || !CURRENCY_PATTERN.test(value.cost.currency)) return false;
  }

  return true;
}

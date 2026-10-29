export const PORTRAIT_READINESS_CONTRACT_VERSION = 'v1' as const;

export type PortraitReadinessReservationRequestV1 = {
  version: typeof PORTRAIT_READINESS_CONTRACT_VERSION;
  reservationKey: string;
  orderId: string;
  packageId: string;
  expiresAt: string;
};

export type PortraitReadinessReservationResultV1 =
  | { version: typeof PORTRAIT_READINESS_CONTRACT_VERSION; status: 'reserved' | 'already_reserved'; reservationId: string; orderId: string; packageId: string }
  | { version: typeof PORTRAIT_READINESS_CONTRACT_VERSION; status: 'blocked'; reason: 'not_ready' | 'unknown' | 'conflict' };

export type PortraitReadinessConsumeRequestV1 = {
  version: typeof PORTRAIT_READINESS_CONTRACT_VERSION;
  reservationId: string;
  authorizationId: string;
  orderId: string;
  packageId: string;
};

export type PortraitReadinessConsumeResultV1 =
  | { version: typeof PORTRAIT_READINESS_CONTRACT_VERSION; status: 'consumed' | 'already_consumed' }
  | { version: typeof PORTRAIT_READINESS_CONTRACT_VERSION; status: 'blocked'; reason: 'reservation_missing' | 'reservation_mismatch' | 'not_ready' | 'unknown' };

export type PortraitReadinessReleaseRequestV1 = {
  version: typeof PORTRAIT_READINESS_CONTRACT_VERSION;
  reservationId: string;
  orderId: string;
  providerTerminal: true;
  reconciliationComplete: true;
};

export type PortraitReadinessReleaseResultV1 =
  | { version: typeof PORTRAIT_READINESS_CONTRACT_VERSION; status: 'released' | 'already_released' }
  | { version: typeof PORTRAIT_READINESS_CONTRACT_VERSION; status: 'blocked'; reason: 'reservation_missing' | 'reservation_mismatch' | 'not_terminal' | 'not_reconciled' | 'unknown' };

export interface PortraitReadinessPortV1 {
  reserve(request: PortraitReadinessReservationRequestV1): Promise<PortraitReadinessReservationResultV1>;
  consume(request: PortraitReadinessConsumeRequestV1): Promise<PortraitReadinessConsumeResultV1>;
  release(request: PortraitReadinessReleaseRequestV1): Promise<PortraitReadinessReleaseResultV1>;
}

export function isPortraitReadinessReservationResultV1(value: unknown): value is PortraitReadinessReservationResultV1 {
  if (!isRecord(value) || value.version !== PORTRAIT_READINESS_CONTRACT_VERSION) return false;
  if (value.status === 'blocked') return ['not_ready', 'unknown', 'conflict'].includes(String(value.reason));
  return (value.status === 'reserved' || value.status === 'already_reserved')
    && nonEmpty(value.reservationId) && nonEmpty(value.orderId) && nonEmpty(value.packageId);
}

export function isPortraitReadinessConsumeResultV1(value: unknown): value is PortraitReadinessConsumeResultV1 {
  if (!isRecord(value) || value.version !== PORTRAIT_READINESS_CONTRACT_VERSION) return false;
  if (value.status === 'blocked') {
    return ['reservation_missing', 'reservation_mismatch', 'not_ready', 'unknown'].includes(String(value.reason));
  }
  return value.status === 'consumed' || value.status === 'already_consumed';
}

export function isPortraitReadinessReleaseResultV1(value: unknown): value is PortraitReadinessReleaseResultV1 {
  if (!isRecord(value) || value.version !== PORTRAIT_READINESS_CONTRACT_VERSION) return false;
  if (value.status === 'blocked') {
    return ['reservation_missing', 'reservation_mismatch', 'not_terminal', 'not_reconciled', 'unknown'].includes(String(value.reason));
  }
  return value.status === 'released' || value.status === 'already_released';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

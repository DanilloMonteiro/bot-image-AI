export const DATA_POLICY_CONTRACT_VERSION_V1 = 'v1' as const;

export const DATA_POLICY_PROVIDER_IDS_V1 = [
  'whatsapp_business_platform_meta',
  'whatsapp_bsp_if_used',
  'google_vertex_gemini_3_8_flash',
  'google_nano_banana_2_1',
  'abacatepay_pix',
  'railway_application_database_and_bucket',
] as const;

export const DATA_POLICY_DATA_SET_IDS_V1 = [
  'whatsapp_conversation',
  'consent_evidence',
  'source_image',
  'generated_result',
  'payment_records',
  'railway_backup_copy',
] as const;

export const DATA_POLICY_DATA_TYPES_V1 = [
  'messages_and_conversation_metadata',
  'minimal_consent_evidence',
  'source_photos',
  'generated_images',
  'pix_transaction_records',
] as const;

export const DATA_POLICY_ACCESS_ROLES_V1 = [
  'application_and_worker',
  'two_administrator_partners',
  'railway_workspace_owners_for_backup_operations',
  'provider_under_its_current_terms',
] as const;

export const DATA_POLICY_OPERATIONAL_CHECKS_V1 = [
  'international_transfer',
  'encryption',
  'verifiable_deletion',
] as const;

export type DataPolicyProviderIdV1 = typeof DATA_POLICY_PROVIDER_IDS_V1[number];
export type DataPolicyDataSetIdV1 = typeof DATA_POLICY_DATA_SET_IDS_V1[number];
export type DataPolicyDataTypeV1 = typeof DATA_POLICY_DATA_TYPES_V1[number];
export type DataPolicyAccessRoleV1 = typeof DATA_POLICY_ACCESS_ROLES_V1[number];
export type DataPolicyOperationalCheckV1 = typeof DATA_POLICY_OPERATIONAL_CHECKS_V1[number];
export type DataPolicyValidationStatusV1 = 'pending' | 'verified';

export type DataPolicyProviderV1 = {
  id: DataPolicyProviderIdV1;
  name: string;
  service: string;
  region: string;
  selected: boolean;
  copyRetention: string;
  deletion: string;
};

export type DataPolicyDataSetV1 = {
  id: DataPolicyDataSetIdV1;
  dataTypes: readonly DataPolicyDataTypeV1[];
  purposes: readonly string[];
  providers: readonly DataPolicyProviderIdV1[];
  access: readonly DataPolicyAccessRoleV1[];
  locations: readonly string[];
  transfer: {
    status: DataPolicyValidationStatusV1;
    destinations: readonly string[];
    note: string;
  };
  retention: {
    applicationDays: number | null;
    applicationStartsAt: string;
    applicationExpiryAction: string;
    providerCopies: string;
    backupDays: number | null;
    backupStartsAt: string;
    backupCopies: string;
  };
  deletion: {
    activeCopies: string;
    providerCopies: string;
    backupCopies: string;
  };
  exceptions: readonly string[];
};

export type DataPolicyV1 = {
  version: typeof DATA_POLICY_CONTRACT_VERSION_V1;
  title: string;
  effectiveDate: string;
  summary: string;
  ownerApproval: {
    status: 'approved' | 'not_approved';
    decidedAt: string;
    approvedAt: string | null;
  };
  providers: readonly DataPolicyProviderV1[];
  dataSets: readonly DataPolicyDataSetV1[];
  operationalReadiness: Readonly<Record<DataPolicyOperationalCheckV1, DataPolicyValidationStatusV1>>;
};

const PROVIDER_SET = new Set<string>(DATA_POLICY_PROVIDER_IDS_V1);
const DATA_SET_SET = new Set<string>(DATA_POLICY_DATA_SET_IDS_V1);
const DATA_TYPE_SET = new Set<string>(DATA_POLICY_DATA_TYPES_V1);
const ACCESS_ROLE_SET = new Set<string>(DATA_POLICY_ACCESS_ROLES_V1);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?![\s\S])/;

function isObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function hasOwnKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return required.every((key) => Object.hasOwn(value, key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown, allowEmpty = false): value is string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isNonEmptyString);
}

function isEnumArray(value: unknown, allowed: Set<string>): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === 'string' && allowed.has(item));
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

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isProvider(value: unknown): value is DataPolicyProviderV1 {
  return isObject(value)
    && hasOnlyKeys(value, ['id', 'name', 'service', 'region', 'selected', 'copyRetention', 'deletion'])
    && hasOwnKeys(value, ['id', 'name', 'service', 'region', 'selected', 'copyRetention', 'deletion'])
    && typeof value.id === 'string'
    && PROVIDER_SET.has(value.id)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.service)
    && isNonEmptyString(value.region)
    && typeof value.selected === 'boolean'
    && isNonEmptyString(value.copyRetention)
    && isNonEmptyString(value.deletion);
}

function isDataSet(value: unknown): value is DataPolicyDataSetV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'id', 'dataTypes', 'purposes', 'providers', 'access', 'locations', 'transfer',
      'retention', 'deletion', 'exceptions',
    ])
    || !hasOwnKeys(value, [
      'id', 'dataTypes', 'purposes', 'providers', 'access', 'locations', 'transfer',
      'retention', 'deletion', 'exceptions',
    ])
    || typeof value.id !== 'string'
    || !DATA_SET_SET.has(value.id)
    || !isEnumArray(value.dataTypes, DATA_TYPE_SET)
    || !isStringArray(value.purposes)
    || !isEnumArray(value.providers, PROVIDER_SET)
    || !isEnumArray(value.access, ACCESS_ROLE_SET)
    || !isStringArray(value.locations)
    || !Array.isArray(value.exceptions)
    || !value.exceptions.every(isNonEmptyString)
    || !isObject(value.transfer)
    || !hasOnlyKeys(value.transfer, ['status', 'destinations', 'note'])
    || !hasOwnKeys(value.transfer, ['status', 'destinations', 'note'])
    || (value.transfer.status !== 'pending' && value.transfer.status !== 'verified')
    || !isStringArray(value.transfer.destinations)
    || !isNonEmptyString(value.transfer.note)
    || !isObject(value.retention)
    || !hasOnlyKeys(value.retention, [
      'applicationDays', 'applicationStartsAt', 'applicationExpiryAction', 'providerCopies',
      'backupDays', 'backupStartsAt', 'backupCopies',
    ])
    || !hasOwnKeys(value.retention, [
      'applicationDays', 'applicationStartsAt', 'applicationExpiryAction', 'providerCopies',
      'backupDays', 'backupStartsAt', 'backupCopies',
    ])
    || !(value.retention.applicationDays === null
      || (typeof value.retention.applicationDays === 'number'
        && Number.isSafeInteger(value.retention.applicationDays)
        && value.retention.applicationDays >= 0))
    || !isNonEmptyString(value.retention.applicationStartsAt)
    || !isNonEmptyString(value.retention.applicationExpiryAction)
    || !isNonEmptyString(value.retention.providerCopies)
    || !(value.retention.backupDays === null
      || (typeof value.retention.backupDays === 'number'
        && Number.isSafeInteger(value.retention.backupDays)
        && value.retention.backupDays >= 0))
    || !isNonEmptyString(value.retention.backupStartsAt)
    || !isNonEmptyString(value.retention.backupCopies)
    || !isObject(value.deletion)
    || !hasOnlyKeys(value.deletion, ['activeCopies', 'providerCopies', 'backupCopies'])
    || !hasOwnKeys(value.deletion, ['activeCopies', 'providerCopies', 'backupCopies'])
    || !isNonEmptyString(value.deletion.activeCopies)
    || !isNonEmptyString(value.deletion.providerCopies)
    || !isNonEmptyString(value.deletion.backupCopies)) return false;

  return true;
}

/** Validate a complete v1 snapshot without filling omissions or accepting unknown fields. */
export function isDataPolicyV1(value: unknown): value is DataPolicyV1 {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'version', 'title', 'effectiveDate', 'summary', 'ownerApproval', 'providers',
      'dataSets', 'operationalReadiness',
    ])
    || !hasOwnKeys(value, [
      'version', 'title', 'effectiveDate', 'summary', 'ownerApproval', 'providers',
      'dataSets', 'operationalReadiness',
    ])
    || value.version !== DATA_POLICY_CONTRACT_VERSION_V1
    || !isNonEmptyString(value.title)
    || !isCalendarDate(value.effectiveDate)
    || !isNonEmptyString(value.summary)
    || !isObject(value.ownerApproval)
    || !hasOnlyKeys(value.ownerApproval, ['status', 'decidedAt', 'approvedAt'])
    || !hasOwnKeys(value.ownerApproval, ['status', 'decidedAt', 'approvedAt'])
    || (value.ownerApproval.status !== 'approved' && value.ownerApproval.status !== 'not_approved')
    || !isCalendarDate(value.ownerApproval.decidedAt)
    || (value.ownerApproval.status === 'approved'
      ? !isCalendarDate(value.ownerApproval.approvedAt)
      : value.ownerApproval.approvedAt !== null)) return false;

  if (!Array.isArray(value.providers)
    || value.providers.length === 0
    || !value.providers.every(isProvider)) return false;
  const providers = value.providers as DataPolicyProviderV1[];
  if (!hasUniqueValues(providers.map((provider) => provider.id))) return false;

  if (!Array.isArray(value.dataSets) || !value.dataSets.every(isDataSet)) return false;
  const dataSets = value.dataSets as DataPolicyDataSetV1[];
  if (!hasUniqueValues(dataSets.map((dataSet) => dataSet.id))
    || !DATA_POLICY_DATA_SET_IDS_V1.every((id) => dataSets.some((dataSet) => dataSet.id === id))
    || dataSets.some((dataSet) => dataSet.providers.some(
      (providerId) => !providers.some((provider) => provider.id === providerId),
    ))) return false;

  const readiness = value.operationalReadiness;
  if (!isObject(readiness)
    || !hasOnlyKeys(readiness, DATA_POLICY_OPERATIONAL_CHECKS_V1)
    || !hasOwnKeys(readiness, DATA_POLICY_OPERATIONAL_CHECKS_V1)
    || !DATA_POLICY_OPERATIONAL_CHECKS_V1.every((check) => (
      readiness[check] === 'pending' || readiness[check] === 'verified'
    ))) return false;

  return true;
}

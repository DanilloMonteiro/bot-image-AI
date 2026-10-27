export const DATA_POLICY_CONTRACT_VERSION_V2 = 'v2' as const;

export const DATA_POLICY_PROVIDER_IDS_V2 = [
  'meta_whatsapp_cloud_api_direct',
  'google_vertex_gemini_3_8_flash',
  'google_nano_banana_2_1',
  'abacatepay_pix',
  'railway_private_postgresql_and_bucket',
] as const;

export const DATA_POLICY_DATA_SET_IDS_V2 = [
  'conversation_and_consent',
  'source_image',
  'generated_result',
] as const;

export const DATA_POLICY_DATA_TYPES_V2 = [
  'messages_and_conversation_metadata',
  'minimal_consent_evidence',
  'source_photos',
  'generated_images',
] as const;

export const DATA_POLICY_ACCESS_ROLES_V2 = [
  'application_and_worker',
  'two_administrator_partners',
] as const;

export const DATA_POLICY_STORAGE_V2 = [
  'private_postgresql',
  'private_bucket',
] as const;

export type DataPolicyProviderIdV2 = typeof DATA_POLICY_PROVIDER_IDS_V2[number];
export type DataPolicyDataSetIdV2 = typeof DATA_POLICY_DATA_SET_IDS_V2[number];
export type DataPolicyDataTypeV2 = typeof DATA_POLICY_DATA_TYPES_V2[number];
export type DataPolicyAccessRoleV2 = typeof DATA_POLICY_ACCESS_ROLES_V2[number];
export type DataPolicyStorageV2 = typeof DATA_POLICY_STORAGE_V2[number];
export type DataPolicyValidationStatusV2 = 'pending' | 'verified';

export type DataPolicyProviderV2 = {
  id: DataPolicyProviderIdV2;
  name: string;
  service: string;
  selected: boolean;
  region: string;
  externalCopies: string;
};

export type DataPolicyDataSetV2 = {
  id: DataPolicyDataSetIdV2;
  dataTypes: readonly DataPolicyDataTypeV2[];
  purpose: string;
  storage: DataPolicyStorageV2;
  providers: readonly DataPolicyProviderIdV2[];
  access: readonly DataPolicyAccessRoleV2[];
  retention: {
    applicationDays: number;
    applicationStartsAt: string;
    applicationExpiryAction: string;
    backupDays: number | null;
    backupCadence: string;
    backupCopies: string;
    externalProviderCopies: string;
  };
  deletion: {
    scope: 'app_controlled_storage';
    activeCopies: string;
    backupCopies: string;
  };
  exceptions: readonly string[];
};

export type DataPolicyV2 = {
  version: typeof DATA_POLICY_CONTRACT_VERSION_V2;
  title: string;
  effectiveDate: string;
  summary: string;
  ownerApproval: {
    status: 'approved' | 'not_approved';
    decidedAt: string;
    approvedAt: string | null;
  };
  providers: readonly DataPolicyProviderV2[];
  dataSets: readonly DataPolicyDataSetV2[];
  operationalReadiness: Readonly<{
    localDeletion: DataPolicyValidationStatusV2;
  }>;
};

const PROVIDER_SET = new Set<string>(DATA_POLICY_PROVIDER_IDS_V2);
const DATA_SET_SET = new Set<string>(DATA_POLICY_DATA_SET_IDS_V2);
const DATA_TYPE_SET = new Set<string>(DATA_POLICY_DATA_TYPES_V2);
const ACCESS_ROLE_SET = new Set<string>(DATA_POLICY_ACCESS_ROLES_V2);
const STORAGE_SET = new Set<string>(DATA_POLICY_STORAGE_V2);
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

function isProvider(value: unknown): value is DataPolicyProviderV2 {
  return isObject(value)
    && hasOnlyKeys(value, ['id', 'name', 'service', 'selected', 'region', 'externalCopies'])
    && hasOwnKeys(value, ['id', 'name', 'service', 'selected', 'region', 'externalCopies'])
    && typeof value.id === 'string'
    && PROVIDER_SET.has(value.id)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.service)
    && typeof value.selected === 'boolean'
    && isNonEmptyString(value.region)
    && isNonEmptyString(value.externalCopies);
}

function isDataSet(value: unknown): value is DataPolicyDataSetV2 {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'id', 'dataTypes', 'purpose', 'storage', 'providers', 'access', 'retention', 'deletion', 'exceptions',
    ])
    || !hasOwnKeys(value, [
      'id', 'dataTypes', 'purpose', 'storage', 'providers', 'access', 'retention', 'deletion', 'exceptions',
    ])
    || typeof value.id !== 'string'
    || !DATA_SET_SET.has(value.id)
    || !isEnumArray(value.dataTypes, DATA_TYPE_SET)
    || !isNonEmptyString(value.purpose)
    || typeof value.storage !== 'string'
    || !STORAGE_SET.has(value.storage)
    || !isEnumArray(value.providers, PROVIDER_SET)
    || !isEnumArray(value.access, ACCESS_ROLE_SET)
    || !Array.isArray(value.exceptions)
    || !value.exceptions.every(isNonEmptyString)
    || !isObject(value.retention)
    || !hasOnlyKeys(value.retention, [
      'applicationDays', 'applicationStartsAt', 'applicationExpiryAction', 'backupDays', 'backupCadence',
      'backupCopies', 'externalProviderCopies',
    ])
    || !hasOwnKeys(value.retention, [
      'applicationDays', 'applicationStartsAt', 'applicationExpiryAction', 'backupDays', 'backupCadence',
      'backupCopies', 'externalProviderCopies',
    ])
    || typeof value.retention.applicationDays !== 'number'
    || !Number.isSafeInteger(value.retention.applicationDays)
    || value.retention.applicationDays < 0
    || !isNonEmptyString(value.retention.applicationStartsAt)
    || !isNonEmptyString(value.retention.applicationExpiryAction)
    || !(value.retention.backupDays === null
      || (typeof value.retention.backupDays === 'number'
        && Number.isSafeInteger(value.retention.backupDays)
        && value.retention.backupDays >= 0))
    || !isNonEmptyString(value.retention.backupCadence)
    || !isNonEmptyString(value.retention.backupCopies)
    || !isNonEmptyString(value.retention.externalProviderCopies)
    || !isObject(value.deletion)
    || !hasOnlyKeys(value.deletion, ['scope', 'activeCopies', 'backupCopies'])
    || !hasOwnKeys(value.deletion, ['scope', 'activeCopies', 'backupCopies'])
    || value.deletion.scope !== 'app_controlled_storage'
    || !isNonEmptyString(value.deletion.activeCopies)
    || !isNonEmptyString(value.deletion.backupCopies)) return false;

  return true;
}

/** Validate the complete v2 snapshot; region is informational and is not a readiness check. */
export function isDataPolicyV2(value: unknown): value is DataPolicyV2 {
  if (!isObject(value)
    || !hasOnlyKeys(value, [
      'version', 'title', 'effectiveDate', 'summary', 'ownerApproval', 'providers', 'dataSets',
      'operationalReadiness',
    ])
    || !hasOwnKeys(value, [
      'version', 'title', 'effectiveDate', 'summary', 'ownerApproval', 'providers', 'dataSets',
      'operationalReadiness',
    ])
    || value.version !== DATA_POLICY_CONTRACT_VERSION_V2
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
    || value.providers.length !== DATA_POLICY_PROVIDER_IDS_V2.length
    || !value.providers.every(isProvider)) return false;
  const providers = value.providers as DataPolicyProviderV2[];
  if (!hasUniqueValues(providers.map((provider) => provider.id))
    || !DATA_POLICY_PROVIDER_IDS_V2.every((id) => providers.some((provider) => provider.id === id))
    || providers.some((provider) => !provider.selected)) return false;

  if (!Array.isArray(value.dataSets)
    || value.dataSets.length !== DATA_POLICY_DATA_SET_IDS_V2.length
    || !value.dataSets.every(isDataSet)) return false;
  const dataSets = value.dataSets as DataPolicyDataSetV2[];
  if (!hasUniqueValues(dataSets.map((dataSet) => dataSet.id))
    || !DATA_POLICY_DATA_SET_IDS_V2.every((id) => dataSets.some((dataSet) => dataSet.id === id))
    || dataSets.some((dataSet) => dataSet.providers.some(
      (providerId) => !providers.some((provider) => provider.id === providerId),
    ))) return false;

  const readiness = value.operationalReadiness;
  if (!isObject(readiness)
    || !hasOnlyKeys(readiness, ['localDeletion'])
    || !hasOwnKeys(readiness, ['localDeletion'])
    || (readiness.localDeletion !== 'pending' && readiness.localDeletion !== 'verified')) return false;

  return true;
}

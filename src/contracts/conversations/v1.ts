export const CONVERSATION_CONTRACT_VERSION_V1 = 'v1' as const;

export type HandoffKindV1 = 'human_help' | 'privacy_request';
export type HandoffReasonV1 =
  | 'customer_requested'
  | 'unsupported_question'
  | 'privacy_request'
  | 'consent_revoked'
  | 'send_rules_unknown'
  | 'outside_service_window'
  | 'delivery_failure';
export type HandoffSafeContextV1 = 'human_request' | 'faq_unapproved' | 'data_rights' | 'consent' | 'delivery';

/** Durable EPIC 5 handoff envelope. It carries safe reason codes, never message text. */
export type HandoffContractV1 = {
  version: typeof CONVERSATION_CONTRACT_VERSION_V1;
  handoffId: string;
  customerId: string;
  conversationId: string;
  kind: HandoffKindV1;
  reason: HandoffReasonV1;
  safeContext: HandoffSafeContextV1;
  idempotencyKey: string;
  status: 'pending';
  createdAt: string;
};

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/;
const REASONS = new Set<HandoffReasonV1>([
  'customer_requested', 'unsupported_question', 'privacy_request', 'consent_revoked',
  'send_rules_unknown', 'outside_service_window', 'delivery_failure',
]);
const CONTEXTS = new Set<HandoffSafeContextV1>([
  'human_request', 'faq_unapproved', 'data_rights', 'consent', 'delivery',
]);

export function isHandoffContractV1(value: unknown): value is HandoffContractV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every((key) => [
    'version', 'handoffId', 'customerId', 'conversationId', 'kind', 'reason', 'safeContext',
    'idempotencyKey', 'status', 'createdAt',
  ].includes(key))
    && ['version', 'handoffId', 'customerId', 'conversationId', 'kind', 'reason', 'safeContext',
      'idempotencyKey', 'status', 'createdAt'].every((key) => Object.hasOwn(item, key))
    && item.version === CONVERSATION_CONTRACT_VERSION_V1
    && typeof item.handoffId === 'string' && IDENTIFIER.test(item.handoffId)
    && typeof item.customerId === 'string' && IDENTIFIER.test(item.customerId)
    && typeof item.conversationId === 'string' && IDENTIFIER.test(item.conversationId)
    && (item.kind === 'human_help' || item.kind === 'privacy_request')
    && typeof item.reason === 'string' && REASONS.has(item.reason as HandoffReasonV1)
    && typeof item.safeContext === 'string' && CONTEXTS.has(item.safeContext as HandoffSafeContextV1)
    && typeof item.idempotencyKey === 'string' && IDENTIFIER.test(item.idempotencyKey)
    && item.status === 'pending'
    && typeof item.createdAt === 'string'
    && Number.isFinite(Date.parse(item.createdAt))
    && new Date(item.createdAt).toISOString() === item.createdAt;
}

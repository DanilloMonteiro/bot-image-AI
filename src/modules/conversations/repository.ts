export type ConversationConsentStatus = 'unknown' | 'granted' | 'refused' | 'revoked';
export type ConversationHandoffKind = 'human_help' | 'privacy_request';
export type ConversationDeliveryState = 'prepared' | 'accepted' | 'delivered' | 'read' | 'failed';
export type ConversationMessageKind = 'text' | 'audio';

export const CONVERSATION_OUTBOUND_MAX_RETRIES = 2;
export const CONVERSATION_OUTBOUND_MAX_ATTEMPTS = CONVERSATION_OUTBOUND_MAX_RETRIES + 1;

export type ConversationContext = {
  customerId: string;
  conversationId: string;
  conversationCreatedAt: string;
  lastInboundAt: string;
  adultConfirmed: boolean | null;
  ownsPhotoConfirmed: boolean | null;
  eligibilityPrompted: 'adult' | 'photo_ownership' | null;
  consentStatus: ConversationConsentStatus;
  consentPolicyVersion: string | null;
  consentPromptedVersion: string | null;
  audioConsent: boolean | null;
  audioConsentPrompted: boolean;
  audioConsentVersion: number;
  optedOut: boolean;
  revocationPending: boolean;
};

export type InboundMessage = {
  providerEventId: string;
  providerMessageId: string;
  channelId: string;
  externalCustomerId: string;
  occurredAt: string;
  receivedAt: string;
  kind: ConversationMessageKind;
  text: string | null;
  source: 'whatsapp' | 'voice_transcription';
  expectedAudioConsentVersion?: number;
};

export type ConversationDecision = {
  replyText: string | null;
  customerPatch?: {
    adultConfirmed?: boolean;
    ownsPhotoConfirmed?: boolean;
    consentStatus?: ConversationConsentStatus;
    consentPolicyVersion?: string | null;
    consentAt?: string | null;
    optedOut?: boolean;
    revocationPending?: boolean;
  };
  conversationPatch?: {
    eligibilityPrompted?: 'adult' | 'photo_ownership' | null;
    consentPromptedVersion?: string | null;
    audioConsent?: boolean | null;
    audioConsentPrompted?: boolean;
    incrementAudioConsentVersion?: boolean;
  };
  handoff?: {
    kind: ConversationHandoffKind;
    reason: 'customer_requested' | 'unsupported_question' | 'privacy_request' | 'consent_revoked';
    safeContext: 'human_request' | 'faq_unapproved' | 'data_rights' | 'consent';
  };
};

export type InboundProcessResult = {
  duplicate: boolean;
  customerId: string;
  conversationId: string;
  inboundMessageId: string;
  replyMessageId: string | null;
  replyText: string | null;
  handoffId: string | null;
  conversationStartedAt: string;
};

export type VoiceAuthorization = {
  allowed: boolean;
  conversationId: string | null;
  consentVersion: number | null;
  externalCustomerId: string;
};

export type VoiceAuthorizationRun<T> =
  | { authorized: true; authorization: VoiceAuthorization; result: T }
  | { authorized: false; authorization: VoiceAuthorization };

export type OutboundMessage = {
  messageId: string;
  customerId: string;
  conversationId: string;
  channelId: string;
  externalCustomerId: string;
  text: string;
  lastInboundAt: string;
  optedOut: boolean;
  revocationPending: boolean;
  deliveryState: ConversationDeliveryState;
  providerMessageId: string | null;
};

export type DeliveryReceipt = {
  providerEventId: string;
  providerMessageId: string;
  state: Exclude<ConversationDeliveryState, 'prepared'>;
  occurredAt: string;
};

export type DeliveryClaim =
  | { status: 'claimed'; message: OutboundMessage }
  | { status: 'blocked'; reason: 'opted_out' | 'revoked' | 'outside_service_window' | 'send_rules_unknown' | 'already_handled' }
  | { status: 'not_found' };

export interface ConversationRepository {
  processInbound(
    input: InboundMessage,
    decide: (context: ConversationContext) => ConversationDecision,
  ): Promise<InboundProcessResult>;
  findInboundResult(providerEventId: string): Promise<InboundProcessResult | null>;
  getVoiceAuthorization(channelId: string, externalCustomerId: string, receivedAt?: string): Promise<VoiceAuthorization>;
  withVoiceAuthorization<T>(
    channelId: string,
    externalCustomerId: string,
    action: (authorization: VoiceAuthorization) => Promise<T>,
    receivedAt?: string,
  ): Promise<VoiceAuthorizationRun<T>>;
  withCustomerSendLock<T>(messageId: string, action: () => Promise<T>): Promise<T>;
  claimOutbound(messageId: string, now: string, sendRulesVerified: boolean): Promise<DeliveryClaim>;
  markOutboundAccepted(messageId: string, providerMessageId: string, acceptedAt: string): Promise<void>;
  markOutboundBlocked(messageId: string, reason: string): Promise<void>;
  markOutboundRetryable(messageId: string, reason: string): Promise<void>;
  markOutboundFailed(messageId: string, reason: string, failedAt: string): Promise<void>;
  recordDeliveryReceipt(receipt: DeliveryReceipt): Promise<ConversationDeliveryState | null>;
  purgeExpired(now: string): Promise<number>;
}

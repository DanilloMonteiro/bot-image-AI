import {
  CONVERSATION_OUTBOUND_MAX_RETRIES,
  type ConversationRepository,
} from '../modules/conversations/repository.js';
import type { WhatsAppTextSender } from '../adapters/whatsapp/cloud-api.js';
import { isWhatsAppSendRulesVerified } from '../adapters/whatsapp/cloud-api.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleConversationOutboundJob(
  job: { messageId: string; attemptNumber?: number },
  dependencies: {
    repository: Pick<ConversationRepository,
      'withCustomerSendLock' | 'claimOutbound' | 'markOutboundAccepted' | 'markOutboundBlocked'
      | 'markOutboundRetryable' | 'markOutboundFailed'>;
    sender: WhatsAppTextSender;
    environment?: Record<string, string | undefined>;
    now?: () => string;
  },
): Promise<void> {
  if (!UUID.test(job.messageId) || (job.attemptNumber !== undefined
    && (!Number.isSafeInteger(job.attemptNumber) || job.attemptNumber < 0))) {
    throw new Error('invalid_conversation_outbound_job');
  }
  const attemptNumber = job.attemptNumber ?? 0;
  const clock = dependencies.now ?? (() => new Date().toISOString());
  const environment = dependencies.environment ?? process.env;
  await dependencies.repository.withCustomerSendLock(job.messageId, async () => {
    const sendRulesVerified = isWhatsAppSendRulesVerified(environment);
    const claimAt = clock();
    const claim = await dependencies.repository.claimOutbound(
      job.messageId,
      claimAt,
      sendRulesVerified,
    );
    if (claim.status !== 'claimed') return;

    let result;
    try { result = await dependencies.sender.sendText(claim.message); }
    catch { result = { status: 'failed' as const, reason: 'provider_unavailable' }; }
    if (result.status === 'accepted') {
      await dependencies.repository.markOutboundAccepted(job.messageId, result.providerMessageId, clock());
      return;
    }
    if (result.status === 'retryable') {
      if (attemptNumber < CONVERSATION_OUTBOUND_MAX_RETRIES) {
        await dependencies.repository.markOutboundRetryable(job.messageId, result.reason);
        throw new Error('conversation_outbound_rate_limited_retry');
      }
      await dependencies.repository.markOutboundFailed(job.messageId, 'rate_limited_max_retries', clock());
      return;
    }
    if (result.status === 'failed') {
      await dependencies.repository.markOutboundFailed(job.messageId, result.reason, clock());
      return;
    }
    await dependencies.repository.markOutboundBlocked(job.messageId, result.reason);
  });
}

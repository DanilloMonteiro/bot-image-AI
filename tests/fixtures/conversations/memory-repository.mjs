import { randomUUID } from 'node:crypto';

const IDLE_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const RANK = { prepared: 0, accepted: 1, failed: 2, delivered: 3, read: 4 };

export class MemoryConversationRepository {
  customers = new Map();
  conversations = new Map();
  messages = new Map();
  inboundEvents = new Map();
  handoffs = new Map();
  outbox = new Map();
  receipts = new Map();
  customerLocks = new Map();

  async withCustomerLock(customerKey, action) {
    const previous = this.customerLocks.get(customerKey) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    this.customerLocks.set(customerKey, current);
    await previous;
    try { return await action(); }
    finally {
      release();
      if (this.customerLocks.get(customerKey) === current) this.customerLocks.delete(customerKey);
    }
  }

  async processInbound(input, decide) {
    const customerKey = `${input.channelId}\u0000${input.externalCustomerId}`;
    return this.withCustomerLock(customerKey, () => this.processInboundWithCustomerLock(input, decide));
  }

  async processInboundWithCustomerLock(input, decide) {
    const prior = await this.findInboundResult(input.providerEventId);
    if (prior) return prior;
    const customerKey = `${input.channelId}\u0000${input.externalCustomerId}`;
    let customer = this.customers.get(customerKey);
    if (!customer) {
      customer = { customerId: randomUUID(), channelId: input.channelId,
        externalCustomerId: input.externalCustomerId, optedOut: false };
      this.customers.set(customerKey, customer);
    }

    let conversation = [...this.conversations.values()].find((item) => (
      item.customerId === customer.customerId && item.state === 'open'
    ));
    if (conversation && Date.parse(input.receivedAt) - Date.parse(conversation.lastInboundReceivedAt) >= IDLE_MS) {
      conversation.state = 'closed';
      conversation.closedAt = new Date(Date.parse(conversation.lastInboundReceivedAt) + IDLE_MS).toISOString();
      conversation = undefined;
    }
    if (!conversation) {
      conversation = {
        conversationId: randomUUID(), customerId: customer.customerId, state: 'open',
        conversationCreatedAt: input.receivedAt, lastInboundAt: input.occurredAt,
        lastInboundReceivedAt: input.receivedAt,
        adultConfirmed: null, ownsPhotoConfirmed: null, eligibilityPrompted: null,
        consentStatus: 'unknown', consentPolicyVersion: null, consentPromptedVersion: null,
        audioConsent: null, audioConsentPrompted: false, audioConsentVersion: 0,
        revocationPending: false,
      };
      this.conversations.set(conversation.conversationId, conversation);
    } else {
      if (Date.parse(input.occurredAt) > Date.parse(conversation.lastInboundAt)) {
        conversation.lastInboundAt = input.occurredAt;
      }
      if (Date.parse(input.receivedAt) > Date.parse(conversation.lastInboundReceivedAt)) {
        conversation.lastInboundReceivedAt = input.receivedAt;
      }
    }

    const context = {
      ...conversation,
      optedOut: customer.optedOut,
    };
    const decision = decide(context);
    const transcriptAllowed = input.source !== 'voice_transcription'
      || (context.audioConsent === true && context.audioConsentVersion === input.expectedAudioConsentVersion
        && !context.revocationPending && context.consentStatus !== 'revoked');
    const inboundMessageId = randomUUID();
    this.messages.set(inboundMessageId, {
      messageId: inboundMessageId, customerId: customer.customerId,
      conversationId: conversation.conversationId, direction: 'inbound',
      kind: transcriptAllowed ? input.kind : 'audio',
      source: transcriptAllowed ? input.source : 'whatsapp',
      text: transcriptAllowed ? input.text : null,
      providerMessageId: input.providerMessageId, occurredAt: input.occurredAt,
      deliveryState: 'accepted',
    });

    Object.assign(conversation, decision.customerPatch && {
      adultConfirmed: decision.customerPatch.adultConfirmed ?? conversation.adultConfirmed,
      ownsPhotoConfirmed: decision.customerPatch.ownsPhotoConfirmed ?? conversation.ownsPhotoConfirmed,
      consentStatus: decision.customerPatch.consentStatus ?? conversation.consentStatus,
      consentPolicyVersion: decision.customerPatch.consentPolicyVersion === undefined
        ? conversation.consentPolicyVersion : decision.customerPatch.consentPolicyVersion,
      consentDecidedAt: decision.customerPatch.consentAt === undefined
        ? conversation.consentDecidedAt : decision.customerPatch.consentAt,
      revocationPending: decision.customerPatch.revocationPending ?? conversation.revocationPending,
    });
    if (decision.customerPatch?.optedOut) customer.optedOut = true;
    Object.assign(conversation, decision.conversationPatch && {
      eligibilityPrompted: decision.conversationPatch.eligibilityPrompted === undefined
        ? conversation.eligibilityPrompted : decision.conversationPatch.eligibilityPrompted,
      consentPromptedVersion: decision.conversationPatch.consentPromptedVersion === undefined
        ? conversation.consentPromptedVersion : decision.conversationPatch.consentPromptedVersion,
      audioConsent: decision.conversationPatch.audioConsent === undefined
        ? conversation.audioConsent : decision.conversationPatch.audioConsent,
      audioConsentPrompted: decision.conversationPatch.audioConsentPrompted ?? conversation.audioConsentPrompted,
      audioConsentVersion: conversation.audioConsentVersion
        + (decision.conversationPatch.incrementAudioConsentVersion ? 1 : 0),
    });

    let handoffId = null;
    if (decision.handoff) {
      const idempotencyKey = `handoff:${input.providerEventId}:${decision.handoff.kind}`;
      let envelope = this.handoffs.get(idempotencyKey);
      if (!envelope) {
        handoffId = randomUUID();
        envelope = {
          version: 'v1', handoffId, customerId: customer.customerId,
          conversationId: conversation.conversationId, ...decision.handoff,
          idempotencyKey, status: 'pending', createdAt: input.receivedAt,
        };
        this.handoffs.set(idempotencyKey, envelope);
      } else handoffId = envelope.handoffId;
    }

    const replyText = decision.replyText?.trim()
      && !context.optedOut && decision.customerPatch?.optedOut !== true
      ? decision.replyText.trim() : null;
    let replyMessageId = null;
    if (replyText) {
      replyMessageId = randomUUID();
      this.messages.set(replyMessageId, {
        messageId: replyMessageId, customerId: customer.customerId,
        conversationId: conversation.conversationId, direction: 'outbound',
        kind: 'text', source: 'whatsapp', text: replyText,
        replyToMessageId: inboundMessageId, deliveryState: 'prepared', providerMessageId: null,
      });
      this.outbox.set(replyMessageId, { status: 'pending', blockReason: null });
    }

    const result = {
      duplicate: false, customerId: customer.customerId,
      conversationId: conversation.conversationId, inboundMessageId,
      replyMessageId, replyText, handoffId,
      conversationStartedAt: conversation.conversationCreatedAt,
    };
    this.inboundEvents.set(input.providerEventId, result);
    return structuredClone(result);
  }

  async findInboundResult(providerEventId) {
    const result = this.inboundEvents.get(providerEventId);
    return result ? { ...structuredClone(result), duplicate: true } : null;
  }

  async getVoiceAuthorization(channelId, externalCustomerId, receivedAt) {
    const customer = this.customers.get(`${channelId}\u0000${externalCustomerId}`);
    const conversation = customer && [...this.conversations.values()].find((item) => (
      item.customerId === customer.customerId && item.state === 'open'
    ));
    const lifecycleActive = receivedAt === undefined
      || Date.parse(receivedAt) - Date.parse(conversation?.lastInboundReceivedAt ?? '') < IDLE_MS;
    const allowed = !!customer && lifecycleActive && !customer.optedOut && conversation?.audioConsent === true
      && !conversation.revocationPending && conversation.consentStatus !== 'revoked';
    return {
      allowed,
      conversationId: conversation?.conversationId ?? null,
      consentVersion: allowed ? conversation.audioConsentVersion : null,
      externalCustomerId,
    };
  }

  async withVoiceAuthorization(channelId, externalCustomerId, action, receivedAt) {
    const customerKey = `${channelId}\u0000${externalCustomerId}`;
    return this.withCustomerLock(customerKey, async () => {
      const authorization = await this.getVoiceAuthorization(channelId, externalCustomerId, receivedAt);
      if (!authorization.allowed) return { authorized: false, authorization };
      const result = await action(authorization);
      return { authorized: true, authorization, result };
    });
  }

  async withCustomerSendLock(messageId, action) {
    const message = this.messages.get(messageId);
    if (!message) return action();
    const customer = [...this.customers.values()].find((item) => item.customerId === message.customerId);
    if (!customer) return action();
    return this.withCustomerLock(
      `${customer.channelId}\u0000${customer.externalCustomerId}`,
      action,
    );
  }

  async claimOutbound(messageId, now, sendRulesVerified) {
    const outbox = this.outbox.get(messageId);
    const message = this.messages.get(messageId);
    if (!outbox || !message) return { status: 'not_found' };
    if (outbox.status === 'sending') {
      Object.assign(outbox, { status: 'blocked', blockReason: 'delivery_outcome_unknown' });
      this.createDeliveryHandoff(message, 'delivery_failure', now);
      return { status: 'blocked', reason: 'already_handled' };
    }
    if (outbox.status !== 'pending') return { status: 'blocked', reason: 'already_handled' };
    const customer = [...this.customers.values()].find((item) => item.customerId === message.customerId);
    const conversation = this.conversations.get(message.conversationId);
    const reason = customer?.optedOut ? 'opted_out'
      : conversation?.revocationPending || conversation?.consentStatus === 'revoked' ? 'revoked'
        : !sendRulesVerified ? 'send_rules_unknown'
        : Date.parse(now) - Date.parse(conversation.lastInboundAt) >= IDLE_MS
          ? 'outside_service_window' : null;
    if (reason) {
      Object.assign(outbox, { status: 'blocked', blockReason: reason });
      if (reason === 'send_rules_unknown' || reason === 'outside_service_window') {
        this.createDeliveryHandoff(message, reason, now);
      }
      return { status: 'blocked', reason };
    }
    outbox.status = 'sending';
    return {
      status: 'claimed',
      message: {
        messageId, customerId: message.customerId, conversationId: message.conversationId,
        channelId: customer.channelId, externalCustomerId: customer.externalCustomerId, text: message.text,
        lastInboundAt: conversation.lastInboundAt, optedOut: customer.optedOut,
        revocationPending: conversation.revocationPending, deliveryState: message.deliveryState,
        providerMessageId: message.providerMessageId,
      },
    };
  }

  async markOutboundAccepted(messageId, providerMessageId) {
    const message = this.messages.get(messageId);
    const outbox = this.outbox.get(messageId);
    if (!message || !outbox) throw new Error('message_missing');
    message.providerMessageId = providerMessageId;
    if (RANK.accepted > RANK[message.deliveryState]) message.deliveryState = 'accepted';
    outbox.status = 'complete';
    const early = [...this.receipts.values()].filter((receipt) => receipt.providerMessageId === providerMessageId);
    for (const receipt of early) this.applyReceipt(message, receipt.state);
  }

  async markOutboundBlocked(messageId, reason) {
    const outbox = this.outbox.get(messageId);
    if (outbox && ['pending', 'sending'].includes(outbox.status)) {
      Object.assign(outbox, { status: 'blocked', blockReason: reason });
      const message = this.messages.get(messageId);
      if (message) this.createDeliveryHandoff(message, 'delivery_failure', new Date().toISOString());
    }
  }

  async markOutboundRetryable(messageId, reason) {
    const outbox = this.outbox.get(messageId);
    if (outbox?.status === 'sending') Object.assign(outbox, { status: 'pending', blockReason: `retry:${reason}` });
  }

  async markOutboundFailed(messageId, reason, failedAt) {
    const outbox = this.outbox.get(messageId);
    const message = this.messages.get(messageId);
    if (!outbox || !message || !['pending', 'sending'].includes(outbox.status)) return;
    Object.assign(outbox, { status: 'failed', blockReason: reason });
    if (RANK.failed > RANK[message.deliveryState]) message.deliveryState = 'failed';
    this.createDeliveryHandoff(message, 'delivery_failure', failedAt);
  }

  createDeliveryHandoff(message, reason, createdAt) {
    const idempotencyKey = `delivery:${message.messageId}`;
    if (this.handoffs.has(idempotencyKey)) return;
    this.handoffs.set(idempotencyKey, {
      version: 'v1', handoffId: randomUUID(), customerId: message.customerId,
      conversationId: message.conversationId, kind: 'human_help', reason,
      safeContext: 'delivery', idempotencyKey, status: 'pending', createdAt,
    });
  }

  async recordDeliveryReceipt(receipt) {
    if (!this.receipts.has(receipt.providerEventId)) this.receipts.set(receipt.providerEventId, receipt);
    const message = [...this.messages.values()].find((item) => item.providerMessageId === receipt.providerMessageId);
    if (!message) return null;
    this.applyReceipt(message, receipt.state);
    return message.deliveryState;
  }

  applyReceipt(message, state) {
    if (RANK[state] > RANK[message.deliveryState]) message.deliveryState = state;
  }

  async purgeExpired(now) {
    let deleted = 0;
    for (const [id, conversation] of this.conversations) {
      if (conversation.state === 'open' && Date.parse(now) - Date.parse(conversation.lastInboundReceivedAt) >= IDLE_MS) {
        conversation.state = 'closed';
        conversation.closedAt = new Date(Date.parse(conversation.lastInboundReceivedAt) + IDLE_MS).toISOString();
      }
      if (conversation.state === 'closed' && Date.parse(now) - Date.parse(conversation.closedAt) >= RETENTION_MS) {
        this.conversations.delete(id);
        for (const [handoffKey, handoff] of this.handoffs) {
          if (handoff.conversationId === id) this.handoffs.delete(handoffKey);
        }
        for (const [messageId, message] of this.messages) {
          if (message.conversationId === id) {
            this.messages.delete(messageId);
            this.outbox.delete(messageId);
          }
        }
        for (const [eventId, event] of this.inboundEvents) {
          if (event.conversationId === id) this.inboundEvents.delete(eventId);
        }
        deleted += 1;
      }
    }
    const retainedCustomerIds = new Set([...this.conversations.values()].map((conversation) => conversation.customerId));
    for (const [key, customer] of this.customers) {
      if (!retainedCustomerIds.has(customer.customerId)) this.customers.delete(key);
    }
    return deleted;
  }
}

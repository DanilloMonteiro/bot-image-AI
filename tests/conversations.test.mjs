import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { MemoryConversationRepository } from './fixtures/conversations/memory-repository.mjs';

const require = createRequire(import.meta.url);
const { Conversations, authorizePhotoProcessing } = require('../dist/modules/conversations/use-cases.js');
const { isHandoffContractV1 } = require('../dist/contracts/conversations/v1.js');
const {
  normalizeWhatsAppWebhook,
  verifyWhatsAppSignature,
  isWhatsAppIngressApproved,
  WhatsAppCloudApiAdapter,
} = require('../dist/adapters/whatsapp/cloud-api.js');
const { GeminiOggTranscriber } = require('../dist/adapters/gemini/ogg-transcriber.js');
const { GeminiFaqClassifier } = require('../dist/adapters/gemini/faq-classifier.js');
const { WhatsAppCloudMediaDownloader } = require('../dist/adapters/whatsapp/media-downloader.js');
const {
  handleWhatsAppVerificationRequest,
  handleWhatsAppWebhookRequest,
} = require('../dist/adapters/http/whatsapp-webhook-handler.js');
const { handleConversationOutboundJob } = require('../dist/worker/conversation-outbound-handler.js');
const { isPublicStoryPath } = require('../dist/adapters/http/production-traffic-gate.js');

const CHANNEL = 'whatsapp:test-number';
const CUSTOMER = '5511999990000';
const at = (hour, day = '2026-10-27') => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;

function inbound(overrides = {}) {
  const time = overrides.receivedAt ?? at(10);
  return {
    providerEventId: overrides.providerEventId ?? `event-${Math.random().toString(16).slice(2)}`,
    providerMessageId: overrides.providerMessageId ?? `message-${Math.random().toString(16).slice(2)}`,
    channelId: overrides.channelId ?? CHANNEL,
    externalCustomerId: overrides.externalCustomerId ?? CUSTOMER,
    occurredAt: overrides.occurredAt ?? time,
    receivedAt: time,
    text: overrides.text ?? 'oi',
  };
}

test('duplicate inbound webhook records one correlated response and preserves the stable customer id', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const event = inbound({ providerEventId: 'duplicate-event', providerMessageId: 'duplicate-message' });
  const first = await conversations.handleText(event);
  const replay = await conversations.handleText(event);

  assert.equal(first.duplicate, false);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.customerId, first.customerId);
  assert.equal(replay.conversationId, first.conversationId);
  assert.equal(replay.replyMessageId, first.replyMessageId);
  assert.equal(repository.messages.size, 2);
  assert.equal(repository.outbox.size, 1);
  assert.equal([...repository.messages.values()].filter((message) => message.direction === 'outbound').length, 1);
});

test('conversation closes after 24 idle hours, resumes under the stable customer id, and retention starts at closure', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const first = await conversations.handleText(inbound({
    providerEventId: 'lifecycle-1', text: 'oi', receivedAt: at(9), occurredAt: at(9),
  }));
  const same = await conversations.handleText(inbound({
    providerEventId: 'lifecycle-2', text: 'oi', receivedAt: at(23), occurredAt: at(23),
  }));
  const resumed = await conversations.handleText(inbound({
    providerEventId: 'lifecycle-3', text: 'oi', receivedAt: at(0, '2026-10-29'),
    occurredAt: at(0, '2026-10-29'),
  }));

  assert.equal(same.customerId, first.customerId);
  assert.equal(same.conversationId, first.conversationId);
  assert.equal(resumed.customerId, first.customerId);
  assert.notEqual(resumed.conversationId, first.conversationId);
  const closed = repository.conversations.get(first.conversationId);
  assert.equal(closed.closedAt, at(23, '2026-10-28'));
  assert.equal(await conversations.purgeExpired(at(22, '2026-11-04')), 0);
  assert.equal(await conversations.purgeExpired(at(23, '2026-11-04')), 1);
  assert.equal(repository.messages.has(first.inboundMessageId), false);
  assert.equal(repository.conversations.has(resumed.conversationId), true);
});

test('delayed webhook receive time controls conversation lifecycle while provider time controls the send window', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const first = await conversations.handleText(inbound({
    providerEventId: 'delayed-first', text: 'oi',
    occurredAt: at(0, '2026-10-27'), receivedAt: at(0, '2026-10-28'),
  }));
  const delayed = await conversations.handleText(inbound({
    providerEventId: 'delayed-second', text: 'ainda tenho uma dúvida',
    occurredAt: at(12, '2026-10-27'), receivedAt: at(23, '2026-10-28'),
  }));
  assert.equal(delayed.conversationId, first.conversationId);
  const context = repository.conversations.get(delayed.conversationId);
  assert.equal(context.lastInboundReceivedAt, at(23, '2026-10-28'));
  assert.equal(context.lastInboundAt, at(12, '2026-10-27'));

  await handleConversationOutboundJob({ messageId: delayed.replyMessageId }, {
    repository,
    sender: { async sendText() { throw new Error('provider must not be called outside the window'); } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(23, '2026-10-28'),
  });
  assert.equal(repository.outbox.get(delayed.replyMessageId).blockReason, 'outside_service_window');

  const resumed = await conversations.handleText(inbound({
    providerEventId: 'delayed-third', text: 'oi novamente',
    occurredAt: at(23, '2026-10-28'), receivedAt: at(23, '2026-10-29'),
  }));
  assert.notEqual(resumed.conversationId, first.conversationId);
  assert.equal(repository.conversations.get(first.conversationId).closedAt, at(23, '2026-10-29'));
});

test('retention purge deletes the external-number customer row after its last conversation expires', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const opened = await conversations.handleText(inbound({
    providerEventId: 'purge-customer', externalCustomerId: '5511999994444',
    text: 'quero excluir meus dados', occurredAt: at(9), receivedAt: at(9),
  }));
  assert.equal(repository.customers.size, 1);
  assert.equal(repository.handoffs.size, 1);
  assert.equal(await conversations.purgeExpired(at(8, '2026-11-04')), 0);
  assert.equal(repository.customers.size, 1);
  assert.equal(repository.handoffs.size, 1);
  assert.equal(await conversations.purgeExpired(at(9, '2026-11-04')), 1);
  assert.equal(repository.customers.size, 0);
  assert.equal(repository.conversations.has(opened.conversationId), false);
  assert.equal(repository.handoffs.size, 0);
});

test('eligibility and versioned consent are explicit, ordered, and cannot open the photo gate', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const make = (id, text, hour) => inbound({
    providerEventId: id, providerMessageId: `msg-${id}`, text,
    receivedAt: at(hour), occurredAt: at(hour),
  });
  const adultPrompt = await conversations.handleText(make('photo-1', 'quero fazer um retrato', 10));
  assert.match(adultPrompt.replyText, /18 anos/);
  assert.doesNotMatch(adultPrompt.replyText, /foto/i);

  const ownershipPrompt = await conversations.handleText(make('photo-2', 'sim, tenho 18 anos', 10));
  assert.match(ownershipPrompt.replyText, /foto.*sua/i);
  assert.doesNotMatch(ownershipPrompt.replyText, /concorda/i);

  const consentPrompt = await conversations.handleText(make('photo-3', 'sim, a foto é minha', 10));
  assert.match(consentPrompt.replyText, /Política de dados do piloto/);
  assert.match(consentPrompt.replyText, /7 dias após o encerramento da conversa/i);
  assert.match(consentPrompt.replyText, /7 dias após a entrega do resultado/i);
  assert.match(consentPrompt.replyText, /6 dias adicionais/i);
  assert.match(consentPrompt.replyText, /Google Nano Banana 2.1/i);
  assert.match(consentPrompt.replyText, /concorda/i);

  const consented = await conversations.handleText(make('photo-4', 'sim, concordo', 10));
  assert.match(consented.replyText, /bloqueados/);
  assert.match(consented.replyText, /não envie uma foto/i);
  const context = repository.conversations.get(consented.conversationId);
  assert.equal(context.adultConfirmed, true);
  assert.equal(context.ownsPhotoConfirmed, true);
  assert.equal(context.consentPolicyVersion, 'v2');
  assert.equal(context.consentStatus, 'granted');
  assert.deepEqual(authorizePhotoProcessing({ ...context, optedOut: false }), {
    allowed: false, reason: 'local_deletion_unverified',
  });

  const revoked = await conversations.handleText(make('photo-5', 'revogar meu consentimento', 10));
  assert.match(revoked.replyText, /Revogação registrada/);
  const revokedContext = repository.conversations.get(revoked.conversationId);
  assert.equal(revokedContext.revocationPending, true);
  assert.equal(authorizePhotoProcessing({ ...revokedContext, optedOut: false }).reason, 'consent_revoked');
  assert.equal(repository.handoffs.size, 1);
});

test('negative eligibility and consent refuse safely without asking for a photo', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const asked = await conversations.handleText(inbound({ providerEventId: 'refuse-1', text: 'quero usar uma foto' }));
  const refusal = await conversations.handleText(inbound({
    providerEventId: 'refuse-2', text: 'não', receivedAt: at(10), occurredAt: at(10),
  }));
  assert.match(asked.replyText, /18 anos/);
  assert.match(refusal.replyText, /não envie uma foto/i);
  assert.equal(repository.conversations.get(refusal.conversationId).adultConfirmed, false);
  assert.equal(repository.messages.size, 4);

  const consentRepository = new MemoryConversationRepository();
  const consentFlow = new Conversations(consentRepository);
  await consentFlow.handleText(inbound({ providerEventId: 'consent-no-1', text: 'quero fazer um retrato' }));
  await consentFlow.handleText(inbound({ providerEventId: 'consent-no-2', text: 'sim', receivedAt: at(10) }));
  const prompt = await consentFlow.handleText(inbound({
    providerEventId: 'consent-no-3', text: 'sim', receivedAt: at(10),
  }));
  assert.match(prompt.replyText, /concorda/i);
  const deniedConsent = await consentFlow.handleText(inbound({
    providerEventId: 'consent-no-4', text: 'não', receivedAt: at(10),
  }));
  assert.match(deniedConsent.replyText, /sem consentimento afirmativo/i);
  assert.equal(consentRepository.conversations.get(deniedConsent.conversationId).consentStatus, 'refused');
  assert.equal(authorizePhotoProcessing({
    ...consentRepository.conversations.get(deniedConsent.conversationId), optedOut: false,
  }).reason, 'consent_missing');
});

test('ambiguous or contradictory eligibility and consent answers never authorize processing', async () => {
  const minorRepository = new MemoryConversationRepository();
  const minorFlow = new Conversations(minorRepository);
  await minorFlow.handleText(inbound({ providerEventId: 'minor-start', text: 'quero usar uma foto' }));
  const minor = await minorFlow.handleText(inbound({
    providerEventId: 'minor-answer', text: 'sim, tenho 17 anos', receivedAt: at(10), occurredAt: at(10),
  }));
  assert.equal(minorRepository.conversations.get(minor.conversationId).adultConfirmed, false);
  assert.match(minor.replyText, /somente para pessoas adultas/i);
  assert.doesNotMatch(minor.replyText, /foto que você pretende usar é sua/i);

  const ownershipRepository = new MemoryConversationRepository();
  const ownershipFlow = new Conversations(ownershipRepository);
  await ownershipFlow.handleText(inbound({ providerEventId: 'ownership-start', text: 'quero usar uma foto' }));
  await ownershipFlow.handleText(inbound({ providerEventId: 'ownership-age', text: 'sim', receivedAt: at(10) }));
  const otherPhoto = await ownershipFlow.handleText(inbound({
    providerEventId: 'ownership-other', text: 'sim, mas a imagem é da minha irmã', receivedAt: at(10), occurredAt: at(10),
  }));
  assert.equal(ownershipRepository.conversations.get(otherPhoto.conversationId).ownsPhotoConfirmed, false);
  assert.match(otherPhoto.replyText, /foto de outra pessoa/i);
  assert.doesNotMatch(otherPhoto.replyText, /concorda com o processamento/i);

  const consentRepository = new MemoryConversationRepository();
  const consentFlow = new Conversations(consentRepository);
  await consentFlow.handleText(inbound({ providerEventId: 'ambiguous-consent-start', text: 'quero usar uma foto' }));
  await consentFlow.handleText(inbound({ providerEventId: 'ambiguous-consent-age', text: 'sim', receivedAt: at(10) }));
  await consentFlow.handleText(inbound({ providerEventId: 'ambiguous-consent-owner', text: 'sim', receivedAt: at(10) }));
  const ambiguous = await consentFlow.handleText(inbound({
    providerEventId: 'ambiguous-consent-answer', text: 'sim, mas não concordo', receivedAt: at(10), occurredAt: at(10),
  }));
  const context = consentRepository.conversations.get(ambiguous.conversationId);
  assert.notEqual(context.consentStatus, 'granted');
  assert.equal(context.consentPromptedVersion, 'v2');
  assert.match(ambiguous.replyText, /Não consegui confirmar/i);
  assert.doesNotMatch(ambiguous.replyText, /Consentimento registrado/i);
});

test('uncertain audio consent stays pending and asks for a clear yes or no', async () => {
  const repository = new MemoryConversationRepository();
  let transcriptions = 0;
  const conversations = new Conversations(repository, {
    async transcribeOgg() { transcriptions += 1; return { status: 'transcribed', text: 'texto' }; },
  });
  const voice = await conversations.handleVoice({
    ...inbound({ providerEventId: 'uncertain-audio-prompt' }), audio: Buffer.from('OggSsynthetic'),
  });
  const uncertain = await conversations.handleText(inbound({
    providerEventId: 'uncertain-audio-answer', text: 'não sei', receivedAt: at(10), occurredAt: at(10),
  }));
  const context = repository.conversations.get(uncertain.conversationId);
  assert.equal(context.audioConsent, null);
  assert.equal(context.audioConsentPrompted, true);
  assert.match(uncertain.replyText, /Não consegui confirmar/i);
  assert.equal(transcriptions, 0);
  assert.match(voice.replyText, /Você autoriza/i);
});

test('voice requires conversation consent and persists only a successful transcript as text', async () => {
  const repository = new MemoryConversationRepository();
  let transcriptions = 0;
  const transcriber = { async transcribeOgg(audio) {
    transcriptions += 1;
    assert.equal(Buffer.from(audio.subarray(0, 4)).toString('ascii'), 'OggS');
    return { status: 'transcribed', text: 'quanto custa?' };
  } };
  const conversations = new Conversations(repository, transcriber);
  const ogg = Buffer.from('OggSsynthetic audio');
  const voiceInput = {
    ...inbound({ providerEventId: 'voice-1', providerMessageId: 'voice-message-1' }),
    audio: ogg,
  };
  const consentPrompt = await conversations.handleVoice(voiceInput);
  assert.match(consentPrompt.replyText, /Você autoriza/);
  assert.equal(transcriptions, 0);

  await conversations.handleText(inbound({
    providerEventId: 'voice-consent', text: 'sim', receivedAt: at(10), occurredAt: at(10),
  }));
  const transcript = await conversations.handleVoice({
    ...voiceInput,
    providerEventId: 'voice-2', providerMessageId: 'voice-message-2',
    occurredAt: at(10), receivedAt: at(10),
  });
  assert.match(transcript.replyText, /preço aprovado/i);
  const storedTranscript = repository.messages.get(transcript.inboundMessageId);
  assert.equal(storedTranscript.kind, 'text');
  assert.equal(storedTranscript.source, 'voice_transcription');
  assert.equal(storedTranscript.text, 'quanto custa?');
  assert.equal(Object.hasOwn(storedTranscript, 'audio'), false);
  assert.equal(JSON.stringify([...repository.messages.values()]).includes('synthetic audio'), false);
  assert.equal(transcriptions, 1);

  const replay = await conversations.handleVoice({
    ...voiceInput,
    providerEventId: 'voice-2', providerMessageId: 'voice-message-2',
    occurredAt: at(10), receivedAt: at(10),
  });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.replyMessageId, transcript.replyMessageId);
  assert.equal(transcriptions, 1);

  await conversations.handleText(inbound({
    providerEventId: 'voice-revocation', text: 'revogar processamento',
    receivedAt: at(10), occurredAt: at(10),
  }));
  const afterRevocation = await conversations.handleVoice({
    ...voiceInput, providerEventId: 'voice-3', providerMessageId: 'voice-message-3',
    occurredAt: at(10), receivedAt: at(10),
  });
  assert.match(afterRevocation.replyText, /processamento continua bloqueado/i);
  assert.equal(repository.messages.get(afterRevocation.inboundMessageId).text, null);
  assert.equal(transcriptions, 1);
});

test('voice refusal and transcription failure offer text and never persist audio bytes', async () => {
  const repository = new MemoryConversationRepository();
  let calls = 0;
  const transcriber = { async transcribeOgg() { calls += 1; return { status: 'failed' }; } };
  const conversations = new Conversations(repository, transcriber);
  const audio = Buffer.from('OggSsynthetic');
  const refusedAsk = await conversations.handleVoice({ ...inbound({ providerEventId: 'voice-no-1' }), audio });
  await conversations.handleText(inbound({ providerEventId: 'voice-no-2', text: 'não' }));
  const refused = await conversations.handleVoice({
    ...inbound({ providerEventId: 'voice-no-3', receivedAt: at(10), occurredAt: at(10) }), audio,
  });
  assert.match(refused.replyText, /texto/i);
  assert.equal(calls, 0);

  const askAgain = await conversations.handleVoice({
    ...inbound({ providerEventId: 'voice-fail-1', externalCustomerId: '5511999991111' }), audio,
  });
  await conversations.handleText(inbound({
    providerEventId: 'voice-fail-2', externalCustomerId: '5511999991111', text: 'sim',
  }));
  const failed = await conversations.handleVoice({
    ...inbound({
      providerEventId: 'voice-fail-3', externalCustomerId: '5511999991111',
      receivedAt: at(10), occurredAt: at(10),
    }), audio,
  });
  assert.match(askAgain.replyText, /Você autoriza/);
  assert.match(failed.replyText, /não consegui transcrever/i);
  assert.equal(repository.messages.get(failed.inboundMessageId).text, null);
  assert.equal(JSON.stringify([...repository.messages.values()]).includes('synthetic'), false);
  assert.equal(calls, 1);
});

test('consent revocation serializes against transcription and prevents a late transcript from being used', async () => {
  const repository = new MemoryConversationRepository();
  let faqCalls = 0;
  let signalStarted;
  let releaseTranscription;
  const started = new Promise((resolve) => { signalStarted = resolve; });
  const paused = new Promise((resolve) => { releaseTranscription = resolve; });
  const conversations = new Conversations(repository, {
    async transcribeOgg() {
      signalStarted();
      await paused;
      return { status: 'transcribed', text: 'vocês atendem em qual cidade?' };
    },
  }, {
    async classifyQuestion() {
      faqCalls += 1;
      return { status: 'classified', answerId: 'unknown' };
    },
  });
  const audio = Buffer.from('OggSsynthetic audio');
  await conversations.handleVoice({ ...inbound({ providerEventId: 'serialized-voice-consent-prompt' }), audio });
  await conversations.handleText(inbound({
    providerEventId: 'serialized-voice-consent', text: 'sim', receivedAt: at(10), occurredAt: at(10),
  }));

  const voicePromise = conversations.handleVoice({
    ...inbound({
      providerEventId: 'serialized-voice-in-flight', providerMessageId: 'serialized-voice-message',
      receivedAt: at(10), occurredAt: at(10),
    }),
    audio,
  });
  await started;
  const revocationPromise = conversations.handleText(inbound({
    providerEventId: 'serialized-voice-revocation', text: 'revogar processamento',
    receivedAt: at(10), occurredAt: at(10),
  }));
  releaseTranscription();
  const [voice, revocation] = await Promise.all([voicePromise, revocationPromise]);

  const storedVoice = repository.messages.get(voice.inboundMessageId);
  assert.equal(storedVoice.kind, 'audio');
  assert.equal(storedVoice.text, null);
  assert.equal(storedVoice.source, 'whatsapp');
  assert.doesNotMatch(voice.replyText, /preço aprovado/i);
  assert.match(voice.replyText, /interrompido/i);
  assert.equal(faqCalls, 0);
  assert.equal(repository.conversations.get(revocation.conversationId).consentStatus, 'revoked');
  assert.equal(JSON.stringify([...repository.messages.values()]).includes('qual cidade'), false);
});

test('human and privacy handoffs are versioned, unique, and omit inbound message content', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const humanInput = inbound({ providerEventId: 'handoff-human', text: 'quero falar com uma pessoa' });
  const human = await conversations.handleText(humanInput);
  const replay = await conversations.handleText(humanInput);
  assert.equal(human.handoffId, replay.handoffId);
  assert.equal(repository.handoffs.size, 1);
  const envelope = [...repository.handoffs.values()][0];
  assert.equal(isHandoffContractV1(envelope), true);
  assert.equal(envelope.kind, 'human_help');
  assert.equal(JSON.stringify(envelope).includes(humanInput.text), false);

  const privacy = await conversations.handleText(inbound({
    providerEventId: 'handoff-privacy', text: 'quero excluir meus dados', receivedAt: at(10), occurredAt: at(10),
  }));
  assert.equal(repository.handoffs.size, 2);
  assert.equal(repository.handoffs.get(`handoff:handoff-privacy:privacy_request`).kind, 'privacy_request');
  assert.match(privacy.replyText, /verificar/i);
});

test('channel rules, opt-out, expiry, and delivery receipts fail closed and never regress evidence', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const first = await conversations.handleText(inbound({ providerEventId: 'send-rule-1' }));
  let sends = 0;
  const sender = { async sendText() { sends += 1; return { status: 'accepted', providerMessageId: 'provider-message' }; } };

  await handleConversationOutboundJob({ messageId: first.replyMessageId }, {
    repository, sender, environment: {}, now: () => at(10),
  });
  assert.equal(sends, 0);
  assert.equal(repository.outbox.get(first.replyMessageId).blockReason, 'send_rules_unknown');
  assert.equal(repository.handoffs.get(`delivery:${first.replyMessageId}`).reason, 'send_rules_unknown');
  assert.equal(repository.handoffs.get(`delivery:${first.replyMessageId}`).safeContext, 'delivery');

  const second = await conversations.handleText(inbound({
    providerEventId: 'send-rule-2', text: 'oi', receivedAt: at(10), occurredAt: at(10),
  }));
  const third = await conversations.handleText(inbound({
    providerEventId: 'send-rule-3', text: 'pare', receivedAt: at(10), occurredAt: at(10),
  }));
  assert.equal(third.replyMessageId, null);
  await handleConversationOutboundJob({ messageId: second.replyMessageId }, {
    repository, sender, environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' }, now: () => at(10),
  });
  assert.equal(sends, 0);
  assert.equal(repository.outbox.get(second.replyMessageId).blockReason, 'opted_out');
  assert.equal(repository.handoffs.has(`delivery:${second.replyMessageId}`), false);

  const plainLanguageOptOut = await conversations.handleText(inbound({
    providerEventId: 'send-rule-plain-opt-out', externalCustomerId: '5511999995555',
    text: 'não quero mais receber mensagens', receivedAt: at(10), occurredAt: at(10),
  }));
  assert.equal(plainLanguageOptOut.replyMessageId, null);
  assert.equal(repository.customers.get(`${CHANNEL}\u00005511999995555`).optedOut, true);

  const thirdCustomer = await conversations.handleText(inbound({
    providerEventId: 'receipt-1', externalCustomerId: '5511999992222', text: 'oi',
  }));
  const message = repository.messages.get(thirdCustomer.replyMessageId);
  assert.equal(await conversations.recordDeliveryReceipt({
    providerEventId: 'receipt-delivered-first', providerMessageId: 'provider-reordered',
    state: 'delivered', occurredAt: at(10),
  }), null);
  const receiptSender = {
    async sendText() { return { status: 'accepted', providerMessageId: 'provider-reordered' }; },
  };
  await handleConversationOutboundJob({ messageId: thirdCustomer.replyMessageId }, {
    repository, sender: receiptSender,
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' }, now: () => at(10),
  });
  assert.equal(message.deliveryState, 'delivered');
  assert.equal(await conversations.recordDeliveryReceipt({
    providerEventId: 'receipt-failure-late', providerMessageId: 'provider-reordered',
    state: 'failed', occurredAt: at(11),
  }), 'delivered');
  assert.equal(message.deliveryState, 'delivered');

  const expired = await conversations.handleText(inbound({
    providerEventId: 'send-expired', externalCustomerId: '5511999993333', text: 'oi',
    occurredAt: at(0), receivedAt: at(0),
  }));
  await handleConversationOutboundJob({ messageId: expired.replyMessageId }, {
    repository, sender, environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(0, '2026-10-28'),
  });
  assert.equal(repository.outbox.get(expired.replyMessageId).blockReason, 'outside_service_window');
  assert.equal(repository.handoffs.get(`delivery:${expired.replyMessageId}`).reason, 'outside_service_window');
  assert.equal(sends, 0);
});

test('consent revocation blocks an already queued reply before sender transport', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const queued = await conversations.handleText(inbound({ providerEventId: 'revocation-queued-reply' }));
  const revoked = await conversations.handleText(inbound({
    providerEventId: 'revocation-before-send', text: 'revogar meu consentimento',
    receivedAt: at(10), occurredAt: at(10),
  }));
  assert.equal(repository.conversations.get(revoked.conversationId).revocationPending, true);

  let sends = 0;
  await handleConversationOutboundJob({ messageId: queued.replyMessageId }, {
    repository,
    sender: { async sendText() { sends += 1; return { status: 'accepted', providerMessageId: 'must-not-send' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' }, now: () => at(10),
  });

  assert.equal(sends, 0);
  assert.equal(repository.outbox.get(queued.replyMessageId).blockReason, 'revoked');
  assert.equal(repository.handoffs.has(`delivery:${queued.replyMessageId}`), false);
});

test('adapter-blocked outbound sends create one safe durable delivery handoff', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const queued = await conversations.handleText(inbound({ providerEventId: 'adapter-blocked-send' }));
  let sends = 0;
  const dependencies = {
    repository,
    sender: { async sendText() { sends += 1; return { status: 'blocked', reason: 'budget_balance_unknown' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' }, now: () => at(10),
  };

  await handleConversationOutboundJob({ messageId: queued.replyMessageId }, dependencies);
  await handleConversationOutboundJob({ messageId: queued.replyMessageId }, dependencies);

  assert.equal(sends, 1);
  assert.equal(repository.outbox.get(queued.replyMessageId).blockReason, 'budget_balance_unknown');
  const handoff = repository.handoffs.get(`delivery:${queued.replyMessageId}`);
  assert.equal(handoff.reason, 'delivery_failure');
  assert.equal(handoff.safeContext, 'delivery');
  assert.equal(isHandoffContractV1(handoff), true);
  assert.equal([...repository.handoffs.keys()].filter((key) => key === `delivery:${queued.replyMessageId}`).length, 1);
});

test('a redelivered sending outbox is treated as ambiguous without resending', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const queued = await conversations.handleText(inbound({ providerEventId: 'ambiguous-sending-outbox' }));
  Object.assign(repository.outbox.get(queued.replyMessageId), { status: 'sending' });
  let sends = 0;
  const dependencies = {
    repository,
    sender: { async sendText() { sends += 1; return { status: 'accepted', providerMessageId: 'must-not-resend' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' }, now: () => at(10),
  };

  await handleConversationOutboundJob({ messageId: queued.replyMessageId }, dependencies);
  await handleConversationOutboundJob({ messageId: queued.replyMessageId }, dependencies);

  assert.equal(sends, 0);
  assert.equal(repository.outbox.get(queued.replyMessageId).status, 'blocked');
  assert.equal(repository.outbox.get(queued.replyMessageId).blockReason, 'delivery_outcome_unknown');
  const handoff = repository.handoffs.get(`delivery:${queued.replyMessageId}`);
  assert.equal(handoff.reason, 'delivery_failure');
  assert.equal(handoff.safeContext, 'delivery');
  assert.equal(isHandoffContractV1(handoff), true);
  assert.equal([...repository.handoffs.keys()].filter((key) => key === `delivery:${queued.replyMessageId}`).length, 1);
});

test('outbound retries only explicit safe rejections and records terminal provider failures for recovery', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const retryable = await conversations.handleText(inbound({ providerEventId: 'outbound-safe-retry' }));
  let sendCount = 0;
  await assert.rejects(handleConversationOutboundJob({
    messageId: retryable.replyMessageId, attemptNumber: 0,
  }, {
    repository,
    sender: { async sendText() { sendCount += 1; return { status: 'retryable', reason: 'rate_limited' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10),
  }), /rate_limited_retry/);
  assert.equal(repository.outbox.get(retryable.replyMessageId).status, 'pending');
  assert.equal(repository.outbox.get(retryable.replyMessageId).blockReason, 'retry:rate_limited');

  await handleConversationOutboundJob({ messageId: retryable.replyMessageId, attemptNumber: 1 }, {
    repository,
    sender: { async sendText() { sendCount += 1; return { status: 'accepted', providerMessageId: 'wamid-retried' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10),
  });
  assert.equal(sendCount, 2);
  assert.equal(repository.outbox.get(retryable.replyMessageId).status, 'complete');

  const ambiguous = await conversations.handleText(inbound({ providerEventId: 'outbound-ambiguous-failure' }));
  let ambiguousCalls = 0;
  await handleConversationOutboundJob({ messageId: ambiguous.replyMessageId, attemptNumber: 0 }, {
    repository,
    sender: { async sendText() { ambiguousCalls += 1; return { status: 'failed', reason: 'provider_unavailable' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10),
  });
  assert.equal(repository.outbox.get(ambiguous.replyMessageId).status, 'failed');
  const handoff = repository.handoffs.get(`delivery:${ambiguous.replyMessageId}`);
  assert.equal(handoff.reason, 'delivery_failure');
  assert.equal(handoff.safeContext, 'delivery');
  assert.equal(isHandoffContractV1(handoff), true);
  await handleConversationOutboundJob({ messageId: ambiguous.replyMessageId, attemptNumber: 1 }, {
    repository,
    sender: { async sendText() { ambiguousCalls += 1; return { status: 'accepted', providerMessageId: 'must-not-resend' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10),
  });
  assert.equal(ambiguousCalls, 1);

  const exhausted = await conversations.handleText(inbound({ providerEventId: 'outbound-retry-exhausted' }));
  await handleConversationOutboundJob({ messageId: exhausted.replyMessageId, attemptNumber: 2 }, {
    repository,
    sender: { async sendText() { return { status: 'retryable', reason: 'rate_limited' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10),
  });
  assert.equal(repository.outbox.get(exhausted.replyMessageId).status, 'failed');
  assert.equal(repository.handoffs.get(`delivery:${exhausted.replyMessageId}`).reason, 'delivery_failure');
});

test('outbound reads its send-window clock after acquiring the customer lock', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const pending = await conversations.handleText(inbound({ providerEventId: 'outbound-lock-clock' }));
  const originalLock = repository.withCustomerSendLock.bind(repository);
  let enteredLock;
  let releaseLock;
  const lockEntered = new Promise((resolve) => { enteredLock = resolve; });
  const lockGate = new Promise((resolve) => { releaseLock = resolve; });
  repository.withCustomerSendLock = (messageId, action) => originalLock(messageId, async () => {
    enteredLock();
    await lockGate;
    return action();
  });

  let currentTime = at(10);
  let clockReads = 0;
  let sends = 0;
  const job = handleConversationOutboundJob({ messageId: pending.replyMessageId }, {
    repository,
    sender: { async sendText() { sends += 1; return { status: 'accepted', providerMessageId: 'must-not-send' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => { clockReads += 1; return currentTime; },
  });
  await lockEntered;
  assert.equal(clockReads, 0);
  currentTime = at(11, '2026-10-28');
  releaseLock();
  await job;
  assert.equal(clockReads, 1);
  assert.equal(sends, 0);
  assert.equal(repository.outbox.get(pending.replyMessageId).blockReason, 'outside_service_window');
  assert.equal(repository.handoffs.get(`delivery:${pending.replyMessageId}`).reason, 'outside_service_window');
});

test('an opt-out waits for an outbound send already holding the customer lock', async () => {
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const pending = await conversations.handleText(inbound({
    providerEventId: 'serialized-send-before-opt-out',
    externalCustomerId: '5511999994444',
  }));
  let beginSend;
  let releaseSend;
  const sendStarted = new Promise((resolve) => { beginSend = resolve; });
  const sendGate = new Promise((resolve) => { releaseSend = resolve; });
  let watchOptOutLock = false;
  let notifyOptOutLock;
  const optOutLockRequested = new Promise((resolve) => { notifyOptOutLock = resolve; });
  const customerKey = `${CHANNEL}\u00005511999994444`;
  const originalWithCustomerLock = repository.withCustomerLock.bind(repository);
  repository.withCustomerLock = (key, action) => {
    if (watchOptOutLock && key === customerKey) notifyOptOutLock();
    return originalWithCustomerLock(key, action);
  };

  const outbound = handleConversationOutboundJob({ messageId: pending.replyMessageId }, {
    repository,
    sender: { async sendText() { beginSend(); await sendGate; return { status: 'accepted', providerMessageId: 'provider-before-opt-out' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10),
  });
  await sendStarted;
  watchOptOutLock = true;
  const optOut = conversations.handleText(inbound({
    providerEventId: 'serialized-opt-out',
    externalCustomerId: '5511999994444',
    text: 'pare',
    receivedAt: at(11),
    occurredAt: at(11),
  }));
  await optOutLockRequested;
  assert.equal(repository.customers.get(customerKey).optedOut, false);

  releaseSend();
  await outbound;
  await optOut;
  assert.equal(repository.customers.get(customerKey).optedOut, true);
  assert.equal(repository.outbox.get(pending.replyMessageId).status, 'complete');
});

test('WhatsApp ingress requires live traffic, account approval, and reconciled cost before route setup', () => {
  const approved = {
    WHATSAPP_LIVE_TRAFFIC_ENABLED: 'true',
    WHATSAPP_ACCOUNT_APPROVED: 'true',
    WHATSAPP_COST_RECONCILED: 'true',
  };
  assert.equal(isWhatsAppIngressApproved({}), false);
  for (const key of Object.keys(approved)) {
    assert.equal(isWhatsAppIngressApproved({ ...approved, [key]: 'false' }), false);
  }
  assert.equal(isWhatsAppIngressApproved(approved), true);
  const { isCustomerDataCollectionAllowed } = require('../dist/modules/data-policy/use-cases.js');
  assert.equal(isCustomerDataCollectionAllowed(), false);

  const route = readFileSync(new URL('../src/app/api/webhooks/whatsapp/route.ts', import.meta.url), 'utf8');
  const gate = route.indexOf('if (!isWhatsAppIngressApproved() || !isCustomerDataCollectionAllowed())');
  assert.ok(gate >= 0);
  assert.ok(gate < route.indexOf('new Budget('));
});

test('Meta signature validation, safe normalization, and webhook handling reject unsigned requests', async () => {
  const secret = 'synthetic-webhook-secret-123456789';
  const repository = new MemoryConversationRepository();
  const conversations = new Conversations(repository);
  const payload = {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'test-number' },
      messages: [{ id: 'wamid.synthetic-1', from: CUSTOMER, timestamp: '1793095200', type: 'text', text: { body: 'oi' } }],
    } }] }],
  };
  const raw = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  assert.equal(verifyWhatsAppSignature(raw, signature, secret), true);
  assert.equal(verifyWhatsAppSignature(raw, 'sha256=bad', secret), false);
  assert.deepEqual(normalizeWhatsAppWebhook(payload).map(({ kind }) => kind), ['text']);
  assert.equal(isPublicStoryPath('/api/webhooks/whatsapp', { PLATFORM_ENVIRONMENT: 'production' }), true);
  assert.equal(isPublicStoryPath('/api/webhooks/whatsapp/extra', { PLATFORM_ENVIRONMENT: 'production' }), false);

  const invalid = await handleWhatsAppWebhookRequest(new Request('http://local/api/webhooks/whatsapp', {
    method: 'POST', body: raw, headers: { 'x-hub-signature-256': 'sha256=bad' },
  }), conversations, { WHATSAPP_APP_SECRET: secret }, () => at(10));
  assert.equal(invalid.status, 401);
  assert.equal(repository.messages.size, 0);

  const request = () => new Request('http://local/api/webhooks/whatsapp', {
    method: 'POST', body: raw, headers: { 'x-hub-signature-256': signature },
  });
  const accepted = await handleWhatsAppWebhookRequest(request(), conversations,
    { WHATSAPP_APP_SECRET: secret }, () => at(10));
  const replay = await handleWhatsAppWebhookRequest(request(), conversations,
    { WHATSAPP_APP_SECRET: secret }, () => at(10));
  assert.equal(accepted.status, 200);
  assert.equal(replay.status, 200);
  assert.deepEqual(await accepted.json(), { status: 'received' });
  assert.equal(repository.messages.size, 2);
  assert.equal(repository.outbox.size, 1);

  const futureTimestampPayload = structuredClone(payload);
  futureTimestampPayload.entry[0].changes[0].value.messages[0] = {
    id: 'wamid.future-clock', from: '5511999996666', timestamp: '1893456000',
    type: 'text', text: { body: 'oi' },
  };
  const futureRaw = Buffer.from(JSON.stringify(futureTimestampPayload));
  const futureSignature = `sha256=${createHmac('sha256', secret).update(futureRaw).digest('hex')}`;
  const futureAccepted = await handleWhatsAppWebhookRequest(new Request('http://local/api/webhooks/whatsapp', {
    method: 'POST', body: futureRaw, headers: { 'x-hub-signature-256': futureSignature },
  }), conversations, { WHATSAPP_APP_SECRET: secret }, () => at(10));
  assert.equal(futureAccepted.status, 200);
  const futureInbound = [...repository.messages.values()].find((message) => message.providerMessageId === 'wamid.future-clock');
  assert.equal(futureInbound.occurredAt, at(10));
  let futureSends = 0;
  await handleConversationOutboundJob({ messageId: [...repository.messages.values()].find((message) => (
    message.direction === 'outbound' && message.replyToMessageId === futureInbound.messageId
  )).messageId }, {
    repository,
    sender: { async sendText() { futureSends += 1; return { status: 'accepted', providerMessageId: 'should-not-send' }; } },
    environment: { WHATSAPP_SEND_RULES_VERIFIED: 'true' },
    now: () => at(10, '2026-10-28'),
  });
  const futureReply = [...repository.outbox.entries()].find(([messageId]) => (
    repository.messages.get(messageId)?.replyToMessageId === futureInbound.messageId
  ));
  assert.equal(futureReply[1].blockReason, 'outside_service_window');
  assert.equal(futureSends, 0);

  const challenge = handleWhatsAppVerificationRequest(new Request(
    'http://local/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=synthetic-verify&hub.challenge=123',
  ), { WHATSAPP_VERIFY_TOKEN: 'synthetic-verify' });
  assert.equal(challenge.status, 200);
  assert.equal(await challenge.text(), '123');
  const refusedChallenge = handleWhatsAppVerificationRequest(new Request(
    'http://local/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123',
  ), { WHATSAPP_VERIFY_TOKEN: 'synthetic-verify' });
  assert.equal(refusedChallenge.status, 404);

  const photoPayload = {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'test-number' },
      messages: [{ id: 'wamid.synthetic-photo', from: CUSTOMER, timestamp: '1793095200', type: 'image', image: { id: 'media-reference' } }],
    } }] }],
  };
  const photoEvent = normalizeWhatsAppWebhook(photoPayload);
  assert.deepEqual(photoEvent.map(({ kind }) => kind), ['unsupported']);
  const photoRaw = Buffer.from(JSON.stringify(photoPayload));
  const photoSignature = `sha256=${createHmac('sha256', secret).update(photoRaw).digest('hex')}`;
  const beforePhoto = repository.messages.size;
  const photoAck = await handleWhatsAppWebhookRequest(new Request('http://local/api/webhooks/whatsapp', {
    method: 'POST', body: photoRaw, headers: { 'x-hub-signature-256': photoSignature },
  }), conversations, { WHATSAPP_APP_SECRET: secret }, () => at(10));
  assert.equal(photoAck.status, 200);
  assert.equal(repository.messages.size, beforePhoto);
  assert.equal(JSON.stringify([...repository.messages.values()]).includes('media-reference'), false);
});

test('signed audio webhooks prompt for consent before fetching Meta media and transcribe only afterward', async () => {
  const secret = 'synthetic-audio-webhook-secret-123456';
  const repository = new MemoryConversationRepository();
  let downloads = 0;
  let transcriptions = 0;
  const conversations = new Conversations(repository, {
    async transcribeOgg(audio) {
      transcriptions += 1;
      assert.equal(Buffer.from(audio.subarray(0, 4)).toString('ascii'), 'OggS');
      return { status: 'transcribed', text: 'quanto custa?' };
    },
  }, undefined, {
    async downloadOgg() {
      downloads += 1;
      return { status: 'downloaded', audio: Buffer.from('OggSsynthetic audio') };
    },
  });
  const timestamp = String(Math.floor(Date.parse(at(10)) / 1_000));
  const signedPost = (payload) => {
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    return handleWhatsAppWebhookRequest(new Request('http://local/api/webhooks/whatsapp', {
      method: 'POST', body: raw, headers: { 'x-hub-signature-256': signature },
    }), conversations, { WHATSAPP_APP_SECRET: secret }, () => at(10));
  };
  const audioPayload = (eventId, mediaId) => ({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'test-number' },
      messages: [{
        id: eventId, from: CUSTOMER, timestamp, type: 'audio',
        audio: { id: mediaId, mime_type: 'audio/ogg; codecs=opus' },
      }],
    } }] }],
  });

  const consentPrompt = await signedPost(audioPayload('wamid.audio-before-consent', '1234567890123'));
  assert.equal(consentPrompt.status, 200);
  assert.equal(downloads, 0);
  assert.equal(transcriptions, 0);
  assert.match([...repository.messages.values()].find((message) => message.direction === 'outbound').text, /Você autoriza/);

  const consentPayload = {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'test-number' },
      messages: [{ id: 'wamid.audio-consent', from: CUSTOMER, timestamp, type: 'text', text: { body: 'sim' } }],
    } }] }],
  };
  assert.equal((await signedPost(consentPayload)).status, 200);
  assert.equal(downloads, 0);
  assert.equal(transcriptions, 0);

  const acceptedAudio = await signedPost(audioPayload('wamid.audio-after-consent', '1234567890124'));
  assert.equal(acceptedAudio.status, 200);
  assert.equal(downloads, 1);
  assert.equal(transcriptions, 1);
  const transcript = [...repository.messages.values()].find((message) => message.source === 'voice_transcription');
  assert.equal(transcript.text, 'quanto custa?');
  assert.equal(transcript.kind, 'text');
  assert.equal(JSON.stringify([...repository.messages.values()]).includes('1234567890124'), false);
  assert.equal(JSON.stringify([...repository.messages.values()]).includes('synthetic audio'), false);
});

test('expired conversation audio consent cannot authorize a media fetch in a resumed conversation', async () => {
  const repository = new MemoryConversationRepository();
  let downloads = 0;
  const conversations = new Conversations(repository, {
    async transcribeOgg() { return { status: 'transcribed', text: 'transcrição sintética' }; },
  }, undefined, {
    async downloadOgg() {
      downloads += 1;
      return { status: 'downloaded', audio: Buffer.from('OggSsynthetic audio') };
    },
  });
  const first = await conversations.handleVoiceFromProvider({
    ...inbound({ providerEventId: 'audio-expiry-prompt', receivedAt: at(10), text: null }),
    mediaId: '1234567890123456', mimeType: 'audio/ogg',
  });
  await conversations.handleText(inbound({
    providerEventId: 'audio-expiry-consent', receivedAt: at(11), text: 'sim',
  }));
  const resumed = await conversations.handleVoiceFromProvider({
    ...inbound({
      providerEventId: 'audio-expiry-resume', occurredAt: at(12, '2026-10-28'),
      receivedAt: at(12, '2026-10-28'), text: null,
    }),
    mediaId: '1234567890123457', mimeType: 'audio/ogg',
  });
  assert.equal(downloads, 0);
  assert.notEqual(resumed.conversationId, first.conversationId);
  assert.match(resumed.replyText, /Você autoriza/);
});

test('provider adapters require external approvals and a successful budget reservation before transport', async () => {
  let providerCalls = 0;
  const message = {
    messageId: '00000000-0000-4000-8000-000000000001', customerId: 'customer',
    conversationId: 'conversation', channelId: 'whatsapp:1234567890', externalCustomerId: CUSTOMER, text: 'safe reply',
    lastInboundAt: at(10), optedOut: false, revocationPending: false,
    deliveryState: 'prepared', providerMessageId: null,
  };
  const transport = async (_url, options) => {
    providerCalls += 1;
    assert.match(options.headers.Authorization, /^Bearer /);
    assert.equal(options.redirect, 'manual');
    return { ok: true, async json() { return { messages: [{ id: 'wamid.accepted' }] }; } };
  };
  const env = {
    WHATSAPP_LIVE_TRAFFIC_ENABLED: 'true', WHATSAPP_ACCOUNT_APPROVED: 'true',
    WHATSAPP_COST_RECONCILED: 'true', WHATSAPP_SEND_RULES_VERIFIED: 'true',
    WHATSAPP_ACCESS_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_GRAPH_API_VERSION: 'v99.0', WHATSAPP_MESSAGE_COST_BRL_MINOR: '10',
  };
  const denied = new WhatsAppCloudApiAdapter({ async reserveAction() {
    return { status: 'blocked', reason: 'balance_unknown' };
  } }, env, transport, () => true);
  assert.deepEqual(await denied.sendText(message), { status: 'blocked', reason: 'budget_balance_unknown' });
  assert.equal(providerCalls, 0);
  const allowed = new WhatsAppCloudApiAdapter({ async reserveAction() {
    return { status: 'reserved', reservationId: 'reservation' };
  } }, env, transport, () => true);
  assert.deepEqual(await allowed.sendText(message), { status: 'accepted', providerMessageId: 'wamid.accepted' });
  assert.equal(providerCalls, 1);
  const throttled = new WhatsAppCloudApiAdapter({ async reserveAction(request) {
    assert.equal(request.attemptLimit, 3);
    return { status: 'reserved', reservationId: 'rate-limit-reservation' };
  } }, env, async () => ({ ok: false, status: 429 }), () => true);
  assert.deepEqual(await throttled.sendText(message), { status: 'retryable', reason: 'rate_limited' });
  const off = new WhatsAppCloudApiAdapter({ async reserveAction() {
    throw new Error('must not reserve');
  } }, { ...env, WHATSAPP_LIVE_TRAFFIC_ENABLED: 'false' }, transport, () => true);
  assert.deepEqual(await off.sendText(message), { status: 'blocked', reason: 'provider_traffic_disabled' });
  assert.equal(providerCalls, 1);

  let geminiCalls = 0;
  const geminiTransport = async () => { geminiCalls += 1; return { transcript: 'synthetic transcript' }; };
  const geminiEnv = {
    GEMINI_LIVE_TRAFFIC_ENABLED: 'true', GEMINI_ACCOUNT_APPROVED: 'true',
    GEMINI_COST_RECONCILED: 'true', GEMINI_CONVERSATION_MODEL: 'gemini-3.8-flash',
    GOOGLE_CLOUD_PROJECT: 'synthetic-project',
    GEMINI_TEXT_COST_BRL_MINOR: '3',
    GEMINI_AUDIO_COST_BRL_MINOR: '2',
  };
  const noBudget = new GeminiOggTranscriber({ async reserveAction() {
    return { status: 'blocked', reason: 'unknown_cost' };
  } }, geminiEnv, geminiTransport, undefined, () => true);
  assert.deepEqual(await noBudget.transcribeOgg(Buffer.from('OggS'), { actionId: 'voice-action' }), { status: 'blocked' });
  assert.equal(geminiCalls, 0);
  const withBudget = new GeminiOggTranscriber({ async reserveAction() {
    return { status: 'reserved', reservationId: 'voice-reservation' };
  } }, geminiEnv, geminiTransport, undefined, () => true);
  assert.deepEqual(await withBudget.transcribeOgg(Buffer.from('OggS'), { actionId: 'voice-action' }), {
    status: 'transcribed', text: 'synthetic transcript',
  });
  assert.equal(geminiCalls, 1);

  let vertexAudioCalls = 0;
  let vertexAudioRequest;
  const vertexTranscriber = new GeminiOggTranscriber({ async reserveAction() {
    return { status: 'reserved', reservationId: 'vertex-audio-reservation' };
  } }, geminiEnv, undefined, { async generateContent(request) {
    vertexAudioCalls += 1;
    vertexAudioRequest = request;
    return { candidates: [{ content: { parts: [{ text: 'transcrição via Vertex' }] } }] };
  } }, () => true);
  assert.deepEqual(await vertexTranscriber.transcribeOgg(Buffer.from('OggSsynthetic audio'), {
    actionId: 'voice-vertex-action',
  }), { status: 'transcribed', text: 'transcrição via Vertex' });
  assert.equal(vertexAudioCalls, 1);
  assert.equal(vertexAudioRequest.location, 'us');
  assert.equal(vertexAudioRequest.model, 'gemini-3.8-flash');
  assert.equal(vertexAudioRequest.contents[0].parts[1].inlineData.mimeType, 'audio/ogg');
  assert.equal(vertexAudioRequest.contents[0].parts[1].inlineData.data, Buffer.from('OggSsynthetic audio').toString('base64'));
});

test('the canonical pending Data Policy blocks all provider requests despite environment approvals', async () => {
  let providerCalls = 0;
  const noReservation = { async reserveAction() { throw new Error('policy must block before budget reservation'); } };
  const geminiEnvironment = {
    GEMINI_LIVE_TRAFFIC_ENABLED: 'true', GEMINI_ACCOUNT_APPROVED: 'true',
    GEMINI_COST_RECONCILED: 'true', GEMINI_CONVERSATION_MODEL: 'gemini-3.8-flash',
    GOOGLE_CLOUD_PROJECT: 'synthetic-project', GEMINI_TEXT_COST_BRL_MINOR: '3', GEMINI_AUDIO_COST_BRL_MINOR: '2',
  };
  const whatsappEnvironment = {
    WHATSAPP_LIVE_TRAFFIC_ENABLED: 'true', WHATSAPP_ACCOUNT_APPROVED: 'true',
    WHATSAPP_COST_RECONCILED: 'true', WHATSAPP_SEND_RULES_VERIFIED: 'true',
    WHATSAPP_ACCESS_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_GRAPH_API_VERSION: 'v99.0', WHATSAPP_MESSAGE_COST_BRL_MINOR: '10',
    WHATSAPP_MEDIA_FETCH_COST_BRL_MINOR: '1',
  };
  const message = {
    messageId: '00000000-0000-4000-8000-000000000001', customerId: 'customer',
    conversationId: 'conversation', channelId: 'whatsapp:1234567890', externalCustomerId: CUSTOMER,
    text: 'safe reply', lastInboundAt: at(10), optedOut: false, revocationPending: false,
    deliveryState: 'prepared', providerMessageId: null,
  };
  const sender = new WhatsAppCloudApiAdapter(noReservation, whatsappEnvironment, async () => {
    providerCalls += 1;
    return { ok: true, async json() { return { messages: [{ id: 'should-not-send' }] }; } };
  });
  assert.deepEqual(await sender.sendText(message), { status: 'blocked', reason: 'data_policy_blocked' });

  const classifier = new GeminiFaqClassifier(noReservation, geminiEnvironment, { async generateContent() {
    providerCalls += 1;
    return {};
  } });
  assert.deepEqual(await classifier.classifyQuestion('pergunta sintética', { actionId: 'faq-policy-blocked' }), { status: 'blocked' });

  const transcriber = new GeminiOggTranscriber(noReservation, geminiEnvironment, async () => {
    providerCalls += 1;
    return { transcript: 'should not transcribe' };
  });
  assert.deepEqual(await transcriber.transcribeOgg(Buffer.from('OggS'), { actionId: 'voice-policy-blocked' }), { status: 'blocked' });

  const downloader = new WhatsAppCloudMediaDownloader(noReservation, whatsappEnvironment, async () => {
    providerCalls += 1;
    return new Response();
  });
  assert.deepEqual(await downloader.downloadOgg({
    mediaId: '1234567890123456', channelId: 'whatsapp:1234567890', actionId: 'media-policy-blocked',
  }), { status: 'blocked' });
  assert.equal(providerCalls, 0);
});

test('Gemini classifies only to approved FAQ ids and never supplies customer-facing text', async () => {
  const repository = new MemoryConversationRepository();
  const requests = [];
  let modelCalls = 0;
  const environment = {
    GEMINI_LIVE_TRAFFIC_ENABLED: 'true', GEMINI_ACCOUNT_APPROVED: 'true',
    GEMINI_COST_RECONCILED: 'true', GEMINI_CONVERSATION_MODEL: 'gemini-3.8-flash',
    GOOGLE_CLOUD_PROJECT: 'synthetic-project', GEMINI_TEXT_COST_BRL_MINOR: '3',
  };
  const classifier = new GeminiFaqClassifier({ async reserveAction(request) {
    assert.equal(request.category, 'ai');
    assert.equal(request.cost.amountMinor, 3);
    return { status: 'reserved', reservationId: 'faq-reservation' };
  } }, environment, { async generateContent(request) {
    modelCalls += 1;
    requests.push(request);
    return { candidates: [{ content: { parts: [{ text: JSON.stringify({ answerId: 'quality_expectations' }) }] } }] };
  } }, () => true);
  const conversations = new Conversations(repository, undefined, classifier);
  const answer = await conversations.handleText(inbound({
    providerEventId: 'faq-gemini-approved', text: 'o que posso esperar do resultado final?',
  }));
  assert.equal(answer.replyText, 'A semelhança pode variar e não é garantida. Posso encaminhar outras dúvidas aos sócios.');
  assert.equal(modelCalls, 1);
  assert.equal(requests[0].projectId, 'synthetic-project');
  assert.equal(requests[0].location, 'us');
  assert.equal(requests[0].model, 'gemini-3.8-flash');
  assert.equal(requests[0].contents[0].parts[0].text, 'o que posso esperar do resultado final?');
  assert.deepEqual(requests[0].generationConfig.responseSchema.properties.answerId.enum, [
    'quality_expectations', 'photo_processing', 'preview_policy', 'price_unapproved', 'timeline_unapproved', 'unknown',
  ]);
  assert.equal(repository.messages.get(answer.replyMessageId).text.includes('answerId'), false);

  const invalidClassifier = new GeminiFaqClassifier({ async reserveAction() {
    return { status: 'reserved', reservationId: 'faq-invalid-reservation' };
  } }, environment, { async generateContent() {
    return { candidates: [{ content: { parts: [{ text: '{"answerId":"invented_answer"}' }] } }] };
  } }, () => true);
  const safeFallback = await new Conversations(new MemoryConversationRepository(), undefined, invalidClassifier)
    .handleText(inbound({ providerEventId: 'faq-gemini-invalid', text: 'vocês atendem em qual cidade?' }));
  assert.match(safeFallback.replyText, /resposta aprovada/i);
  assert.ok(safeFallback.handoffId);

  let blockedTransportCalls = 0;
  const blocked = new GeminiFaqClassifier({ async reserveAction() {
    return { status: 'blocked', reason: 'balance_unknown' };
  } }, environment, { async generateContent() { blockedTransportCalls += 1; return {}; } }, () => true);
  assert.equal((await blocked.classifyQuestion('pergunta sintética', { actionId: 'faq-blocked' })).status, 'blocked');
  assert.equal(blockedTransportCalls, 0);
});

test('Meta media downloader requires its gates and bounds metadata, host, MIME, and audio bytes', async () => {
  const environment = {
    WHATSAPP_LIVE_TRAFFIC_ENABLED: 'true', WHATSAPP_ACCOUNT_APPROVED: 'true',
    WHATSAPP_COST_RECONCILED: 'true', WHATSAPP_ACCESS_TOKEN: 'synthetic-token',
    WHATSAPP_PHONE_NUMBER_ID: 'test-number', WHATSAPP_GRAPH_API_VERSION: 'v99.0',
    WHATSAPP_MEDIA_FETCH_COST_BRL_MINOR: '1',
  };
  const mediaId = '1234567890123456';
  const audio = Buffer.from('OggSsynthetic audio');
  const metadata = {
    id: mediaId, messaging_product: 'whatsapp', mime_type: 'audio/ogg',
    file_size: audio.length,
    url: `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${mediaId}&ext=1&hash=synthetic`,
  };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://graph.facebook.com/')) {
      return new Response(JSON.stringify(metadata), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(audio, { headers: { 'content-type': 'audio/ogg', 'content-length': String(audio.length) } });
  };
  const downloader = new WhatsAppCloudMediaDownloader({ async reserveAction(request) {
    assert.equal(request.category, 'meta_pix_fx_retries');
    assert.equal(request.cost.amountMinor, 1);
    return { status: 'reserved', reservationId: 'media-reservation' };
  } }, environment, fetcher, () => true);
  const downloaded = await downloader.downloadOgg({
    mediaId, channelId: CHANNEL, actionId: 'meta-audio:synthetic',
  });
  assert.equal(downloaded.status, 'downloaded');
  assert.deepEqual(Buffer.from(downloaded.audio), audio);
  assert.equal(calls.length, 2);
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[1].options.redirect, 'manual');

  let redirectFollowupCalls = 0;
  const redirectedMetadata = new WhatsAppCloudMediaDownloader({ async reserveAction() {
    return { status: 'reserved', reservationId: 'media-redirect-reservation' };
  } }, environment, async (_url, options) => {
    assert.equal(options.redirect, 'manual');
    redirectFollowupCalls += 1;
    return new Response(null, { status: 302, headers: { location: 'https://attacker.invalid/media' } });
  }, () => true);
  assert.deepEqual(await redirectedMetadata.downloadOgg({
    mediaId, channelId: CHANNEL, actionId: 'meta-audio:redirect',
  }), { status: 'failed' });
  assert.equal(redirectFollowupCalls, 1);

  let untrustedFetchCalls = 0;
  const untrusted = new WhatsAppCloudMediaDownloader({ async reserveAction() {
    return { status: 'reserved', reservationId: 'untrusted-media-reservation' };
  } }, environment, async () => {
    untrustedFetchCalls += 1;
    return new Response(JSON.stringify({ ...metadata, url: 'https://attacker.invalid/audio.ogg' }), {
      headers: { 'content-type': 'application/json' },
    });
  }, () => true);
  assert.deepEqual(await untrusted.downloadOgg({ mediaId, channelId: CHANNEL, actionId: 'meta-audio:untrusted' }), { status: 'blocked' });
  assert.equal(untrustedFetchCalls, 1);

  let defaultOffCalls = 0;
  const defaultOff = new WhatsAppCloudMediaDownloader({ async reserveAction() {
    throw new Error('disabled media must not reserve');
  } }, {}, async () => { defaultOffCalls += 1; return new Response(); });
  assert.deepEqual(await defaultOff.downloadOgg({ mediaId, channelId: CHANNEL, actionId: 'meta-audio:off' }), { status: 'blocked' });
  assert.equal(defaultOffCalls, 0);
});

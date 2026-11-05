import { decideDataUse, readApprovedDataPolicy } from '../data-policy/use-cases';
import type { DataPolicyV2 } from '../../contracts/data-policy/v2';
import { createHash } from 'node:crypto';
import type {
  ConversationContext,
  ConversationDecision,
  ConversationRepository,
  InboundMessage,
  InboundProcessResult,
} from './repository';

const MAX_TEXT_LENGTH = 4_000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const AFFIRMATIVE = /^(sim|s|confirmo|concordo|aceito|autorizo)\b/i;
const NEGATIVE = /^(nao|n|recuso|nao autorizo|nao concordo|prefiro nao)\b/i;
const CONSENT_AFFIRMATIVE = /^(sim|confirmo|concordo|aceito|autorizo)\b/i;

export type PhotoProcessingAuthorization =
  | { allowed: true; policyVersion: string }
  | { allowed: false; reason: string };

export const APPROVED_FAQ_ANSWER_IDS = [
  'quality_expectations',
  'photo_processing',
  'preview_policy',
  'price_unapproved',
  'timeline_unapproved',
  'unknown',
] as const;
export type ApprovedFaqAnswerId = typeof APPROVED_FAQ_ANSWER_IDS[number];

export type FaqClassificationResult =
  | { status: 'classified'; answerId: ApprovedFaqAnswerId }
  | { status: 'blocked' | 'failed' };

export interface ConversationFaqClassifier {
  classifyQuestion(text: string, options: { actionId: string }): Promise<FaqClassificationResult>;
}

export function authorizePhotoProcessing(context: ConversationContext): PhotoProcessingAuthorization {
  if (context.adultConfirmed !== true || context.ownsPhotoConfirmed !== true) {
    return { allowed: false, reason: 'eligibility_not_confirmed' };
  }
  if (context.revocationPending || context.consentStatus === 'revoked') {
    return { allowed: false, reason: 'consent_revoked' };
  }
  if (context.consentStatus !== 'granted' || !context.consentPolicyVersion) {
    return { allowed: false, reason: 'consent_missing' };
  }
  const policy = readApprovedDataPolicy();
  if (policy.status !== 'available' || policy.policy.version !== context.consentPolicyVersion) {
    return { allowed: false, reason: policy.status === 'blocked' ? policy.reason : 'policy_version_mismatch' };
  }
  const decision = decideDataUse(policy.policy, 'process');
  return decision.allowed
    ? { allowed: true, policyVersion: decision.version }
    : { allowed: false, reason: decision.reason };
}

export interface VoiceTranscriber {
  transcribeOgg(
    audio: Uint8Array,
    options: { actionId: string },
  ): Promise<{ status: 'transcribed'; text: string } | { status: 'blocked' | 'failed' }>;
}

export type VoiceMediaDownloadResult =
  | { status: 'downloaded'; audio: Uint8Array }
  | { status: 'blocked' | 'failed' };

export interface VoiceMediaDownloader {
  downloadOgg(input: { mediaId: string; channelId: string; actionId: string }): Promise<VoiceMediaDownloadResult>;
}

type VoiceTranscriptionRunResult =
  | { status: 'transcribed'; text: string }
  | { status: 'blocked' | 'failed' | 'invalid' };

export class Conversations {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly transcriber?: VoiceTranscriber,
    private readonly faqClassifier?: ConversationFaqClassifier,
    private readonly mediaDownloader?: VoiceMediaDownloader,
  ) {}

  handleText(input: Omit<InboundMessage, 'kind' | 'text' | 'source'> & { text: string }): Promise<InboundProcessResult> {
    const text = input.text.trim();
    if (!text || text.length > MAX_TEXT_LENGTH) throw new Error('invalid_inbound_text');
    return this.handleTextWithFaq(input, text);
  }

  private async handleTextWithFaq(
    input: Omit<InboundMessage, 'kind' | 'text' | 'source'> & { text: string },
    text: string,
  ): Promise<InboundProcessResult> {
    const prior = await this.repository.findInboundResult(input.providerEventId);
    if (prior) return prior;
    let answerId: ApprovedFaqAnswerId | null = null;
    if (this.faqClassifier && shouldClassifyWithGemini(text)) {
      try {
        const result = await this.faqClassifier.classifyQuestion(text, {
          actionId: `faq:${createHash('sha256').update(input.providerEventId).digest('hex')}`,
        });
        if (result.status === 'classified') answerId = result.answerId;
      } catch {
        answerId = null;
      }
    }
    return this.repository.processInbound({
      ...input,
      text,
      kind: 'text',
      source: 'whatsapp',
    }, (context) => this.decideText(context, text, input.receivedAt, answerId));
  }

  handleVoiceUnavailable(input: Omit<InboundMessage, 'kind' | 'text' | 'source'>): Promise<InboundProcessResult> {
    return this.repository.processInbound({
      ...input,
      kind: 'audio',
      text: null,
      source: 'whatsapp',
    }, (context) => {
      if (context.optedOut) return { replyText: null };
      if (context.revocationPending || context.consentStatus === 'revoked') {
        return this.decideAudioConsent(context);
      }
      if (context.audioConsent === true) {
        return { replyText: 'A transcrição de áudio não está disponível agora. Se preferir, envie sua mensagem por texto.' };
      }
      return this.decideAudioConsent(context);
    });
  }

  async handleVoice(
    input: Omit<InboundMessage, 'kind' | 'text' | 'source'> & { audio: Uint8Array },
  ): Promise<InboundProcessResult> {
    const { audio, ...message } = input;
    return this.processVoice(message, async () => ({ status: 'downloaded', audio }));
  }

  handleVoiceFromProvider(
    input: Omit<InboundMessage, 'kind' | 'text' | 'source'> & { mediaId: string; mimeType: string },
  ): Promise<InboundProcessResult> {
    const { mediaId, mimeType, ...message } = input;
    const normalizedMime = mimeType.split(';', 1)[0].trim().toLowerCase();
    if (!this.mediaDownloader || !/^[0-9]{1,40}$/.test(mediaId) || normalizedMime !== 'audio/ogg') {
      return this.handleVoiceUnavailable(message);
    }
    return this.processVoice(message, () => this.mediaDownloader!.downloadOgg({
      mediaId,
      channelId: message.channelId,
      actionId: `meta-audio:${createHash('sha256').update(message.providerEventId).digest('hex')}`,
    }));
  }

  private async processVoice(
    input: Omit<InboundMessage, 'kind' | 'text' | 'source'>,
    downloadAudio: () => Promise<VoiceMediaDownloadResult>,
  ): Promise<InboundProcessResult> {
    const prior = await this.repository.findInboundResult(input.providerEventId);
    if (prior) return prior;

    const authorizedRun = await this.repository.withVoiceAuthorization<VoiceTranscriptionRunResult>(
      input.channelId,
      input.externalCustomerId,
      async () => {
        let media: VoiceMediaDownloadResult;
        try {
          media = await downloadAudio();
        } catch {
          return { status: 'failed' as const };
        }
        if (media.status !== 'downloaded') return { status: media.status };
        if (media.audio.byteLength < 4 || media.audio.byteLength > MAX_AUDIO_BYTES
          || Buffer.from(media.audio.subarray(0, 4)).toString('ascii') !== 'OggS') return { status: 'invalid' as const };
        if (!this.transcriber) return { status: 'blocked' as const };
        let transcription: Awaited<ReturnType<VoiceTranscriber['transcribeOgg']>>;
        try {
          transcription = await this.transcriber.transcribeOgg(media.audio, {
            actionId: `voice:${createHash('sha256').update(input.providerEventId).digest('hex')}`,
          });
        } catch {
          transcription = { status: 'failed' };
        }
        if (transcription.status !== 'transcribed') return { status: transcription.status };
        if (!transcription.text.trim()) {
          return { status: 'failed' as const };
        }
        const text = transcription.text.trim().slice(0, MAX_TEXT_LENGTH);
        return { status: 'transcribed' as const, text };
      },
        input.receivedAt,
    );
    if (!authorizedRun.authorized) {
      return this.repository.processInbound({
        ...input,
        kind: 'audio', text: null, source: 'whatsapp',
      }, (context) => this.decideAudioConsent(context));
    }
    const { authorization, result: transcription } = authorizedRun;
    const expectedAudioConsentVersion = authorization.consentVersion;
    if (expectedAudioConsentVersion === null) {
      return this.repository.processInbound({
        ...input,
        kind: 'audio', text: null, source: 'whatsapp',
      }, (context) => this.decideAudioConsent(context));
    }

    if (transcription.status !== 'transcribed') {
      return this.repository.processInbound({
        ...input,
        kind: 'audio', text: null, source: 'whatsapp',
        expectedAudioConsentVersion,
      }, (context) => {
        if (context.optedOut) return { replyText: null };
        if (context.revocationPending || context.consentStatus === 'revoked'
          || context.audioConsent !== true || context.audioConsentVersion !== expectedAudioConsentVersion) {
          return this.decideAudioConsent(context);
        }
        if (transcription.status === 'invalid') {
          return { replyText: 'Não consegui entender esse áudio. Se preferir, escreva sua mensagem por texto.' };
        }
        return { replyText: 'Não consegui transcrever esse áudio. Se preferir, envie sua mensagem por texto.' };
      });
    }

    let answerId: ApprovedFaqAnswerId | null = null;
    if (this.faqClassifier && shouldClassifyWithGemini(transcription.text)) {
      const classificationRun = await this.repository.withVoiceAuthorization<ApprovedFaqAnswerId | null>(
        input.channelId,
        input.externalCustomerId,
        async (currentAuthorization) => {
          if (currentAuthorization.conversationId !== authorization.conversationId
            || currentAuthorization.consentVersion !== expectedAudioConsentVersion) return null;
          try {
            const classification = await this.faqClassifier!.classifyQuestion(transcription.text, {
              actionId: `faq:${createHash('sha256').update(input.providerEventId).digest('hex')}`,
            });
            return classification.status === 'classified' ? classification.answerId : null;
          } catch {
            return null;
          }
        },
        input.receivedAt,
      );
      if (classificationRun.authorized) answerId = classificationRun.result;
    }

    return this.repository.processInbound({
      ...input,
      kind: 'text',
      text: transcription.text,
      source: 'voice_transcription',
      expectedAudioConsentVersion,
    }, (context) => {
      if (context.optedOut) return { replyText: null };
      if (context.revocationPending || context.consentStatus === 'revoked'
        || !context.audioConsent || context.audioConsentVersion !== expectedAudioConsentVersion) {
        return { replyText: 'O uso do áudio foi interrompido. Se preferir, envie sua mensagem por texto.' };
      }
      return this.decideText(context, transcription.text, input.receivedAt, answerId);
    });
  }

  recordDeliveryReceipt(receipt: Parameters<ConversationRepository['recordDeliveryReceipt']>[0]) {
    return this.repository.recordDeliveryReceipt(receipt);
  }

  purgeExpired(now = new Date().toISOString()) { return this.repository.purgeExpired(now); }

  private decideAudioConsent(context: ConversationContext): ConversationDecision {
    if (context.optedOut) return { replyText: null };
    if (context.revocationPending || context.consentStatus === 'revoked') {
      return { replyText: 'A revogação foi registrada e o processamento continua bloqueado. Se preferir, envie uma mensagem por texto.' };
    }
    if (context.audioConsent === false) {
      return { replyText: 'Tudo bem. Não vou processar áudio. Se preferir, envie sua mensagem por texto.' };
    }
    return {
      replyText: 'Posso usar IA para transcrever áudios somente com sua autorização nesta conversa. Você autoriza? Se preferir, envie sua mensagem por texto.',
      conversationPatch: { audioConsentPrompted: true },
    };
  }

  private decideText(
    context: ConversationContext,
    rawText: string,
    at: string,
    answerId: ApprovedFaqAnswerId | null = null,
  ): ConversationDecision {
    if (context.optedOut) return { replyText: null };
    const text = normalize(rawText);

    if (isPrivacyRequest(text)) {
      return {
        replyText: 'Recebi seu pedido. Os sócios vão verificar os dados envolvidos; só confirmaremos a conclusão depois da conferência. A primeira resposta humana será em até 24 horas.',
        handoff: { kind: 'privacy_request', reason: 'privacy_request', safeContext: 'data_rights' },
      };
    }

    if (isOptOut(text)) {
      return { replyText: null, customerPatch: { optedOut: true } };
    }

    if (isConsentRevocation(text)) {
      return {
        replyText: 'Revogação registrada. Novos processamentos ficam bloqueados. Não vou afirmar que dados foram apagados sem a verificação dos sócios.',
        customerPatch: { consentStatus: 'revoked', consentAt: at, revocationPending: true },
        conversationPatch: { consentPromptedVersion: null },
        handoff: { kind: 'privacy_request', reason: 'consent_revoked', safeContext: 'consent' },
      };
    }

    if (isHumanRequest(text)) {
      return {
        replyText: 'Recebi seu pedido para falar com uma pessoa. Os sócios darão a primeira resposta em até 24 horas; não há um prazo aprovado para a resolução.',
        handoff: { kind: 'human_help', reason: 'customer_requested', safeContext: 'human_request' },
      };
    }

    if (context.audioConsentPrompted && isConsentAffirmative(text)) {
      return {
        replyText: 'Autorização de áudio registrada para esta conversa. Pode enviar um áudio OGG; se preferir, também pode escrever por texto.',
        conversationPatch: { audioConsent: true, audioConsentPrompted: false, incrementAudioConsentVersion: true },
      };
    }
    if (context.audioConsentPrompted && isConsentNegative(text)) {
      return {
        replyText: 'Tudo bem. Não vou processar áudio. Se preferir, envie sua mensagem por texto.',
        conversationPatch: { audioConsent: false, audioConsentPrompted: false, incrementAudioConsentVersion: true },
      };
    }
    if (context.audioConsentPrompted && isConsentResponseCandidate(text)) {
      return { replyText: 'Não consegui confirmar se você autoriza a transcrição. Pode responder sim ou não? Se preferir, envie sua mensagem por texto.' };
    }

    if (context.eligibilityPrompted === 'adult') {
      if (isAdultAffirmative(text)) {
        return {
          replyText: 'A foto que você pretende usar é sua?',
          customerPatch: { adultConfirmed: true },
          conversationPatch: { eligibilityPrompted: 'photo_ownership' },
        };
      }
      if (isAdultNegative(text)) {
        return {
          replyText: 'Entendi. Este serviço é somente para pessoas adultas. Não envie uma foto para processamento. Posso responder outra dúvida ou encaminhar você aos sócios.',
          customerPatch: { adultConfirmed: false },
          conversationPatch: { eligibilityPrompted: null },
        };
      }
      return { replyText: 'Você tem 18 anos ou mais?' };
    }

    if (context.eligibilityPrompted === 'photo_ownership') {
      if (isPhotoOwnershipAffirmative(text)) {
        const policy = readApprovedDataPolicy();
        if (policy.status !== 'available') {
          return {
            replyText: 'Ainda não posso confirmar as condições de tratamento dos dados. Não envie uma foto. Posso encaminhar sua dúvida aos sócios.',
            customerPatch: { ownsPhotoConfirmed: true },
            conversationPatch: { eligibilityPrompted: null },
          };
        }
        return {
          replyText: `${policy.policy.title}\n${formatConsentPolicySummary(policy.policy)}\n\nVocê concorda com o processamento descrito para gerar o retrato?`,
          customerPatch: { ownsPhotoConfirmed: true },
          conversationPatch: { eligibilityPrompted: null, consentPromptedVersion: policy.policy.version },
        };
      }
      if (isPhotoOwnershipNegative(text)) {
        return {
          replyText: 'Entendi. Só podemos considerar uma foto própria. Não envie uma foto de outra pessoa. Posso encaminhar sua dúvida aos sócios.',
          customerPatch: { ownsPhotoConfirmed: false },
          conversationPatch: { eligibilityPrompted: null },
        };
      }
      return { replyText: 'A foto que você pretende usar é sua?' };
    }

    if (context.consentPromptedVersion && isConsentAffirmative(text)) {
      const policy = readApprovedDataPolicy();
      if (policy.status !== 'available' || policy.policy.version !== context.consentPromptedVersion) {
        return {
          replyText: 'Não consegui confirmar a versão atual da política. O processamento continua bloqueado; não envie uma foto.',
          conversationPatch: { consentPromptedVersion: null },
        };
      }
      return {
        replyText: 'Consentimento registrado. A coleta e o processamento de fotos continuam bloqueados até a comprovação da exclusão local. Por favor, não envie uma foto. Posso esclarecer outra dúvida ou chamar uma pessoa.',
        customerPatch: {
          consentStatus: 'granted', consentPolicyVersion: policy.policy.version,
          consentAt: at, revocationPending: false,
        },
        conversationPatch: { consentPromptedVersion: null },
      };
    }
    if (context.consentPromptedVersion && isConsentNegative(text)) {
      return {
        replyText: 'Tudo bem. Sem consentimento afirmativo, não haverá processamento de foto. Podemos continuar sem foto ou encerrar por aqui.',
        customerPatch: {
          consentStatus: 'refused', consentPolicyVersion: context.consentPromptedVersion,
          consentAt: at,
        },
        conversationPatch: { consentPromptedVersion: null },
      };
    }
    if (context.consentPromptedVersion && isConsentResponseCandidate(text)) {
      return { replyText: 'Não consegui confirmar se você concorda com o processamento descrito. Pode responder sim ou não? Sem confirmação, não haverá processamento de foto.' };
    }

    if (asksToUsePhoto(text)) {
      if (context.adultConfirmed === false || context.ownsPhotoConfirmed === false) {
        return { replyText: 'Não posso prosseguir sem confirmar que você é adulta e que a foto é sua. Não envie uma foto.' };
      }
      if (context.adultConfirmed !== true) {
        return {
          replyText: 'Você tem 18 anos ou mais?',
          conversationPatch: { eligibilityPrompted: 'adult' },
        };
      }
      if (context.ownsPhotoConfirmed !== true) {
        return {
          replyText: 'A foto que você pretende usar é sua?',
          conversationPatch: { eligibilityPrompted: 'photo_ownership' },
        };
      }
      if (context.consentStatus === 'revoked' || context.revocationPending) {
        return { replyText: 'A revogação foi registrada e o processamento continua bloqueado. Posso esclarecer outra dúvida ou encaminhar seu pedido aos sócios.' };
      }
      if (context.consentStatus === 'refused') {
        return { replyText: 'Sem consentimento afirmativo, não haverá processamento de foto. Podemos continuar sem foto ou encerrar por aqui.' };
      }
      if (context.consentStatus !== 'granted') {
        const policy = readApprovedDataPolicy();
        if (policy.status !== 'available') {
          return { replyText: 'A política aprovada não está disponível. Não envie uma foto; posso encaminhar sua dúvida aos sócios.' };
        }
        return {
          replyText: `${policy.policy.title}\n${formatConsentPolicySummary(policy.policy)}\n\nVocê concorda com o processamento descrito para gerar o retrato?`,
          conversationPatch: { consentPromptedVersion: policy.policy.version },
        };
      }
      const authorization = authorizePhotoProcessing(context);
      if (!authorization.allowed) {
        return {
          replyText: 'Mesmo com elegibilidade e consentimento registrados, a coleta de fotos permanece bloqueada até a comprovação da exclusão local. Por favor, não envie uma foto.',
        };
      }
    }

    if (asks(text, ['preco', 'valor', 'quanto custa', 'pacote'])) {
      return approvedFaqDecision('price_unapproved');
    }
    if (asks(text, ['prazo', 'quando fica', 'demora', 'entrega'])) {
      return approvedFaqDecision('timeline_unapproved');
    }
    if (asks(text, ['parecido', 'semelhanca', 'rosto', 'qualidade', 'garante'])) {
      return approvedFaqDecision('quality_expectations');
    }
    if (asks(text, ['previa', 'amostra'])) {
      return approvedFaqDecision('preview_policy');
    }
    if (asks(text, ['ia', 'inteligencia artificial', 'como funciona'])) {
      return approvedFaqDecision('photo_processing');
    }
    if (asks(text, ['audio', 'voz', 'nota de voz'])) return this.decideAudioConsent(context);
    if (isGreeting(text)) return { replyText: 'Olá! Posso responder dúvidas sobre o ensaio. O que você gostaria de saber?' };

    if (answerId && answerId !== 'unknown') return approvedFaqDecision(answerId);

    return {
      replyText: 'Não encontrei uma resposta aprovada para essa dúvida. Encaminhei o pedido aos sócios, que darão a primeira resposta em até 24 horas.',
      handoff: { kind: 'human_help', reason: 'unsupported_question', safeContext: 'faq_unapproved' },
    };
  }
}

function approvedFaqDecision(answerId: Exclude<ApprovedFaqAnswerId, 'unknown'>): ConversationDecision;
function approvedFaqDecision(answerId: 'unknown'): null;
function approvedFaqDecision(answerId: ApprovedFaqAnswerId): ConversationDecision | null {
  switch (answerId) {
    case 'quality_expectations':
      return { replyText: 'A semelhança pode variar e não é garantida. Posso encaminhar outras dúvidas aos sócios.' };
    case 'photo_processing':
      return { replyText: 'O retrato seria processado com inteligência artificial. A coleta e o processamento de fotos continuam bloqueados até a comprovação da exclusão local. Não envie uma foto enquanto esse bloqueio estiver ativo.' };
    case 'preview_policy':
      return { replyText: 'Uma prévia depende de aprovação dos sócios e de reserva de custo. Não vou iniciar uma geração por este pedido.' };
    case 'price_unapproved':
      return {
        replyText: 'Ainda não há um preço aprovado para informar. Posso encaminhar essa dúvida aos sócios.',
        handoff: { kind: 'human_help', reason: 'unsupported_question', safeContext: 'faq_unapproved' },
      };
    case 'timeline_unapproved':
      return {
        replyText: 'Ainda não há um prazo aprovado para informar. Não quero prometer uma data sem confirmação. Posso encaminhar essa dúvida aos sócios.',
        handoff: { kind: 'human_help', reason: 'unsupported_question', safeContext: 'faq_unapproved' },
      };
    case 'unknown':
      return null;
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function asks(value: string, needles: string[]): boolean { return needles.some((needle) => value.includes(needle)); }
function formatConsentPolicySummary(policy: DataPolicyV2): string {
  const conversation = policy.dataSets.find((item) => item.id === 'conversation_and_consent');
  const photo = policy.dataSets.find((item) => item.id === 'source_image');
  if (!conversation || !photo) return policy.summary;
  const channelProvider = policy.providers.find((provider) => provider.id === 'meta_whatsapp_cloud_api_direct')?.name;
  const imageProvider = policy.providers.find((provider) => provider.id === 'google_nano_banana_2_1')?.name;
  const backupRetention = conversation.retention.backupDays === null
    ? 'O prazo de expiração das cópias de backup não está definido.'
    : `Cópias de backup do banco podem permanecer por até ${conversation.retention.backupDays} dias adicionais.`;
  return [
    'A foto seria usada somente para gerar o retrato pedido. Não será usada em publicidade, portfólio ou treinamento.',
    `A conversa e o registro mínimo de consentimento ficam no sistema por até ${conversation.retention.applicationDays} dias após o encerramento da conversa.`,
    `A foto original e o retrato ficam no sistema por até ${photo.retention.applicationDays} dias após a entrega do resultado.`,
    backupRetention,
    `O canal é ${channelProvider ?? 'Meta — WhatsApp Cloud API direta'}; a foto seria enviada à IA ${imageProvider ?? 'Google Nano Banana 2.1'} para gerar o retrato. Cópias mantidas por esses serviços seguem os termos deles e não são apagadas pela exclusão local.`,
  ].join('\n');
}
function hasContradiction(value: string): boolean { return /\b(nao|nunca|recuso|menor|outra pessoa)\b/.test(value); }
function isAffirmative(value: string): boolean {
  return (AFFIRMATIVE.test(value) || /^pode[.!? ]*$/.test(value)) && !hasContradiction(value);
}
function isNegative(value: string): boolean { return !isUncertainResponse(value) && NEGATIVE.test(value); }
function isConsentAffirmative(value: string): boolean {
  return (CONSENT_AFFIRMATIVE.test(value) || /^pode[.!? ]*$/.test(value)) && !hasContradiction(value);
}
function isConsentNegative(value: string): boolean { return isNegative(value) || /^(recuso|prefiro nao)\b/.test(value); }
function isUncertainResponse(value: string): boolean {
  return /^(?:nao sei|nao tenho certeza|talvez|estou em duvida|tenho duvida)[.!? ]*$/.test(value);
}
function isConsentResponseCandidate(value: string): boolean {
  return AFFIRMATIVE.test(value) || /^pode[.!? ]*$|^isso[.!? ]*$/.test(value)
    || isConsentNegative(value) || isUncertainResponse(value);
}
function isAdultAffirmative(value: string): boolean {
  if (isAdultNegative(value)) return false;
  return isAffirmative(value)
    || (/^(sou maior de idade|sou adulto|sou adulta|tenho (?:18|19|[2-9][0-9]) anos(?: ou mais)?)(?:$|[,.!?])/.test(value)
      && !hasContradiction(value));
}
function isAdultNegative(value: string): boolean {
  return isNegative(value)
    || /\b(?:sou menor(?: de idade)?|tenho (?:[0-9]|1[0-7]) anos|tenho (?:onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezasseis|dezessete) anos)\b/.test(value);
}
function isPhotoOwnershipAffirmative(value: string): boolean {
  if (isPhotoOwnershipNegative(value)) return false;
  return isAffirmative(value)
    || (/^(?:a foto|essa foto|a imagem|essa imagem) e minha\b/.test(value) && !hasContradiction(value));
}
function isPhotoOwnershipNegative(value: string): boolean {
  return isNegative(value)
    || /\b(?:foto|imagem)\b.*\b(?:de outra pessoa|da minha|do meu|e da minha|e do meu)\b/.test(value)
    || /\b(?:nao e minha|nao e meu|pertence a outra pessoa)\b/.test(value);
}
function isGreeting(value: string): boolean { return /^(oi|ola|bom dia|boa tarde|boa noite|tudo bem)[!.? ]*$/.test(value); }
function isHumanRequest(value: string): boolean { return /\b(pessoa|humano|atendente|socio|socia|falar com alguem)\b/.test(value); }
function isPrivacyRequest(value: string): boolean { return /\b(meus dados|meus arquivos|acesso aos dados|excluir meus dados|apagar meus dados|direito de dados)\b/.test(value); }
function isConsentRevocation(value: string): boolean { return /\b(revogar|retiro|cancelar)\b.*\b(consentimento|autorizacao|processamento)\b/.test(value); }
function isOptOut(value: string): boolean {
  return /^(?:pare(?: de me (?:mandar|enviar|chamar|contatar|escrever)(?: mensagens?)?)?|parar(?: de me (?:mandar|enviar|chamar|contatar|escrever)(?: mensagens?)?)?|sair|stop|nao quero (?:mais )?(?:receber mensagens?|mensagens?|contato)|nao me (?:mande|envie|chame|contate)(?: mais)?(?: mensagens?)?|me descadastre)[.! ]*$/.test(value);
}
function asksToUsePhoto(value: string): boolean { return asks(value, ['foto', 'imagem', 'retrato', 'ensaio', 'gerar', 'processar']); }

function shouldClassifyWithGemini(rawText: string): boolean {
  const text = normalize(rawText);
  if (isPrivacyRequest(text) || isOptOut(text) || isConsentRevocation(text) || isHumanRequest(text)) return false;
  if (isConsentResponseCandidate(text)
    || isAdultAffirmative(text) || isAdultNegative(text)
    || isPhotoOwnershipAffirmative(text) || isPhotoOwnershipNegative(text)) return false;
  if (isAffirmative(text) || isNegative(text) || isConsentAffirmative(text) || isConsentNegative(text)) return false;
  if (isGreeting(text) || asksToUsePhoto(text) || asks(text, [
    'preco', 'valor', 'quanto custa', 'pacote', 'prazo', 'quando fica', 'demora', 'entrega',
    'parecido', 'semelhanca', 'rosto', 'qualidade', 'garante', 'previa', 'amostra',
    'ia', 'inteligencia artificial', 'como funciona', 'audio', 'voz', 'nota de voz',
  ])) return false;
  return true;
}

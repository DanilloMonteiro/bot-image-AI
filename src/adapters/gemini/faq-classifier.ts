import type { Budget } from '../../modules/budget/use-cases.js';
import { isProviderDataProcessingAllowed } from '../../modules/data-policy/use-cases';
import {
  APPROVED_FAQ_ANSWER_IDS,
  type ApprovedFaqAnswerId,
  type ConversationFaqClassifier,
  type FaqClassificationResult,
} from '../../modules/conversations/use-cases';
import {
  GoogleVertexGeminiTransport,
  vertexCandidateText,
  type VertexGeminiTransport,
} from './vertex-transport';

const SELECTED_MODEL = 'gemini-3.8-flash';
type Environment = Record<string, string | undefined>;

function readConfig(environment: Environment): { allowed: true; projectId: string; costMinor: number } | { allowed: false } {
  if (environment.GEMINI_LIVE_TRAFFIC_ENABLED !== 'true'
    || environment.GEMINI_ACCOUNT_APPROVED !== 'true'
    || environment.GEMINI_COST_RECONCILED !== 'true') return { allowed: false };
  const projectId = environment.GOOGLE_CLOUD_PROJECT;
  const model = environment.GEMINI_CONVERSATION_MODEL ?? SELECTED_MODEL;
  const costValue = environment.GEMINI_TEXT_COST_BRL_MINOR;
  if (!projectId || !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)
    || model !== SELECTED_MODEL || !costValue || !/^\d+$/.test(costValue)) return { allowed: false };
  const costMinor = Number(costValue);
  if (!Number.isSafeInteger(costMinor) || costMinor <= 0) return { allowed: false };
  return { allowed: true, projectId, costMinor };
}

function parseAnswerId(response: unknown): ApprovedFaqAnswerId | null {
  const text = vertexCandidateText(response);
  if (!text || text.length > 256) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || Object.keys(record)[0] !== 'answerId') return null;
  return typeof record.answerId === 'string'
    && (APPROVED_FAQ_ANSWER_IDS as readonly string[]).includes(record.answerId)
    ? record.answerId as ApprovedFaqAnswerId
    : null;
}

const SYSTEM_INSTRUCTION = [
  'Classifique a pergunta da cliente para atendimento comercial do piloto. Não escreva uma resposta para a cliente.',
  'Selecione exatamente um answerId aprovado. Nunca invente informações nem tente responder perguntas sobre preço ou prazo como se estivessem definidos.',
  'quality_expectations: pergunta sobre semelhança ou qualidade; a resposta aprovada diz que a semelhança pode variar e não é garantida.',
  'photo_processing: pergunta sobre inteligência artificial ou funcionamento; a resposta aprovada explica o uso de IA e informa que fotos continuam bloqueadas até comprovar a exclusão local.',
  'preview_policy: pergunta sobre prévia ou amostra; a resposta aprovada diz que depende de aprovação dos sócios e reserva de custo.',
  'price_unapproved: pergunta sobre preço, valor, pacote ou custo; não há preço aprovado e a dúvida deve ser encaminhada aos sócios.',
  'timeline_unapproved: pergunta sobre prazo, demora ou entrega; não há prazo aprovado e a dúvida deve ser encaminhada aos sócios.',
  'unknown: qualquer outro assunto, pergunta ambígua ou sem resposta aprovada.',
  'Se houver vários assuntos ou dúvida, escolha unknown. Retorne somente JSON com a chave answerId.',
].join('\n');

export class GeminiFaqClassifier implements ConversationFaqClassifier {
  constructor(
    private readonly budget: Pick<Budget, 'reserveAction'>,
    private readonly environment: Environment = process.env,
    private readonly transport: VertexGeminiTransport = new GoogleVertexGeminiTransport(),
    private readonly dataPolicyAllows: () => boolean = isProviderDataProcessingAllowed,
  ) {}

  async classifyQuestion(text: string, options: { actionId: string }): Promise<FaqClassificationResult> {
    const config = readConfig(this.environment);
    if (!config.allowed || !this.dataPolicyAllows() || !text.trim() || text.length > 4_000
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.actionId)) return { status: 'blocked' };
    const reservation = await this.budget.reserveAction({
      version: 'v1',
      actionId: options.actionId,
      category: 'ai',
      cost: { status: 'known', amountMinor: config.costMinor, currency: 'BRL' },
      attemptLimit: 1,
    });
    // Only the request that creates the reservation may spend externally; replays fail closed.
    if (reservation.status !== 'reserved') return { status: 'blocked' };
    try {
      const response = await this.transport.generateContent({
        projectId: config.projectId,
        location: 'us',
        model: SELECTED_MODEL,
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: { answerId: { type: 'STRING', enum: [...APPROVED_FAQ_ANSWER_IDS] } },
            required: ['answerId'],
            propertyOrdering: ['answerId'],
          },
          maxOutputTokens: 32,
        },
      });
      const answerId = parseAnswerId(response);
      return answerId ? { status: 'classified', answerId } : { status: 'failed' };
    } catch {
      return { status: 'failed' };
    }
  }
}

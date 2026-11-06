import type { Budget } from '../../modules/budget/use-cases.js';
import { isProviderDataProcessingAllowed } from '../../modules/data-policy/use-cases';
import type { VoiceTranscriber } from '../../modules/conversations/use-cases';
import { GoogleVertexGeminiTransport, vertexCandidateText, type VertexGeminiTransport } from './vertex-transport';

const SELECTED_MODEL = 'gemini-3.8-flash';

type Environment = Record<string, string | undefined>;

export type GeminiAudioTransport = (request: {
  projectId: string;
  model: string;
  mimeType: 'audio/ogg';
  audioBase64: string;
}) => Promise<{ transcript: string }>;

function readConfig(environment: Environment): { allowed: true; projectId: string; model: string; costMinor: number } | { allowed: false } {
  if (environment.GEMINI_LIVE_TRAFFIC_ENABLED !== 'true'
    || environment.GEMINI_ACCOUNT_APPROVED !== 'true'
    || environment.GEMINI_COST_RECONCILED !== 'true') return { allowed: false };
  const projectId = environment.GOOGLE_CLOUD_PROJECT;
  const model = environment.GEMINI_CONVERSATION_MODEL ?? SELECTED_MODEL;
  const costValue = environment.GEMINI_AUDIO_COST_BRL_MINOR;
  if (!projectId || !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)
    || model !== SELECTED_MODEL || !costValue || !/^\d+$/.test(costValue)) return { allowed: false };
  const costMinor = Number(costValue);
  if (!Number.isSafeInteger(costMinor) || costMinor <= 0) return { allowed: false };
  return { allowed: true, projectId, model, costMinor };
}

/** Runtime uses Vertex ADC; tests may inject a transport while the same gates and reservation still apply. */
export class GeminiOggTranscriber implements VoiceTranscriber {
  constructor(
    private readonly budget: Pick<Budget, 'reserveAction'>,
    private readonly environment: Environment = process.env,
    private readonly transport?: GeminiAudioTransport,
    private readonly vertexTransport: VertexGeminiTransport = new GoogleVertexGeminiTransport(),
    private readonly dataPolicyAllows: () => boolean = isProviderDataProcessingAllowed,
  ) {}

  async transcribeOgg(
    audio: Uint8Array,
    options: { actionId: string },
  ): Promise<{ status: 'transcribed'; text: string } | { status: 'blocked' | 'failed' }> {
    const config = readConfig(this.environment);
    if (!config.allowed || !this.dataPolicyAllows()) return { status: 'blocked' };
    const reservation = await this.budget.reserveAction({
      version: 'v1',
      actionId: options.actionId,
      category: 'ai',
      cost: { status: 'known', amountMinor: config.costMinor, currency: 'BRL' },
      attemptLimit: 1,
    });
    if (reservation.status !== 'reserved') return { status: 'blocked' };
    try {
      const response = await (this.transport ?? ((request) => this.transcribeWithVertex(request)))({
        projectId: config.projectId,
        model: config.model,
        mimeType: 'audio/ogg',
        audioBase64: Buffer.from(audio).toString('base64'),
      });
      const transcript = response.transcript.trim();
      if (!transcript || transcript.length > 4_000) return { status: 'failed' };
      return { status: 'transcribed', text: transcript };
    } catch {
      return { status: 'failed' };
    }
  }

  private async transcribeWithVertex(request: {
    projectId: string;
    model: string;
    mimeType: 'audio/ogg';
    audioBase64: string;
  }): Promise<{ transcript: string }> {
    const response = await this.vertexTransport.generateContent({
      projectId: request.projectId,
      location: 'us',
      model: request.model,
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcreva literalmente a fala em português. Não resuma, não responda à fala e não acrescente texto que não foi falado.' },
          { inlineData: { mimeType: request.mimeType, data: request.audioBase64 } },
        ],
      }],
      generationConfig: { maxOutputTokens: 1_000 },
    });
    return { transcript: vertexCandidateText(response) ?? '' };
  }
}

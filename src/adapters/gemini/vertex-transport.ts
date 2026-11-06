import { GoogleAuth } from 'google-auth-library';

const MAX_RESPONSE_BYTES = 128 * 1024;
const VERTEX_HOST = 'https://aiplatform.us.rep.googleapis.com';

export type VertexGeminiGenerateContentRequest = {
  projectId: string;
  location: 'us';
  model: string;
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{
    role: 'user';
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }>;
  generationConfig: Record<string, unknown>;
};

export type VertexGeminiTransport = {
  generateContent(request: VertexGeminiGenerateContentRequest): Promise<unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBounded(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error('vertex_response_too_large');
  if (!response.body) throw new Error('vertex_response_empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new Error('vertex_response_too_large');
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* A rejected response is not reused. */ }
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(Buffer.from(body).toString('utf8')) as unknown;
}

export class GoogleVertexGeminiTransport implements VertexGeminiTransport {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly auth: GoogleAuth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    }),
  ) {}

  async generateContent(request: VertexGeminiGenerateContentRequest): Promise<unknown> {
    if (!/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(request.projectId)
      || request.location !== 'us'
      || request.model !== 'gemini-3.8-flash') throw new Error('vertex_configuration_invalid');
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error('vertex_credentials_unavailable');
    const modelPath = `projects/${encodeURIComponent(request.projectId)}/locations/${request.location}/publishers/google/models/${request.model}`;
    const response = await this.fetcher(`${VERTEX_HOST}/v1/${modelPath}:generateContent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(request.systemInstruction ? { systemInstruction: request.systemInstruction } : {}),
        contents: request.contents,
        generationConfig: request.generationConfig,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('vertex_request_failed');
    const result = await readJsonBounded(response);
    if (!isObject(result)) throw new Error('vertex_response_invalid');
    return result;
  }
}

export function vertexCandidateText(value: unknown): string | null {
  if (!isObject(value) || !Array.isArray(value.candidates)) return null;
  const candidate = value.candidates[0];
  if (!isObject(candidate) || !isObject(candidate.content) || !Array.isArray(candidate.content.parts)) return null;
  const parts = candidate.content.parts;
  const textPart = parts.find((part) => isObject(part) && typeof part.text === 'string');
  return isObject(textPart) && typeof textPart.text === 'string' ? textPart.text : null;
}

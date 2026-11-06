import { PostgresConversationRepository } from '@/adapters/postgres/conversation-repository';
import {
  handleWhatsAppVerificationRequest,
  handleWhatsAppWebhookRequest,
} from '@/adapters/http/whatsapp-webhook-handler';
import { Conversations } from '@/modules/conversations/use-cases';
import { Budget } from '@/modules/budget/use-cases';
import { PostgresBudgetRepository } from '@/adapters/postgres/budget-repository';
import { GeminiFaqClassifier } from '@/adapters/gemini/faq-classifier';
import { GeminiOggTranscriber } from '@/adapters/gemini/ogg-transcriber';
import { WhatsAppCloudMediaDownloader } from '@/adapters/whatsapp/media-downloader';
import { isWhatsAppIngressApproved } from '@/adapters/whatsapp/cloud-api';
import { isCustomerDataCollectionAllowed } from '@/modules/data-policy/use-cases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  return handleWhatsAppVerificationRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!isWhatsAppIngressApproved() || !isCustomerDataCollectionAllowed()) {
    return Response.json({ error: 'ingress_disabled' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const budget = new Budget(new PostgresBudgetRepository());
  const conversations = new Conversations(
    new PostgresConversationRepository(),
    new GeminiOggTranscriber(budget),
    new GeminiFaqClassifier(budget),
    new WhatsAppCloudMediaDownloader(budget),
  );
  return handleWhatsAppWebhookRequest(request, conversations);
}

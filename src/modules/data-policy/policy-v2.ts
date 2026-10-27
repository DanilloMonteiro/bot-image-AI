import type { DataPolicyV2 } from '../../contracts/data-policy/v2.js';
import { deepFreeze } from './deep-freeze.js';

/** Owner-approved 2026-10-27 policy. Real-data use stays closed until local deletion is proven. */
export const DATA_POLICY_V2 = deepFreeze({
  version: 'v2',
  title: 'Política de dados do piloto',
  effectiveDate: '2026-10-27',
  summary: 'Política v2 aprovada pelo proprietário em 2026-10-27. O piloto usa a WhatsApp Cloud API diretamente pela Meta. Esta versão cobre dados sob controle da aplicação no PostgreSQL e no Bucket privado; a prontidão exige comprovar a exclusão local. Cópias de provedores e região seguem os termos e a configuração de cada serviço, não são gates desta política e não são apagadas pela aplicação. A aprovação não libera dados ou tráfego reais enquanto o gate local e os controles independentes de produção permanecerem fechados.',
  ownerApproval: {
    status: 'approved',
    decidedAt: '2026-10-27',
    approvedAt: '2026-10-27',
  },
  providers: [
    {
      id: 'meta_whatsapp_cloud_api_direct',
      name: 'Meta — WhatsApp Cloud API direta',
      service: 'Canal oficial para receber e enviar mensagens e mídia, sem BSP no piloto.',
      selected: true,
      region: 'Conforme os termos vigentes da Meta; região informativa, sem gate operacional.',
      externalCopies: 'Cópias e retenção seguem os termos vigentes da Meta. A exclusão local da aplicação não apaga cópias da Meta; a aplicação não promete remoção externa.',
    },
    {
      id: 'google_vertex_gemini_3_8_flash',
      name: 'Google Vertex AI — Gemini 3.8 Flash',
      service: 'Interpretação e geração de respostas para conversas em serviço pago.',
      selected: true,
      region: 'Multi-região nos Estados Unidos; informativa, sem gate operacional.',
      externalCopies: 'O proprietário aceita cópias e retenção segundo os termos vigentes do serviço pago. Sem uso para treinamento, publicidade ou portfólio; cada uso adicional exige consentimento separado.',
    },
    {
      id: 'google_nano_banana_2_1',
      name: 'Google Nano Banana 2.1',
      service: 'Geração de imagens em endpoint global, conforme a escolha do proprietário.',
      selected: true,
      region: 'Endpoint global; informativa, sem gate operacional.',
      externalCopies: 'O proprietário aceita cópias, retenção e processamento global segundo os termos vigentes do serviço pago. A exclusão local não apaga cópias do Google; cada uso adicional exige consentimento separado.',
    },
    {
      id: 'abacatepay_pix',
      name: 'AbacatePay',
      service: 'Processamento de pagamentos Pix.',
      selected: true,
      region: 'Conforme os termos vigentes do serviço; informativa, sem gate operacional da Data Policy.',
      externalCopies: 'A AbacatePay e parceiros podem manter registros de transação por períodos maiores quando exigido por lei ou regulação. Esta política não promete exclusão de cópias mantidas por esses fornecedores.',
    },
    {
      id: 'railway_private_postgresql_and_bucket',
      name: 'Railway — PostgreSQL e Bucket privado',
      service: 'Armazenamento controlado pela aplicação: conversas e prova mínima de consentimento em PostgreSQL; fotos originais e resultados no Bucket privado.',
      selected: true,
      region: 'Serviços em US East/Virgínia e Bucket privado em IAD; informativa, sem gate operacional.',
      externalCopies: 'Backups PostgreSQL mantêm a configuração existente de pg_dump a cada 3 dias e retenção de 6 dias. Dumps já gerados podem conservar conversa e consentimento até expirarem. O Bucket privado não tem lifecycle; a aplicação/worker executa a exclusão ativa dos objetos.',
    },
  ],
  dataSets: [
    {
      id: 'conversation_and_consent',
      dataTypes: ['messages_and_conversation_metadata', 'minimal_consent_evidence'],
      purpose: 'Atender a cliente, registrar a versão da política e a prova mínima de consentimento, responder dúvidas e dar suporte ao serviço.',
      storage: 'private_postgresql',
      providers: [
        'meta_whatsapp_cloud_api_direct',
        'google_vertex_gemini_3_8_flash',
        'railway_private_postgresql_and_bucket',
      ],
      access: ['application_and_worker', 'two_administrator_partners'],
      retention: {
        applicationDays: 7,
        applicationStartsAt: 'Encerramento da conversa.',
        applicationExpiryAction: 'A aplicação/worker expurga as cópias ativas no primeiro processamento possível após o prazo.',
        backupDays: 6,
        backupCadence: 'pg_dump a cada 3 dias, conforme a configuração existente da Railway.',
        backupCopies: 'Dumps já gerados podem conservar conversa e prova mínima de consentimento até expirarem pelo ciclo de retenção de 6 dias.',
        externalProviderCopies: 'Cópias Meta e Google seguem os termos vigentes de cada serviço e não são apagadas pela exclusão local.',
      },
      deletion: {
        scope: 'app_controlled_storage',
        activeCopies: 'Excluir conversas e prova mínima do PostgreSQL no primeiro processamento possível após 7 dias do encerramento; a exclusão local ainda precisa ser implementada e comprovada.',
        backupCopies: 'Dumps PostgreSQL existentes não são alterados pela exclusão ativa e expiram pela configuração atual de 6 dias.',
      },
      exceptions: [
        'A retenção de cópias externas segue os termos Meta/Google e está fora do gate de exclusão da aplicação.',
        'Dumps Railway já gerados podem manter cópias de texto até expirarem.',
        'Publicidade, portfólio e treinamento não são finalidades aprovadas; cada uso exige consentimento separado.',
      ],
    },
    {
      id: 'source_image',
      dataTypes: ['source_photos'],
      purpose: 'Gerar o ensaio solicitado e permitir suporte e avaliação do serviço no painel.',
      storage: 'private_bucket',
      providers: [
        'meta_whatsapp_cloud_api_direct',
        'google_nano_banana_2_1',
        'railway_private_postgresql_and_bucket',
      ],
      access: ['application_and_worker', 'two_administrator_partners'],
      retention: {
        applicationDays: 7,
        applicationStartsAt: 'Entrega do resultado à cliente.',
        applicationExpiryAction: 'A aplicação/worker apaga o objeto original no primeiro processamento possível após o prazo.',
        backupDays: null,
        backupCadence: 'Não se aplica: mídia no Bucket não entra nos dumps PostgreSQL.',
        backupCopies: 'Dumps PostgreSQL não contêm objetos do Bucket e não substituem a exclusão ativa de mídia.',
        externalProviderCopies: 'Cópias Meta e Google seguem os termos vigentes; a exclusão local não as apaga nem promete sua remoção.',
      },
      deletion: {
        scope: 'app_controlled_storage',
        activeCopies: 'Apagar o objeto do Bucket privado no primeiro processamento possível após 7 dias da entrega; a exclusão local ainda precisa ser implementada e comprovada.',
        backupCopies: 'A mídia do Bucket não é armazenada nos dumps PostgreSQL.',
      },
      exceptions: [
        'Publicidade, portfólio e treinamento não são finalidades aprovadas; cada uso exige consentimento separado.',
        'Cópias externas ficam fora do gate de exclusão da aplicação.',
      ],
    },
    {
      id: 'generated_result',
      dataTypes: ['generated_images'],
      purpose: 'Entregar o ensaio solicitado e permitir suporte e avaliação do serviço no painel.',
      storage: 'private_bucket',
      providers: [
        'google_nano_banana_2_1',
        'railway_private_postgresql_and_bucket',
        'meta_whatsapp_cloud_api_direct',
      ],
      access: ['application_and_worker', 'two_administrator_partners'],
      retention: {
        applicationDays: 7,
        applicationStartsAt: 'Entrega do resultado à cliente.',
        applicationExpiryAction: 'A aplicação/worker apaga o resultado no primeiro processamento possível após o prazo.',
        backupDays: null,
        backupCadence: 'Não se aplica: mídia no Bucket não entra nos dumps PostgreSQL.',
        backupCopies: 'Dumps PostgreSQL não contêm objetos do Bucket e não substituem a exclusão ativa de mídia.',
        externalProviderCopies: 'Cópias Google e Meta seguem os termos vigentes; a exclusão local não as apaga nem promete sua remoção.',
      },
      deletion: {
        scope: 'app_controlled_storage',
        activeCopies: 'Apagar o objeto do Bucket privado no primeiro processamento possível após 7 dias da entrega; a exclusão local ainda precisa ser implementada e comprovada.',
        backupCopies: 'A mídia do Bucket não é armazenada nos dumps PostgreSQL.',
      },
      exceptions: [
        'Publicidade, portfólio e treinamento não são finalidades aprovadas; cada uso exige consentimento separado.',
        'Cópias externas ficam fora do gate de exclusão da aplicação.',
      ],
    },
  ],
  operationalReadiness: {
    localDeletion: 'pending',
  },
} as const satisfies DataPolicyV2);

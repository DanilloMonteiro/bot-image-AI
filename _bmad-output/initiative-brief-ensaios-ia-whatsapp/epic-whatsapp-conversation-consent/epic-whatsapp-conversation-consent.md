---
type: epic
title: Conversa no WhatsApp e consentimento
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-1, CAP-2]
after: [epic-pilot-budget-data-policy]
assignee: "Isaac"
risk: high
---

# Conversa no WhatsApp e consentimento

## Description

Receber e conduzir a conversa a partir da primeira mensagem que chega pelo WhatsApp: explicar o ensaio de aniversário com linguagem natural e FAQ aprovada, verificar elegibilidade, informar a política de dados aprovada e registrar consentimento afirmativo antes de pedir ou processar a foto própria de uma pessoa adulta.

## Outcome

A cliente entende a oferta e os requisitos antes do Pix e pode iniciar o fluxo sem menus, atalhos ou comandos, com consentimento atribuível à versão da política apresentada.

## Done when

1. Mensagens recebidas iniciam ou retomam conversa identificável e chegam à cliente por respostas em português com uma pergunta por vez e conteúdo comercial aprovado; mensagens repetidas e fora de ordem não duplicam efeitos nem regridem evidência de entrega.
2. Elegibilidade para adulto usando a própria foto é confirmada antes de avançar; casos não elegíveis não seguem para geração.
3. Política aprovada é apresentada antes da solicitação da foto, e o consentimento afirmativo e sua versão ficam registrados; revogação bloqueia trabalho ainda não enviado, e fotos reais permanecem bloqueadas até haver prova da exclusão local no PostgreSQL e no Bucket.
4. Antes de processar o primeiro áudio da conversa, o serviço explica o uso de IA e pede confirmação; o áudio original é transitório e não fica no banco nem no Bucket, enquanto a transcrição segue a retenção de sete dias da conversa. Recusa ou falha de interpretação oferece texto.
5. Opt-in/opt-out do canal, revogação de consentimento e solicitações de direitos sobre dados são tratados separadamente; regras de templates e janela seguem a conta habilitada, e pedidos humanos ou de privacidade chegam ao contrato durável da Operação em produção.

## Boundaries

Épico dono do módulo Conversas, identidade de conversa, estado conversacional, FAQ, elegibilidade, coleta de consentimento e evidência correspondente. Começa na mensagem recebida; anúncios, clique e transição do Instagram ficam fora. Não armazena o conteúdo binário de fotos, não confirma Pix nem executa aprovação de prévia. O módulo Operação consome o handoff humano; Retratos consome identidade, elegibilidade e consentimento por caso de uso público.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-1, CAP-2, Constraints e Non-goals
- UX — _bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/EXPERIENCE.md
- PRD — prd-ensaios-ia-whatsapp.md, FAQ pré-Pix aprovada e §10 perguntas 1, 7, 9, 14, 16
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulo Conversas e limites de autorização

## Notes

- Decision (2026-10-27): Isaac owns this epic and develops it independently from Epic 4; the shared sandbox integration is in Epic 8 after both epics.
- Decision (2026-10-27): voice messages are included. The first audio in a conversation receives an AI-processing notice and requires confirmation; raw audio is transient, only the transcript is retained with conversation text for seven days, and refusal or failure falls back to text. This resolves PRD §10, question 14.
- Decision: o sistema começa depois que a primeira mensagem é recebida no WhatsApp; anúncio do Instagram e transição ao canal não fazem parte do sistema.
- Decision: FAQ base aprovada; preços listados são hipóteses, e prazo de entrega continua pendente antes de anúncio/coleta.
- Open question: configurar e validar conta Meta, opt-in, janela, templates, transparência sobre automação e custos antes de ativar o canal.

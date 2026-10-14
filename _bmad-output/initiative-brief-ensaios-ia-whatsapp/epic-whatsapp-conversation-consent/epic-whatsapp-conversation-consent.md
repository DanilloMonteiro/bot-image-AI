---
type: epic
title: Conversa no WhatsApp e consentimento
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-1, CAP-2]
after: [epic-pilot-budget-data-policy]
assignee: ""
risk: high
---

# Conversa no WhatsApp e consentimento

## Description

Receber e conduzir a conversa a partir da primeira mensagem que chega pelo WhatsApp: explicar o ensaio de aniversário com linguagem natural e FAQ aprovada, verificar elegibilidade, informar a política de dados aprovada e registrar consentimento afirmativo antes de pedir ou processar a foto própria de uma pessoa adulta.

## Outcome

A cliente entende a oferta e os requisitos antes do Pix e pode iniciar o fluxo sem menus, atalhos ou comandos, com consentimento atribuível à versão da política apresentada.

## Done when

1. Mensagens recebidas iniciam ou retomam conversa identificável e chegam à cliente por respostas em português com uma pergunta por vez e conteúdo comercial aprovado.
2. Elegibilidade para adulto usando a própria foto é confirmada antes de avançar; casos não elegíveis não seguem para geração.
3. Política aprovada é apresentada antes da solicitação da foto, e o consentimento afirmativo e sua versão ficam registrados; sem consentimento o fluxo não coleta/processa mídia.
4. Áudio, opt-in, templates, janela, custos e apresentação de automação seguem apenas regras habilitadas e validadas para a conta real do canal.
5. Eventos repetidos de mensagem não duplicam resposta ou avanço de etapa, e uma solicitação de pessoa humana é entregue ao contrato de handoff da Operação em produção.

## Boundaries

Épico dono do módulo Conversas, identidade de conversa, estado conversacional, FAQ, elegibilidade, coleta de consentimento e evidência correspondente. Começa na mensagem recebida; anúncios, clique e transição do Instagram ficam fora. Não armazena o conteúdo binário de fotos, não confirma Pix nem executa aprovação de prévia. O módulo Operação consome o handoff humano; Retratos consome identidade, elegibilidade e consentimento por caso de uso público.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-1, CAP-2, Constraints e Non-goals
- UX — _bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/EXPERIENCE.md
- PRD — prd-ensaios-ia-whatsapp.md, FAQ pré-Pix aprovada e §10 perguntas 1, 7, 9, 14, 16
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulo Conversas e limites de autorização

## Notes

- Decision: o sistema começa depois que a primeira mensagem é recebida no WhatsApp; anúncio do Instagram e transição ao canal não fazem parte do sistema.
- Decision: FAQ base aprovada; preços listados são hipóteses, e prazo de entrega e retenção exata continuam pendentes antes de anúncio/coleta.
- Open question: confirmar conta/provedor, opt-in, janela e templates, transparência sobre automação e custos antes de ativar o canal.
- Open question: áudio, canal de notificação e demais detalhes de retomada da automação permanecem fora da decisão até confirmação.

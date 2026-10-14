---
type: epic
title: Prévia opcional com aprovação
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-5]
after: [epic-pilot-budget-data-policy, epic-whatsapp-conversation-consent, epic-orders-pix, epic-partner-operations, epic-portrait-fulfillment]
assignee: ""
risk: high
---

# Prévia opcional com aprovação

## Description

Oferecer a possibilidade de uma Prévia antes do Pix sem permitir gasto autônomo: um sócio autenticado aprova a solicitação, o sistema reserva custo e aplica limites, Retratos gera uma versão reduzida com marca-d’água e a cliente pode seguir para o pagamento normal.

## Outcome

Uma cliente elegível pode avaliar uma Prévia opcional antes de comprar, e cada imagem de Prévia tem autorização, custo reservado, limites aplicados e trilha auditável.

## Done when

1. Solicitação verifica cliente, elegibilidade e consentimento antes de aparecer na fila de aprovação; nenhuma imagem é coletada/processada sob política não aprovada.
2. Sócio com conta individual, MFA e permissão aprova ou recusa; decisão, identidade, horário e motivo são auditáveis, e aprovação não é acionada por modelo ou webhook do cliente.
3. Reserva de custo e limites por cliente/período são atômicos e idempotentes; solicitação é recusada se saldo ou limite for desconhecido/insuficiente.
4. Cada Prévia autorizada é entregue em baixa resolução e com marca-d’água; falha de processamento ou envio aparece como exceção e não consome autorização duplicada.
5. Cliente pode prosseguir ao fluxo normal de pacote e Pix, sem cobrança ou geração paga até confirmação autenticada.
6. Fluxo de produção respeita limites, custo, retenção e política comercial definidos antes da ativação; conversão e custo de Prévias não convertidas são visíveis à Operação.

## Boundaries

Épico dono do fluxo de Prévia, fila/decisão de aprovação e autorização específica. Reusa painel e identidade de Operação, políticas e reservas de Budget, cliente/consentimento de Conversas, geração/entrega de Retratos e conversão via Pedido/Pix. Não é dono de painel geral, geração de imagem, ledger, preço ou retenção.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-5, Constraints e Open Questions
- UX — _bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/EXPERIENCE.md
- PRD — prd-ensaios-ia-whatsapp.md, §10 perguntas 4 e 6
- addendum — _bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/addendum.md, Provisional operational values e Pilot economics
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, autorização de ferramenta e módulo Budget

## Notes

- Open question: decidir se Prévia conta como primeira imagem do pacote e confirmar limites por cliente, diários/mensais e valor de orçamento antes de ativar.
- Source conflict: plano fonte sugere 1 Prévia por WhatsApp ID em 30 dias, R$8/dia e R$25/mês; são hipóteses não aprovadas e não devem virar configuração final.
- Decision: toda Prévia exige aprovação manual de um sócio e reserva de custo, é de baixa resolução com marca-d’água e respeita limites configurados.

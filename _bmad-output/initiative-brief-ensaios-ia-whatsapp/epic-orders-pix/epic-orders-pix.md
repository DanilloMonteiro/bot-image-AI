---
type: epic
title: Pedidos e pagamento Pix
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-1, CAP-3]
after: [epic-pilot-budget-data-policy, epic-whatsapp-conversation-consent]
assignee: ""
risk: high
---

# Pedidos e pagamento Pix

## Description

Transformar a escolha de pacote em Pedido rastreável, apresentar apenas preço aprovado e iniciar Pix pelo provedor selecionado após validar saldo e consentimento. Um evento autenticado de pagamento confirmado libera uma única autorização de geração, ligada ao Pedido e ao valor esperado.

## Outcome

A cliente pode pagar um Pedido por Pix com total verificável, e eventos do provedor produzem exatamente uma confirmação financeira e uma autorização de fulfillment.

## Done when

1. Pacotes e valores vêm de catálogo aprovado e aparecem iguais na confirmação do Pedido e na cobrança; não se exibem preços hipótese como finais.
2. Pix em produção está ligado a Pedido, cliente, conta, valor e moeda esperados; confirmação depende de evento autenticado do provedor e conciliação verificável.
3. Webhooks duplicados, fora de ordem ou concorrentes não duplicam Pedido, cobrança, confirmação ou autorização de geração.
4. Nenhuma cobrança, desconto, reembolso ou autorização é criada por texto livre do modelo; exceções dependem de regra determinística ou sócio autorizado.
5. Enquanto a rota de entrega não estiver pronta, a compra real permanece desabilitada; em staging, o tracer percorre Pedido, Pix sandbox e resultado de teste.

## Boundaries

Épico dono de Pedidos, estado comercial, catálogo/preço aprovado, integração Pix, reconciliação e emissão idempotente da autorização de fulfillment. Usa conversa e consentimento do módulo Conversas, orçamento do módulo Budget e publica estado para Operação. Não gera, armazena ou entrega imagens. Pix é o único meio de pagamento do MVP.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-1, CAP-3, Constraints e Open Questions
- PRD — prd-ensaios-ia-whatsapp.md, §6.4 e §10 perguntas 3, 5, 10
- addendum — _bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/addendum.md, guardrails de Pix e custos (propostas)
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulos Orders/Payments e contratos de autorização

## Notes

- Open question: valores e pacotes finais dependem de validação de margem antes de anúncio.
- Decision (2026-10-25, owner-approved): AbacatePay is the selected Pix provider for the MVP. This epic owns its account setup and payment integration; the Budget gate continues to block paid actions while their costs are unknown.
- Decision: geração paga só começa depois de confirmação autenticada vinculada ao Pedido e ao valor; eventos repetidos não duplicam efeitos.
- Decision: manter compra de cliente desabilitada até o caminho de geração e entrega estar pronto.

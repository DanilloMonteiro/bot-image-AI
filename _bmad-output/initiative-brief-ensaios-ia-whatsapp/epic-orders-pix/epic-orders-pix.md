---
type: epic
title: Pedidos e pagamento Pix
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-1, CAP-3]
after: [epic-pilot-budget-data-policy]
assignee: "Danillo"
risk: high
---

# Pedidos e pagamento Pix

## Description

Implementar o módulo de Pedidos/Pagamentos, catálogo comercial, integração AbacatePay, reconciliação Pix e autorização única após pagamento confirmado. Este epic é desenvolvido e validado sozinho com dados de exemplo, oferta sandbox e remetente local; uma story independente liga seus casos públicos à conversa real depois que os Epics 3 e 4 terminarem.

## Outcome

O módulo cria Pedidos e pagamentos Pix verificáveis, confirma um pagamento autenticado e publica exatamente uma autorização durável de entrega. A rota de produção existe, mas permanece bloqueada até os gates de preço, orçamento e entrega; a conversa real é integrada depois em uma story conjunta.

## Done when

1. O catálogo só expõe valores aprovados para produção; uma oferta privada de sandbox permite ensaiar sem aprovar preços finais.
2. O adaptador AbacatePay implementa Dev mode e configuração de produção; cobranças reais permanecem fechadas até haver rota de entrega do Epic 6, oferta aprovada, saldo verificável e gates operacionais.
3. Eventos autenticados são vinculados a Pedido, conta, valor e moeda esperados; repetição, concorrência, reenvio e chegada fora de ordem não duplicam cobrança, confirmação ou autorização.
4. Nenhuma cobrança, desconto, reembolso ou autorização é criada por texto livre do modelo; exceções dependem de regra determinística ou sócio autorizado.
5. O tracer de staging percorre Pedido, Pix sandbox e uma autorização usando identidades e consentimentos de exemplo e remetente local; não chama o WhatsApp nem usa dinheiro ou fotos reais.

## Boundaries

Épico dono de Pedidos, estado comercial, catálogo, integração Pix, reconciliação e emissão idempotente da autorização de fulfillment. Implementa seus próprios casos de teste com IDs opacos e dados de exemplo; não depende do código ou das tabelas de Conversas, não envia mensagens pelo WhatsApp e não gera, armazena ou entrega imagens. Usa o módulo Budget e publica estado para Operação. Pix é o único meio de pagamento do MVP.

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
- Decision (2026-10-27): Danillo owns this epic and develops it independently from Epic 3 with fixture identities, consent cases and a local fake sender. Epic 8 connects WhatsApp and Orders after both epics finish.
- Decision (2026-10-27): the production connector path is implemented but fails closed until the Epic 6 delivery route, approved production offer, Budget and operational gates are ready. Require one manual real Pix test after Epic 6 is ready; the Epic 3/4 integration story uses sandbox only.

---
type: epic
title: Integração da conversa com pedidos e Pix
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-1, CAP-3]
after: [epic-pilot-budget-data-policy, epic-whatsapp-conversation-consent, epic-orders-pix]
assignee: "Isaac e Danillo"
risk: high
---

# Integração da conversa com pedidos e Pix

## Description

Conectar os casos públicos de Conversas e Pedidos/Pagamentos para que uma cliente de teste percorra a compra pelo WhatsApp e pague no ambiente sandbox da AbacatePay.

## Outcome

Uma cliente sintética começa no número de teste do WhatsApp, recebe as instruções Pix correspondentes ao próprio pedido e, ao pagar no Dev mode, produz uma confirmação e uma autorização de entrega sem duplicidade.

## Done when

1. Mensagens do número de teste chegam à conversa correta e recebem respostas coerentes pelo Gemini.
2. A escolha da oferta privada de sandbox cria um pedido ligado à identidade estável e ao consentimento registrados pelo Epic 3.
3. A cobrança Pix sandbox e as instruções enviadas no WhatsApp correspondem ao mesmo pedido e valor.
4. A confirmação autenticada de pagamento publica uma única autorização durável para o Epic 6.
5. Reenvios, duplicatas, eventos fora de ordem e falhas de envio não duplicam resposta, pedido, cobrança, confirmação ou autorização.
6. O ensaio usa dados sintéticos, não cria Pix de produção nem processa fotos reais; chamadas de Meta/Gemini só ocorrem quando o Budget autoriza o custo.

## Boundaries

Este epic integra os módulos depois de eles serem concluídos separadamente. Usa os casos públicos de ambos e não grava diretamente nas tabelas de outro módulo. Não gera ou entrega imagens, não habilita cobrança de produção e não aprova preços de venda.

## References

- initiative — _bmad-output/initiative-brief-ensaios-ia-whatsapp/initiative-brief-ensaios-ia-whatsapp.md, CAP-1, CAP-3 e tracer path
- Epic 3 — _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-whatsapp-conversation-consent/epic-whatsapp-conversation-consent.md
- Epic 4 — _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-orders-pix/epic-orders-pix.md
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, AD-2 e AD-3
- AbacatePay Dev mode — https://docs.abacatepay.com/pages/devmode
- AbacatePay webhooks — https://docs.abacatepay.com/pages/webhooks

## Notes

- Decision (2026-10-27): iniciar a única story deste epic apenas depois da conclusão dos Epics 3 e 4.
- Decision (2026-10-27): este contêiner de integração tem uma única story conjunta para manter o gate explícito antes do Epic 6; os Epics 3 e 4 continuam independentes entre si.
- Decision (2026-10-27): a integração usa AbacatePay Dev mode; o teste manual com Pix real ocorre depois do Epic 6, quando a entrega estiver pronta e houver uma oferta aprovada.
- Decision (2026-10-27): Isaac e Danillo executam juntos o tracer de ponta a ponta com o número de teste, dados sintéticos e credenciais sandbox; chamadas pagas de Meta/Gemini dependem do Budget.

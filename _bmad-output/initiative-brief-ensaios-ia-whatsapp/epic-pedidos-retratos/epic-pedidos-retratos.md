---
tracker_id: ""
key: ""
type: epic
title: "Pedidos Pix e entrega de retratos"
parent: initiative-brief-ensaios-ia-whatsapp
covers: ["CAP-1", "CAP-2", "CAP-3", "CAP-4", "CAP-5"]
after: []
assignee: ""
risk: medium
---

# Pedidos Pix e entrega de retratos

## Description

Implementar catálogo, aceite do pacote e preço, pedido, cobrança Pix individual, reconciliação de pagamento, geração e entrega do retrato. Retratos só pode usar uma imagem depois de verificar elegibilidade e consentimento vigente para aquela imagem, finalidade e destino imediatamente antes da chamada ao provedor, além de reservar orçamento para tentativas autorizadas. O primeiro caminho demonstrável usa fixtures sintéticas em sandbox; estados divergentes, desconhecidos ou falhas ficam recuperáveis e visíveis para Operações.

## Outcome

Uma compra sintética percorre aceite de preço, Pix sandbox, reconciliação autenticada, retrato de teste, revisão e recibo explícito sem cobrança ou entrega duplicada.

## Requirements

- CAP-1 — catálogo e aceitação explícita de pacote/preço.
- CAP-2 — validação por imagem e consentimento exato antes de qualquer uso por provedor.
- CAP-3 — pedido, cobrança Pix e conciliação.
- CAP-4 — geração, checagem de qualidade, recuperação e entrega confirmada.
- CAP-5 — estado/envio de prévia aprovada; PRD FR-26 registra custo, aprovação, envio, conversão e motivo de não conversão.
- PRD FR-43 — confirmação de recebimento e convite a feedback após entrega.

## DoneWhen

- [ ] O catálogo aprovado tem preço e regras explícitos; pedido e cobrança Pix são individualizados e nenhum pedido é aceito sem confirmação de pacote/preço.
- [ ] Evento de pagamento é autenticado e idempotente; estados pendente, duplicado, divergente e desconhecido podem ser reconciliados sem liberar geração antes da confirmação confiável.
- [ ] Imagem, elegibilidade, finalidade, destino e consentimento vigente são revalidados imediatamente antes de cada chamada a provedor; o orçamento reserva custo máximo autorizado para tentativas limitadas.
- [ ] Toda prévia autorizada exige aprovação explícita e reserva de custo, é gerada e enviada em baixa resolução com marca-d’água e respeita limites configurados por cliente e por dia; custo, aprovação, envio, conversão e motivo de não conversão ficam mensuráveis.
- [ ] Falha, baixa qualidade, tentativa excedida e entrega pendente permanecem recuperáveis sem cobrança, tentativa ou entrega duplicada; após a entrega, o cliente pode confirmar recebimento e enviar feedback conforme opt-out/regras do canal, e feedback negativo gera handoff acionável para Operações.
- [ ] O fluxo com fixture sintética está implantado e verificável em produção até o recibo explícito de entrega; cobranças, fotos e chamadas reais de IA seguem bloqueadas até aprovação de fornecedor, termos, retenção, política de repetição/estorno e limites por categoria.

## Boundaries

- Pedidos/Pagamentos é dono do catálogo, pacote/preço aceito, pedido, cobrança e reconciliação Pix.
- Retratos é dono de elegibilidade por imagem, estado de geração/prévia, avaliação de qualidade e entrega.
- Conversas é fonte de identidade e consentimento; Orçamento é dono da reserva/limite; Operações é dona da revisão humana e do tratamento de exceções.
- Usa casos públicos e eventos duráveis; não escreve diretamente em dados de outro módulo.
- Para pós-venda, Retratos publica o evento de entrega, Conversas envia a pergunta/convite e feedback negativo segue para Operações; este épico fornece os dados de prévia à leitura operacional.

## References

- `../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md` (CAP-1 a CAP-4)
- `../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` (AD-3, AD-4, AD-5, AD-6)
- `../prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md` e `../prd-ensaios-ia-whatsapp/addendum.md`
- `../ux-ensaios-ia-whatsapp/EXPERIENCE.md`

## Notes

- Pix, provedor de geração, critérios de qualidade, preço, estorno, tentativas, limites de categoria e disponibilidade de sandbox ainda são decisões abertas; registrar validações externas antes de ativar ações reais.
- O `after` em `tickets.toml` declara necessidades entre capacidades; somente histórias que usam identidade/consentimento e casos de orçamento dependem desses contratos, com os IDs exatos fixados na inception.

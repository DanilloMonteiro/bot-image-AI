---
tracker_id: ""
key: ""
type: epic
title: "Base segura do piloto e controle de custos"
parent: initiative-brief-ensaios-ia-whatsapp
covers: ["CAP-7"]
after: []
assignee: ""
risk: medium
---

# Base segura do piloto e controle de custos

## Description

Entregar a base modular monolítica necessária para executar o piloto com aplicação Next.js, worker Node.js, eventos duráveis e orçamento autoritativo. O épico fornece contratos públicos, reservas e reconciliação idempotentes, bloqueio fail-closed no teto de R$ 500 e uma leitura de custos para Operações. Ele não implementa a interface dos sócios nem libera ações reais de cobrança, geração por IA ou uso de fotos.

## Outcome

Os demais domínios conseguem integrar-se por casos públicos e operar um fluxo sintético implantado em produção sem exceder o orçamento ou repetir efeitos financeiros.

## Requirements

- CAP-7 — aplicar teto total de R$ 500, limites por categoria aprovados e prestação de contas para avaliação do piloto.
- AD-3 — eventos/outbox duráveis, idempotência e estados explícitos de entrega.
- Plataforma compartilhada — CI para aplicação e worker, ambientes, implantação e operação mínima antes de abrir integração aos outros domínios.
- Fronteiras arquiteturais: módulos sem escrita direta em dados de outros módulos; app e worker separados.

## DoneWhen

- [ ] Aplicação Next.js e worker Node.js estão implantados em produção com CI e promoção humana, HTTPS, ambientes/segredos separados, banco/mídia privados, sem cache compartilhado de dados pessoais e com restauração de backup comprovada; um evento sintético percorre outbox, worker e reserva mínima.
- [ ] O livro razão distingue valores realizados, comprometidos, reservados, não faturados e custos externos; novas ações falham fechadas no teto de R$ 500 ou no limite aprovado da categoria.
- [ ] Reserva, reconciliação, liquidação e liberação autorizada são duráveis, auditáveis e idempotentes, inclusive sob concorrência, duplicatas, estados desconhecidos e tentativas limitadas.
- [ ] Operações consegue ler snapshot de saldo, bloqueios e alertas acionáveis por casos públicos; este épico não é dono de interface de operador.
- [ ] Cobranças reais, geração por IA e uso de fotos reais continuam desativados até aprovação de fornecedores, políticas, custos por categoria e operação.

## Boundaries

- Dono: módulo Orçamento e infraestrutura compartilhada (aplicação, worker, eventos, configurações e observabilidade mínima).
- Fornece casos públicos de reserva, reconciliação, liberação autorizada, snapshot e avisos acionáveis aos módulos consumidores.
- Retratos é dono dos estados de geração/prévia/entrega; Pedidos/Pagamentos é dono de pedidos e cobranças; Operações é dona da interface e das ações dos sócios.
- A reserva sintética do demo não representa custo realizado. Custos reais de hospedagem entram na categoria aprovada e no limite total.

## References

- `../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md` (CAP-7)
- `../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` (AD-1, AD-3, AD-6, AD-8 e fronteiras modulares)
- `../prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md`
- `../ux-ensaios-ia-whatsapp/EXPERIENCE.md` (`visao-operacional`)

## Notes

- O épico é sequenciado primeiro para que os outros domínios integrem-se aos contratos reais de orçamento e eventos; as dependências de histórias serão fixadas quando cada épico for iniciado.
- Antes de provisionar a primeira história, os sócios aprovam e registram as opções e termos de hospedagem/região, persistência/fila/migrações, limites por categoria e regra de liberação; só então o operador provisiona e implanta o tracer.
- A primeira história fica restrita a um tracer sintético em produção: HTTPS, segredos fora do código e acesso restrito, sem entrada real do WhatsApp nem dados pessoais; a história seguinte estabelece CI e verifica os controles completos de AD-8 e restauração antes de qualquer uso com dados pessoais.

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

- Decision (2026-10-20): Railway foi escolhida para app, worker e PostgreSQL; pg-boss usa PostgreSQL sem Redis; objetos usam Railway Bucket privado. Serviços em US East/Virgínia e Bucket em IAD. Os tetos de custo por categoria foram aprovados e estão em AD-6/PRD; as duas contas individuais de Isaac e seu sócio são admins com MFA e auditoria.
- Sequence gate: este épico não está listado no índice oficial `../tickets.toml`. O épico oficial Orçamento do piloto e política de dados (ID 2) vem depois de `epic-platform-foundation`; a história 1.5 (restauração de backup) e a 1.6 (implantação de app/worker em produção) pertencem à base de plataforma. Não provisionar nem executar tracer em produção antes de 1.6. Harmonizar o ticket candidato e suas dependências pelo fluxo de tickets antes de iniciar este épico.
- A implantação e o tracer usam somente dados sintéticos, sem WhatsApp real nem fotos. Manter a base enquanto épicos dependentes a utilizarem; após aceite, remover fixtures sintéticas e conservar evidência operacional não pessoal.
- Open gate: confirmar retenção/exclusão, segurança de criptografia do Railway Bucket e termos de transferência para os EUA antes de armazenar ou processar fotos reais. A região do Bucket não pode ser alterada após criação.

---
title: 'Implementar o Epic 4: Pedidos e pagamento Pix'
type: 'feature'
ticket: ''
created: '2026-10-28'
status: 'built'
baseline_revision: 'd07210de39e8e769aee567989336e876a98219ab'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 2
context:
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-orders-pix/epic-orders-pix.md'
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-orders-pix/tickets.toml'
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Orders/Payments não existe; o produto não consegue criar Pix verificável nem autorizar fulfillment de forma durável e sem duplicidade.

**Approach:** Implementar as sete histórias do Epic 4 com catálogo sintético, AbacatePay Dev mode, eventos autenticados e autorização durável. Pix real exige gates aprovados e reserva idempotente de prontidão de Retratos por pedido/pacote.

## Boundaries & Constraints

**Always:** Um pedido não conciliado por cliente; usar casos públicos de Budget; conferir pedido/conta/valor/moeda; exigir reserva pública de prontidão por pedido/pacote antes de Pix real; validar secret e HMAC do corpo bruto; deduplicar evento; persistir confirmação e autorização atomicamente. Só horário autenticado dentro da validade autoriza; pagamento tardio ou sem horário confiável é exceção. Consumir a reserva uma vez e mantê-la até estado terminal e conciliação; vencimento sozinho não a libera.

**Never:** Integrar WhatsApp ou imagens reais; publicar preço hipotético; armazenar payload bruto/segredos; habilitar Pix real sem aprovação de oferta, retenção, Budget, prontidão do Epic 6 e operação.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pedido repetido | Mesma chave e dados | Mesmo pedido/total; uma pendência por cliente | Dados conflitantes retornam conflito |
| Pix sandbox | Pedido sintético e Budget permite | Salva QR/copia-e-cola e validade sem WhatsApp | Timeout não cria segunda cobrança |
| Prontidão negada | Reserva ausente/falsa/desconhecida ou de outro pedido | Pix real bloqueado | Erro do caso público falha fechado |
| Webhook | Assinatura válida, evento único e pagamento compatível | Confirma e autoriza uma vez só com horário confiável na validade | Duplicado retorna 2xx; divergente/tardio/sem horário vira exceção; inválido retorna 401 |
| Produção | Oferta, saldo, retenção, prontidão ou operação pendente | Nenhuma chamada real ao provedor | Mantém gate desligado |

</frozen-after-approval>

## Code Map

- `src/modules/budget/use-cases.ts`, `src/contracts/budget/v1.ts` — `reserveAction`/`recordExposure`; custo ou saldo desconhecido bloqueia.
- `src/adapters/postgres/budget-repository.ts`, `src/adapters/postgres/runtime.ts` — DDL, Pool, transações; não ampliar tabelas de Budget.
- `src/modules/platform-smoke/`, `src/adapters/postgres/smoke-repository.ts` — separação de camadas e idempotência durável; não copiar o domínio Smoke.
- `src/adapters/http/staging-auth.ts`, `production-traffic-gate.ts`, `src/proxy.ts` — auth interna, gates e allowlist; webhook usa auth própria do provedor.
- `src/modules/data-policy/policy-v1.ts` (`payment_records`) — retenção local Pix não aprovada; produção deve continuar fechada.
- Epic 4 tickets, arquitetura e Epic 6 — sete histórias; Budget 2.4 concluída; AD-10 precisa definir prontidão pública, pois Retratos não tem módulo nesta base.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/orders-payments/v1.ts`, `src/contracts/portrait-readiness/v1.ts`, `src/modules/orders-payments/` — contratos tipados e casos públicos; sem dependência de Next.js/SDK.
- [x] `src/adapters/postgres/orders-payments-repository.ts` — estado mínimo durável; pedido, evento, reserva e autorização idempotentes, com confirmação atômica.
- [x] src/modules/orders-payments/use-cases.ts, src/adapters/postgres/orders-payments-repository.ts, src/adapters/http/orders-payments-handler.ts, reconciliation routes — preflight mode credentials/account before any Budget, readiness, or attempt write; add authenticated, idempotent reconciliation using evidence references; confirm only a matching payment with a trusted in-window timestamp, close/release readiness only after provider terminality and reconciliation, and quarantine/close orphan events without fulfillment authorization.
- [x] `src/adapters/abacatepay/pix-gateway.ts`, `src/adapters/http/orders-payments-handler.ts` — API v2/Dev mode; Budget antes de ação externa e prontidão antes de Pix real.
- [x] `src/adapters/http/abacatepay-webhook-handler.ts`, `src/app/api/webhooks/abacatepay/route.ts`, `src/proxy.ts` — validar secret/HMAC raw, limitar corpo, deduplicar e liberar somente a rota de webhook.
- [x] `src/adapters/http/production-traffic-gate.ts`, arquitetura e envelope Epic 6 — gates desligados por padrão e contrato AD-10 de prontidão pública. `.env.example` mantém somente placeholders locais sem credenciais de provedor; configuração e flags ausentes falham fechadas.
- [x] `tests/orders-payments*.test.mjs`, `docs/abacatepay-orders-payments.md` — cobrir exceções/tracer sintético e documentar setup, retenção pendente e procedimento sandbox sem segredos.

**Acceptance Criteria:**
- Given chave repetida e dados iguais, when criar pedido, then retorna o mesmo; dados divergentes conflitam e um cliente não ganha segunda pendência.
- Given pedido sintético e Budget disponível, when criar Pix Dev mode, then salva instruções/validade sem WhatsApp.
- Given prontidão ausente/indisponível/desconhecida, when criar Pix real, then bloqueia; reserva permanece até terminalidade e conciliação.
- Given webhook assinado e pagamento correspondente com horário confiável na validade, when processado, then confirma e emite uma autorização consumindo a mesma reserva.
- Given evento inválido, repetido, divergente, tardio ou sem timestamp confiável, when recebido, then não autoriza automaticamente e deixa exceção recuperável.
- Given a payment exception, when an authorized operator submits stable reconciliation evidence, then only a matching terminal payment with a trusted in-window timestamp creates one authorization; an unpaid/refunded payment closes and releases readiness only after reconciliation.
- Given provider mode credentials or account configuration are missing, when Pix is requested, then block before Budget, readiness, attempt persistence, and provider calls.
- Given a signed event with no matching payment attempt, when acknowledged, then preserve normalized event fields in an authenticated quarantine; terminal reconciliation can close it but never create a fulfillment authorization.
- Given qualquer gate de produção ausente, when solicitar Pix real, then bloqueia antes de AbacatePay; E2E sintético conclui sem canal, dinheiro ou imagem real.

## Implementation Notes

- O índice de cliente único cobre `pending_payment` e `payment_exception`; uma exceção aberta bloqueia outro pedido até reconciliação.
- Mode, chave de API e conta AbacatePay são verificados antes de reservar Budget/prontidão ou gravar tentativa. Tentativa existente é lida primeiro para preservar idempotência e instruções em replay.
- Budget reserva a ação antes da prontidão; uma negação de Budget não cria reserva de Retratos. Se a prontidão negar, a reserva Budget usa o mesmo ID estável em retentativa e continua conservadora até ação ou conciliação operacional.
- Webhook trava pedido e tentativa na mesma ordem usada pela reconciliação. O consumo da prontidão ocorre dentro da transação durável; falha reverte o evento para retry. Consumo/liberação externa são repetíveis por IDs estáveis.
- O endpoint de reconciliação valida schema estrito, autentica com o segredo interno de staging e fica oculto em produção. Guarda decisão/evidência tipada, nunca payload bruto; confirmação emite autorização/outbox atomicamente e encerramento libera prontidão só após terminalidade e reconciliação.
- Para `close_unpaid` em produção, reconciliação e outbox de liberação são gravados na mesma transação; o serviço externo só é chamado depois do commit. Falha deixa o outbox pendente; repetir o mesmo ID e payload retoma a liberação idempotente.
- O webhook limita a leitura do corpo a 64 KiB antes de parsear e valida HMAC sobre os bytes recebidos. O contrato específico do evento AbacatePay ainda precisa de captura assinada em Dev mode.
- `paidAt` ausente, inválido ou não canônico é normalizado como não confiável (`null`), persistido como exceção e nunca substituído pelo horário de recebimento.
- Eventos autenticados sem tentativa guardam somente campos normalizados em quarentena consultável por staging; decisão terminal idempotente fecha o órfão sem associá-lo a pedido nem autorizar fulfillment.
- O contrato `portrait-readiness/v1` implementa a fronteira AD-10; o port runtime de Epic 6 não existe nesta base, então produção segue bloqueada. Nenhuma credencial ou flag de provedor foi adicionada ao `.env.example`.

## Plan Change Log

- 2026-10-29 review loopback: preflight provider mode/account credentials before Budget or attempt writes; add authenticated, idempotent payment-exception reconciliation; and make readiness consumption/release recoverable with the durable decision. The prior plan required recoverable exceptions but specified no transition, which stranded paid or uncertain orders. Keep synthetic-only identities/offers, Budget-before-provider reservation, raw-body HMAC, webhook dedupe, one durable authorization, and production gates closed.

## Review Triage Log

- quick finding 1 — maybe-false (high, unverified), defer: official webhook docs show the v2 envelope but the reviewed evidence does not establish the transparent.completed data shape; a captured signed Dev-mode event or event-specific schema would settle whether the current normalizer rejects valid events.
- quick finding 2 — medium, patch: missing mode key throws inside gateway.create after the attempt and Budget reservation are durable; the catch marks the provider outcome uncertain although no provider request was sent.
- quick finding 3 — high, bad_plan: mismatched, late, and untrusted events persist terminal exception states, with no authorized reconciliation transition; this plan revision defines one.
- quick finding 4 — medium, patch: readiness is consumed before the repository locks and commits payment/authorization, so a concurrent conflicting event can consume the reservation without creating authorization.
- quick review round 2 finding 1 — medium, patch: Budget denial after readiness reservation could strand readiness without a payment attempt; reorder Budget before readiness and cover both denials before provider/attempt writes.
- quick review round 2 finding 2 — medium, patch: unmatched signed events were acknowledged but stored without normalized payment references or a closure path; quarantine normalized fields and add staging-authenticated list/close flow that never authorizes fulfillment.
- quick review final finding 1 — medium, maybe-false/unverified, defer: official docs establish the v2 envelope and state that 4xx responses are not retried, but do not establish the `transparent.completed` event-specific fields. Require one signed Dev-mode capture before treating provider webhook acceptance as operationally verified.
- quick review final finding 2 — medium, patch: malformed non-empty `paidAt` was rejected before persistence; normalize it to untrusted time and persist the exception without authorization.
- quick review postfix finding 1 — medium, patch: closing an unpaid production order released readiness before the reconciliation transaction committed; persist the terminal decision and release outbox atomically, then dispatch after commit and retry pending release through the same reconciliation request.

## Design Notes

AbacatePay documenta criação/consulta Pix, simulação só em Dev mode, secret na URL e HMAC-SHA256 do corpo bruto; deduplicar o ID antes de 2xx. Não documenta `paidAt`: sem timestamp verificável, aplicar a exceção aprovada. Reserva de prontidão por pedido/pacote é idempotente, consumida uma vez e retida até terminalidade/conciliação. Cobrança real fica fechada enquanto Data Policy e Epic 6 não oferecerem aprovação/porta.

## Verification

**Commands:**
- `npm test` — passou: build Next.js/TypeScript e 110 testes (110 passaram).
- `npm run build` — executado por `npm test`; aplicação e rotas de reconciliação compilam.
- `git diff --check` — passou sem erros.
- Integração com PostgreSQL real não foi executada; a DDL do outbox e as transações foram compiladas, mas precisam de validação de runtime com o banco.
- O contrato exato de `transparent.completed` segue pendente de captura assinada em Dev mode e permanece como trabalho diferido; produção continua fechada.

---
title: "Conciliar custos e liquidar ou liberar reservas"
type: feature
ticket: 5
created: 2026-10-25
status: built
baseline_revision: b37d0b213bd13e04aa78e09bb8c4b6dd74913d77
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - ../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md
  - ../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
  - story-expandir-ledger-e-limites-do-piloto-plan.md
  - story-formalizar-contratos-publicos-e-fixtures-de-budget-plan.md
---

<frozen-after-approval reason="conciliação idempotente e autoridade de dois sócios já aprovadas">

## Intent

**Problem:** Reservas do ledger não podem ser encerradas com evidência: custos externos, pendentes e não faturados não convergem, e não há registro de quem autorizou liquidação ou liberação.

**Approach:** Persistir reconciliações sintéticas/manual/externas com estado de terminalidade, custo conhecido ou desconhecido e evidência. Uma reserva só muda após reconciliação terminal e autorização de um sócio administrador; liquidação move o custo final para incorrido/não faturado, liberação exige evidência de custo final zero. Registrar ator, motivo e horário na mesma transação. Reconciliar saldo inicial por categoria sem assumir zero.

## Boundaries & Constraints

**Always:** Manter custo/saldo desconhecido separado de zero; aceitar custos em BRL para decisões e tratar outras moedas como desconhecidas até haver conversão documentada. Distinguir fonte externa, custo confirmado, pendente e não faturado. Usar chave estável, transação e auditoria idempotentes. A autorização identifica Isaac ou o sócio por um verificador injetado; sem verificador/autorização, negar. Um único administrador autorizado pode decidir.

**Never:** Liquidar/liberar só porque um pedido cliente ou modelo afirmou terminalidade; usar custo pendente/desconhecido como pago ou liberável; apagar a reserva sem transição auditada; habilitar integrações reais, cobrar ou mudar Railway.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior |
|----------|--------------|-------------------|
| Sem terminalidade | Reserva ativa e reconciliação pendente/desconhecida | Não liquida nem libera; mantém reserva |
| Custo sem prova/conversão | Fonte externa, valor desconhecido ou moeda sem FX comprovado | Permanece desconhecido e bloqueado |
| Custo final conhecido | Reserva ativa, terminal, valor BRL confirmado ou não faturado e admin autorizado | Liquida uma vez e transfere o valor para o estado correto |
| Liberação | Reserva ativa, terminal e custo conciliado exatamente zero | Libera uma vez e audita ator, motivo e horário |
| Sem autorização | Admin inválido, ausência do verificador ou motivo ausente | Nega antes da mutação |
| Repetição | Mesma chave e mesmo conteúdo | Retorna decisão original sem duplicar exposição/auditoria |
| Chave reutilizada | Mesmo ID com payload/ator/motivo diferente | Rejeita conflito sem alterar ledger |
| Saldo inicial | Evidência completa por categoria ou fonte ainda pendente | Só marca saldo conhecido com evidência completa; faltantes permanecem desconhecidos |

</frozen-after-approval>

## Code Map

- `src/contracts/budget/v1.ts` — acrescentar schemas/guards de reconciliação, evidência do saldo inicial e decisão administrativa; reutilizar os tipos de custo/exposição.
- `src/modules/budget/repository.ts` e `use-cases.ts` — ampliar a porta Budget; o caso de uso valida contratos e nega por padrão sem callback autorizador.
- `src/adapters/postgres/budget-repository.ts` — reutilizar `lockBudgetLedger`; criar reconciliação/auditoria e consolidar baseline ou reserva+exposição na mesma transação.
- `tests/fixtures/budget/memory-repository.mjs` e `tests/budget-reconciliation.test.mjs` — exercitar estados, autorização e repetição sem banco/Railway.
- `tests/budget-ledger.test.mjs` — preservar limites e verificar que custos liquidados entram no saldo; arquitetura AD-6/AD-7 define autoridade e auditoria.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/budget/v1.ts` — validar contratos estritos para evidência terminal/pending, BRL conhecido/desconhecido, saldo inicial completo e decisão auditável.
- [x] `src/modules/budget/repository.ts`, `use-cases.ts` — adicionar conciliação e decisão idempotentes; exigir motivo, ator autorizado e evidência; negar ausência/erro do autorizador.
- [x] `src/adapters/postgres/budget-repository.ts` — persistir reconciliações/auditoria; liquidar ou liberar e inserir exposição atomicamente; conciliar baseline somente com os quatro estados e evidência.
- [x] `tests/fixtures/budget/memory-repository.mjs`, `tests/budget-reconciliation.test.mjs` — cobrir custo pendente/desconhecido/externo/não faturado, terminalidade, zero, admin, repetição/conflito e baseline parcial.
- [x] `tests/budget-ledger.test.mjs` — provar que reserva ativa sai do comprometido apenas ao ser liquidada/liberada e custo real excedente permanece contabilizado.

**Acceptance Criteria:**
- Given conciliação pendente/desconhecida ou estado não terminal, when settle/release, then reserva fica ativa e custo desconhecido não vira pago/liberável.
- Given custo terminal conciliado e admin autorizado, when liquidar/liberar, then a transição e a auditoria (ator, motivo, horário) são atômicas e idempotentes.
- Given custo final positivo, when liquidação, then contabiliza o valor real conhecido, inclusive se diferir da reserva; custo não faturado permanece nessa categoria.
- Given um saldo inicial incompleto, when reservar, then as categorias sem evidência continuam desconhecidas e falham fechado.

## Implementation Notes

Conciliações terminais exigem evidência compatível com a fonte e custo BRL conhecido para liquidar; liberar exige custo final comprovado em zero. Decisões autorizadas gravam auditoria e transição na mesma transação. Baselines só ficam conhecidos quando os quatro estados têm valores e evidência, e a conciliação que pode liberar novas reservas também exige o callback administrativo.

## Plan Change Log

## Review Triage Log

- **medium — patch** — `src/adapters/postgres/budget-repository.ts` — Verified: `recordExposure` writes an exposure counted by `loadBudgetLedgerState`, then settlement inserts the entire reconciliation amount for the same action, so an already-recorded confirmed charge is counted twice. Patch completed: settlement moves existing action exposures to the final billing state and adds only the remaining amount; the overage conflict stays blocked. Synthetic test coverage passes.
- **medium — patch** — `src/adapters/postgres/budget-repository.ts` — Verified: blocked authorized results return before inserting `budget_reservation_decisions`; the same `decisionId` can later settle after state changes or be reused with a changed payload. Patch completed: blocked outcomes are persisted for replay/conflict, while a new decision ID may retry until success. Synthetic tests cover replay, conflict, and retry.

## Design Notes

O adapter futuro de identidade fornecerá o callback de autorização para os dois sócios; este módulo recebe apenas `actorId` validado, nunca confia em uma flag enviada pelo cliente. O início sem evidência mantém os cinco baselines desconhecidos. O caso de custo final acima da reserva registra o custo conhecido integral e deixa novas reservas sujeitas aos limites atuais; não esconde a cobrança já ocorrida.

## Verification

**Commands:**
- `npx next build --webpack` — passou; compilação Webpack e otimização concluídas usando bindings WASM.
- `npx tsc -p tsconfig.worker.json` — passou.
- `node --test tests/budget-reconciliation.test.mjs tests/budget-ledger.test.mjs tests/budget-contracts.test.mjs` — passou, 22/22.
- `npm run check:boundaries` — passou.

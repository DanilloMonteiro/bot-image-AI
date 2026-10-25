---
title: "Expandir a reserva para o ledger e os limites do piloto"
type: feature
ticket: 4
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
  - story-formalizar-contratos-publicos-e-fixtures-de-budget-plan.md
---

<frozen-after-approval reason="caps e fail-closed aprovados pelo proprietário">

## Intent

**Problem:** O tracer só reserva um centavo sintético; não há ledger que aplique os tetos aprovados nem impeça duplicidade ou sobrealocação.

**Approach:** Registrar exposições incorridas, comprometidas, reservadas e não faturadas. Reservar por `actionId` estável em BRL, sob teto total e de categoria, em uma transação atômica. Saldo, custo ou câmbio desconhecido bloqueia gasto; o tracer permanece sintético.

## Boundaries & Constraints

**Always:** Tetos: R$500 total; anúncios R$220; IA R$110; Railway R$65; domínio/acessórios R$25; Meta/Pix/câmbio/retentativas R$80. Somar os quatro estados na exposição. Reservar o custo conhecido de todas as tentativas finitas, sem overflow. Não transferir saldo entre categorias. Usar PostgreSQL/idempotência.

**Never:** Tratar ausente como zero, inferir câmbio, usar preços de venda hipotéticos, exceder limites, contar o tracer como gasto real, chamar provedores/cobrar, mudar Railway ou assumir saldo inicial zero antes de reconciliar fontes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior |
|----------|--------------|-------------------|
| Reserva válida | Saldo conhecido; custo BRL conhecido | Reserva única inclui todas as tentativas limitadas |
| Custo/saldo desconhecido | Custo, câmbio ou saldo não confirmado | Bloqueia; preserva motivo/estado, sem zero padrão |
| Limite | Reserva excede teto de categoria ou R$500 | Bloqueia sem transferir saldo |
| Concorrência | Reservas juntas excederiam limite | Serializa; não permite sobrealocação |
| Idempotência | Mesmo `actionId`; payload repetido/divergente | Mesmo payload converge; payload divergente é rejeitado |
| Exposições | Evento estável em qualquer dos quatro estados | Conta uma vez contra categoria e total |
| Tracer | Evento sintético já suportado | Mantém uma reserva sem despesa externa real |

</frozen-after-approval>

## Code Map

- `src/modules/budget/repository.ts`, `use-cases.ts` — domínio atual limita-se ao tracer; preservar a porta e acrescentar reserva genérica.
- `src/adapters/postgres/budget-repository.ts` — DDL inline, transações e `ON CONFLICT`; persistir ledger/lock aqui sem mudar Railway/pg-boss.
- `src/contracts/budget/v1.ts`, `tests/fixtures/budget/v1.mjs` — reaproveitar contratos e categorias da 2.3.
- `src/contracts/platform-usage/v1.ts` — custo opcional deve continuar desconhecido, nunca zero.
- `src/worker/index.ts`, handlers de Budget e rota `src/app/api/internal/budget/trace/route.ts` — preservar o tracer sem criar operação paga.
- `tests/platform-smoke.test.mjs`, `tests/budget-contracts.test.mjs` — regressões/idempotência existentes.
- Arquitetura AD-3/AD-6, spec CAP-7 e `tickets.toml` — estados, limites e regras aprovadas.

## Tasks & Acceptance

**Execution:**
- [x] Expandir `src/modules/budget/` para reserva genérica e registro de exposições tipadas.
- [x] Persistir ledger e checagem de saldo em transação serializada; saldo sem conciliação começa desconhecido.
- [x] Reusar/estender contratos v1 sem quebrar consumidores da 2.3.
- [x] Criar `tests/budget-ledger.test.mjs` com fixtures sintéticas para quatro estados, limites, desconhecidos, repetição e concorrência.
- [x] Preservar tracer e verificar tentativas limitadas/aritmética segura.

**Acceptance Criteria:**
- Given saldo e custo BRL conhecidos, when reserva, then as quatro exposições são representadas e todas as tentativas são cobertas.
- Given concorrência, repetição ou limite excedido, when reserva, then não há duplicidade/sobrealocação e nenhum saldo muda de categoria.
- Given custo, câmbio ou saldo desconhecido, when reserva paga, then bloqueia sem coerção permissiva.
- Given somente eventos sintéticos, when testes executam, then não ocorre chamada real/cobrança e o tracer segue idempotente.

## Implementation Notes

## Plan Change Log

## Review Triage Log

- **false** — `src/modules/budget/use-cases.ts` — O bloqueio preserva `status: 'blocked'` e o motivo estável `unknown_cost`, como pede a matriz; ela não exige ecoar o texto interno de `BudgetCostV1.reason` no resultado público.

## Design Notes

Sem linhas conciliadas, o saldo é desconhecido; a story 2.5 fornece a reconciliação. O domínio mantém a fonte única dos tetos; o banco serializa reservas do total e a chave única impede duplicidade. IDs não contêm dados pessoais.

## Verification

**Commands:**
- `npx next build --webpack` — passou; o build padrão não funciona neste Windows porque o Turbopack requer bindings SWC nativos ausentes.
- `npx tsc -p tsconfig.worker.json` — passou.
- `node --test tests/budget-ledger.test.mjs` — 7/7 passaram.
- `node --test tests/budget-contracts.test.mjs` — 6/6 passaram.
- `node --test tests/platform-smoke.test.mjs` — 24/24 passaram.
- `npm run check:boundaries` — passou.

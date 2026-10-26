---
title: "Fornecer snapshot de orçamento para Operações"
type: feature
ticket: 6
created: 2026-10-25
status: built
baseline_revision: 98450a087cfb5b786e06e9eb2be2304b1a672aa8
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - ../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md
  - ../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
  - ../prd-ensaios-ia-whatsapp/addendum.md
  - ../ux-ensaios-ia-whatsapp/EXPERIENCE.md
  - story-expandir-ledger-e-limites-do-piloto-plan.md
  - story-conciliar-custos-e-liquidar-ou-liberar-reservas-plan.md
---

<frozen-after-approval reason="limiares e economia ilustrativa já constam das decisões aprovadas">

## Intent

**Problem:** Operações não consegue ler num contrato estável o estado financeiro autoritativo, os bloqueios de gasto ou o avanço dos alertas do piloto.

**Approach:** Estender o snapshot somente leitura do Budget com alertas derivados dos quatro estados financeiros, bloqueios explicados e a única hipótese de margem documentada para cinco imagens. Manter os valores desconhecidos como desconhecidos e marcar toda economia como ilustrativa.

## Boundaries & Constraints

**Always:** Calcular consumo pela soma de incorrido, comprometido, reservado e não faturado; limiares são 60%, 80% e 95% do teto total e de cada categoria capped. Quando qualquer parcela necessária é desconhecida, alertas e disponibilidade daquele escopo ficam desconhecidos. Mostrar bloqueios apenas quando derivados do ledger (saldo não reconciliado ou limite esgotado). Identificar a margem de cinco imagens como hipótese, com premissas e CAC documentados.

**Never:** Alterar ledger, reconciliação, reservas, tetos ou dados de custo para compor leitura; inferir zero, custo ou alerta com saldo desconhecido; calcular margens para pacotes sem custos documentados; tratar preço/margem como oferta; criar estado de pausa ou sinais ainda não persistidos; implementar a interface de Operações.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior |
|----------|--------------|-------------------|
| Saldo desconhecido | Uma categoria ou parcela necessária está desconhecida | Preserva unknown; seus limiares são unknown e há blocker `balance_unknown` |
| Alertas | Consumo abaixo, exatamente em ou acima de 60/80/95% | Emite os 3 limiares por total/categoria; reached apenas no limiar atingido |
| Teto atingido | Exposição igual/acima do teto | Mostra blocker total/categoria e mantém o consumo real, mesmo se available for zero |
| Saldo disponível | Saldos conhecidos e abaixo do teto | Não inventa blocker; mantém os quatro estados separados |
| Economia ilustrativa | Hipótese do pacote de cinco imagens e cenários de CAC do addendum | Retorna valores calculados e fonte, sempre rotulados como hipótese |
| Leitura | Chamar snapshot repetidamente | Produz leitura consistente sem alterar entradas ou baselines do ledger |

</frozen-after-approval>

## Code Map

- `src/contracts/budget/v1.ts` — `BudgetReadSnapshotV1` e `isBudgetReadSnapshotV1` atualmente validam só saldos; estender o contrato versionado com alertas, blockers e hipótese de margem.
- `src/modules/budget/use-cases.ts` — `Budget.readBudgetSnapshot()` encaminha a leitura; compor aqui a projeção derivada, sem mutação.
- `src/modules/budget/repository.ts` — a porta atual retorna o snapshot-base; separar o estado do ledger da projeção completa consumida por Operações.
- `src/adapters/postgres/budget-repository.ts` — `loadBudgetLedgerState` e `toBudgetReadSnapshot()` já agregam quatro estados, caps e unknown numa transação consistente; manter essa fonte autoritativa e somente leitura.
- `src/modules/budget/limits.ts` — tetos aprovados em centavos; não duplicar nem recalcular limites em outra configuração.
- `tests/fixtures/budget/memory-repository.mjs`, `tests/fixtures/budget/v1.mjs`, `tests/budget-ledger.test.mjs`, `tests/budget-contracts.test.mjs` — adapters/fixtures sintéticos e consumidores atuais a estender; novo `tests/budget-snapshot.test.mjs` cobre thresholds, blockers, hipótese e ausência de mutação.
- PRD addendum, § “Simulação econômica ilustrativa”, e `EXPERIENCE.md#visao-operacional` — única hipótese calculável: 5 imagens a R$39,90, custos variáveis R$12,90, contribuição R$27 antes do CAC e R$19/R$12/R$5 após CAC de R$8/R$15/R$22. Não há custos para calcular pacotes de 1 ou 10 imagens.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/budget/v1.ts` — definir o snapshot-base interno e os tipos/guards estritos para alertas, blockers e margens hipotéticas.
- [x] `src/modules/budget/snapshot.ts` — projetar alertas com aritmética inteira a partir dos quatro estados e montar blockers e economia documentada sem tocar no ledger.
- [x] `src/modules/budget/repository.ts`, `use-cases.ts`, `src/adapters/postgres/budget-repository.ts` — separar a leitura-base da projeção consumível e manter agregação PostgreSQL consistente e sem escrita.
- [x] `tests/fixtures/budget/memory-repository.mjs`, `tests/fixtures/budget/v1.mjs`, `tests/budget-contracts.test.mjs` — atualizar repositório, fixture e validação do consumidor.
- [x] `tests/budget-snapshot.test.mjs`, `tests/budget-ledger.test.mjs` — verificar limites exatos e desconhecidos, bloqueios, valores de margem documentados e que snapshot não altera entradas/baselines.

**Acceptance Criteria:**
- Given qualquer uma das cinco categorias capped e o total, when consumo cruza 60/80/95%, then o snapshot mostra cada limiar correto a partir da soma dos quatro estados.
- Given saldo desconhecido ou limite esgotado, when Operações lê o snapshot, then recebe o blocker e motivo correspondente sem transformar unknown em zero.
- Given custos abaixo do limite, when o snapshot é lido, then quatro estados continuam distintos e não há blocker inventado.
- Given os dados econômicos do addendum, when o snapshot é projetado, then mostra contribuição de R$27 antes do CAC e R$19/R$12/R$5 nos três cenários, como hipóteses explícitas.
- Given leituras repetidas, when consumidores leem o contrato, then ledger e baselines permanecem inalterados.

## Implementation Notes

O adapter agora retorna apenas `BudgetLedgerSnapshotV1`; o caso de uso projeta alertas, blockers e a hipótese estática sem tocar no ledger. A ocupação usa a soma não truncada dos quatro estados e comparação inteira. A simulação econômica permanece fixa aos valores documentados para cinco imagens.

## Plan Change Log

## Review Triage Log

Quick review: no findings.

## Design Notes

A ocupação é `sum(estados) / cap`, comparada com cada percentual por inteiros para não perder precisão; não usar `available`, que é truncado a zero quando há excesso. Blockers do snapshot são só os derivados do saldo agregado. `unknown_cost` de uma ação e pausas não persistidas não podem ser inferidos; sinais acionáveis pertencem à story 2.7. A hipótese usa apenas o pacote de cinco imagens documentado.

## Verification

**Commands:**
- `npx next build --webpack`
- `npx tsc -p tsconfig.worker.json`
- `node --test tests/budget-snapshot.test.mjs tests/budget-ledger.test.mjs tests/budget-contracts.test.mjs`
- `npm run check:boundaries`

**Results:** All commands passed. The Next.js build used WASM bindings because native SWC was unavailable. Budget tests: 22 passed, 0 failed.

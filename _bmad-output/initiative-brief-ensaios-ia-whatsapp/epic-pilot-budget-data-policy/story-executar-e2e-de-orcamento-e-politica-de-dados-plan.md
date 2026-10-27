---
title: "Executar E2E de orçamento e política de dados"
type: feature
ticket: 9
created: 2026-10-26
status: done
baseline_revision: fc8b1072045bf608250c760d220fc3d954a63e7b
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - ../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md
  - tickets.toml
  - story-percorrer-o-tracer-sintetico-ate-uma-reserva-budget-plan.md
  - story-aprovar-e-versionar-a-politica-de-dados-plan.md
  - story-formalizar-contratos-publicos-e-fixtures-de-budget-plan.md
  - story-expandir-ledger-e-limites-do-piloto-plan.md
  - story-conciliar-custos-e-liquidar-ou-liberar-reservas-plan.md
  - story-fornecer-snapshot-de-orcamento-para-operacoes-plan.md
  - story-sinalizar-e-recuperar-trabalho-de-orcamento-plan.md
  - story-fazer-refactor-sweep-dos-modulos-budget-e-data-policy-plan.md
---

<frozen-after-approval reason="ticket 2.9, AD-3/AD-6/AD-8 e decisões do proprietário para fluxo apenas sintético">

## Intent

**Problem:** Os componentes de tracer, ledger/reconciliação/recuperação e gate de Data Policy têm cobertura individual, mas falta uma suíte de integração que percorra o fluxo Budget sintético e confirme que a política continua bloqueando qualquer coleta/processamento não liberado.

**Approach:** Compor os handlers de tracer web e worker com o caso de uso Budget e seu repositório em memória; percorrer limites, custo/saldo desconhecido, conciliação, snapshot e retomada com IDs sintéticos. Exercitar `decideDataUse` nas fronteiras de coleta e processamento e provar que callbacks de provedor permanecem intocados enquanto os gates estão pendentes.

## Boundaries & Constraints

**Always:** Usar apenas `Request` em memória, fixtures sem dados de cliente e o repositório Budget sintético. Validar idempotência/concorrência, valores BRL inteiros, custo/saldo desconhecido, bloqueios por limites, evidência/decisão terminal, snapshot e replay de retomada. A política aprovada pode ser lida, mas ações com requisitos operacionais pendentes continuam bloqueadas. Manter o teste isolado do smoke geral da plataforma.

**Never:** Conectar PostgreSQL/Railway, pg-boss, AbacatePay, WhatsApp/Meta, Google/Gemini ou serviços reais; usar fotos, conversas, pagamentos ou credenciais de cliente; chamar ações reais de coleta/processamento; alterar limites, tecnologia ou configuração Railway.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tracer sintético | Requisições concorrentes/replay com o mesmo UUID | Uma reserva de tracer e um job idempotente; worker aceita redelivery para a mesma chave | IDs/jobs divergentes falham sem duplicar estado |
| Reserva concorrente | Mesmo `actionId`, custo conhecido e saldo suficiente | Uma reserva de ledger; replays retornam a mesma identidade | Payload alterado falha em conflito |
| Limites | Categoria ou teto total esgotado | Nova reserva fica bloqueada e snapshot preserva exposição | Nenhuma transferência entre categorias |
| Custo/saldo desconhecido | Custo sem evidência ou baselines não conciliados | Falha fechada, sinal aberto, nenhuma reserva inventada | Desconhecido não vira zero nem retry faturável |
| Retomada | Saldo corrigido, mesma reserva e `resumeId` repetido | Revalida limites, reserva uma vez com o `actionId` original e reproduz o resultado | Bloqueio continua acionável; nenhuma liberação automática |
| Conciliação | Estado pendente/desconhecido, depois terminal conhecido | Reserva permanece ativa até evidência e decisão admin; snapshot reflete os estados | Tentativa não terminal fica bloqueada e auditável |
| Política ausente/não aprovada | Ação `collect` ou `process` | Decisão bloqueia e contador de callback permanece zero | Nenhum serviço/dado é chamado |
| Política aprovada sem validação operacional | Artefato canônico v2 com exclusão local pendente; v1 permanece apenas como histórico | Leitura informativa disponível; coleta/processamento bloqueados | Rejeitar v1 e snapshots injetados como não correntes |

</frozen-after-approval>

## Code Map

- `src/adapters/http/budget-trace-handler.ts` — entrada sintética com chave idempotente.
- `src/worker/budget-trace-handler.ts` — validação e leitura da reserva pelo worker.
- `src/modules/budget/use-cases.ts`, `src/modules/budget/snapshot.ts` — fluxo do ledger, limites, sinais e projeção.
- `src/modules/data-policy/use-cases.ts`, `src/modules/data-policy/policy-v2.ts` — política aprovada atual e bloqueio fail-closed; v1 fica como histórico.
- `tests/fixtures/budget/memory-repository.mjs` — persistência sintética concorrente, sem rede ou dados pessoais.
- Novo `tests/budget-data-policy-e2e.test.mjs` — composição E2E sintética de tracer, Budget e Data Policy.
- `tests/platform-smoke.test.mjs` — cobertura existente do smoke geral; fora da execução desta story.

## Tasks & Acceptance

**Execution:**
- [x] Criar suíte E2E sintética que percorra handler HTTP de tracer, repositório em memória e handler do worker com replay/redelivery.
- [x] Integrar cenários Budget para concorrência, limites por categoria/total, desconhecidos, sinais/snapshot, conciliação terminal e retomada idempotente.
- [x] Integrar gates Data Policy de coleta/processamento ausentes, não aprovados e operacionalmente pendentes, afirmando zero callbacks externos.
- [x] Executar build, compilação, suite E2E e verificações de fronteira sem rodar ou repetir o smoke geral.

**Acceptance Criteria:**
- Given o mesmo tracer sintético submetido concorrente/repetido, when web e worker processam a chave, then há uma reserva/job lógico e nenhuma duplicidade.
- Given operações de Budget sintéticas, when limites, saldo/custo desconhecido, conciliação e retomada são percorridos, then os contratos preservam exposição, bloqueio, sinal, snapshot, evidência terminal e replay sem liquidar/liberar automaticamente.
- Given política ausente, não aprovada ou com validação operacional pendente, when `collect`/`process` são solicitados, then a decisão é negada e nenhum callback de serviço é chamado.
- Given a suíte termina, when seus efeitos são inspecionados, then nenhum banco externo, serviço de provedor, dado de cliente ou configuração de plataforma foi usado.

## Implementation Notes

- A nova suíte compõe os handlers HTTP/worker com `createMemoryBudgetRepository` e testa custos/identificadores sintéticos; nenhum adapter PostgreSQL ou provedor é iniciado. A política atual é v2; v1 e snapshots injetados são rejeitados como não correntes.
- Os cinco cenários E2E cobrem tracer/concurrency/redelivery, limites e desconhecidos, retry, conciliação terminal com decisão admin e bloqueios Data Policy.

## Plan Change Log

- 2026-10-26: added integrated synthetic tracer/Budget/Data Policy suite; no production-provider or database access.
- 2026-10-27: updated the Data Policy E2E gate from the historical v1 artifact to the owner-approved v2 with local deletion pending; provider copies and region remain outside the readiness gate.

## Review Triage Log

Quick review: no findings.

## Design Notes

A suíte é in-process, mas compõe os adaptadores HTTP/worker, módulo Budget, fixture de persistência e Data Policy. A autenticação de teste usa segredo sintético local; não cria credencial persistente. Ela não é um substituto para a validação PostgreSQL/produção nem aciona serviços externos.

## Verification

**Commands:**
- `npx tsc -p tsconfig.worker.json` — compila os módulos/adaptadores para os testes.
- `node --test tests/budget-data-policy-e2e.test.mjs tests/data-policy.test.mjs tests/budget-signals.test.mjs tests/budget-ledger.test.mjs tests/budget-reconciliation.test.mjs tests/budget-snapshot.test.mjs tests/budget-contracts.test.mjs` — integração e contratos sintéticos passam.
- `npm run check:boundaries` — fronteiras continuam válidas.
- `npx next build --webpack` — build otimizado conclui.
- `git diff --check` — não há erros de whitespace.

**Results:**
- `npx tsc -p tsconfig.worker.json` — passou.
- Suíte E2E + contratos sintéticos de Budget/Data Policy — 50 testes passaram.
- `npm run check:boundaries` e `git diff --check` — passaram.
- `npx next build --webpack` — passou; Next usou o fallback WASM porque o binário nativo SWC não está instalado.

Verificação atual de fechamento em 2026-10-27: a suíte E2E e os seis arquivos complementares de Data Policy/Budget passaram com 51/51; `npx tsc -p tsconfig.worker.json`, `npm run check:boundaries`, `npx next build --webpack` e `git diff --check` passaram após o ajuste final da fixture de custo desconhecido. O fluxo permanece inteiramente sintético.

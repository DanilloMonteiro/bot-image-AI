---
title: "Fazer refactor sweep dos módulos Budget e Data Policy"
type: feature
ticket: 8
created: 2026-10-26
status: done
baseline_revision: b08beb19ef8941e5103c2711e7efbe6db81f37b6
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
  - story-aprovar-e-versionar-a-politica-de-dados-plan.md
  - story-formalizar-contratos-publicos-e-fixtures-de-budget-plan.md
  - story-expandir-ledger-e-limites-do-piloto-plan.md
  - story-conciliar-custos-e-liquidar-ou-liberar-reservas-plan.md
  - story-fornecer-snapshot-de-orcamento-para-operacoes-plan.md
  - story-sinalizar-e-recuperar-trabalho-de-orcamento-plan.md
---

<frozen-after-approval reason="ticket 2.8: limpar apenas dívida estrutural comprovada e achados adiados do Epic 2">

## Intent

**Problem:** `policy-v1.ts` e `use-cases.ts` mantêm cópias idênticas da função que congela recursivamente a política. A duplicação pode divergir e enfraquece uma garantia comum do módulo.

**Approach:** Extrair a função pura para um helper interno de Data Policy e reutilizá-la na política aprovada e nos snapshots clonados. A triagem das stories 2.2–2.7 não deixou achados adiados; os achados da 2.7 foram corrigidos. Nenhuma mudança de Budget é justificada além da preservação de seus contratos e verificações nesta limpeza.

## Boundaries & Constraints

**Always:** Preservar a semântica atual de congelamento profundo, os exports públicos, o conteúdo/versionamento da política, o bloqueio fail-closed de uso real e os contratos de Budget. Manter a direção das dependências dos módulos e usar somente fixtures sintéticas.

**Never:** Reescrever a política aprovada, mudar estado operacional ou retenção, alterar contratos/limites/ledger de Budget, tocar em chamadas reais de provedores ou configuração Railway, ou fazer um refactor amplo sem dívida comprovada.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Política canônica | `DATA_POLICY_V1` carregada | Objeto raiz, filhos e arrays permanecem congelados | Nenhum campo/conteúdo muda |
| Snapshot injetado válido | Cópia aprovada compatível | Caso de uso devolve cópia isolada e profundamente congelada | Entrada original não é congelada nem alterada |
| Política ausente/incompleta/não atual | Estados cobertos pela suíte existente | Decisão de uso continua bloqueada | Falha fechada preservada |
| Contratos do Epic 2 | Fixtures Budget e Data Policy atuais | Guards, limites, ledger, recuperação e snapshot continuam válidos | Nenhuma alteração pública |

</frozen-after-approval>

## Code Map

- `src/modules/data-policy/policy-v1.ts` — conteúdo aprovado e primeira cópia de `deepFreeze`.
- `src/modules/data-policy/use-cases.ts` — `immutableSnapshot` e segunda cópia de `deepFreeze`.
- Novo `src/modules/data-policy/deep-freeze.ts` — implementação compartilhada, privada ao módulo.
- `tests/data-policy.test.mjs` — congelamento, isolamento e gates fail-closed existentes.
- `tests/budget-contracts.test.mjs`, `tests/budget-ledger.test.mjs`, `tests/budget-reconciliation.test.mjs`, `tests/budget-signals.test.mjs`, `tests/budget-snapshot.test.mjs` — verificações de preservação dos contratos Budget.
- Planos e logs de revisão das stories 2.2–2.7 — fonte da dívida/achados considerados pelo sweep.

## Tasks & Acceptance

**Execution:**
- [x] Criar um helper puro `deepFreeze` em `src/modules/data-policy/deep-freeze.ts` com a mesma recursão e comportamento atuais.
- [x] Fazer `policy-v1.ts` e `use-cases.ts` importarem o helper; remover as cópias locais sem alterar a API.
- [x] Confirmar os gates e a imutabilidade por testes sintéticos e executar as verificações de fronteiras/compilação.

**Acceptance Criteria:**
- Given a política aprovada ou um snapshot validado, when o caso de uso o expõe, then todas as estruturas aninhadas permanecem profundamente congeladas e o snapshot injetado é isolado por cópia.
- Given os contratos do Epic 2, when a limpeza termina, then os testes de Data Policy e Budget continuam passando sem mudança de comportamento ou contrato.
- Given a triagem de dívida do Epic 2, when o sweep termina, then apenas a duplicação comprovada é alterada.

## Implementation Notes

- A implementação idêntica foi movida para `deep-freeze.ts`; os dois consumidores usam o mesmo helper e mantêm o comportamento anterior.
- Nenhum arquivo de Budget, conteúdo da política, contrato público ou decisão operacional foi alterado.

## Plan Change Log

- 2026-10-26: consolidated the identical Data Policy deep-freeze helper; no public API or Budget code changed.

## Review Triage Log

Quick review: no findings.

## Design Notes

Helper interno compartilhado; nenhuma mudança de ownership, persistência, formato de política ou comportamento operacional.

## Verification

**Commands:**
- `npx next build --webpack` — build otimizado conclui.
- `npx tsc -p tsconfig.worker.json` — worker compila.
- `node --test tests/data-policy.test.mjs tests/budget-signals.test.mjs tests/budget-ledger.test.mjs tests/budget-reconciliation.test.mjs tests/budget-snapshot.test.mjs tests/budget-contracts.test.mjs` — suites sintéticas passam.
- `npm run check:boundaries` — fronteiras continuam válidas.
- `git diff --check` — não há erros de whitespace.

**Results:**
- `npx tsc -p tsconfig.worker.json` — passou.
- 45 testes sintéticos de Data Policy e Budget passaram.
- `npm run check:boundaries` e `git diff --check` — passaram.
- `npx next build --webpack` — passou; Next usou o fallback WASM porque o binário nativo SWC não está instalado.

Verificação atual de fechamento em 2026-10-27: a suíte sintética atual de sete arquivos, incluindo a política v2, passou com 51/51; `npx tsc -p tsconfig.worker.json`, `npm run check:boundaries`, `npx next build --webpack` e `git diff --check` passaram. A revisão inclui os ajustes da v2 e não usou dados reais ou provedores.

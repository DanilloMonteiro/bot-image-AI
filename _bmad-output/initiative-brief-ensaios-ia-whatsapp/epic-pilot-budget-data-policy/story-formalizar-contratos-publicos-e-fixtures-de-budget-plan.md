---
title: "Formalizar contratos públicos e fixtures de Budget"
type: feature
ticket: 3
created: 2026-10-25
status: built
baseline_revision: b37d0b213bd13e04aa78e09bb8c4b6dd74913d77
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
  - tickets.toml
---

<frozen-after-approval reason="owner-approved epic scope; no product choice is open">

## Intent

**Problem:** O Budget ainda expõe somente uma reserva específica do tracer e não tem contratos estáveis que aplicação, worker e consumidores possam compartilhar para reservar, consultar saldos e receber sinais. O contrato de uso de plataforma já permite omitir custo, mas não há contrato comum que preserve essa ausência como desconhecida em todas as fronteiras.

**Approach:** Definir contratos públicos versionados para reserva, leitura e sinais de Budget, com valores monetários em unidades menores e estado de custo conhecido/desconhecido explícito. Fornecer fixtures sintéticas reutilizáveis por aplicação, worker e consumidor; preservar o caminho atual do tracer e sua chave idempotente. Esta story formaliza formatos, sem implementar o ledger, tetos, conciliação ou recuperação das stories seguintes.

## Boundaries & Constraints

**Always:** Manter o contrato de uso de plataforma existente e compatibilidade com a reserva sintética de 1 centavo BRL; usar `actionId` estável para idempotência; modelar custos ausentes como `unknown`, nunca como zero; manter contratos versionados e validados em tempo de execução para dados que atravessam fronteiras; cobrir fixtures de aplicação, worker e consumidor sem dados pessoais.

**Never:** Chamar provedores ou APIs reais, cobrar, ler faturas/reais saldos Railway, usar dados de clientes, aprovar estimativas comerciais, transferir limites entre categorias, implementar neste passo o ledger ou mudar configuração/tecnologia Railway.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Custo conhecido | Registro v1 com valor inteiro em unidade menor e moeda válida | Contrato válido; valor e moeda preservados | Rejeitar valor negativo, fracionário ou moeda malformada |
| Custo omitido | Registro de uso sem propriedade `cost` | Consumidor reconhece estado desconhecido; nenhum default numérico é inserido | A reserva downstream permanece fechada por regra da story 2.4 |
| Repetição | Fixture com o mesmo `actionId` repetida | Resultado/identidade da reserva permanece idempotente | Não criar uma segunda ação no consumidor |
| Leitura incompleta | Snapshot com saldo realizado ou comprometido desconhecido | Estado desconhecido permanece explícito, sem somar como zero | Consumidor não assume saldo disponível |
| Sinal de Budget | Fixture de custo desconhecido ou bloqueio | Contrato de sinal v1 conserva ID, origem, motivo e estado | Rejeitar sinal sem campos obrigatórios ou com campos extras |
| Versão/formato inválido | Versão incompatível, categoria desconhecida ou campo obrigatório ausente | Type guard rejeita o objeto | Sem coerção ou fallback permissivo |

</frozen-after-approval>

## Code Map

- `src/modules/budget/repository.ts` e `src/modules/budget/use-cases.ts` — reserva sintética atual, cuja compatibilidade deve ser preservada.
- `src/adapters/postgres/budget-repository.ts` e `src/worker/budget-trace-handler.ts` — persistência/idempotência do tracer e seu contrato consumido pelo worker.
- `src/contracts/platform-usage/v1.ts` — contrato de uso de plataforma; custo é opcional e já não deve virar zero.
- `src/worker/index.ts` e `src/app/api/internal/budget/trace/route.ts` — consumidores app/worker do caminho sintético.
- `tests/` — padrão local de fixtures e testes Node que compilam para `dist`.
- `../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` — AD-1/AD-3/AD-6 definem fronteiras, idempotência e formatos/estados de custo.
- `../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md` — CAP-7 e limites aprovados; valores de venda continuam hipóteses.
- `tickets.toml` — escopo e verificação da story 2.3.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/budget/v1.ts` — definir contratos versionados validados para custos, reservas, leitura/snapshot e sinais; representar explicitamente custo e saldo desconhecidos.
- [x] `tests/fixtures/budget/v1.mjs` — compartilhar fixtures sintéticas para aplicação, worker e consumidor, incluindo known, unknown e ação repetida.
- [x] `tests/budget-contracts.test.mjs` — validar contratos válidos/inválidos, preservação de custo omitido, leitura desconhecida e identidade idempotente.
- [x] Garantir que os contratos não importem módulos de infraestrutura e que o tracer de 1 centavo continue compatível.

**Acceptance Criteria:**
- Given uma ação com custo conhecido ou desconhecido, when aplicação, worker e consumidor validam o contrato, then cada lado preserva exatamente esse estado sem inventar custo.
- Given o mesmo `actionId` repetido em fixtures, when um consumidor deduplica a ação, then a identidade da reserva continua única.
- Given snapshots e sinais sintéticos, when um consumidor os lê, then os dados desconhecidos, a origem, o motivo e a versão são preservados.
- Given objeto incompleto, versão ou enum inválido, when o type guard roda, then rejeita sem fallback permissivo.
- Given a reserva mínima do tracer atual, when o código é compilado/testado, then mantém compatibilidade sem acesso a provedor ou ação financeira real.

## Implementation Notes

## Plan Change Log

## Review Triage Log

- **patch** — `tests/fixtures/budget/v1.mjs`, `tests/budget-contracts.test.mjs` — A fixture de worker continha apenas custo conhecido, portanto o teste não comprovava a preservação de custo desconhecido na fronteira do worker; a finding do quick review confirmou a lacuna ao comparar com os critérios.

## Design Notes

O contrato é uma fronteira compartilhada, não um segundo ledger. Os formatos devem permitir que 2.4–2.7 adicionem comportamento sem duplicar regras financeiras; fixture de unknown apenas prova preservação e bloqueio esperado pelo consumidor, sem criar preços. A action do tracer segue com seu `actionId` existente e mantém a reserva mínima atual.

## Verification

**Commands:**
- `npx next build --webpack` — passou; o build padrão usa Turbopack, cujos bindings nativos não estão instalados neste Windows.
- `npx tsc -p tsconfig.worker.json` — passou.
- `node --test tests/budget-contracts.test.mjs` — 6/6 passaram.
- `node --test tests/platform-smoke.test.mjs` — 24/24 passaram, incluindo compatibilidade e idempotência do tracer sintético.
- `npm run check:boundaries` — passou.

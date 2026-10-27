---
title: "Sinalizar e recuperar trabalho de orçamento"
type: feature
ticket: 7
created: 2026-10-26
status: done
baseline_revision: 6a7fb181fb02a6d4017d0591c78fab886b50349b
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 3
context:
  - ../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md
  - tickets.toml
  - story-expandir-ledger-e-limites-do-piloto-plan.md
  - story-conciliar-custos-e-liquidar-ou-liberar-reservas-plan.md
  - story-fornecer-snapshot-de-orcamento-para-operacoes-plan.md
---

<frozen-after-approval reason="ticket 2.7, arquitetura AD-3/AD-6 e decisões do proprietário para operações sintéticas">

## Intent

**Problem:** Bloqueios e trabalho de orçamento parado não deixam um sinal durável que Operações consiga acompanhar ou retomar com segurança. O contrato v1 já descreve sinais, mas ainda não os persiste, publica no snapshot ou reprocessa.

**Approach:** Persistir sinais idempotentes vinculados a IDs estáveis de reserva e conciliação, incluí-los no contrato de leitura de Operações e oferecer uma retomada segura para reservas recusadas. Reservas ativas sem progresso por 24 horas passam a ser sinalizadas; esse prazo só alerta e nunca expira ou libera uma reserva.

## Boundaries & Constraints

**Always:** Registrar origem, motivo, tentativas e estado; deduplicar sinais por causa; preservar custo/saldo desconhecido e bloqueios por teto; reutilizar o mesmo `actionId` ao retomar reserva; manter qualquer conciliação, liquidação ou liberação sujeita às regras administrativas já existentes. Exibir sinais abertos e reconhecidos no snapshot. A retomada de sinais de reserva pode repetir somente a reserva original após novo cálculo dos limites; desconhecidos e conciliações paradas exigem evidência/ação operacional separada. Usar PostgreSQL e pg-boss já adotados, apenas com dados sintéticos.

**Never:** Liberar ou liquidar automaticamente; chamar AbacatePay, Meta, Google ou qualquer API externa; usar dados de cliente ou conteúdo de conversa; criar interface de Operações; alterar tecnologia/configuração Railway; tratar sinal como prova de custo ou autorização de gasto.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reserva bloqueada | Custo/saldo desconhecido ou limite insuficiente | Persiste um sinal acionável e o snapshot o apresenta | Repetição do mesmo bloqueio não duplica o sinal |
| Reserva parada | Reserva permanece ativa e sem conciliação por 24 horas | Persiste `reservation_stale`, sem alterar o ledger | Novas leituras mantêm um único sinal |
| Retomada liberada | Sinal de reserva com saldo agora conhecido e suficiente | Repete reserva com o `actionId` original; cria no máximo uma reserva | Mesmo `resumeId` reproduz o resultado; payload conflitante falha |
| Retomada ainda bloqueada | Limite continua insuficiente ou custo desconhecido | Incrementa tentativas e mantém o sinal aberto | Não cria reserva nem chama provedor |
| Conciliação parada/desconhecida | Evidência não terminal ou custo desconhecido | Mantém sinal para reconciliação operacional | Nunca liquida nem libera automaticamente |
| Ação já resolvida | Reserva já foi criada ou decisão administrativa concluída | Retorna resultado atual sem duplicação | Replays são idempotentes |

</frozen-after-approval>

## Code Map

- `src/contracts/budget/v1.ts` — `BudgetSignalV1` e seu guard já existem; `BudgetReadSnapshotV1` precisa expor sinais e a retomada precisa de request/result versionados e validados.
- `src/modules/budget/repository.ts`, `use-cases.ts`, `snapshot.ts` — porta, validação de entrada e projeção do snapshot; preservar a regra de autorização administrativa para decidir reservas.
- `src/adapters/postgres/budget-repository.ts` — cria tabelas idempotentes junto aos demais objetos Budget; `reserveAction`, `recordReconciliation` e `decideReservation` são pontos transacionais para sinalizar bloqueios e progresso.
- `tests/fixtures/budget/memory-repository.mjs`, `tests/fixtures/budget/v1.mjs`, `tests/budget-reconciliation.test.mjs`, `tests/budget-ledger.test.mjs`, `tests/budget-snapshot.test.mjs` — adapters sintéticos, idempotência já exercitada e contrato de leitura; adicionar suíte focada em sinais/retomada.
- Arquitetura AD-3/AD-6 e planos das stories 2.4–2.6 — persistência PostgreSQL como fonte autoritativa, fila durável, reservas com IDs estáveis, falha fechada e liberação somente após terminalidade, conciliação e autorização.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/budget/v1.ts` — completar os contratos e guards de leitura/retomada para consumidores de Operações.
- [x] `src/modules/budget/repository.ts`, `use-cases.ts`, `snapshot.ts` — expor criação, leitura e retomada idempotentes de sinais; permitir retry seguro só para reserva bloqueada.
- [x] `src/adapters/postgres/budget-repository.ts` — persistir sinais e resultados de retomada atomicamente, deduplicar por causa e materializar reservas stale com limite de 24 horas.
- [x] `tests/fixtures/budget/memory-repository.mjs`, `tests/fixtures/budget/v1.mjs`, `tests/budget-signals.test.mjs` — cobrir bloqueios, stale, leituras, tentativas, replay/conflito, sem duplicação e sem auto-liberação.
- [x] `tests/budget-contracts.test.mjs`, `tests/budget-snapshot.test.mjs`, `tests/budget-ledger.test.mjs`, `tests/budget-reconciliation.test.mjs` — manter os contratos e fluxos anteriores compatíveis.

**Acceptance Criteria:**
- Given um bloqueio ou estado de custo desconhecido/parado, when Operações lê o snapshot, then encontra um sinal persistido com origem, motivo, tentativas e estado.
- Given uma reserva ativa sem conciliação por 24 horas, when sinais são consultados, then existe um único sinal stale e o ledger permanece idêntico.
- Given um sinal de reserva e saldo já corrigido, when a retomada é repetida com o mesmo identificador, then uma única reserva usa o `actionId` original.
- Given saldo ainda desconhecido/insuficiente ou conciliação não terminal, when há retomada, then o sinal continua acionável e nenhuma liberação/liquidação acontece.

## Implementation Notes

- Sinais duráveis são deduplicados pela causa e publicados no snapshot de Budget; retomadas guardam o resultado sob `resumeId`, revalidam limites e reaproveitam o `actionId` original.
- A varredura stale usa 24 horas apenas como alerta. Estados sem evidência terminal ficam abertos e nenhuma retomada libera ou liquida uma reserva.
- Uma reserva só recebe o alerta stale quando ainda não existe nenhuma conciliação; a materialização do alerta compartilha a trava transacional do ledger com conciliações e decisões administrativas.
- Uma retomada que encontra uma reserva já liquidada/liberada registra e devolve `already_resolved` sob o seu `resumeId`, sem repetir a reserva.
- O payload original de uma reserva bloqueada fica imutável para seu `actionId`; a criação/decisão da reserva e o resultado da retomada são persistidos na mesma transação.
- O snapshot não trunca sinais abertos ou reconhecidos; sinais abertos vêm primeiro e alertas `reservation_stale` continuam abertos após replay de reserva ativa.
- A suíte usa repositório sintético; nenhum provedor, dado de cliente, pagamento ou configuração Railway foi acessado.

## Plan Change Log

- 2026-10-26: revisão rápida encontrou quatro falhas de idempotência/visibilidade; correções aplicadas e verificações repetidas.
- 2026-10-26: segunda leitura encontrou duas corridas na classificação/materialização stale; filtro e transação foram corrigidos.
- 2026-10-26: terceira leitura encontrou a corrida entre retomada e decisão terminal; o resultado `already_resolved` agora é persistido atomicamente.

## Review Triage Log

- **patch** — `src/adapters/postgres/budget-repository.ts` — O bloqueio de reserva podia substituir o payload de recuperação para um mesmo `actionId`. Agora chamadas posteriores com payload diferente falham por conflito; a fixture sintética cobre esse contrato.
- **patch** — `src/adapters/postgres/budget-repository.ts` — Reserva e resultado de retomada podiam ser confirmados em transações distintas. A persistência do resultado e a atualização do sinal agora ocorrem junto da reserva, na mesma transação.
- **patch** — `src/adapters/postgres/budget-repository.ts` — O `LIMIT 500` podia ocultar sinais recentes. A consulta retorna todos os sinais não resolvidos e ordena os abertos primeiro.
- **patch** — `src/adapters/postgres/budget-repository.ts`, `tests/fixtures/budget/memory-repository.mjs`, `tests/budget-signals.test.mjs` — Replay de reserva ativa resolvia também `reservation_stale`; agora a resolução automática por reserva deixa esse alerta aberto até conciliação/decisão terminal.
- **patch** — `src/adapters/postgres/budget-repository.ts`, `tests/fixtures/budget/memory-repository.mjs`, `tests/budget-signals.test.mjs` — Uma conciliação pendente/desconhecida gerava ainda um alerta stale duplicado; a varredura agora exige ausência de qualquer conciliação e a suíte cobre o estado desconhecido.
- **patch** — `src/adapters/postgres/budget-repository.ts` — A detecção e a escrita stale podiam competir com liquidação/liberação. Ambas agora rodam sob a mesma transação e trava do ledger usada por conciliação e decisão administrativa.
- **patch** — `src/adapters/postgres/budget-repository.ts` — Se uma decisão administrativa terminal vencer uma retomada concorrente, a reserva não ativa causava erro sem resultado idempotente. A retomada agora persiste e retorna `already_resolved` na transação que observa a decisão.
- Revisão rápida independente após as correções: no findings.

## Design Notes

Bloqueios de reserva só podem retomar o passo idempotente de reservar, após revalidar os limites; não disparam trabalho faturável. Sinais de reserva stale e de conciliação exigem reconciliação e a decisão administrativa já existente. O limite de 24 horas só determina quando mostrar alerta, não uma expiração. Sinais são deduplicados por tipo/origem/ID estável; requests de retomada têm chave própria para reproduzir o resultado exato.

## Verification

**Commands:**
- `npx next build --webpack` — compilação e build otimizados concluem.
- `npx tsc -p tsconfig.worker.json` — worker compila.
- `node --test tests/budget-signals.test.mjs tests/budget-ledger.test.mjs tests/budget-reconciliation.test.mjs tests/budget-snapshot.test.mjs tests/budget-contracts.test.mjs` — testes sintéticos passam.
- `npm run check:boundaries` — fronteiras continuam válidas.
- `git diff --check` — não há erros de whitespace.

**Results:**
- `npx next build --webpack` — passou após todas as correções; Next usou o fallback WASM porque o binário nativo SWC não está instalado.
- `npx tsc -p tsconfig.worker.json` — passou.
- Suíte Budget sintética — 38 testes passaram.
- `npm run check:boundaries` e `git diff --check` — passaram após a terceira rodada de correções.
- PostgreSQL real não foi conectado; o adapter foi validado por build/tipos e os fluxos foram exercitados com o repositório sintético.

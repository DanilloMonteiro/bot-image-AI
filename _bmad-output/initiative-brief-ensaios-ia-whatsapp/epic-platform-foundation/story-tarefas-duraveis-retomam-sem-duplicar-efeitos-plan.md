---
title: 'Tarefas duráveis retomam sem duplicar efeitos'
type: 'feature'
ticket: '2'
created: '2026-10-15'
status: 'built'
baseline_revision: '63e11af76c74331b8731eb8e7547ebd455e8f09f'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md'
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A tarefa atual é durável, mas uma entrega repetida ou uma queda após o efeito e antes da confirmação do job pode deixar estado inconsistente ou repetir o efeito. Falhas terminais também precisam continuar visíveis e oferecer um caminho de retomada.

**Approach:** Fazer o worker aplicar um efeito sintético em um destino PostgreSQL com chave idempotente estável, persistindo o efeito e a conclusão da tarefa atomicamente. Manter tentativas limitadas, permitir consultar e reprocessar uma tarefa terminal pelo job existente e comprovar o fluxo com repetição, interrupção e recuperação local.

## Boundaries & Constraints

**Always:** O ID durável da tarefa será a chave idempotente estável e seguirá igual em cada entrega e recuperação. O registro do efeito de teste e o estado concluído serão gravados na mesma transação; uma restrição única no destino impedirá efeito duplicado. O estado da tarefa acompanha a tentativa atual para que uma execução antiga não sobrescreva o resultado de uma nova. Falhas usarão tentativas automáticas limitadas e código consultável sem expor detalhes internos. Recuperação manual só pode reabrir um job terminal `failed`, com uma tentativa adicional por ação e o mesmo segredo de staging; jobs ativos retomam pela expiração/retry normal. Dados permanecem sintéticos.

**Never:** Integrar cobrança, Pix, WhatsApp, IA ou geração de imagens. Alegar entrega exatamente uma vez pela fila; a garantia desta história limita-se a um efeito comprometido no destino idempotente. Criar uma nova tarefa ou chave durante recuperação, permitir retry automático ilimitado, reabrir um job ativo manualmente, ou ativar infraestrutura paga.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Entrega repetida ou retomada após queda | Mesmo job e chave; efeito pode já estar comprometido | Tarefa termina com um único registro de efeito para a chave | Erro transitório segue o limite de tentativas |
| Retentativas esgotadas | Falha persistente do job | Consulta mostra `failed`; recuperação reusa job e chave | Código seguro e limitado; sem estado falso de sucesso |
| Falha atrasada de tentativa antiga | Tentativa nova já concluiu | Estado permanece `completed`; destino conserva uma linha | Resultado antigo é ignorado |
| Recuperação inválida | ID ausente, tarefa não falha ou credencial inválida | Nenhum novo job nem alteração indevida | 404, 409 ou 401, respectivamente |

</frozen-after-approval>

## Code Map

- `src/adapters/postgres/smoke-repository.ts` — transação de efeito, deduplicação, consulta do estado do job e recuperação terminal.
- `src/modules/platform-smoke/repository.ts`, `src/modules/platform-smoke/use-cases.ts` — contrato público do módulo para execução idempotente e recuperação.
- `src/worker/index.ts` — validação do job e execução que pode ser repetida sem duplicar o efeito.
- `src/app/api/internal/smoke/[id]/route.ts`, `src/app/api/internal/smoke/[id]/retry/route.ts` — consulta existente e novo caminho autenticado de recuperação.
- `tests/platform-smoke.test.mjs`, `scripts/smoke-local.mjs` — regressões determinísticas e exercício PostgreSQL/pg-boss com queda, repetição e recuperação.
- `docs/platform-staging.md` — comportamento operacional, estado terminal, recuperação e limite da garantia.

## Tasks & Acceptance

**Execution:**
- [x] `src/adapters/postgres/smoke-repository.ts` — adicionar destino sintético com unicidade por chave, gravar efeito e conclusão atomicamente, proteger transições pelo número da tentativa, manter retentativas limitadas e refletir jobs terminais via `findJobs`; recuperar somente job terminal falho com sua chave e uma tentativa adicional.
- [x] `src/modules/platform-smoke/repository.ts`, `src/modules/platform-smoke/use-cases.ts`, `src/worker/index.ts` — expor recuperação pelo módulo e fazer o worker executar o mesmo efeito idempotente em cada entrega válida.
- [x] `src/app/api/internal/smoke/[id]/retry/route.ts` — aceitar apenas tarefa terminal falha, com autenticação, resposta sem cache e códigos 202/401/404/409 consistentes.
- [x] `tests/platform-smoke.test.mjs` — cobrir entrega repetida, falha antes/depois do efeito, tentativas esgotadas, chave preservada, resultado atrasado e transições inválidas.
- [x] `scripts/smoke-local.mjs`, `docs/platform-staging.md` — usar um gatilho de crash abrupto restrito ao smoke sintético para interromper o worker após o commit e antes do ack, reiniciar e aguardar expiração/retry; provar uma linha de efeito e demonstrar consulta e recuperação terminal.

**Acceptance Criteria:**
- Given um job de smoke aceito, when o worker falha depois de gravar o efeito mas antes de confirmar o job e depois é reiniciado, then o job conclui com exatamente um efeito persistido sob o ID/chave original.
- Given que as tentativas limitadas se esgotaram, when o cliente autorizado consulta a tarefa, then recebe estado `failed` e código seguro; ao recuperar, o mesmo job volta à fila e pode concluir sem acrescentar outro efeito.
- Given uma tentativa nova já concluiu, when uma tentativa antiga reporta falha atrasada, then o estado visível continua `completed`.
- Given uma repetição não autorizada ou uma tarefa não elegível para recuperação, when a rota de retry é chamada, then recebe 401/409 e o estado e a fila não mudam.

## Implementation Notes

- `npm test` passed (8/8); `npm run check:boundaries` and `git diff --check` passed.
- `npm run smoke:local` was attempted after the final code change but Docker Desktop returned an Internal Server Error from API v1.45 before containers started.

## Plan Change Log

## Review Triage Log

- Quick review 2026-10-16: 0 high, 1 medium, 0 low, 0 false, 0 maybe-false. `src/adapters/postgres/smoke-repository.ts`: medium/patch — pg-boss defaults job retention to seven days, while `find()` needs the failed row to mark an unqueried task terminal and `retry()` requires the existing failed job; after expiry the task can remain processing or become unrecoverable.
- Resolution: set `deleteAfterSeconds: 0` for the smoke queue and each submitted job, preserving terminal reconciliation and recovery; documented this retention choice. No findings were deferred.

## Design Notes

A fila pode entregar um job novamente quando uma execução expira ou falha. A proteção real fica na gravação do destino: chave única e efeito/conclusão na mesma transação. A recuperação manual usa a operação de retry do pg-boss no job terminal existente, sem limpar o registro idempotente; cada ação autoriza uma tentativa finita adicional. O gatilho de crash e tempos curtos de expiração/monitoramento pertencem somente ao smoke local. Esse contrato não cobre efeitos fora do PostgreSQL.

## Verification

**Commands:**
- `npm test` — build e testes unitários passam, incluindo duplicatas, falhas e recuperação.
- `npm run check:boundaries` — fronteiras de persistência dos módulos continuam respeitadas.
- `npm run smoke:local` — PostgreSQL e worker reproduzem a queda/reinício e a falha terminal; cada chave tem um único efeito comprometido.

---
title: "Backups do estado durável podem ser restaurados"
type: "feature"
ticket: 5
created: "2026-10-20"
status: "in-progress"
assignee: "Danillo"
baseline_revision: "3b940b833ead"
route: "full"
route_source: "auto"
risk: "medium"
review: "none"
review_source: "auto"
lenses_ran: []
review_loop_iteration: 0
context:
  - "{project-root}/docs/platform-staging.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ainda não há procedimento reproduzível para provar que o estado durável e os jobs relacionados sobrevivem a uma restauração isolada. Nenhum provedor externo foi aprovado, portanto não há base para configurar ou alegar backups de produção.

**Approach:** Criar um comando local de demonstração com PostgreSQL e dados sintéticos: registrar uma tarefa com o worker parado, fazer dump completo, restaurar em outro projeto Compose e processar a tarefa restaurada pelo smoke path. Documentar esse limite e manter a configuração externa pendente de aprovação do provedor.

## Boundaries & Constraints

**Always:** Usar somente dados sintéticos e projetos/volumes Compose aleatórios criados pelo comando; incluir o banco completo, preservando estado da aplicação e pg-boss; usar credenciais efêmeras; manter o banco privado; limpar os projetos criados e o dump temporário mesmo em falha; não afirmar garantias que o exercício não comprova.

**Never:** Acessar ou modificar banco externo, produção ou dados de clientes; enviar dump a serviço externo; incluir segredos no artefato; inventar provedor, região, agenda, retenção, RTO ou RPO; declarar que backup de produção está configurado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Restauração sintética | Docker disponível; tarefa sintética está queued no projeto de origem | Dump restaurado em projeto/volume distintos; API consulta o mesmo UUID; worker conclui a tarefa uma vez e grava um efeito | Nenhum erro esperado |
| Falha em qualquer etapa | Docker indisponível ou erro ao criar, exportar, restaurar, consultar ou processar | Comando termina com código diferente de zero e não relata sucesso | Limpa somente projetos próprios e apaga o dump temporário em finally |

</frozen-after-approval>

## Code Map

- scripts/smoke-local.mjs — padrão existente para Compose efêmero, tarefa sintética, polling e limpeza.
- compose.yaml — serviços, rede privada, volume PostgreSQL e porta local da web.
- src/adapters/postgres/smoke-repository.ts — grava tarefa e job pg-boss na mesma transação; define também a evidência de efeito idempotente.
- package.json — ponto de entrada para o novo comando local.
- docs/platform-staging.md — limites atuais do staging e decisão pendente sobre provedor.

## Tasks & Acceptance

**Execution:**
- [x] scripts/backup-restore-local.mjs — implementar o fluxo ponta a ponta com dois projetos Compose independentes, dump completo em arquivo temporário, restauração limpa, consulta/processamento pelo smoke path, validação do efeito e limpeza restrita aos recursos criados.
- [x] package.json — adicionar o comando backup:restore:local para tornar a demonstração repetível.
- [x] docs/platform-staging.md — documentar pré-requisitos, comando, escopo sintético e a pendência de provedor; distinguir a prova local de backup externo de produção.

**Acceptance Criteria:**
- Given Docker local disponível, when o comando conclui, then a tarefa sintética restaurada é consultável pelo mesmo UUID e processada no ambiente isolado com exatamente um efeito.
- Given falha em qualquer fase, when o comando encerra, then retorna erro, remove o dump temporário e limpa apenas seus projetos/volumes Compose.
- Given nenhum provedor externo aprovado, when a documentação descreve o resultado, then não afirma configuração de backup externo nem define RTO, RPO ou retenção.

## Implementation Notes

- The local command uses two unique Compose projects and separate ephemeral credentials; external provider setup remains pending approval.
- Static JavaScript and package JSON parsing passed; the Docker restore flow was not executed.

## Plan Change Log

## Review Triage Log

## Design Notes

O dump precisa conter o estado PostgreSQL completo, incluindo as tabelas da aplicação e os metadados/jobs de pg-boss. Recriar o job manualmente ou copiar apenas a tabela de tarefas não prova que a transação e a fila durável foram restauradas juntas. A web de origem e a restaurada não devem ocupar a porta fixa simultaneamente; manter o fluxo sequencial. Credenciais não fazem parte do dump.

## Verification

**Commands:**
- npm run backup:restore:local — expected: imprime sucesso somente após consultar a tarefa restaurada, processá-la e confirmar um efeito; falhas retornam código diferente de zero.

**Manual checks (if no CLI):**
- Confirmar no diff que a limpeza só usa nomes aleatórios criados pelo comando e não há upload, endereço de banco externo, segredo persistido ou alteração de dados reais.

## Code Review

### 2026-10-20

Code review complete. 0 decision-needed, 6 patch, 0 defer, 3 rejected.

- [x] [Review][Patch] Validate the effective Docker context before running Compose [scripts/backup-restore-local.mjs:93]
- [x] [Review][Patch] Preserve object grants when restoring the complete database dump [scripts/backup-restore-local.mjs:170]
- [x] [Review][Patch] Bound Docker subprocess execution so stalled commands terminate [scripts/backup-restore-local.mjs:15]
- [x] [Review][Patch] Run the backup and restore command in the staging smoke workflow [.github/workflows/staging-smoke.yml:17]
- [x] [Review][Patch] Add a deterministic failure-path check for project and dump cleanup [scripts/backup-restore-local.mjs:209]
- [x] [Review][Patch] Poll for pg-boss completion together with task completion [scripts/backup-restore-local.mjs:188]

#### Rejected

- `false` — The pg-boss expiration starts after a job becomes active; the restored job is queued while the source worker is stopped, so a slow backup or restore does not consume its 30-second active-job limit.
- `false` — The plan remains `in-progress` and explicitly says the Docker restore flow was not executed. Its checked tasks describe implementation work, so they do not claim that the acceptance flow was verified.
- `low` — SIGINT/SIGTERM can bypass `finally`, but this requires an uncommon interruption and needs additional signal-handling control flow for a local synthetic-data command; the resulting orphaned temporary project can be removed manually.

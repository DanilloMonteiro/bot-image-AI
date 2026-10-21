---
title: 'Caminho durável do Next.js ao worker em staging'
type: 'feature'
ticket: '1'
created: '2026-10-15'
status: done
baseline_revision: 'ca814bec464be2abff75d68f5d2fce4cab52fee2'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ainda não existe aplicação ou infraestrutura para demonstrar que um evento recebido pelo Next.js sobrevive a uma falha de processo e chega ao worker em staging. Sem essa base, os demais épicos não têm um caminho implantável e consistente.

**Approach:** Criar a base TypeScript com Next.js e worker Node separados, persistir uma tarefa de demonstração em PostgreSQL e processá-la por uma fila no mesmo banco. Exercitar o caminho completo em ambiente local reproduzível e na CI; preparar a configuração de staging externo para quando houver conta e provedor aprovados.

## Boundaries & Constraints

**Always:** Manter domínio/aplicação independentes de Next.js e SDKs; cada módulo controla seus dados. A chamada de smoke exige segredo, usa dados sintéticos e devolve um identificador de correlação consultável. Persistir a aceitação antes de responder; não registrar dados pessoais nem bytes de mídia. Não ativar infraestrutura paga sem escolha de provedor, região e teto de gasto aprovados.

**Never:** Habilitar tráfego de clientes, fotos reais, Pix ou geração de imagem nesta história; expor o banco à internet; declarar proteção contra efeitos externos duplicados antes da história 1.2.

**Decision (2026-10-15):** O usuário confirmou que ainda não tem conta Railway e autorizou avançar sem ela. PostgreSQL e pg-boss serão usados localmente como base técnica; hospedagem, região, limite financeiro e deploy externo ficam para decisão posterior. Nenhum gasto ou conta externa é criado nesta etapa.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Smoke aceito | POST autenticado com payload sintético | Resposta inclui ID; worker conclui tarefa; consulta pelo ID mostra mesmo ID e estado concluído | — |
| Banco indisponível | POST autenticado sem transação persistida | Nenhuma aceitação é confirmada | Resposta de indisponibilidade sem inserir tarefa parcial |
| Processo interrompido | Tarefa aceita e worker reiniciado | Tarefa permanece no banco e pode ser retomada | Falha fica visível para a operação |
| Acesso indevido | POST ou consulta sem credencial | Nenhum estado é exposto ou alterado | 401/403 |

</frozen-after-approval>

## Code Map

- `src/app/`, `src/worker/`, `src/modules/`, `src/adapters/` — diretórios propostos na arquitetura; nenhum código de aplicação existe ainda.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` — AD-1/2/3/8 e decisões de stack abertas; registrar a escolha validada aqui.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-platform-foundation/tickets.toml` — critérios da história 1.1; não alterar o ticket pelo fluxo Build.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md` — teto total de R$500 e bloqueio de dados reais antes da política.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `tsconfig.json`, `src/app/page.tsx`, `src/worker/index.ts` — iniciar Next.js 16 e processo Node com scripts de build/execução separados.
- [ ] `src/modules/platform-smoke/use-cases.ts`, `src/modules/platform-smoke/repository.ts`, `src/adapters/postgres/smoke-repository.ts` — criar caso de uso, persistência transacional e tarefa durável com pg-boss; guardar somente payload sintético e correlação.
- [ ] `src/app/api/internal/smoke/route.ts`, `src/app/api/internal/smoke/[id]/route.ts` — expor criação e consulta protegidas por segredo de staging, com falha fechada.
- [ ] `compose.yaml`, `.github/workflows/staging-smoke.yml` — iniciar web, worker e PostgreSQL localmente e reproduzir o caminho na CI com dados sintéticos.
- [ ] `scripts/check-boundaries.mjs`, `docs/platform-staging.md` — impor fronteiras de importação/persistência e documentar configuração, custo, privacidade e operação do smoke.

**Acceptance Criteria:**
- Given o ambiente local ou a CI sem credenciais externas, when web, worker e banco são iniciados, then o caminho de smoke executa na mesma revisão do código.
- Given POST de smoke autorizado, when o banco confirma a transação, then a consulta pelo ID mostra a tarefa e depois a conclusão pelo worker com a mesma correlação.
- Given perda do banco ou segredo incorreto, when o endpoint recebe a chamada, then não confirma tarefa inexistente nem revela estado sem autorização.
- Given um módulo novo importa persistência privada de outro, when a verificação de fronteiras roda, then a CI falha.

## Implementation Notes

- 2026-10-15: Aplicação, worker, PostgreSQL e pg-boss implementados; Compose e CI reproduzem o caminho com dados sintéticos. `npm test` (build e 3 testes) e `npm run check:boundaries` passaram.
- Docker Desktop retornou HTTP 500 neste ambiente. O mesmo caminho integrado foi executado contra uma instância PostgreSQL 16 temporária em localhost e passou: autenticação, persistência antes do worker, reinício do worker, conclusão pelo mesmo ID e falha fechada após desligar o banco. A CI executará o Compose com PostgreSQL 18.6.
- Após a revisão, o job recebeu ID igual à correlação, duas retentativas e expiração limitada; a consulta converte falha terminal em estado visível. O smoke via Compose passou a usar projeto exclusivo, de forma que sua limpeza não toca o stack manual. `npm test`, `npm run check:boundaries` e o smoke integrado em PostgreSQL local passaram novamente.

## Plan Change Log

## Review Triage Log

- Quick review 2026-10-15: 0 high, 2 medium, 0 low, 0 false, 0 maybe-false. `src/adapters/postgres/smoke-repository.ts`: medium/patch — com `retryLimit: 0`, uma queda após marcar `processing` termina o job sem atualizar a tarefa; a API pode mostrar `processing` indefinidamente. A documentação do pg-boss confirma expiração e limite de tentativas; corrigir recuperação e estado terminal visível. `scripts/smoke-local.mjs`: medium/patch — o Compose usa o projeto padrão e `down -v` pode apagar o volume do stack manual descrito na documentação; isolar o nome do projeto de smoke.
- Resolução da revisão: ambos os findings foram corrigidos e verificados. Nenhum finding foi adiado. O deploy em staging externo permanece pendente por decisão do usuário de avançar sem conta Railway.

## Design Notes

Uma fila no mesmo PostgreSQL reduz provedores e permite enfileirar na transação; a história 1.2 acrescentará deduplicação de efeitos externos. pg-boss documenta enfileiramento transacional: https://github.com/timgit/pg-boss . Railway segue apenas candidato para a implantação futura: https://docs.railway.com/pricing , https://docs.railway.com/pricing/cost-control , https://docs.railway.com/deployments/regions , https://railway.com/legal/dpa .

## Verification

**Commands:**
- `npm run build` — Next.js e worker compilam.
- `npm run check:boundaries` — importação proibida entre módulos é rejeitada.
- `npm run smoke:local` — tarefa autenticada é criada, processada e consultada com a mesma correlação.

## Code Review

### 2026-10-19

**Code review complete.** 0 `decision-needed`, 4 `patch`, 0 `defer`, 11 rejected.

Escopo: commit `63e11af` (story 1.1), conferido contra a `main` atual para não reabrir problemas corrigidos em commits posteriores.

- [x] [Review][Patch] Tratar erros de conexão do pool PostgreSQL para evitar falha não capturada do processo [src/adapters/postgres/smoke-repository.ts:39]
- [x] [Review][Patch] Codificar `POSTGRES_PASSWORD` antes de interpolar na URI PostgreSQL [compose.yaml:24]
- [x] [Review][Patch] Limpar o projeto Compose quando `up` falhar parcialmente [scripts/smoke-local.mjs:45]
- [x] [Review][Patch] Preservar diagnóstico seguro dos erros de inicialização e da fila do worker [src/worker/index.ts:18]

Resolução em 2026-10-19: os quatro patches foram aplicados. `git diff --check` passou; testes não foram executados.

**Rejected**

- `false` (resolvido depois da 1.1): `.env.example` agora inclui `POSTGRES_PASSWORD` em `8b9d94b`.
- `false` (resolvido depois da 1.1): `.dockerignore` agora exclui `.env*` em `8b9d94b`.
- `low`: conflito com a porta 3000 depende de outro serviço local estar usando a porta documentada; resolver exige tornar a porta e a URL configuráveis.
- `low`: retenção indefinida de tarefas sintéticas tem baixo impacto no uso local/CI desta story e uma política de limpeza acrescentaria regras de ciclo de vida.
- `false`: corrigir checkboxes de execução alteraria o plano que está sendo revisado.
- `false`: atualizar o Code Map também alteraria o plano que está sendo revisado.
- `false`: deploy externo foi explicitamente adiado; a story documenta Compose local e CI, conforme a decisão do usuário de seguir sem Railway.
- `false`: embora o teste unitário use um `Map`, o smoke da story usa PostgreSQL/Compose e valida a fila durável com o worker parado antes de retomá-lo.
- `false` (resolvido depois da 1.1): o código atual configura `deleteAfterSeconds: 0` e não oferece caminho normal para cancelar ou apagar jobs, evitando o caso de job ausente citado.
- `false` (resolvido depois da 1.1): o smoke atual cobre esgotamento de retries e recuperação manual, adicionado em `ccedbea`.
- `false`: a ambiguidade sobre staging externo foi resolvida pela decisão registrada no próprio plano; não há requisito de provisionar um serviço externo nesta story.

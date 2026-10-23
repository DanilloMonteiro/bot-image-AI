---
id: 1
type: story
title: "Configurar e validar o ambiente de produção no Railway"
parent: none
covers: ["F2", "F4", "F5"]
after: []
assignee: ""
refined: false
hitl: true
risk: high
---

# Configurar e validar o ambiente de produção no Railway

## Description

Preparar e validar manualmente o workspace e o ambiente de produção do Railway, mantendo o piloto sintético até que os controles de custo, privacidade, acesso e recuperação tenham evidência aprovada.

## Acceptance Criteria

1. **Workspace e custos controlados**
   **Given** a conta Railway criada
   **When** o workspace dedicado ao piloto estiver configurado
   **Then** o plano Railway pode ser Hobby mesmo com uma única conta de desenvolvedor, desde que Isaac e seu parceiro tenham acesso administrativo ao painel da aplicação e permissão de escrita no repositório GitHub
   **And** pelo menos um membro do projeto tem a conta GitHub vinculada ao Railway e acesso de contribuidor ao repositório, e commits de contas sem Railway vinculado têm o fluxo de aprovação documentado
   **And** o Compute hard limit fica abaixo do equivalente em USD do teto mensal total de R$65, reservando o custo estimado do Bucket e tributos; os custos do Bucket são acompanhados separadamente porque o limite não garante um teto para a fatura
   **And** o limite total do piloto permanece em R$500
2. **Plano revisado antes da aplicação**
   **Given** o workspace, projeto e ambiente de produção dedicados
   **When** `railway config plan` for executado com Railway CLI 5.42.1 ou mais recente
   **Then** o plano revisado registra recursos, regiões, referências de variáveis e exclusões, não contém valores secretos nem alterações não relacionadas, e mantém banco, worker e Bucket sem acesso público
   **And** a configuração mantém o PostgreSQL na região provisionada (`iad`), sem propor sua migração; web e worker usam `us-east4-eqdc4a`, e o Bucket permanece privado em IAD (`iad`)
3. **Aplicação e credenciais isoladas**
   **Given** o plano aprovado e aplicado
   **When** o ambiente de produção for configurado
   **Then** somente o serviço web recebe domínio HTTPS, o banco usa a referência privada `DATABASE_URL`, e worker, banco e Bucket não recebem domínio público
   **And** `PRODUCTION_SMOKE_SECRET` é definido diretamente no escopo do serviço web de produção, tem pelo menos 32 caracteres aleatórios e é diferente do segredo de staging
4. **Rotas e smoke verificados**
   **Given** o serviço web e o worker implantados
   **When** as verificações de produção forem executadas
   **Then** o domínio público expõe somente `/api/health` e as rotas autenticadas de smoke sintético, o worker usa seu health check privado, uma solicitação de smoke não autorizada não cria tarefa, e uma solicitação sintética autorizada conclui sem registrar segredos, dados pessoais ou bytes de mídia
   **And** rotas de clientes e mídia permanecem fechadas enquanto qualquer evidência de aprovação estiver ausente
5. **Custos, alertas e recuperação comprovados**
   **Given** os responsáveis aprovarem os controles operacionais e de backup
   **When** a reconciliação de custos e o teste de restauração forem concluídos
   **Then** o mecanismo de alertas cobre e verifica os limites de 60%, 80% e 95%, o Compute hard limit está efetivo, e uma autoridade de pausa está nomeada
   **And** o backup agendado, sua política de acesso, retenção e metas RTO/RPO aprovadas ficam registrados, e uma restauração sintética é verificada em ambiente privado isolado, sem credenciais de produção
   **And** custos de uso são reconciliados com a fatura do mesmo período, com o Bucket tratado separadamente
6. **Gates de produção mantidos por evidência**
   **Given** as seis aprovações de produção ainda não comprovadas
   **When** qualquer gate estiver pendente
   **Then** sua flag permanece unset e as rotas de clientes e mídia continuam fechadas
   **And** cada flag só é definida após a evidência correspondente ser registrada

## Boundaries

- Não aplicar o plano antes da revisão e aprovação de um responsável autorizado.
- Não habilitar tráfego de clientes, fotos reais, Pix ou geração de imagens durante este piloto sintético.
- Não expor worker, banco ou Bucket à rede pública.
- Não guardar segredos no repositório, em logs ou em evidências operacionais.
- Não tratar o Compute hard limit como garantia do teto total da fatura: arquivos já armazenados no Bucket continuam sendo cobrados mesmo quando o acesso ao Bucket é suspenso por limite.

## Checklist de execução

### Conta e workspace

- [x] Criar a conta Railway.
- [x] Assinar o plano Hobby (US$5/mês); assinatura confirmada pelo usuário em 2026-10-22.
- [x] Confirmar o workspace usado pelo piloto: `botimageai`; projeto criado nesse workspace em 2026-10-22.
- [x] Ativar MFA na conta Railway; usuário confirmou em 2026-10-22.
- [ ] Confirmar o titular do workspace. Danillo não será adicionado como membro Railway no plano Hobby; manter o acesso dele pelo painel da aplicação e pelo GitHub.
- [ ] Confirmar que Isaac e seu parceiro têm acesso administrativo ao painel da aplicação e permissão de escrita no repositório GitHub.
- [x] Vincular a conta Railway à conta GitHub; o usuário confirmou que concluiu essa etapa em 2026-10-22.
- [x] Verificar que o Railway GitHub App pode acessar `DanilloMonteiro/bot-image-AI` e que a conta GitHub vinculada ao Railway tem acesso de escrita; usuário confirmou a validação em 2026-10-22. Registrar que commits do Danillo podem exigir aprovação manual de deploy.
- [x] Configurar Compute hard limit de US$10 (mínimo permitido); usuário confirmou e a CLI verificou o limite no workspace `botimageai` em 2026-10-22.
- [x] Configurar alerta de e-mail em US$8; o usuário confirmou a conclusão em 2026-10-22.
- [x] Configurar Agent hard limit em US$0; usuário confirmou e a CLI verificou o limite no workspace `botimageai` em 2026-10-22.
- [ ] Estimar o custo do Bucket e tributos e confirmar que a margem nominal aproximada de US$3 até o teto de R$65 é suficiente; arquivos já armazenados no Bucket podem continuar sendo cobrados após o limite.
- [ ] Confirmar o teto total de R$500, acompanhar armazenamento e egress do Bucket separadamente e reconciliar a fatura mensal completa com o limite de R$65.

### Plano e aplicação

- [x] Atualizar o mapeamento GitHub: `develop` substitui a antiga `main` como branch de integração e `production` é a branch de release para o Railway; PR #13 foi mesclado em `develop` e PR #14 em `production`.
- [x] Sincronizar as referências locais `develop` → `origin/develop` e `production` → `origin/production`. Preservar a antiga branch local `main` como `backup/main-before-develop-rename-20261023`; `origin/main` não existe mais.
- [x] Confirmar as dependências locais do projeto (`package-lock.json` e `node_modules/railway` presentes em 2026-10-22).
- [x] Instalar Railway CLI 5.42.1 ou mais recente; versão instalada e verificada: `5.71.0` em 2026-10-22.
- [x] Autenticar a Railway CLI; login concluído em 2026-10-22 e confirmado pela própria CLI.
- [x] Criar o projeto vazio `ensaios-ia-whatsapp-pilot` no workspace `botimageai` com `railway init`; criação confirmada em 2026-10-22, ID `fdb4554f-dbfb-43fe-857b-15b680eaa7f4`.
- [x] Vincular a CLI ao projeto e ambiente `production` com `railway link`; concluído em 2026-10-22.
- [x] Executar e revisar `railway config plan` em 2026-10-22: 4 recursos para criar, nenhum para alterar ou destruir; regiões, fontes e referências revisadas.
- [x] Confirmar no plano que não há valor de segredo, mudança não relacionada nem domínio/acesso público declarado para banco, worker e Bucket. `PRODUCTION_SMOKE_SECRET` aparece como `preserve()`.
- [x] Obter aprovação explícita do responsável autorizado antes da aplicação; usuário autorizou em 2026-10-22.
- [x] Aplicar o plano aprovado em 2026-10-22 com `railway config apply --yes`; CLI retornou sucesso e o status confirmou PostgreSQL, Bucket e serviços web/worker.
- [x] Manter PostgreSQL em IAD (`iad`): remover a região explícita do helper local (`postgres('postgres')`) e executar somente `railway config plan --json`. Em 2026-10-22, o plano retornou `No changes`; nenhuma migração nem aplicação foi executada.
- [x] Atualizar no ambiente Railway `production` as branches fonte de `web`, `worker` e `postgres-backup` de `main` para `production`. A revisão exibiu uma alteração por serviço, sem criação ou exclusão de recursos.
- [x] Verificar após a atualização que `web`, `worker`, PostgreSQL e o cron `postgres-backup` estão online; o último backup foi bem-sucedido. A primeira execução naturalmente agendada ainda está pendente.
- [x] Confirmar os primeiros deploys: PostgreSQL, `web` e `worker` ficaram `SUCCESS`/`RUNNING` em 2026-10-22; após atualizar `source.branch` para `production`, `railway status` confirmou os serviços online novamente em 2026-10-23. Smoke, conexão funcional e privacidade de acesso estão verificados nos itens abaixo.

### Segredos, acesso e gates

- [x] Definir `PRODUCTION_SMOKE_SECRET` diretamente no serviço web de produção; o usuário confirmou a configuração em 2026-10-22.
- [x] Rotacionar `PRODUCTION_SMOKE_SECRET` após o valor anterior ter sido compartilhado nesta conversa; usuário confirmou a rotação em 2026-10-22. Não registrar o valor novo.
- [ ] Se smoke local for necessário, usar segredo local/staging independente em `.env.local`; nunca reutilizar o segredo de produção. `.env.local` está coberto pelo `.gitignore`.
- [x] Confirmar que o domínio HTTPS gerado do serviço `web` responde; não há domínio declarado para `worker` nem PostgreSQL.
- [x] Confirmar `GET /api/health` com resposta `{"status":"ok"}`. O readiness do web verifica PostgreSQL (`SELECT 1`) e a fila sintética.
- [x] Confirmar worker `RUNNING` e evento `worker_ready` nos logs; o health check Railway está configurado em `/health`.
- [x] Confirmar as restrições de borda: `GET /api/customer`, `/api/customers` e `/api/media` retornam 404; status/plano mostram domínio público somente no web, sem domínio para PostgreSQL/worker nem networking público declarado para o Bucket.
- [x] Confirmar que `POST /api/internal/smoke` sem autorização retorna HTTP 401 e não aceita/cria tarefa; verificado em 2026-10-22. O handler rejeita a autorização antes de chamar a operação de aceitação.
- [x] Enviar um smoke sintético autorizado e confirmar conclusão e logs seguros; tarefa terminou `completed` e os logs incluem somente tipo do evento, UUID de correlação, tentativa, estado e horário.
- [ ] Escolher e verificar mecanismo adicional que cubra alertas de custo em 60%, 80% e 95%; os controles Railway descritos no guia não cobrem esses três limites.
- [ ] Nomear a autoridade de pausa e confirmar que o Compute hard limit está efetivo.
- [ ] Registrar evidência e só então definir `PRODUCTION_PRIVACY_APPROVED`.
- [ ] Registrar reconciliação de custo e só então definir `PRODUCTION_COST_RECONCILED`.
- [x] Concluir a restauração isolada do dump lógico em PostgreSQL privado descartável, registrar a verificação e definir `PRODUCTION_BACKUP_RESTORE_VERIFIED=true` após a evidência (sem disparar deploy); as outras cinco flags seguem ausentes.
- [ ] Verificar os três alertas e só então definir `PRODUCTION_COST_ALERTS_60_80_95_VERIFIED`.
- [ ] Confirmar a efetividade do limite e só então definir `PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED`.
- [ ] Nomear a autoridade de pausa e só então definir `PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED`.
- [ ] Manter as rotas de clientes e mídia fechadas enquanto qualquer gate estiver pendente.

### Backup, restauração e reconciliação

- [x] Preparar e aprovar a política de backup para o piloto sintético (titular com MFA, retenção de 6 dias, backup a cada 3 dias, RPO de até 72 horas e RTO-alvo de até 4 horas); usuário confirmou a cadência revisada em 2026-10-22.
- [x] Escolher o mecanismo compatível com Hobby. O agendamento nativo de snapshots foi rejeitado pela Railway por exigir workspace Pro; usuário autorizou o serviço cron com `pg_dump` e Bucket privado dedicado a cada 3 dias.
- [x] Configurar backup agendado do PostgreSQL: serviço `postgres-backup`, cron `0 3 */3 * *` às 03:00 UTC e Bucket privado dedicado `postgres-backups` em IAD; execução manual bem-sucedida registrada em 2026-10-22. A primeira execução natural ainda está pendente.
- [x] Restaurar o dump em PostgreSQL descartável, privado e isolado em IAD, usando URL de banco temporário e sem `DATABASE_URL` de produção; registrar que o exercício valida o caminho lógico e não snapshots de volume.
- [x] Verificar uma tarefa sintética concluída com job pg-boss retido e efeito idempotente correspondente; resultado: 1 válida, 0 tarefas concluídas sem job/efeito. Remover serviço e banco descartáveis após o registro; ambos foram removidos.
- [ ] Decidir se deve manter ou excluir `restore-drill-volume` e reconciliar seu custo; em 2026-10-23, a Railway ainda o reportava como volume destacado (`DETACHED`) e `READY`, usando 0.1 GB de 4.9 GB.
- [ ] Capturar uso Railway e reconciliar com a fatura do mesmo período; reconciliar armazenamento do Bucket separadamente.
- [ ] Acompanhar o armazenamento do Bucket em GB-mês (US$0,015/GB-mês) e o egress de serviços que enviam arquivos ao Bucket.

### Política proposta de backup do PostgreSQL para o piloto

- **Escopo:** somente dados sintéticos. Não habilitar dados de clientes, fotos reais ou informações de pagamento com esta política.
- **Acesso:** apenas a conta titular do workspace Railway, protegida por MFA, pode visualizar, baixar ou restaurar backups. Danillo não terá acesso ao Railway no plano Hobby; não compartilhar variáveis nem cópias de credenciais do banco.
- **Agenda e retenção aprovadas:** a cada 3 dias às 03:00 UTC (`0 3 */3 * *`), com janela de 6 dias. Como o campo cron usa dias do mês, pode haver intervalo menor na virada do mês; o intervalo máximo é de 3 dias. O mecanismo nativo de snapshots foi recusado no workspace Hobby. O mecanismo configurado é o serviço cron `postgres-backup`, que produz `pg_dump` em `postgres-backups` (IAD) e remove cópias com mais de 6 dias. Uma execução manual e o tamanho do objeto foram verificados em 2026-10-22; a primeira execução natural do agendamento ainda está pendente.
- **RPO:** alvo de até 72 horas, condicionado a cada execução agendada concluir com sucesso. Registrar a data/hora do último sucesso; se uma cópia falhar ou for ignorada, o RPO efetivo passa a ser o tempo desde o último dump válido.
- **RTO:** alvo operacional de até 4 horas para recuperar o serviço e verificar o smoke sintético. É uma meta do piloto, não SLA Railway. O comando de restore levou cerca de 6 segundos após o banco descartável estar disponível; o RTO completo desde um incidente não foi medido.
- **Limite dos snapshots:** quando disponíveis, são incrementais e cobrados pelo armazenamento incremental, mas só podem ser restaurados no mesmo projeto e ambiente, substituindo o volume montado no serviço e redeployando-o. Não servem para teste isolado sem afetar o serviço; apagar o volume também apaga seus snapshots. A CLI informou que backups manuais e agendados exigem workspace Pro.
- **Exercício isolado:** para cumprir o requisito de não levar credenciais de produção ao destino, o teste partiu de um `pg_dump` lógico e restaurou-o em um PostgreSQL descartável, privado e com credenciais novas. O dump de 48.394 bytes restaurou uma tarefa sintética concluída com job pg-boss retido e efeito idempotente correspondente (1 válida; 0 sem job/efeito). O comando de restauração levou cerca de 6 segundos após o banco descartável estar disponível; isso não mede o RTO completo desde um incidente. O serviço e o banco de teste foram removidos depois do registro, e o dump permanece no Bucket sob a retenção de 6 dias. O exercício valida o caminho lógico, mas não snapshots de volume. A flag `PRODUCTION_BACKUP_RESTORE_VERIFIED=true` foi definida em 2026-10-22 após registrar esse método e resultado, sem disparar deploy; as demais cinco flags seguem ausentes. Avaliar PITR ou cópia independente antes de dados reais.
- **Revisão:** reavaliar retenção, cópia independente e acesso de recuperação antes de qualquer dado real ou se o RPO/RTO pretendido mudar.

## References

- guia — docs/platform-staging.md, Railway plan and apply
- guia — docs/platform-staging.md, Provider backup and isolated restore
- contrato de uso — docs/platform-usage-contract.md, Railway pilot reconciliation
- requisitos da plataforma — _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-platform-foundation/epic-platform-foundation.md, Requirements F2, F4 e F5
- implementação existente — _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-platform-foundation/story-base-web-e-worker-e-implantada-em-producao-plan.md, Provider verification remains pending
- preços Railway — https://railway.com/pricing, planos Hobby e Pro
- workspaces Railway — https://docs.railway.com/projects/workspaces, workspace padrão e criação de workspaces adicionais a partir do Pro/Enterprise
- cobrança Railway — https://docs.railway.com/pricing/plans, Subscription pricing e Included usage
- limites Railway — https://docs.railway.com/pricing/cost-control, Usage limits e Compute vs. Agent usage limits
- backups de volume Railway — https://docs.railway.com/volumes/backups, agenda, retenção, restauração e limitações
- backup e restauração de Postgres Railway — https://docs.railway.com/guides/postgres-backups-restores, snapshots, PITR e cópias lógicas
- PITR Railway — https://docs.railway.com/volumes/point-in-time-recovery, restauração em serviço irmão e tratamento de variáveis/credenciais
- planos Railway — https://docs.railway.com/pricing/plans, valores Hobby e Pro e recursos por plano
- guia Railway de backups Postgres — https://docs.railway.com/guides/postgres-backups-restores, automação de `pg_dump` por serviço cron e Bucket S3-compatible
- cobrança do Bucket — https://docs.railway.com/storage-buckets/billing, preço por GB-mês, suspensão por limite e cobrança dos dados armazenados
- regiões Railway — https://docs.railway.com/deployments/regions, regiões de compute e migração de volumes ao mudar de região
- rede privada — https://docs.railway.com/networking/private-networking/how-it-works, comunicação interna e egress
- latência entre regiões — https://docs.railway.com/deployments/troubleshooting/slow-deployments, efeito de manter aplicação e banco em regiões diferentes
- valores aceitos pelos limites — https://docs.railway.com/cli/usage, limite de Compute em dólares inteiros e mínimo de US$10
- commits e autodeploy — https://docs.railway.com/deployments/github-autodeploys, requisito de GitHub vinculado e acesso de contribuidor
- aprovação de deploy — https://docs.railway.com/services, aprovação de commits de usuário GitHub sem conta Railway vinculada
- fatura Railway — https://docs.railway.com/pricing/understanding-your-bill, Included usage e Tax and VAT

## Notes

- Estado atual de branches e Railway (2026-10-23; substitui as pendências antigas abaixo): GitHub usa `develop` para integração; o ambiente Railway de produção usa `production`. PR #13 foi mesclado em `develop` e PR #14 em `production`. As branches locais acompanham `origin/develop` e `origin/production`; a antiga branch local `main` foi preservada como `backup/main-before-develop-rename-20261023`. As fontes Railway de `web`, `worker` e `postgres-backup` foram atualizadas, e `railway status` mostra os serviços online. `restore-drill-volume` ainda aparece destacado e precisa de decisão de retenção/remoção e reconciliação de custo; a primeira execução naturalmente agendada do backup e os demais gates de produção continuam pendentes.
- Risk rationale: uma configuração errada pode expor dados, exceder limites de custo ou comprometer a recuperação do ambiente de produção.
- Superseded assumption (2026-10-22): inicialmente, os R$65 foram tratados como alocação exclusiva de Compute. O usuário esclareceu que R$65 é o teto da fatura inteira; o limite de Compute deve deixar reserva para Bucket e tributos.
- Billing: Hobby custa no mínimo US$5/mês e inclui US$5 de uso. Se o uso total faturável for US$13, a fatura antes de tributos é US$13, não US$18.
- Hard limit example: configurar Compute hard limit de US$10 define o limite de uso de Compute no ciclo — não US$10 além da assinatura. Pela lógica de cobrança, exatamente US$10 de uso resultariam em US$5 cobertos pelo Hobby e US$5 de excedente, total nominal de US$10 antes de tributos. Porém, a Railway não garante um teto exato em dólares nem um prazo máximo de interrupção após atingir o limite. Pela estimativa do usuário (R$65 ≈ US$13), a margem nominal seria cerca de US$3 (aprox. R$15), antes de Bucket, tributos e câmbio; essa margem não é garantida.
- Limite de Compute: cobre CPU, memória, armazenamento e egress dos serviços e pode desligar workloads quando atingido. A documentação do CLI informa valores em dólares inteiros e hard limit mínimo de US$10. Como estimativa aproximada, R$65 equivale a cerca de US$13; US$10 de Compute deixaria somente cerca de US$3 para Bucket, tributos e variação cambial, então essa margem precisa ser avaliada antes de configurar.
- Bucket: cobra US$0,015 por GB-mês; uploads feitos por serviços também podem gerar egress de serviço. Ao exceder o Hard Usage Limit, o acesso ao Bucket é suspenso e não é possível ler ou enviar arquivos, mas os dados armazenados continuam sendo cobrados. Portanto, o hard limit pode interromper o acesso, mas não apaga o Bucket nem garante o teto total da fatura de R$65.
- Decision (2026-10-22): o usuário aceita o plano Hobby mesmo com um único desenvolvedor Railway. O requisito de colaboração é que ambos tenham acesso administrativo ao painel da aplicação e consigam fazer commits no GitHub. Permissões de commit são controladas pelo GitHub, não pelo número de desenvolvedores Railway. Para autodeploy, ao menos um membro do projeto precisa ter GitHub vinculado e acesso de contribuidor; commits de uma pessoa sem Railway vinculado podem exigir aprovação manual.
- Access update (2026-10-22): usuário confirmou MFA ativo. Danillo não pode ser adicionado ao workspace no plano Hobby; confirmar que ele tem acesso administrativo ao painel da aplicação e escrita no repositório GitHub. Commits dele podem gerar uma aprovação manual de deploy no Railway.
- GitHub update (2026-10-22): usuário vinculou a conta GitHub à Railway, mas ainda não conectou repositório nem criou projeto Railway. O arquivo `.railway/railway.ts` já declara `DanilloMonteiro/bot-image-AI`, branch `main`; conceder acesso ao Railway GitHub App antes de preparar o plano. Não criar serviço nem iniciar deploy pelo dashboard nesta etapa.
- GitHub access update (2026-10-22): usuário confirmou que verificou os dois acessos: a conta GitHub vinculada à Railway tem `Write` no repositório e a instalação do Railway GitHub App inclui `DanilloMonteiro/bot-image-AI`. Marcar a etapa como concluída; isso não cria projeto nem conecta serviços.
- Local CLI check (2026-10-22): Node.js `v24.18.0`, `package-lock.json` e `node_modules/railway` estão presentes no repositório; o comando `railway --version` não encontrou o Railway CLI no PATH. Próximo passo é instalar o CLI 5.42.1 ou mais recente e então seguir pelo fluxo IaC deste repositório.
- Open question: qual mecanismo adicional será usado para verificar alertas em 60%, 80% e 95%, já que os controles Railway descritos no guia não cobrem todos esses limites?
- Check externo: antes de marcar a tarefa como done, o sócio que não aplicou o plano deve revisar no Railway os acessos, alertas, backup, flags e domínios configurados.
- Backup (2026-10-22): usuário revisou a cadência para cada 3 dias e autorizou a alternativa Hobby: cron `0 3 */3 * *` (03:00 UTC), `pg_dump` lógico, Bucket privado em IAD e retenção configurada de 6 dias; RPO-alvo atualizado para 72 horas e RTO-alvo segue em 4 horas. A tentativa nativa de agenda foi recusada por exigir workspace Pro; nenhuma agenda nativa foi alterada e PITR segue desativado. A implementação foi implantada e validada com um backup manual e uma restauração isolada. A primeira execução natural e a medição de RTO completo ainda estão pendentes.
- Aplicação (2026-10-22): `railway config apply --yes` terminou com código de saída 0. `railway status --json` confirmou o Bucket `media` e os serviços `postgres`, `web` e `worker`. PostgreSQL ficou `RUNNING` com deploy `SUCCESS`; volume `postgres-volume` está `READY` (5.000 MB, cerca de 4,2 MB usados). Os deploys de `web` e `worker` estavam `QUEUED`, com `deploymentStopped=true` e sem instâncias. Ambos apontam para o commit `134320f13140ff1f41bc7536c111d4a191adc706` (`Merge remote-tracking branch 'origin/main'`), autor reportado `bras-monteirod`. Os logs informam que ainda não há build associado. A documentação Railway diz que pushes de autor sem conta Railway vinculada geram uma aprovação manual; verificar a tela dos serviços, pois esse pode ser o motivo da fila. Nenhum domínio público aparece no status.
- Reconciliação (2026-10-22): `railway config plan --json` após a aplicação encontrou uma mudança destrutiva pendente: mover o PostgreSQL de `iad` para `us-east4-eqdc4a`. O banco provisionado e seu volume estão em IAD, divergindo da configuração. O usuário condicionou a autorização à mudança não ser destrutiva; como o plano a classificou como destrutiva, não autorizou e nenhuma nova aplicação foi executada. Manter o banco em `iad` até definir uma solução que não exija essa mudança destrutiva ou obter nova decisão explícita.
- Estado atual (2026-10-22): PostgreSQL `RUNNING` em `iad`; `web` e `worker` `RUNNING` em `us-east4-eqdc4a`. Compute reportado como US$0,000181; hard limit US$10 e soft limit US$8. `DATABASE_URL` é referência privada. Diferença de região pode acrescentar latência, mas o tráfego privado entre serviços Railway não gera egress. O IaC foi alinhado para preservar o estado do banco sem migração.
- IaC e smoke (2026-10-22): `.railway/railway.ts` usa `postgres('postgres')`, sem fixar região; o plano retorna `No changes`. O usuário confirmou `status: ok` no endpoint de saúde e um smoke autorizado terminou `completed`; logs do worker não contêm segredo, dados pessoais nem bytes de mídia. Rotas de cliente/mídia testadas retornaram 404.
- Segredo de smoke (2026-10-22): usuário confirmou a configuração de `PRODUCTION_SMOKE_SECRET` em Railway, compartilhou o valor anterior nesta conversa e depois confirmou que o rotacionou. O novo valor não foi registrado. Não copiar o segredo de produção para arquivos locais. `.env.local` é ignorado pelo Git; se necessário para testes locais, usar um segredo local separado.
- Backup implantado (2026-10-22): o serviço `postgres-backup` envia dumps ao Bucket privado `postgres-backups` em IAD a cada 3 dias às 03:00 UTC. A execução manual criou `postgres/20261022T194929Z.dump`, com 48.394 bytes confirmados no Bucket; retenção configurada de 6 dias. A primeira execução agendada naturalmente ainda precisa ser observada.
- Restauração isolada (2026-10-22): dump restaurado em PostgreSQL privado descartável em IAD, usando credenciais próprias e sem URL do banco de produção. Verificados 1 tarefa sintética concluída com job e efeito idempotente e 0 tarefas concluídas sem essas linhas; comando levou aproximadamente 6 segundos depois que o banco de teste ficou disponível. Serviço e banco descartáveis foram removidos; em 2026-10-23, a Railway ainda reportava `restore-drill-volume` como volume destacado (`DETACHED`) e `READY`, usando 0.1 GB de 4.9 GB. O dump permanece no Bucket.
- Gate de backup (2026-10-22): após registrar backup e restauração isolada bem-sucedidos, `PRODUCTION_BACKUP_RESTORE_VERIFIED=true` foi definida somente no serviço web de produção com `--skip-deploys`; a leitura das seis flags confirmou as outras cinco ausentes. Nenhum deploy foi iniciado por essa alteração.
- Fonte de deploy do backup (registro anterior): o primeiro deploy foi feito por upload local isolado. A referência inicial usava `main`, que não existe mais no remoto. Em 2026-10-23, a fonte GitHub foi atualizada para `production` em `web`, `worker` e `postgres-backup`; manter `.railway/railway.ts` alinhado e não incluir alterações não relacionadas do workspace.
- Falha de build GitHub (2026-10-22, antes da publicação): Railway não encontrou `/services/postgres-backup` porque a fonte ainda apontava para a antiga `main` e os arquivos do serviço não estavam publicados. A branch `production` agora contém o merge do PR #14 e o status Railway foi confirmado online em 2026-10-23.
- Plano de fonte (2026-10-22, concluído em 2026-10-23): a primeira prévia apontou exclusão do flag `PRODUCTION_BACKUP_RESTORE_VERIFIED`; `.railway/railway.ts` foi ajustado para preservá-lo com `preserve()`. A revisão final continha somente 3 atualizações de `source.branch` para `production` (web, worker e postgres-backup), sem criações ou exclusões. As alterações foram aplicadas e os serviços ficaram online.
- PR #14 (histórico de 2026-10-22): o PR para `production` foi aberto e seus checks falharam em `tests/platform-isolation.test.mjs:58`, que exige a região antiga `us-east4-eqdc4a`. A decisão aprovada mantém PostgreSQL em IAD sem região explícita; não restaurar a alteração de região. O PR #14 foi posteriormente mesclado em `production`; os checks antigos não foram reexecutados nesta atualização.
- 2026-10-23 — GitHub verificado: PR #13 mesclado em `develop` (`69cf3847d0893d453fb9b98977e54d7cfa5cd646`) e PR #14 em `production` (`435e0b3bd898ffaba70349c2b7e947bf6b0dce7b`); `origin/main` foi removida. Criadas refs locais de tracking `develop` e `production`; a antiga ref local `main` foi preservada em `backup/main-before-develop-rename-20261023`. Railway: aplicadas as três atualizações de fonte para `production`; `railway status` mostrou web, worker, postgres e postgres-backup online. A primeira execução natural do backup segue pendente. O workspace permanece na branch `docs/accept-platform-stories-1-4` com alterações locais preexistentes e deste acompanhamento; nenhuma alteração foi enviada ao remoto.

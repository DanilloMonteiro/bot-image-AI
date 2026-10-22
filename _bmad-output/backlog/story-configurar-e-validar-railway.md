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
   **Then** somente Isaac e seu parceiro são administradores, cada um usa uma conta individual permitida com MFA, e o Compute hard limit corresponde ao equivalente em USD da alocação aprovada de R$65
   **And** o limite total do piloto permanece em R$500, com custos do Bucket reconciliados separadamente do Compute
2. **Plano revisado antes da aplicação**
   **Given** o workspace, projeto e ambiente de produção dedicados
   **When** `railway config plan` for executado com Railway CLI 5.42.1 ou mais recente
   **Then** o plano revisado registra recursos, regiões, referências de variáveis e exclusões, não contém valores secretos nem alterações não relacionadas, e mantém banco, worker e Bucket sem acesso público
   **And** somente um responsável autorizado aprova a aplicação do plano, que usa a região `us-east4-eqdc4a` e o Bucket privado em IAD (`iad`)
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
- Não tratar o Compute hard limit como limite para cobranças de armazenamento do Bucket.

## Checklist de execução

### Conta e workspace

- [x] Criar a conta Railway.
- [ ] Criar ou confirmar um workspace dedicado ao piloto.
- [ ] Restringir administradores a Isaac e seu parceiro, com contas individuais permitidas e MFA.
- [ ] Registrar o equivalente em USD da alocação aprovada de R$65 e configurar o Compute hard limit.
- [ ] Confirmar o teto total de R$500 e registrar separadamente os custos do Bucket.

### Plano e aplicação

- [ ] Instalar as dependências travadas e Railway CLI 5.42.1 ou mais recente.
- [ ] Conectar a CLI ao workspace, projeto e ambiente de produção pretendidos.
- [ ] Executar `railway config plan` e revisar recursos, regiões, referências de variáveis e exclusões.
- [ ] Confirmar que o plano não contém segredos, mudanças não relacionadas ou acesso público para worker, banco e Bucket.
- [ ] Obter aprovação do responsável autorizado antes de aplicar o plano.
- [ ] Aplicar o plano aprovado e registrar o resultado.

### Segredos, acesso e gates

- [ ] Definir `PRODUCTION_SMOKE_SECRET` diretamente no serviço web de produção e manter o segredo de staging separado.
- [ ] Habilitar domínio HTTPS apenas para o serviço web após aprovação e confirmar as restrições de borda.
- [ ] Verificar `/api/health`, health check privado do worker, banco privado e ausência de domínios públicos para worker, banco e Bucket.
- [ ] Confirmar que uma requisição de smoke sem autorização não cria tarefa.
- [ ] Enviar um smoke sintético autorizado e confirmar conclusão e logs seguros.
- [ ] Escolher e verificar mecanismo adicional que cubra alertas de custo em 60%, 80% e 95%; os controles Railway descritos no guia não cobrem esses três limites.
- [ ] Nomear a autoridade de pausa e confirmar que o Compute hard limit está efetivo.
- [ ] Registrar evidência e só então definir `PRODUCTION_PRIVACY_APPROVED`.
- [ ] Registrar reconciliação de custo e só então definir `PRODUCTION_COST_RECONCILED`.
- [ ] Concluir a restauração isolada e só então definir `PRODUCTION_BACKUP_RESTORE_VERIFIED`.
- [ ] Verificar os três alertas e só então definir `PRODUCTION_COST_ALERTS_60_80_95_VERIFIED`.
- [ ] Confirmar a efetividade do limite e só então definir `PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED`.
- [ ] Nomear a autoridade de pausa e só então definir `PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED`.
- [ ] Manter as rotas de clientes e mídia fechadas enquanto qualquer gate estiver pendente.

### Backup, restauração e reconciliação

- [ ] Obter aprovação da política de acesso, retenção e metas RTO/RPO antes de configurar backups.
- [ ] Configurar backup agendado do PostgreSQL e registrar agenda e último sucesso.
- [ ] Restaurar um backup selecionado em ambiente descartável, privado e isolado, sem domínio público nem credenciais de produção.
- [ ] Verificar estado da tarefa sintética, job retido e efeito idempotente; registrar o resultado antes de remover o ambiente descartável.
- [ ] Capturar uso Railway e reconciliar com a fatura do mesmo período; reconciliar armazenamento do Bucket separadamente.

## References

- guia — docs/platform-staging.md, Railway plan and apply
- guia — docs/platform-staging.md, Provider backup and isolated restore
- contrato de uso — docs/platform-usage-contract.md, Railway pilot reconciliation
- requisitos da plataforma — _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-platform-foundation/epic-platform-foundation.md, Requirements F2, F4 e F5
- implementação existente — _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-platform-foundation/story-base-web-e-worker-e-implantada-em-producao-plan.md, Provider verification remains pending
- preços Railway — https://railway.com/pricing, planos Hobby e Pro
- cobrança Railway — https://docs.railway.com/pricing/plans, Subscription pricing e Included usage
- limites Railway — https://docs.railway.com/pricing/cost-control, Usage limits e Compute vs. Agent usage limits
- fatura Railway — https://docs.railway.com/pricing/understanding-your-bill, Included usage e Tax and VAT

## Notes

- Risk rationale: uma configuração errada pode expor dados, exceder limites de custo ou comprometer a recuperação do ambiente de produção.
- Current finding (2026-10-22): o Hobby cobra mínimo de US$5 e inclui US$5 de uso mensal. Se o uso de recursos for US$13, a conta total do plano e uso será US$13 (US$5 cobertos pela assinatura e US$8 acima do crédito); não se soma mais US$5 ao uso total. Se R$65 for a alocação de Compute do guia, o hard limit deve ser o equivalente integral em USD, não o equivalente a R$40.
- Limite do controle: o Compute hard limit cobre CPU, memória, armazenamento e egress e pode desligar os serviços ao ser atingido. Ele não limita cobranças de armazenamento do Bucket; impostos também podem aparecer separadamente na fatura.
- Open question: os R$65 são somente a alocação de Compute indicada no guia ou precisam cobrir também Bucket e impostos? Se forem o teto total da fatura, o hard limit de Compute sozinho não garante esse teto.
- Open question: o plano Hobby atende ao requisito de dois administradores com contas individuais? A página de preços o descreve como workspace de desenvolvedor único e informa assentos de workspace ilimitados no Pro; confirmar o acesso necessário antes de assinar.
- Open question: qual mecanismo adicional será usado para verificar alertas em 60%, 80% e 95%, já que os controles Railway descritos no guia não cobrem todos esses limites?
- Check externo: antes de marcar a tarefa como done, o sócio que não aplicou o plano deve revisar no Railway os acessos, alertas, backup, flags e domínios configurados.

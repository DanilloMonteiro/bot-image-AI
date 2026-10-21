# Railway — configuração inicial do piloto

Guia de configuração e conferência para Isaac e Danillo. O Railway ainda não tem conta, workspace, projeto ou recursos deste piloto; a IaC no repositório descreve o que será criado, mas ainda não foi aplicada. Siga a ordem abaixo e use somente dados sintéticos.

## Antes de criar recursos: confirmar o custo do workspace

A conta cria um workspace padrão. A arquitetura aprovada pede um workspace dedicado ao piloto, e a Railway informa que workspaces adicionais e colaboração exigem Pro ou Enterprise. Na página oficial consultada em 21/10/2026, o Pro custa US$20 por mês e inclui até US$20 de uso de recursos; o consumo acima desse crédito aumenta a fatura. Mesmo que o Compute hard limit pare os serviços antes de atingir US$20 em consumo, a cobrança mínima do plano continua em US$20. Isso pode ultrapassar a alocação de infraestrutura de R$65, conforme câmbio e tributos. Confirmem como assinatura e consumo serão contabilizados dentro dos R$65 e do teto total de R$500 antes de trocar de plano. Os preços podem mudar; confiram a fatura projetada no momento da contratação. [Planos e cobrança da Railway](https://docs.railway.com/pricing/plans) · [Workspaces](https://docs.railway.com/projects/workspaces)

**Ponto de parada:** criar a conta gratuita é seguro; não façam upgrade, não cadastrem recursos pagos e não apliquem a IaC até os responsáveis aprovarem o custo do workspace e o controle de gastos. O hard limit da Railway cobre Compute, mas o armazenamento do Bucket é faturado separadamente. O egress do Bucket é gratuito; o tráfego de saída dos serviços que enviam ou servem arquivos é cobrado como egress do serviço. Um hard limit pode parar todos os serviços do workspace ao ser atingido. [Controles de custo](https://docs.railway.com/pricing/cost-control) · [Cobrança de Buckets](https://docs.railway.com/storage-buckets)

## O que a IaC configura

O arquivo [`.railway/railway.ts`](../.railway/railway.ts) é a configuração de referência. Ele declara um projeto e quatro recursos:

| Recurso | Configuração esperada |
| --- | --- |
| `web` | Repositório `DanilloMonteiro/bot-image-AI`, branch `main`; 1 réplica em `us-east4-eqdc4a` (Virgínia); início `npm run start:web`; health check `/api/health`. É o único serviço que poderá receber domínio HTTPS, depois das verificações. |
| `worker` | Mesmo repositório e região, 1 réplica; início `npm run start:worker`; health check interno `/health`; sem domínio público. |
| `postgres` | PostgreSQL em `us-east4-eqdc4a`; acesso privado e URL privada compartilhada com `web` e `worker`; sem domínio público. A fila `pg-boss` usa esse PostgreSQL, sem Redis. |
| `media` | Bucket privado na região `iad` (Virgínia); sem domínio público. A região não pode ser alterada depois da criação. Nenhuma credencial do Bucket é conectada aos serviços nesta fase. O preço publicado é US$0,015 por GB-mês; egress do serviço que envia arquivos continua sujeito à cobrança. |

O grafo não declara domínio público. Não use `railway up`, `railway add` nem crie serviços manualmente: isso pode criar recursos fora da IaC. A criação via `railway config apply` é faturável.

## Variáveis de ambiente

| Variável | Serviço | Como configurar |
| --- | --- | --- |
| `DATABASE_URL` | `web`, `worker` | Vem da referência privada ao PostgreSQL na IaC. Não copiar, colar nem criar manualmente. |
| `PLATFORM_ENVIRONMENT=production` | `web`, `worker` | Definida pela IaC. |
| `PORT=3001` | `worker` | Definida pela IaC para o listener interno do worker. |
| `PRODUCTION_SMOKE_SECRET` | `web` | Gerar com um gerenciador de senhas, com pelo menos 32 caracteres; cadastrar diretamente no escopo de variáveis do serviço `web` no ambiente de produção. Não colocar no Git, em comandos, capturas de tela ou mensagens. `preserve()` mantém esse valor sob gestão da Railway. Usar uma chave diferente da staging/local. |
| `STAGING_SMOKE_SECRET` | local/CI | Não cadastrar na Railway de produção nem reutilizar como segredo de produção. O exemplo local está em `.env.example`. |
| `POSTGRES_PASSWORD` | Compose local | Obrigatória somente na execução manual do Compose local descrita em [staging](./platform-staging.md); gerar um valor aleatório local e nunca cadastrar na Railway. `.env.example` mantém o valor vazio. |
| `PRODUCTION_PRIVACY_APPROVED` | `web` | Não criar na configuração inicial. Só definir literalmente `true` depois de registrar a evidência de privacidade aprovada. |
| `PRODUCTION_COST_RECONCILED` | `web` | Não criar na configuração inicial. Só definir `true` depois de reconciliar consumo e fatura do período. |
| `PRODUCTION_BACKUP_RESTORE_VERIFIED` | `web` | Não criar na configuração inicial. Só definir `true` depois de backup programado e restauração isolada verificada na Railway. |
| `PRODUCTION_COST_ALERTS_60_80_95_VERIFIED` | `web` | Não criar na configuração inicial. Só definir `true` quando alertas de 60%, 80% e 95% estiverem testados para o total e as categorias aprovadas. |
| `PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED` | `web` | Não criar na configuração inicial. Só definir `true` depois de confirmar o hard limit no workspace dedicado. |
| `PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED` | `web` | Não criar na configuração inicial. Só definir `true` depois de nomear e registrar quem pode pausar gastos. |

Os seis sinalizadores finais precisam de evidência própria e permanecem ausentes até ela existir. A aplicação só aceita o valor exato `true`; sem todos eles, caminhos de cliente e mídia continuam bloqueados. O Bucket será criado vazio e privado pelo grafo, mas o app ainda não tem integração de mídia: não gere nem conecte credenciais, e não invente variáveis S3. O `.env.example` é apenas para execução local. [Variáveis da Railway](https://docs.railway.com/variables) · [`preserve()` na IaC](https://docs.railway.com/infrastructure-as-code/reference)

## Passo a passo

### 1. Criar a conta individual de Isaac

1. Acesse [railway.com](https://railway.com) e entre com a identidade individual de Isaac. Não compartilhe login, senha nem token.
2. Em Account Security, ative MFA na própria Railway com app autenticador ou passkey e confirme o endereço de e-mail. Guarde os códigos de recuperação no gerenciador seguro; não os coloque no registro do projeto. [MFA da Railway](https://docs.railway.com/access/multi-factor-authentication)
3. A Railway cria um workspace padrão. Deixe-o sem projeto e sem recursos deste piloto enquanto o custo do workspace dedicado não estiver aprovado.

### 2. Aprovar plano, workspace e pessoas

1. Confirme com Isaac e Danillo como o Pro/Enterprise será pago e contabilizado dentro dos R$65 de infraestrutura e dos R$500 do piloto. Revise o plano e a fatura no momento da decisão.
2. Depois da aprovação, crie um workspace exclusivo para `ensaios-ia-whatsapp-pilot`.
3. Convide Danillo pelo e-mail da conta Railway individual dele. Cada um ativa MFA. Mantenha como Admin somente Isaac e Danillo, conforme a regra do piloto; não compartilhem credenciais.
4. Em People/Security, habilite `Require 2FA` para o workspace. Essa exigência está disponível em Pro ou superior. Registre nome/ID do workspace, plano, responsáveis e data da aprovação. Não inclua senhas, tokens ou valores de segredos. [Exigir 2FA no workspace](https://docs.railway.com/access/two-factor-enforcement)

### 3. Configurar os limites e o controle de gastos

Faça essa etapa antes de provisionar o projeto:

1. Converta a alocação de infraestrutura de R$65 para USD usando a taxa aprovada pelos responsáveis. Antes de definir o limite, obtenha uma estimativa aprovada para armazenamento do Bucket e demais cobranças que não entram em Compute; reserve esses valores da alocação. Configure **Compute Hard limit** somente com o saldo restante, nunca com os R$65 integrais. Registre fonte/data da taxa, estimativa e cálculo. No dashboard, selecione o workspace dedicado, abra **Usage → Set Usage Limits → Compute Usage** e configure o limite. Somente um Admin do workspace pode alterar esse controle.
2. O limite Railway é informado em dólares inteiros. Arredonde o saldo restante para baixo. Se não houver uma estimativa/reserva confiável para o Bucket e demais cobranças separadas, ou se o limite não puder ser configurado no valor calculado, pare e peça nova decisão de orçamento. O hard limit pode desligar web, worker e banco; não controla o armazenamento do Bucket nem implementa o teto de R$500 do piloto. Nesta fase o Bucket deve permanecer vazio e sem credenciais associadas. Antes de qualquer gravação futura, definam e testem monitoramento de armazenamento e um procedimento de pausa que mantenha compute + Bucket dentro dos R$65; sem esse controle, mantenham a integração e o tráfego de mídia bloqueados. O total combinado precisa caber nos R$65 aprovados.
3. A Railway oferece um alerta soft configurável e avisos nativos em 75%, 90% e 100%; isso não cobre o requisito aprovado de 60%, 80% e 95%. Configure e teste um mecanismo adicional que alerte os responsáveis para o total do piloto e cada categoria. Se ainda não existe mecanismo e prova dos três limiares, mantenha os recursos sem provisionar e todos os seis sinalizadores ausentes.
4. Nomeie Isaac ou Danillo como autoridade de pausa, com substituto e forma de registro de ator, motivo e horário. Teste como a pausa será executada.
5. Guarde evidência redigida das telas de limite e dos testes de alerta. Nunca capture valores secretos. Depois de vincular o CLI ao workspace, confira o hard limit com `railway usage limit status`.

### 4. Conectar GitHub e preparar o CLI

1. Na Railway, conecte a conta GitHub que pode ler `DanilloMonteiro/bot-image-AI`; autorize somente o acesso necessário ao repositório.
2. Use uma cópia limpa do repositório, Node.js 24 ou superior e as dependências bloqueadas pelo `package-lock.json`.
3. Na raiz do projeto, instale as dependências do lockfile:

```powershell
npm ci
```

4. Instale a CLI oficial e confira a versão. O guia do projeto exige Railway CLI 5.42.1 ou superior para este fluxo de IaC:

```powershell
npm install --global @railway/cli
railway --version
railway login
railway whoami
```

`whoami` deve identificar a conta individual esperada. Não use token compartilhado, token em arquivo versionado nem `RAILWAY_TOKEN` pessoal em CI.

### 5. Planejar e aplicar a configuração

1. Abra um terminal na raiz do repositório, onde está `.railway/railway.ts`.
2. Se a pasta ainda não estiver vinculada e o CLI exigir um projeto, crie e vincule apenas um com `railway init --name ensaios-ia-whatsapp-pilot --workspace "<workspace dedicado>"`. Depois selecione o ambiente de produção. Não crie um projeto duplicado. [CLI `init`](https://docs.railway.com/cli/init)
3. Gere apenas o plano:

```powershell
railway config plan
```

4. Leia todas as mudanças. O plano deve corresponder somente a `postgres`, `media`, `web` e `worker`, às regiões da tabela acima e às referências de variáveis descritas aqui. Os valores de variáveis são redigidos por padrão; nunca use `--show-values` nem `--decrypt-variables`. Pare se aparecer domínio público para banco, worker ou Bucket; variável pública de banco; segredo em texto; exclusão inesperada; mudança fora do piloto; ou região diferente.
5. Salve o plano redigido como evidência e peça a aprovação operacional dos responsáveis. Aplicar a IaC cria recursos faturáveis e pode iniciar deploys de `web` e `worker` a partir da branch `main`. Só depois da aprovação execute:

```powershell
railway config apply
```

O comando reapresenta o plano. Confira novamente antes de confirmar; não aceite mudança que não corresponda ao plano aprovado. A IaC é TypeScript e o `config plan` é a revisão antes do `config apply`. [Railway IaC](https://docs.railway.com/infrastructure-as-code) · [CLI de configuração](https://docs.railway.com/cli/config)

### 6. Cadastrar o segredo de smoke e verificar os serviços

1. Na Railway, abra somente o ambiente de produção e o serviço `web`. Cadastre `PRODUCTION_SMOKE_SECRET` no escopo de variáveis do serviço, usando o gerenciador de senhas. Aplique/reimplante a variável. Não a envie por terminal ou mensagem.
2. Confirme no canvas os quatro recursos, as regiões e a ausência de domínio em `postgres`, `worker` e `media`. Confirme que `DATABASE_URL` é uma referência privada gerenciada e aparece somente em `web` e `worker`.
3. Atribuir um domínio ao `web` já o expõe à internet. Faça isso somente depois da aprovação explícita de exposição e de confirmar que o proxy bloqueia todas as rotas, exceto `/api/health` e as rotas de smoke sintético autenticadas. Em seguida, confirme o certificado HTTPS ativo e teste os limites de rota antes de enviar qualquer requisição sintética. Não há etapa de validar HTTPS antes de atribuir o domínio.
4. Verifique `GET /api/health` no domínio HTTPS e a prontidão `/health` do worker pelos controles internos da Railway. Em um cliente HTTP com cofre de segredos, faça `POST /api/internal/smoke` sem Authorization e confirme 401/403 sem criação de tarefa. Depois envie o mesmo POST com `Authorization: Bearer <segredo>` e sem corpo; espere 202 com um `id`, consulte `GET /api/internal/smoke/<id>` com o mesmo header e confirme conclusão sintética. Não cole o segredo em comandos, histórico do terminal ou mensagens. Confira logs sem segredos ou dados pessoais.
5. Não habilite outras rotas públicas, mídia, foto, dado de cliente, Pix ou tráfego real. O domínio do `web` é público a partir da atribuição; mantenha-o restrito aos endpoints permitidos e ao smoke sintético até todas as verificações e aprovações estarem concluídas.

### 7. Configurar o Bucket e os backups sem liberar tráfego real

1. Confirme que `media` está privado, em `iad`, sem domínio e sem credenciais associadas a `web` ou `worker`. Não suba arquivos reais ou de teste com dados pessoais. A região é imutável; não recrie em outra região por tentativa. A Railway publica cobrança de US$0,015/GB-mês pelo armazenamento do Bucket; egress do próprio Bucket e operações S3 são gratuitos, mas o egress dos serviços não é. Confira o preço atual e concilie o Bucket separadamente. [Buckets e preços](https://docs.railway.com/storage-buckets)
2. A documentação atual da Railway lista ausência de criptografia server-side, versionamento, object lock e lifecycle nativos no Bucket. Isso não prova nem nega a criptografia em repouso da plataforma: validem a proteção, retenção e exclusão com a Railway antes de guardar imagens ou dados pessoais. A integração de armazenamento ainda não existe no código. Quando uma história implementar mídia, ela deverá definir variáveis exatas e acesso somente servidor/worker antes de associar credenciais.
3. Para PostgreSQL, aprove primeiro política de acesso, retenção, custo e metas RPO/RTO. Na aba Backups do serviço, a Railway oferece agenda diária (retenção de 6 dias), semanal (1 mês) ou mensal (3 meses); escolham a frequência conforme o RPO/RTO aprovado e registrem agenda e último sucesso. Backups de volume só restauram no mesmo serviço, projeto e ambiente; não usem esse botão para um teste isolado, pois ele troca o volume do serviço original. Para validar restore isolado, habilitem PITR apenas após aprovar sua configuração e custo de armazenamento; escolham um horário sintético e usem **Restore to this moment**, que cria um serviço Postgres irmão no mesmo projeto/ambiente e deixa a origem intacta. Mantenham o serviço restaurado privado, sem domínios e sem referências de tráfego de `web`/`worker`; as variáveis de recuperação podem conter acesso ao arquivo PITR, então restrinjam quem pode vê-las. Confiram tarefa/UUID sintético, job retido e efeito idempotente, registrem o resultado e removam o serviço temporário após a evidência. Se PITR/custo não forem aprovados, mantenham o gate de restore fechado. [Guia Railway de backup e restauração PostgreSQL](https://docs.railway.com/guides/postgres-backups-restores)
4. O exercício local `npm run backup:restore:local` não comprova configuração ou restauração de backup do provedor. Mantenha `PRODUCTION_BACKUP_RESTORE_VERIFIED` ausente até a restauração isolada por PITR na Railway passar.

### 8. Reconciliar custos e atualizar as evidências

No mesmo período de cobrança, registre uso e fatura para web/PostgreSQL; faça a apuração do Bucket separadamente. A ausência de métrica ou valor não significa custo zero. Use a CLI da Railway sem compartilhar saídas que contenham dados sensíveis:

```powershell
railway usage --json
railway usage projects --project <project-id> --period previous --json
railway bucket info --json
```

Compare os relatórios com a fatura correspondente, sem estimar gasto pelo número de objetos. Atualize o contrato de uso quando a fonte, período, unidade e valor estiverem confirmados. Depois de aprovar cada evidência, cadastre somente o sinalizador correspondente como `true` no escopo de variáveis do serviço `web` em produção e reimplante. Mantenha qualquer outro sinalizador sem definição até sua própria evidência; tráfego real continua fechado até todos os seis passarem.

## Evidência e replicação por Danillo

Mantenha um único registro operacional acessível aos dois responsáveis, com campos como:

```text
Data/hora UTC e operador:
Commit do repositório:
Workspace e plano aprovados:
Projeto e ambiente Railway:
Fonte/data da conversão BRL→USD e hard limit aplicado:
Alertas 60/80/95 testados (total e categorias):
Responsável e substituto por pausa de gastos:
Regiões, domínios e variáveis confirmados (somente nomes; nunca valores):
Backup programado, retenção e último sucesso:
Restauração isolada (backup/data sintética/resultado):
Período de uso, fatura e Bucket conciliados:
Sinalizadores de produção comprovados e respectivas evidências:
Pendências:
```

Danillo repete as verificações com a própria conta MFA no mesmo workspace e projeto; isso replica a conferência sem criar outro projeto nem compartilhar segredos. Compare o canvas e o resultado de `railway config plan` com a IaC do commit registrado. Não execute `config apply` em mudanças posteriores sem revisão do plano e aprovação do responsável.

## Referências do repositório

- [Checklist de staging, isolamento e gates de produção](./platform-staging.md)
- [Contrato de uso e conciliação](./platform-usage-contract.md)
- [IaC Railway](../.railway/railway.ts)
- [Gate das rotas de produção](../src/adapters/http/production-traffic-gate.ts)

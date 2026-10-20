---
name: ImageSystem
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: modular monolith
scope: MVP de retratos de aniversário por WhatsApp, do primeiro contato à operação dos sócios e entrega.
status: final
created: 2026-10-09
updated: 2026-10-20
binds: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7]
sources:
  - ../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
companions:
  - ../prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md
  - ../prd-ensaios-ia-whatsapp/addendum.md
  - ../ux-ensaios-ia-whatsapp/DESIGN.md
  - ../ux-ensaios-ia-whatsapp/EXPERIENCE.md
---

# Architecture Spine — ImageSystem

## Design Paradigm

Monólito modular TypeScript em um único código-base. A cliente percorre a jornada na conversa nativa do WhatsApp; a aplicação Next.js atende o painel interno e recebe webhooks, enquanto um processo worker Node separado executa tarefas duráveis. Integrações externas ficam atrás de adaptadores; não há serviço independente por capacidade no piloto.

## Invariants & Rules

### AD-1 — Aplicação, worker e fronteiras dos módulos [ADOPTED]

- **Binds:** CAP-1–CAP-7
- **Prevents:** regras e estado divergirem entre serviços implantados independentemente ou módulos alterarem silenciosamente os dados uns dos outros.
- **Rule:** painel e handlers HTTP/webhook executam na aplicação Next.js; tarefas demoradas executam no worker Node em processo separado. Ambos usam os mesmos casos de uso no mesmo código-base. Domínio e aplicação não dependem de Next.js nem de SDKs de provedores. Não extrair serviços por capacidade durante o piloto.

### AD-2 — Propriedade e dependência entre módulos [ADOPTED]

- **Binds:** CAP-1–CAP-7
- **Prevents:** entidades compartilhadas ganharem donos concorrentes ou outros módulos alterarem silenciosamente pagamento, consentimento, mídia, custo ou estado de atendimento.
- **Rule:** Conversas é dona do ID interno estável da cliente, do vínculo de identidades WhatsApp ao ID, do conteúdo da conversa, da evidência de consentimento, do opt-in/opt-out e dos metadados de campanha recebidos. Pedidos/Pagamentos é dono do pedido e pagamento. Retratos é dono das referências de fotos/resultados e dos estados de elegibilidade por imagem, geração, qualidade e entrega. Operação dos Sócios é dona das escalações, solicitações de direitos de dados, atribuição, estado de controle/takeover da conversa e auditoria; Conversas continua dona do consentimento e sua revogação. Orçamento é dono do livro de custos e das reservas. Cada dono expõe casos de uso públicos; os demais usam esses casos e referenciam IDs, sem escrever diretamente em tabelas alheias. Pedidos, consentimentos, limites por cliente, custos e direitos de dados usam o mesmo ID interno de cliente; IDs de telefone/provedor não são chaves de cliente derivadas por outros módulos. Domínio e aplicação não dependem de Next.js nem de SDKs de provedores.

### AD-3 — Estado durável e trabalho recuperável [ADOPTED]

- **Binds:** CAP-3–CAP-7
- **Prevents:** eventos duplicados, falhas parciais ou tentativas concorrentes criarem pedidos, cobranças ou gerações duplicadas, ou declararem uma entrega sem evidência.
- **Rule:** um armazenamento durável é a fonte autoritativa do estado comercial; trabalhos assíncronos usam fila durável e outbox transacional ou garantia equivalente. Autenticar, deduplicar e persistir eventos do provedor antes de confirmar o webhook. Worker e adaptadores são idempotentes, reconciliáveis e usam tentativas limitadas; falhas finais ficam recuperáveis e escalonáveis. Operação dos Sócios persiste o pedido de privacidade antes da confirmação de recebimento e usa outbox/fila durável para notificação ao painel; falha de despacho conserva estado pendente, agenda recuperação e alerta a operação. Para revogação de consentimento ou exclusão que afete trabalho ativo, o caso e a barreira durável `revocation-pending` em Conversas são persistidos atomicamente na mesma transação PostgreSQL coordenada por um caso de uso público; a confirmação de recebimento só ocorre após o commit. A autorização de despacho serializa no mesmo lock/versão e sempre consulta essa barreira: consentimento `ativo` não autoriza trabalho enquanto houver pedido aplicável pendente. Falha ou estado incerto mantém o trabalho bloqueado até reconciliação. Validar qualidade antes do envio. Eventos de mensagem são correlacionados ao ID externo, deduplicados e toleram chegada fora de ordem. Estados distintos: aceito/enviado, entregue, lido (se disponível) e falho. Precedência é por evidência, não ordem de chegada: aceito não regride entregue/lido; lido implica entregue; recibo entregue/lido prevalece sobre falha conflitante para estado da cliente, mas gera conciliação; falha só prevalece sem evidência de entrega. Só recibo explícito satisfaz “entregue”.

### AD-4 — Políticas determinísticas autorizam ações comerciais [ADOPTED]

- **Binds:** CAP-1, CAP-3–CAP-5
- **Prevents:** texto gerado, comprovante da cliente ou estado local liberarem oferta, cobrança ou geração não aprovada.
- **Rule:** IA pode interpretar intenção e preparar respostas/ações tipadas; casos de uso validam catálogo aprovado, autorização, custo e transição permitida. Conversas usa somente FAQ aprovada, faz uma pergunta por vez e não inventa preço ou prazo. Descontos e reembolsos seguem regras determinísticas aprovadas ou decisão explícita de sócio autorizado com confirmação no painel; IA não os cria nem autoriza, e toda decisão fica auditada. Só confirmação autenticada do provedor, correspondente ao pedido, conta recebedora, valor e moeda, autoriza geração paga. Cada item pago tem um único ID de autorização de entrega; eventos/transações repetidos convergem para ele. Novo pagamento após item já atendido vira conciliação/escalação, nunca geração extra automática. Preços só são comunicados após validação de margem; prazo só após teste de capacidade. Prévia e geração adicional exigem aprovação autorizada, reserva de custo e aplicação atômica dos limites por cliente e por dia; prévias têm baixa resolução e marca-d’água.

### AD-5 — Elegibilidade, consentimento e ciclo de vida da mídia [ADOPTED]

- **Binds:** CAP-2, CAP-4–CAP-6
- **Prevents:** imagem inelegível ou dado pessoal ser processado, reutilizado, divulgado ou declarado excluído sem autorização e evidência ligada à imagem e à ação.
- **Rule:** antes de pedir a foto, explicar finalidade, uso de IA, fornecedor/tratamento externo e política aprovada por tipo de dado; Conversas guarda consentimento afirmativo com sujeito, conversa/pedido, finalidade, versão dos termos e horário. Retratos liga cada autorização ao ID exato da foto, resultado de elegibilidade por imagem e destino externo. Antes da submissão, um caso de uso público de Conversas adquire atomicamente uma autorização de despacho vinculada à versão atual do consentimento; revogação e autorização são serializadas pelo mesmo estado durável. Se a revogação vencer, nenhum despacho ocorre; se a autorização de despacho vencer, tratar a chamada como em curso/possivelmente recebida. Troca de foto ou revogação cancela trabalho ainda não despachado. Em retirada posterior à autorização de despacho, suprimir resultado/entrega, pedir exclusão ao provedor quando suportada, registrar estado e escalar; não alegar exclusão sem evidência. Perguntar separadamente se a cliente é adulta e envia a própria foto; não inferir idade pela aparência. Não processar fora do gate fotos de menores, terceiros, grupos/múltiplas pessoas ou pedidos de imitação de celebridade; incerteza segue para sócio. Foto enviada espontaneamente antes do gate não é baixada nem encaminhada e segue a política aprovada de descarte, sem alegação de exclusão sem evidência. Originais e resultados ficam em armazenamento privado; filas e logs guardam referências, nunca bytes da imagem. Publicidade, portfólio e treinamento exigem consentimento separado. Operação deve localizar, fornecer acesso e excluir dados e cópias de fornecedores/backups conforme política; só confirmar conclusão após evidência.

### AD-6 — Autorização e teto de custo [ADOPTED]

- **Binds:** CAP-5, CAP-7
- **Prevents:** trabalho concorrente, gasto comprometido ou custo desconhecido ultrapassar o orçamento aprovado do piloto ou ser reservado/contabilizado mais de uma vez.
- **Rule:** cada ação com custo tem ID estável e uma única reserva autoritativa de Orçamento. Reservar e contabilizar custos comprometidos, reservados, incorridos e ainda não faturados antes de cada ação; a reserva cobre todas as tentativas limitadas, e tentativas usam a mesma reserva ou subações explicitamente ligadas. Reservar, liquidar ou liberar é idempotente. Só liberar após estado terminal do provedor e conciliação da evidência de uso/cobrança vinculada ao ID da ação; liquidar custos confirmados e manter compromissos ainda não faturados; divergência ou saldo desconhecido mantém a reserva bloqueada. O teto do piloto é R$500: anúncios R$220; IA R$110; aplicação, worker, PostgreSQL, Bucket, armazenamento, tráfego de serviço e backups Railway R$65; domínio/acessórios R$25; reserva para tarifas Meta/Pix, câmbio e retentativas R$80. Nenhum saldo migra automaticamente entre categorias. Emitir alertas em 60%, 80% e 95% do total e da categoria; bloquear nova ação paga quando saldo ou custo for desconhecido/insuficiente, ou qualquer teto for alcançado. Antes de gastar em provedor externo, configurar teto no provedor quando disponível; caso contrário, reconciliar manualmente cobranças realizadas, comprometidas e ainda não faturadas antes de retomar. Qualquer um dos dois sócios administradores pode pausar gastos e liberar reserva após a conciliação definida acima, com registro de ator, motivo e horário em auditoria. O limite duro da Railway é defesa adicional da plataforma, não substitui estes limites em BRL.

### AD-7 — Identidade e controle da operação humana [ADOPTED]

- **Binds:** CAP-2, CAP-5–CAP-7
- **Prevents:** ação sensível sem responsável identificável, atendimento humano perdido ou resposta automática concorrente com um sócio.
- **Rule:** somente Isaac e seu sócio têm acesso ao painel, cada um por conta individual incluída explicitamente na lista permitida e protegida por MFA; não há cadastro público nem credenciais compartilhadas. Ambos são administradores e qualquer um pode executar ações administrativas permitidas, inclusive pausar gastos e liberar reserva após conciliação; não se exige dupla aprovação. A lista de ações que exigem confirmação explícita é: autorizar gasto/geração, alterar pagamento/preço/desconto/reembolso, liberar reserva, baixar/exportar/excluir dado pessoal, mudar acesso e assumir/retomar conversa. Cada confirmação fica vinculada ao ator autenticado, ação, objeto e estado vigente e é auditada com horário e motivo. A visualização normal no painel não pede confirmação adicional, mas exige autenticação, autorização por objeto em cada requisição e registro de acesso. Leituras de mídia fazem proxy pelo servidor autenticado; nunca expor URL pré-assinada ao navegador, pois ela permite leitura até expirar. Em caso de negação, não revelar bytes, metadados, nome ou existência. Pedidos humanos, privacidade, falha ou feedback negativo criam escalação com contexto acionável, responsável, prioridade/estado e idade e notificam os sócios. Takeover usa conversation ID como escopo canônico e um estado/versão durável de controle pertencente a Operação dos Sócios. Envio automático e takeover serializam nesse mesmo controle: takeover invalida respostas antigas já enfileiradas e só é confirmado depois de cancelar ou concluir o despacho externo em curso; o despachante revalida a versão imediatamente antes do envio. Retomada explícita avança a versão. A primeira resposta humana ocorre em até 24 horas; não prometer prazo de resolução.

### AD-8 — Implantação web e worker [ADOPTED]

- **Binds:** CAP-1–CAP-7
- **Prevents:** webhook ou geração depender de execução efêmera, banco/objetos expostos ou provedor incompatível com o limite de custo e privacidade.
- **Rule:** produção executa servidor Next.js em Node, worker Node de longa duração e PostgreSQL no Railway, com fila pg-boss no mesmo PostgreSQL e sem Redis. Região escolhida para app, worker e PostgreSQL: US East / Virgínia (`us-east4-eqdc4a`). Objetos usam Railway Bucket privado S3-compatible na região IAD (`iad`), com credenciais somente no servidor/worker; manter instâncias e credenciais separadas por ambiente. Preços Railway combinam assinatura de plano e uso de recursos; a tabela consultada não publica tarifas regionais diferentes, então não há base para afirmar que outra região seja mais barata. Virgínia/IAD é a região disponível geograficamente mais próxima de São Paulo e a escolha inicial, não garantia de latência; antes do tráfego real, definir meta numérica p95 e medir respostas da aplicação desde São Paulo, separadas do tempo de provedores externos. A região do Bucket é imutável após criação. Embora os objetos sejam privados por credencial, o Bucket não oferece conexão pela rede privada; uploads a partir dos serviços usam a rede pública e contam como service egress. No painel, mídia passa por proxy autenticado no servidor, que revalida autorização por objeto em cada requisição; não expor URLs pré-assinadas. Validar localização e transferência internacional de todos os dados pessoais tratados pela Railway nos EUA — não apenas fotos —, criptografia adequada, retenção/exclusão e cópias/backup antes de dados reais. Tarefas de banco usam a rede privada e `DATABASE_URL`; webhooks usam HTTPS. Conteúdo pessoal não entra em cache compartilhado; revisar padrões do Next.js antes das rotas privadas. Backups incluem teste de restauração. Manter a base sintética de produção enquanto épicos dependentes a utilizarem; após aceite, remover fixtures sintéticas e conservar apenas evidência operacional não pessoal. Limites duros Railway, cobrados em USD por ciclo, não substituem ledger em BRL nem garantem sozinhos o teto por categoria.

### AD-9 — Fronteira e política do WhatsApp [ADOPTED]

- **Binds:** CAP-1, CAP-2, CAP-4, CAP-6
- **Prevents:** jornada da cliente derivar para um produto separado ou mensagens ativas ignorarem consentimento e regras do canal.
- **Rule:** o sistema começa na primeira mensagem recebida; perguntas, oferta, consentimento, foto, prévia, entrega e feedback permanecem na conversa nativa do WhatsApp. Anúncio e clique do Instagram ficam fora do sistema; registrar somente metadados de campanha que o canal fornecer. Não criar app, login, formulário obrigatório ou portal para a cliente. Registrar opt-in/opt-out e verificar janela, template e elegibilidade antes de cada contato ativo; validar regras vigentes e custo do canal antes do lançamento.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Naming and ownership | IDs CAP e estados seguem PRD/spec; cada módulo expõe casos de uso próprios e controla suas escritas. |
| Money and time | Valores em BRL usam centavos inteiros; horários persistidos em UTC e convertidos para exibição. |
| External events | IDs externos e chaves de idempotência únicas ficam associados aos IDs internos; eventos Pix validam provedor, pedido, conta, valor e moeda; web, worker e provedor são correlacionáveis. |
| State and security | Usar transições explícitas; segredos fora do código; logs redigidos sem fotos, conversa integral, tokens ou credenciais. |
| Conversation | Seguir FAQ aprovada, uma pergunta por vez; registrar opt-in/opt-out e elegibilidade da mensagem antes de contato ativo. Feedback e follow-up respeitam regras do canal. |
| Panel accessibility | Aplicar DESIGN.md: contraste mínimo, foco visível, estados com texto/ícone, motivo de ações indisponíveis e informação essencial fora de tooltips. |

## Stack

| Name | Version | Status |
| --- | --- | --- |
| TypeScript | 6.0.3 | Versão fixada pelo repositório. A opção `useTypeScriptCli` do Next.js é experimental e não recomendada para produção ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli)) |
| Node.js | 24 LTS | Runtime recomendado para aplicação e worker |
| Next.js | 16.4.2 | Framework escolhido; versão estável atual e acima do patch de segurança 16.4.1 ([release](https://github.com/vercel/next.js/releases/tag/v16.4.2), [aviso](https://nextjs.org/blog/nextjs-security-update-october-14-2026)) |
| PostgreSQL | 18.6 | Banco escolhido para produção no Railway; confirmar imagem suportada e manter compatibilidade com o smoke local |
| pg-boss | 12.37.1 (pin atual do repositório) | Fila durável para PostgreSQL, sem Redis. A versão 12.38.0 já existe e migra o schema para v46; revisar migração e mudanças de comportamento antes de atualizar para produção ([12.37.1](https://github.com/timgit/pg-boss/releases/tag/12.37.1), [12.38.0](https://github.com/timgit/pg-boss/releases/tag/12.38.0)) |
| Railway | Atual | Hospedagem escolhida para aplicação, worker e PostgreSQL; região US East / Virgínia |
| Railway Bucket | S3-compatible | Armazenamento privado de objetos, região IAD (`iad`); uso para fotos reais depende dos gates de privacidade, criptografia e retenção |

Decisão de 2026-10-20: PostgreSQL e pg-boss, já usados pelo smoke local/CI, são a base selecionada para produção na Railway; o registro de domínio e o job permanecem na mesma transação. O repositório fixa pg-boss 12.37.1; a versão 12.38.0 introduz schema v46 e migração, então revisar a migração e seus efeitos antes de atualizar o pin de produção. A aplicação usará o Railway Bucket privado para objetos, mantendo credenciais apenas no servidor e no worker. A tabela de preços Railway consultada não publica tarifas regionais diferentes; portanto não há base para afirmar que outra região seja mais barata. US East / Virgínia e Bucket IAD foram escolhidos por serem as opções disponíveis mais próximas de São Paulo, como melhor estimativa geográfica de latência. A latência real será medida após implantação; ainda não há benchmark. A região do Bucket é imutável após criação. A documentação atual registra ausência de server-side encryption, versionamento e lifecycle no Bucket; isso não determina por si só a criptografia em repouso da plataforma e precisa de validação antes de imagens reais. O storage cobra US$0,015/GB-mês e o service egress dos uploads é faturado à parte. Fontes operacionais: [preços](https://docs.railway.com/pricing), [regiões de serviço](https://docs.railway.com/deployments/regions), [regiões do Bucket](https://docs.railway.com/cli/bucket), [Storage Buckets](https://docs.railway.com/storage-buckets) e [cobrança do Bucket](https://docs.railway.com/storage-buckets/billing). A ferramenta de migração ainda será escolhida conforme a implementação real; backups do banco devem ser habilitados e testados, com cópia lógica portátil.

## Structural Seed

~~~mermaid
flowchart LR
  customer["Cliente no WhatsApp"] --> channel["Provedor de mensagens"]
  channel --> hook["Next.js: Route Handler de webhook"]
  partners["Sócios"] --> panel["Next.js: painel autenticado"]
  hook --> usecases["Casos de uso dos módulos"]
  panel --> usecases
  usecases --> durable["Armazenamento durável + outbox/fila"]
  durable --> worker["Worker Node: processo dedicado"]
  worker --> usecases
  usecases --> adapters["Adaptadores externos"]
  adapters --> pix["Provedor Pix"]
  adapters --> ai["Provedores de IA"]
  adapters --> media["Railway Bucket privado"]
~~~

~~~mermaid
flowchart TD
  inbound["Painel e webhooks Next.js"] --> app["Casos de uso da aplicação"]
  worker["Handlers do worker"] --> app
  app --> domain["Domínio dos módulos"]
  app --> ports["Portas declaradas pelos módulos"]
  adapters["Adaptadores de banco, fila, canal, Pix, IA e mídia"] -. implementam .-> ports
~~~

~~~text
src/
  app/                 # Painel dos sócios e handlers HTTP/webhook
  modules/
    conversations/     # FAQ, consentimento, canal e atribuição recebida
    orders-payments/   # Catálogo, pedidos e confirmação Pix
    portraits/         # Elegibilidade, aprovação, geração, qualidade e entrega
    partner-operations/# Escalações, direitos de dados, auditoria e retomada
    budget/            # Reserva, conciliação e bloqueios de custo
  worker/              # Consumidores da fila durável em processo Node separado
  adapters/            # Canal, Pix, IA, mídia, persistência e fila
~~~

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
| --- | --- | --- |
| CAP-1 — intenção, FAQ e oferta | conversations, orders-payments | AD-2, AD-4, AD-9 |
| CAP-2 — elegibilidade, consentimento e direitos | conversations, portraits, partner-operations | AD-2, AD-5, AD-7 |
| CAP-3 — pedido e Pix | orders-payments | AD-3, AD-4 |
| CAP-4 — geração, qualidade e entrega | portraits, worker | AD-1, AD-3, AD-5 |
| CAP-5 — prévia e aprovação | portraits, partner-operations, budget | AD-4, AD-6, AD-7 |
| CAP-6 — atendimento humano, privacidade e pós-venda | partner-operations, conversations | AD-2, AD-5, AD-7, AD-9 |
| CAP-7 — custos e decisão do piloto | budget, partner-operations | AD-3, AD-6, AD-8 |

## Deferred

- **Migrações e recuperação:** escolher ferramenta de migração versionada; confirmar versão da imagem PostgreSQL Railway, habilitar backups/PITR quando aplicável e testar restauração isolada e cópia lógica portátil antes de dados operacionais.
- **Controles efetivos de custo Railway:** configurar alerta e limite duro em USD compatíveis com o teto em BRL, considerando câmbio, taxas e ciclo de faturamento; o limite duro pode desligar todas as workloads. Bucket acima do limite de storage pode ficar inacessível enquanto dados armazenados continuam cobrando; reconciliar também o egress dos serviços.
- **Bucket e dados pessoais:** Bucket escolhido e privado; região IAD não pode ser alterada. Avaliar localização nos EUA, transferência internacional de todos os dados pessoais, criptografia adequada, controle de credenciais, retenção, exclusão e cópias antes de qualquer dado real. Não há suporte documentado atual a server-side encryption, versionamento de objetos ou lifecycle no Bucket.
- **Latência da região:** Virgínia/IAD é apenas estimativa geográfica. Antes do tráfego real, definir uma meta numérica p95 para a resposta da aplicação medida em São Paulo, separada do tempo dos provedores externos; medir a implantação e reavaliar região/rota se não cumprir.
- **Patch de segurança Next.js:** o repositório ainda fixa Next.js 16.4.0. O aviso oficial de 2026-10-14 inclui 16.4.0 nas versões afetadas por duas vulnerabilidades críticas e uma alta, corrigidas a partir de 16.4.1; a versão estável atual consultada é 16.4.2. Atualizar e verificar o lockfile antes de qualquer deploy exposto ([aviso oficial](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [release 16.4.2](https://github.com/vercel/next.js/releases/tag/v16.4.2)).
- **Migração de pg-boss:** o repositório fixa 12.37.1; 12.38.0 é o release atual consultado e migra o schema para v46. Revisar migração, leituras limitadas/paginadas e semântica de exclusões em lote antes de atualizar e validar o lockfile para produção ([release 12.38.0](https://github.com/timgit/pg-boss/releases/tag/12.38.0)).
- **Provedores de WhatsApp, Pix e IA:** antes das integrações; validar preço, limites de gasto, segurança, contratos, disponibilidade e termos de privacidade/retenção.
- **Regras vigentes do WhatsApp:** antes do lançamento, validar opt-in/opt-out, janela de atendimento, templates aprovados, custos e elegibilidade de mensagens de entrega, feedback e follow-up.
- **Política por tipo de dado:** antes de pedir ou encaminhar foto; definir fornecedor, tratamento externo, retenção e marco inicial, exclusão e exceções para originais, resultados, conversa/consentimento, backups e cópias de fornecedores.
- **Identidade e MFA:** escolher provedor/implementação e cadastrar apenas as duas contas individuais de Isaac e do sócio antes do painel em produção; MFA, allowlist e auditoria são obrigatórios. Definir verificação para vincular nova identidade de canal à cliente existente.
- **Autorização administrativa:** os dois sócios são admins e qualquer um pode pausar gastos/liberar reserva após conciliação, com auditoria. Implementar checks explícitos por ação; nenhuma outra conta acessa o painel.
- **Regras comerciais e de qualidade:** antes de anúncio/geração paga, validar margem, preços, prazo após teste de capacidade, critérios de qualidade, tentativas, ajustes/reembolso e limites de prévia por pessoa/dia. R$19,90 / R$39,90 / R$59,90 para 1 / 5 / 10 imagens são hipóteses, não oferta ativa; ETA segue pendente.
- **Limites de gasto:** teto total e categorias aprovados em 2026-10-20 e registrados em AD-6. Antes de cobrança externa, configurar limites do provedor quando possível; senão exigir conciliação manual. Incluir câmbio, impostos, egress, custos não faturados e valores comprometidos no ledger.
- **Operação humana e pós-venda:** definir canal/prioridade de notificação, cobertura de atendimento, falhas de envio ao painel e cadência de feedback; manter a primeira resposta em até 24h e sem promessa de resolução.
- **Observabilidade e recuperação em produção:** antes do lançamento, definir monitoração mínima da aplicação/worker, webhooks, fila, falhas de entrega e bloqueios de custo; nomear quem recebe alertas e os passos de recuperação/reconciliação dos sócios.
- **Migração para TypeScript 7:** 7.0.2 é estável, mas a opção `useTypeScriptCli` do Next.js está marcada experimental e não recomendada para produção; manter 6.0.3 até haver caminho de produção estável ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli)).
- **Compatibilidade do bootstrap Next.js:** verificar configuração inicial e comportamento de cache de rotas privadas no Next.js 16.4 antes de implementar o painel e dados de clientes.
- **Painel e acessibilidade:** confirmar dispositivo, breakpoints, fontes fallback, largura, grid e espaçamento antes do handoff visual; confirmar alvo provisório WCAG 2.2 AA, teclado, foco e reflow em 320 CSS px.
- **Atribuição de campanha:** definir campos e retenção quando o provedor do canal efetivamente fornecer metadados; não pressupor acesso a dados do anúncio/clique do Instagram.

---
name: ImageSystem
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: modular monolith
scope: MVP de retratos de aniversário por WhatsApp, do primeiro contato à operação dos sócios e entrega.
status: final
created: 2026-10-09
updated: 2026-10-09
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
- **Rule:** Conversas é dona do ID interno estável da cliente, do vínculo de identidades WhatsApp ao ID, do conteúdo da conversa, da evidência de consentimento, do opt-in/opt-out e dos metadados de campanha recebidos. Pedidos/Pagamentos é dono do pedido e pagamento. Retratos é dono das referências de fotos/resultados e dos estados de elegibilidade por imagem, geração, qualidade e entrega. Operação dos Sócios é dona das escalações, atribuição, estado de controle/takeover da conversa e auditoria. Orçamento é dono do livro de custos e das reservas. Cada dono expõe casos de uso públicos; os demais usam esses casos e referenciam IDs, sem escrever diretamente em tabelas alheias. Pedidos, consentimentos, limites por cliente, custos e direitos de dados usam o mesmo ID interno de cliente; IDs de telefone/provedor não são chaves de cliente derivadas por outros módulos. Domínio e aplicação não dependem de Next.js nem de SDKs de provedores.

### AD-3 — Estado durável e trabalho recuperável [ADOPTED]

- **Binds:** CAP-3–CAP-7
- **Prevents:** eventos duplicados, falhas parciais ou tentativas concorrentes criarem pedidos, cobranças ou gerações duplicadas, ou declararem uma entrega sem evidência.
- **Rule:** um armazenamento durável é a fonte autoritativa do estado comercial; trabalhos assíncronos usam fila durável e outbox transacional ou garantia equivalente. Autenticar, deduplicar e persistir eventos do provedor antes de confirmar o webhook. Worker e adaptadores são idempotentes, reconciliáveis e usam tentativas limitadas; falhas finais ficam recuperáveis e escalonáveis. Validar qualidade antes do envio. Eventos de mensagem são correlacionados ao ID externo, deduplicados e toleram chegada fora de ordem. Estados distintos: aceito/enviado, entregue, lido (se disponível) e falho. Precedência é por evidência, não ordem de chegada: aceito não regride entregue/lido; lido implica entregue; recibo entregue/lido prevalece sobre falha conflitante para estado da cliente, mas gera conciliação; falha só prevalece sem evidência de entrega. Só recibo explícito satisfaz “entregue”.

### AD-4 — Políticas determinísticas autorizam ações comerciais [ADOPTED]

- **Binds:** CAP-1, CAP-3–CAP-5
- **Prevents:** texto gerado, comprovante da cliente ou estado local liberarem oferta, cobrança ou geração não aprovada.
- **Rule:** IA pode interpretar intenção e preparar respostas/ações tipadas; casos de uso validam catálogo aprovado, autorização, custo e transição permitida. Conversas usa somente FAQ aprovada, faz uma pergunta por vez e não inventa preço ou prazo. Só confirmação autenticada do provedor, correspondente ao pedido, conta recebedora, valor e moeda, autoriza geração paga. Cada item pago tem um único ID de autorização de entrega; eventos/transações repetidos convergem para ele. Novo pagamento após item já atendido vira conciliação/escalação, nunca geração extra automática. Preços só são comunicados após validação de margem; prazo só após teste de capacidade. Prévia e geração adicional exigem aprovação autorizada, reserva de custo e aplicação atômica dos limites por cliente e por dia; prévias têm baixa resolução e marca-d’água.

### AD-5 — Elegibilidade, consentimento e ciclo de vida da mídia [ADOPTED]

- **Binds:** CAP-2, CAP-4–CAP-6
- **Prevents:** imagem inelegível ou dado pessoal ser processado, reutilizado, divulgado ou declarado excluído sem autorização e evidência ligada à imagem e à ação.
- **Rule:** antes de pedir a foto, explicar finalidade, uso de IA, fornecedor/tratamento externo e política aprovada por tipo de dado; Conversas guarda consentimento afirmativo com sujeito, conversa/pedido, finalidade, versão dos termos e horário. Retratos liga cada autorização ao ID exato da foto, resultado de elegibilidade por imagem e destino externo; valida consentimento ainda ativo pelo caso de uso público de Conversas imediatamente antes de enviar ao provedor. Troca de foto ou revogação invalida trabalho ainda não enviado. Perguntar separadamente se a cliente é adulta e envia a própria foto; não inferir idade pela aparência. Não processar fora do gate fotos de menores, terceiros, grupos/múltiplas pessoas ou pedidos de imitação de celebridade; incerteza segue para sócio. Foto enviada espontaneamente antes do gate não é baixada nem encaminhada e segue a política aprovada de descarte, sem alegação de exclusão sem evidência. Originais e resultados ficam em armazenamento privado; filas e logs guardam referências, nunca bytes da imagem. Publicidade, portfólio e treinamento exigem consentimento separado. Operação deve localizar, fornecer acesso e excluir dados e cópias de fornecedores/backups conforme política; só confirmar conclusão após evidência.

### AD-6 — Autorização e teto de custo [ADOPTED]

- **Binds:** CAP-5, CAP-7
- **Prevents:** trabalho concorrente, gasto comprometido ou custo desconhecido ultrapassar o orçamento aprovado do piloto ou ser reservado/contabilizado mais de uma vez.
- **Rule:** cada ação com custo tem ID estável e uma única reserva autoritativa de Orçamento. Reservar e contabilizar custos comprometidos, reservados, incorridos e ainda não faturados antes de cada ação; reserva cobre todas as tentativas limitadas, e tentativas usam a mesma reserva ou subações explicitamente ligadas. Reservar, liquidar ou liberar é idempotente; manter custo comprometido até resultado terminal e conciliação de cobranças pendentes. Bloquear nova ação paga quando saldo for desconhecido/insuficiente ou o teto for alcançado; manter bloqueio até conciliação e liberação explícita de sócio autorizado pela matriz de permissões, registrada em auditoria. O teto total do piloto é R$500 incluindo todos os custos; limites por categoria e despesas externas sem controle automático precisam de mecanismo de teto ou reconciliação antes de operar. Alertas não substituem a autorização síncrona.

### AD-7 — Identidade e controle da operação humana [ADOPTED]

- **Binds:** CAP-2, CAP-5–CAP-7
- **Prevents:** ação sensível sem responsável identificável, atendimento humano perdido ou resposta automática concorrente com um sócio.
- **Rule:** cada sócio usa conta individual protegida por MFA. Verificar permissão explícita antes de ação sensível. Registrar ator, horário e ação em aprovações, geração adicional, decisões financeiras, atendimento de privacidade e liberação de orçamento. Pedidos humanos, privacidade, falha ou feedback negativo criam escalação com contexto acionável, responsável, prioridade/estado e idade e notificam os sócios. Takeover usa conversation ID como escopo canônico e um estado/versão durável de controle pertencente a Operação dos Sócios. Envio automático e takeover serializam nesse mesmo controle: takeover invalida respostas antigas já enfileiradas e só é confirmado depois de cancelar ou concluir o despacho externo em curso; o despachante revalida a versão imediatamente antes do envio. Retomada explícita avança a versão. A primeira resposta humana ocorre em até 24 horas; não prometer prazo de resolução.

### AD-8 — Implantação web e worker [ADOPTED]

- **Binds:** CAP-1–CAP-7
- **Prevents:** webhook ou geração depender de execução efêmera, banco/objetos expostos ou provedor incompatível com o limite de custo e privacidade.
- **Rule:** produção executa servidor Next.js em Node e worker Node de longa duração; webhooks usam HTTPS. Ambientes e segredos são separados; banco e mídia são privados; conteúdo pessoal não entra em cache compartilhado; revisar padrões de cache do Next.js antes das primeiras rotas privadas. Backups incluem teste de restauração. Escolher hospedagem somente após validar custo total, controle real de gasto, região e termos de privacidade/retenção.

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
| TypeScript | 6.0.3 | Baseline conservadora para produção; CLI de TypeScript 7 do Next é experimental ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli)) |
| Node.js | 24 LTS | Runtime recomendado para aplicação e worker |
| Next.js | 16.4.0 | Framework escolhido; versão estável verificada em 2026-10-09 ([fonte](https://nextjs.org/blog)) |
| PostgreSQL | 18.6 | Adotado para o smoke local/CI da história 1.1; provedor externo pendente |
| pg-boss | 12.37.1 | Adotado para fila transacional do smoke local/CI da história 1.1 ([release](https://github.com/timgit/pg-boss/releases/tag/12.37.1)) |

Decisão de 2026-10-15: PostgreSQL e pg-boss formam a base técnica local da história 1.1. O registro do smoke e o job são gravados na mesma transação. A escolha não autoriza hospedagem externa, região ou gasto; a ferramenta de migração e o procedimento de backup/restauração ainda serão definidos antes da operação externa.

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
  adapters --> media["Armazenamento privado"]
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

- **Migrações e operação externa do armazenamento:** escolher migrações versionadas e validar durabilidade, transações, backups, restauração, custo e privacidade antes de implantar fora do ambiente local/CI. PostgreSQL 18.6 e pg-boss 12.37.1 foram adotados apenas como base técnica local.
- **Hospedagem, região e controles do custo da plataforma:** antes da implantação; validar custo total e limite efetivo de gasto dentro do teto de R$500.
- **Provedores de WhatsApp, Pix, IA e objetos:** antes das integrações; validar preço, segurança, contratos, disponibilidade e termos de privacidade/retenção.
- **Regras vigentes do WhatsApp:** antes do lançamento, validar opt-in/opt-out, janela de atendimento, templates aprovados, custos e elegibilidade de mensagens de entrega, feedback e follow-up.
- **Política por tipo de dado:** antes de pedir ou encaminhar foto; definir fornecedor, tratamento externo, retenção e marco inicial, exclusão e exceções para originais, resultados, conversa/consentimento, backups e cópias de fornecedores.
- **Identidade e MFA:** escolher provedor/implementação antes do painel em produção; contas individuais, MFA e auditoria permanecem obrigatórios. Definir verificação para vincular novo número/identidade de canal à cliente existente antes de produção.
- **Matriz de autorização dos sócios:** definir antes do painel em produção quais ações cada sócio pode executar e quais, se houver, exigem aprovação dos dois; nenhuma permissão é presumida pela existência de conta.
- **Regras comerciais e de qualidade:** antes de anúncio/geração paga, validar margem, preços, prazo após teste de capacidade, critérios de qualidade, tentativas, ajustes/reembolso e limites de prévia por pessoa/dia. R$19,90 / R$39,90 / R$59,90 para 1 / 5 / 10 imagens são hipóteses, não oferta ativa; ETA segue pendente.
- **Teto por categoria e gastos externos:** definir antes de operar; despesas que o sistema não controla exigem limite no próprio provedor ou reconciliação antes de liberar novas ações com custo.
- **Operação humana e pós-venda:** definir canal/prioridade de notificação, cobertura de atendimento, falhas de envio ao painel e cadência de feedback; manter a primeira resposta em até 24h e sem promessa de resolução.
- **Observabilidade e recuperação em produção:** antes do lançamento, definir monitoração mínima da aplicação/worker, webhooks, fila, falhas de entrega e bloqueios de custo; nomear quem recebe alertas e os passos de recuperação/reconciliação dos sócios.
- **Migração para TypeScript 7:** 7.0.2 é estável, mas o checker CLI do Next.js 16.4 está marcado experimental e não recomendado para produção; manter 6.0.3 até haver caminho de produção estável ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli)).
- **Compatibilidade do bootstrap Next.js:** verificar configuração inicial e comportamento de cache de rotas privadas no Next.js 16.4 antes de implementar o painel e dados de clientes.
- **Painel e acessibilidade:** confirmar dispositivo, breakpoints, fontes fallback, largura, grid e espaçamento antes do handoff visual; confirmar alvo provisório WCAG 2.2 AA, teclado, foco e reflow em 320 CSS px.
- **Atribuição de campanha:** definir campos e retenção quando o provedor do canal efetivamente fornecer metadados; não pressupor acesso a dados do anúncio/clique do Instagram.

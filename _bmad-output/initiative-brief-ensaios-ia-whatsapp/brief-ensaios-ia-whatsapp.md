---
product: Ensaios IA por WhatsApp
artifact: product-brief
status: ready-for-bmad-prd
version: '2.0'
date: '2026-10-08'
locale: pt-BR
owners: Dois socios desenvolvedores (nomes comerciais a definir)
source: Plano de Negocio e Arquitetura v2.0
confidentiality: Uso interno - informacoes de negocio confidenciais
---

# Product Brief: Ensaios IA por WhatsApp

> Documento de entrada para o BMAD Method. O nome comercial, provedor de IA, provedor de hospedagem e SLAs finais ainda estao sujeitos a validacao. Nao interpretar valores estimados como cotacoes.

## Executive Summary

Criar um negocio de ensaios fotograficos digitais personalizados com inteligencia artificial, adquirido por anuncios no Instagram que iniciam uma conversa no WhatsApp. O cliente envia sua foto, explica em linguagem natural o resultado desejado, recebe orientacao, conhece o preco, paga um Pix individualizado e recebe os arquivos no proprio WhatsApp. No lancamento, os produtos incluem aniversarios e outros ensaios individuais, como retratos elegantes e datas especiais.

O diferencial esta no atendimento natural e acessivel. Nao ha formulario, menus numerados, comandos, cadastro ou exigencia de conhecimento sobre IA. Um agente conversacional interpreta a intencao e adapta **tom, entusiasmo, comprimento e vocabulario** ao estilo demonstrado pelo cliente, mantendo a identidade da marca e respeitando regras comerciais deterministicas. O agente e transparente sobre ser automatizado quando apresentado ou questionado, sem se passar por uma pessoa.

A operacao e conduzida por dois desenvolvedores, sem n8n e com investimento inicial maximo de R$ 500 para validar a demanda. Dúvidas frequentes, objecoes, pos-venda e parte das reclamacoes sao resolvidas automaticamente; situacoes sensiveis, nao resolvidas ou que exigem autoridade humana geram **notificacoes priorizadas no painel**, com resumo e acao para assumir a conversa. Previas com marca-d'agua dependem de aprovacao manual e de limites financeiros.

## The Problem

- Consumidores interessados em fotos de aniversario ou retratos personalizados nao sabem redigir prompts, editar imagens ou usar ferramentas especializadas.
- Pessoas menos familiarizadas com tecnologia perdem-se em fluxos com varias opcoes, links, logins e etapas desnecessarias.
- Bots de atendimento com respostas fixas soam artificiais, repetem perguntas e nao acompanham o jeito de falar do cliente.
- Compradores desconfiam de pagar antes de conhecer o resultado; oferecer amostras sem controle pode consumir toda a margem do negocio.
- Uma equipe de duas pessoas nao consegue responder individualmente a todas as conversas, e precisa identificar so os casos que necessitam intervencao.
- Integracoes de IA, pagamentos e mensagens criam riscos de cobrancas duplicadas, promessas improcedentes, vazamento de fotos e pedidos perdidos apos falhas.

## The Solution

Uma experiencia **WhatsApp-first e conversation-first** com quatro capacidades:

1. **Agente comercial conversacional:** compreende mensagens livres, inclusive ambiguidade, hesitacao e audio (se habilitado), recupera o contexto e pede apenas a informacao indispensavel que estiver faltando. Responde a duvidas sem interromper a jornada de compra. Personalidade adaptativa: calorosa diante de entusiasmo, serena e objetiva diante de mensagens formais, acolhedora diante de preocupacoes, sem exagero ou manipulacao emocional.
2. **Motor transacional confiavel:** registra tema, pacote, quantidade, preco e consentimento; gera Pix dinamico; reconhece pagamento por evento autenticado e consulta ao provedor; produz imagens com fila persistente e entrega automaticamente. Modelo de IA nunca aprova pagamento, desconto, reembolso ou amostra por conta propria.
3. **Suporte automatico com transferencia inteligente:** resolve FAQ, orientacoes de Pix, status de pedido e primeira tentativa de ajuste; reconhece indignacao, reclamacoes repetidas, contestacao financeira, privacidade, falhas e pedidos expressos de humano. Quando necessario, abre atendimento no painel, prioriza, notifica os socios, suspende respostas comerciais e permite assumir/devolver o atendimento. **Nao exibir continuamente uma opcao de falar com uma pessoa ou um menu de ajuda**, mas nunca bloquear pedido expresso de atendimento humano, reclamacao ou direitos do consumidor.
4. **Painel administrativo proprio:** inbox de escalacoes com filtro por gravidade e SLA; chat em tempo real; resumo, historico e motivo; acoes `Assumir`, `Responder`, `Resolver` e `Retomar IA`; fila de previas sujeitas a aprovacao com orcamento diario/cliente; pedidos, custos, qualidade, publicidade e conciliacao.

### Jornada principal (linguagem natural)

Anuncio Instagram -> conversa WhatsApp -> IA entende tema/intencao -> esclarece necessidades -> informa pacote e preco -> cliente envia foto e autoriza uso -> gera cobranca Pix -> confirma exclusivamente por webhook validado + conciliacao -> worker gera as imagens -> verificacao automatica de qualidade -> entrega no WhatsApp -> IA faz pos-venda contextualizado. Se cliente pedir previa: criacao de solicitacao, aprovacao por um socio, reserva atomica do limite, geracao em baixa resolucao com marca-d'agua, envio e oferta do pacote restante.

## What Makes This Different

- Conversa organica, nao arvore de menus e nao lista artificial de comandos.
- Adaptacao de tom por mensagem sem estereotipar usuarios por idade, genero ou outras caracteristicas.
- Fluxo transacional protegido: liberdade linguistica com limites de operacao codificados.
- Escalacao por necessidade, com painel de notificacoes em vez de depender de vigilancia constante de chats.
- Previa controlada por consentimento, aprovacao, limite financeiro e auditoria.
- Sem dependencia de ferramenta no-code: monorepo TypeScript, adapters para WhatsApp/Pix/IA e infraestrutura portavel.

## Who This Serves

**Primario:** pessoas adultas que veem anuncios de fotos personalizadas e querem um resultado bonito sem aprender tecnologia; inclui pessoas mais velhas e clientes que preferem orientacoes claras em WhatsApp.

**Secundario:** compradores de presentes, familiares, pessoas preparando datas especiais, e clientes cautelosos com pagamento antecipado.

**Usuarios internos:** os dois socios, operando um painel compacto para excecoes, aprovacoes, metricas e conciliacao, sem ter de ler todas as conversas normais.

## Success Criteria

Metas **iniciais a validar**, nao previsoes:

- 100% dos pedidos pagos liberados somente por comprovacao transacional autentica.
- >= 90% das conversas de teste completam a compra sem menus, atalhos ou digitacao de codigos numericos.
- >= 80% das duvidas comuns resolvidas sem intervencao (avaliar por auditoria amostral e reabertura, nao por autoavaliacao da IA).
- 100% dos pedidos explicitos para falar com humano escalados e 100% das reclamacoes graves notificadas.
- >= 95% de entrega efetiva em prazo prometido; falhas abertas automaticamente como incidentes.
- Zero duplicidade de cobranca, imagem faturada ou liberacao de previa em testes de webhook repetido e concorrencia.
- Custo variavel por pedido e por conversa conhecido, inclusive tokens, mensagens WhatsApp, retentativas e previas nao convertidas.
- Campanha inicial respeita teto financeiro total de R$ 500; so escalar com CAC e margem de contribuicao positivos.
- Testes assistidos com no minimo cinco pessoas de baixa afinidade digital sem necessidade de aprender comandos.

## Scope

### MVP - in

- Campanhas Instagram direcionando ao WhatsApp Business Platform oficial.
- Atendimento por IA em portugues brasileiro, estilo dinamico, memoria curta/estruturada e catalogo de ensaios.
- Temas iniciais: aniversario, retrato elegante e data especial individual; pacotes 1/5/10 fotos com precos de teste R$ 19,90/R$ 39,90/R$ 59,90.
- Foto enviada, verificacao basica de qualidade, consentimento e aviso de uso de IA.
- Pix por pedido (adapter de provedor, primeira opcao Asaas), webhooks com idempotencia e verificacao de valor.
- Geracao de imagem com adapter de fornecedor; varias tentativas limitadas; QA basico e fila de excecoes.
- Amostra com marca-d'agua apos aprovacao administrativa e reserva do orcamento.
- IA para FAQ, objecoes e reclamacoes simples; detector de escalacao e monitoramento de frustacao/repeticao.
- Inbox de notificacoes, prioridades, responsavel, bloqueio de dois atendentes simultaneos e handoff humano/IA.
- Painel de pedidos, pagamentos, amostras, conversas, qualidade e custos.
- Deploy de MVP em Railway (recomendado) com alternativa AWS Lightsail; containers Docker; backups; observabilidade e alertas.
- Politica LGPD com armazenamento privado, expiracao, exportacao/exclusao mediante solicitacao e retencao minima.

### MVP - out

- Menu numerado, arvore de dialogo rigida, formulario obrigatorio ou roteiros repetitivos.
- Promocao permanente de botao 'falar com humano', embora solicitacoes explicitas sejam atendidas.
- Geracao de conteudo irrestrito ou edicao livre de prompts pelo cliente.
- Marketplace, afiliados, SaaS para outros comerciantes, aplicativo mobile ou CRM completo.
- Multiplos rostos, grupos grandes, celebridades e usos de imagem sem autorizacao no lancamento.
- Cobrança por cartão, parcelamento e assinaturas no MVP.
- Descontos inventados pela IA e execucao automatica de estorno sem autorizacao.
- AWS ECS/Fargate, Kubernetes ou arquitetura de microsservicos no MVP.

### Boundary Conditions / Rules

- LLM interpreta e redige; backend aplica politicas e executa tools tipadas. Uma resposta gerada nunca e fonte de verdade de dinheiro ou permissao.
- IA pode **solicitar** actions `quote`, `create_order`, `send_pix`, `request_sample`, `get_order_status`, `escalate_ticket`, mas o backend valida estado, permissao e idempotencia.
- Nunca revelar fotos privadas sem autorizacao, compartilhar fotos com outros clientes ou simular permissao inexistente.
- Quando frustracao importante, disputa financeira, exclusao de dados, reembolso ou humano expresso: escalonar, confirmar recebimento e nao prometer resolucao automatica.
- Atendimento humano possui `conversation_mode=HUMAN`; o bot fica suspenso ate retomada explicita. Mensagens transacionais devem seguir regra separada para evitar contradicao.
- Janela WhatsApp de 24 h, templates e precificacao de mensagens devem ser validados na conta WABA e na documentacao oficial vigente em outubro/2026.
- Nao afirmar ser humano. Ser claro sobre atendimento automatizado de forma natural, conforme diretrizes da plataforma e transparencia ao consumidor.

## Technical Direction (guardrails for PRD/Architecture)

- **Repositorios:** monorepo TypeScript (pnpm), apps/api (Fastify), apps/worker, apps/admin (Next.js), packages/domain, packages/db (Drizzle/PostgreSQL), packages/integrations, packages/ai, packages/shared; Docker multi-stage e Docker Compose local.
- **Estado:** conversacao e pedido separados; intents/slots persistentes; historico resumido; LLM com saida estruturada `intent`, `entities`, `tone`, `confidence`, `escalation`, `response_draft`, `requested_action`; gate de politicas antes de executar ferramentas.
- **Fila:** PostgreSQL + pg-boss, com outbox transacional, DLQ, retries limitados, ids idempotentes e reconciliação periodica; sem Redis na primeira versao.
- **Painel:** login com MFA, RBAC `admin`/`operator`, inbox de escalacoes com SSE ou polling, auditoria e atualizacao em tempo real.
- **Deploy candidato A:** Railway API + worker + Postgres, dominio HTTPS para webhooks, frontend opcionalmente no mesmo ambiente ou Vercel; bucket privado S3-compatível. GitHub Actions, envs, backups e limites de gasto. **O plano de US$ 5 e credito de consumo nao limita custo total a US$ 5.**
- **Deploy candidato B:** AWS Lightsail VM com Docker Compose, Caddy, API, worker, painel e Postgres; backup criptografado offsite, firewall apenas 80/443 e SSH restrito, monitoramento. Menos custo em potencial, mais operacao.
- **Alternativas:** Cloud Run + DB externo, Render plano pago; nao usar free tiers que dormem para webhooks criticos.
- **Integracoes:** Meta WhatsApp Cloud API; Asaas Pix; provedor de modelo conversacional; provedor de imagem; armazenamento em bucket privado.

## Initial Delivery Plan

1. Fundacao, politicas de negocio, testes e sistema de eventos persistentes.
2. Conversa livre com memoria e estilo adaptativo + testes de tom/intencao.
3. Pedidos + Pix sandbox + geracao de 1 imagem + entrega via WhatsApp.
4. Suporte automatico, escalacao, notificacoes e handoff com exclusao mutua.
5. Previa autorizada + limites de custo + painel de metricas e custos.
6. Deploy HTTPS, backups, logs, testes de falhas e piloto de anuncios pequeno.

**Ownership sugerido:** Dev A: API, integracoes, dominio, pagamento e worker; Dev B: agente conversacional, qualidade, painel/inbox e UX; ambos: seguranca, testes e deploy.

## Risks and Open Decisions

| Item | Posicao inicial | Validacao necessaria |
| --- | --- | --- |
| Nome e identidade da marca | A definir | Registro comercial e textos de transparencia |
| Provedor de texto e de imagem | Abstracao por interfaces | Custo real e fidelidade facial comparados |
| SLA de atendimento humano | Horario comercial, prioridade alta | Disponibilidade dos dois socios |
| Previsao de entrega | Prazo confirmado apenas apos testes | Capacidade e taxa de retentativa |
| Politica de revisao e reembolso | Documento escrito antes de vender | Verificacao juridica e teste com usuarios |
| Infraestrutura | Railway como recomendacao inicial | Cotacao e teste de deploy de API + worker + banco |
| Regras Meta sobre IA e mensagens | Assistente de comercio especializado | Elegibilidade da conta WABA e rate card atual |
| Precos e limite de previa | 19,90 / 39,90 / 59,90; teto conservador | Conversao, CAC e margem |

## Vision

Validar um produto rentavel de ensaios individuais no WhatsApp; apos atingir qualidade, repetibilidade e boa margem, ampliar catalogo, experimentar planos de presente e desenvolver recursos para recompra e indicacao. A arquitetura pode evoluir para mais campanhas, fornecedores de IA e canais, mantendo uma jornada extremamente simples para o cliente.

## BMAD Handoff

**Entrada:** usar este arquivo em `bmad-prd` para criar um PRD com historias, requisitos nao funcionais e criterios de aceite. Em seguida, usar `bmad-ux` para consolidar a experiencia da conversa e do painel, `bmad-architecture` para a arquitetura e `bmad-ticket` para decomposicao em epicos/atividades. No workflow `bmad-product-brief`, este artefato ja e uma primeira versao de brief; solicitar revisao/validacao, nao geracao do zero.

**Prioridade de planejamento:** (1) automacao conversacional que nao pareca menu; (2) suporte e escalacao; (3) controle de pagamentos e custos; (4) operacao confiavel em infra simples. Nao permitir que a IA gerencie dinheiro por instrucao em linguagem natural.

## References

- BMAD Method - Product Brief template: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-product-brief/assets/brief-template.md
- BMAD Method - Planning paths: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/plan/choose-a-planning-path.md
- Meta WhatsApp - atualizacao de cobranca: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages.md/
- Meta WhatsApp - precificacao geral: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md/
- Asaas - webhooks: https://docs.asaas.com/docs/sobre-os-webhooks
- Railway - pricing: https://docs.railway.com/pricing/plans
- Railway - backend SaaS: https://docs.railway.com/guides/saas-backend
- AWS Lightsail - pricing: https://aws.amazon.com/lightsail/pricing/

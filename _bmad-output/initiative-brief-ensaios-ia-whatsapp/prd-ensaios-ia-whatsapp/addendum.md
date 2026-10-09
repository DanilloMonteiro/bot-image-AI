# Addendum — details for downstream planning

This file keeps technical and operational detail from the supplied source plan that informs UX and architecture. Values below are proposals or hypotheses unless explicitly marked as product constraints. The PRD remains the source of customer-facing and operational requirements.

## Technical direction from the source plan

- Proposed TypeScript monorepo using pnpm, with API, worker, admin web app, domain, database, integrations, AI, and shared packages. The proposed API is Fastify; the admin is Next.js; persistence is PostgreSQL through Drizzle.
- Proposed durable job processing uses PostgreSQL with pg-boss, transactional outbox, dead-letter handling, bounded retries, idempotency keys, and periodic reconciliation. Redis is excluded from the initial version.
- Proposed AI boundary: the model returns structured intent, entities, tone, confidence, escalation state, response draft, and requested action. Backend policy checks authorize typed actions; model text is never authoritative for price, payment, refunds, discounts, or sample approval.
- Proposed adapters: Meta WhatsApp Cloud API, Asaas Pix, a conversational model provider, an image-generation provider, and private S3-compatible storage.
- Proposed admin controls include MFA, admin/operator roles, escalation inbox, real-time updates, audit history, and mutual exclusion when an operator takes a conversation.
- Hosting direction: Railway for API, worker, and PostgreSQL is the initial recommendation; AWS Lightsail with Docker Compose is an alternative with more operating work. Both remain subject to quotation and deployment checks. The source explicitly warns that a low monthly plan or credit is not a hard cap on total consumption.
- Deployment proposals include HTTPS webhooks, Docker, backups, observability, alerts, spend limits, restricted network access, and encrypted offsite backups where applicable.

## Provisional operational values and unresolved rules

- Test package prices are R$19.90, R$39.90, and R$59.90 for 1, 5, and 10 images; validate conversion and contribution margin before treating them as final.
- The plan proposes at most one preview per WhatsApp ID in 30 days, an R$8 daily preview budget, and an R$25 monthly preview budget. The brief only confirms that previews require manual approval and daily/customer limits; exact values need confirmation.
- The plan suggests a four-business-hour initial response target for ordinary escalations. The user decided there are no fixed support hours and that the first human response is due within 24 hours; no resolution deadline is defined. The plan’s four-business-hour target is not adopted.
- The plan suggests retaining abandoned-cart data for 7 days and completed-order data for 30 days after delivery. The brief requires minimum retention and deletion support but does not set periods; validate before committing.

- The source plan has inconsistent retry wording: one section proposes 2–3 attempts per image, while an example setting uses MAX_IMAGE_RETRIES=2. Confirm whether this includes the initial attempt.
- The plan proposes counting an approved preview as the first image in a paid package; the brief does not explicitly confirm this accounting rule.
- Escalation priority rules, notification channels, and a resolution deadline remain open; there are no fixed support hours, and the first human response is due within 24 hours.

## Pilot economics to validate

- The R$500 limit is the total pilot ceiling across ad spend and operating/variable costs. The source proposes the allocation below, subject to confirmation; account for incurred but not yet billed charges.
- Track cost per order and conversation, CAC, conversion, contribution margin, delivery success, retries, refunds/revisions, preview conversion, and partner handling time. The numerical targets in the brief are initial hypotheses, not forecasts.
- Any external cost ceiling needs enforcement or provider-level controls; alerts alone may not stop charges immediately.

## External discovery: market examples and official sources

Research accessed 2026-10-08. Competitor statements are vendor claims, not independently verified results; this small sample is not a market-wide benchmark.

- [MAGIC PHOT.IA](https://magicphotoia.com.br/) markets event and keepsake portraits, takes photos through WhatsApp, and displays entry pricing from R$14.90. Its page shows inconsistent delivery-time promises.
- [Perfil Pro](https://ensaios.perfil.pro/) targets professional portraits and displays tiers from R$24.90 to R$97 with different image/style counts and delivery windows.
- [AEVIA](https://aevia.com.br/) positions WhatsApp as a guided portrait-creation flow and addresses privacy and ease-of-use concerns.
- Inference from the sales pages: likely purchase concerns include face likeness, natural appearance, privacy, turnaround, and revision/refund terms. Customer interviews or usability tests are needed to validate them.

- Meta's [Business Messaging Policy](https://business.whatsapp.com/policy/preview?lang=pt_BR) and [Platform Pricing](https://whatsappbusiness.com/products/platform-pricing/) are relevant if the product uses the Business Platform/API. Verify account eligibility and the live Brazil rate card before launch; the public pricing page did not expose the exact Brazil rates in this research pass. Business App/manual messaging is a different cost path.
- The [ANPD technical note on generative AI and personal data](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/documentos-tecnicos-orientativos/sei_anpd-0140555-nota-tecnica.pdf) and [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) warrant legal/privacy validation of the actual image-processing flow. The note distinguishes ordinary photos from processing involving biometric attributes; this is not a settled legal conclusion for this product.
- [ANPD Technical Note 1/2026](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/documentos-tecnicos-orientativos/nota-tecnica-no-1-2026-fis-cgf-anpd.pdf) concerns a separate proceeding and is context only, not a ruling on portrait services.

## Complementos de validação e operação

- O teto de R$500 abrange mídia e custos operacionais. A divisão por categoria, alertas, limites de campanha/API e a rotina para pausar gastos antes de ultrapassar o teto precisam ser definidos; custos incorridos e ainda não faturados entram na reconciliação.
- A fonte sugere Dev A para API, integrações, domínio comercial, pagamento e worker; Dev B para agente conversacional, qualidade, painel/inbox e UX; ambos para segurança, testes e deploy. É uma sugestão de trabalho, não atribuição confirmada.
- A validação comercial proposta inclui simulação de economia unitária e sensibilidade de CAC, campanha pequena, experimento de anúncios, teste assistido com pelo menos cinco pessoas de baixa afinidade digital e decisão de continuar apenas com CAC e margem de contribuição positivos.
- Detalhes de arquitetura a manter fora dos FRs incluem rotas internas, ferramentas tipadas permitidas, estados e transições de pedido/conversa, tabelas e índices únicos, sequência de webhook e worker, reconciliação e reserva atômica de limite de prévia. São insumos para arquitetura e tickets, não escolhas confirmadas pelo PRD.
- A fonte também propõe uma lista de QA visual, limites de custo por saída, pausa do worker em anomalias, e envio direto pelo WhatsApp sem ZIP ou portal externo. Transformar esses pontos em critérios de aceite após confirmar o padrão de qualidade, orçamento por imagem e experiência de entrega.
- Operação do canal deve guardar opt-in/opt-out, janela de 24 horas, uso de templates aprovados fora da janela e salvaguardas contra notificações duplicadas. Validar regras e custos na conta real antes de lançar.

## Proposta orçamentária do plano fonte — valores provisórios

A fonte trata o teto total do piloto como R$500 e sugere esta alocação:

| Categoria | Valor proposto |
| --- | ---: |
| Anúncios no Instagram | R$220 |
| Créditos de IA de texto e imagem | R$110 |
| Hospedagem, banco e backup do piloto | R$65 |
| Domínio e acessórios | R$25 |
| Reserva para Meta, Pix, câmbio e retentativas | R$80 |
| **Total** | **R$500** |

O plano propõe alertas de gasto em 60%, 80% e 95%, parar anúncios no teto e contabilizar custos incorridos ainda não faturados. A regra para interromper uso de provedores e API quando houver risco de ultrapassar o teto segue por confirmar.

### Simulação econômica ilustrativa

Para o pacote de cinco fotos a R$39,90, a fonte estima R$7,50 para imagens/retentativas, R$0,70 de IA conversacional, R$1,00 de WhatsApp, R$1,50 de Pix/gateway, R$1,80 de prévias alocadas e R$0,40 de armazenamento/operação: margem de R$27,00 antes do CAC.

| CAC simulado | Margem após custos variáveis listados e CAC |
| ---: | ---: |
| R$8 | R$19 |
| R$15 | R$12 |
| R$22 | R$5 |

São simulações, não cotações nem previsão de lucro. O plano sugere pausar anúncios quando CAC superar a margem bruta unitária e corrigir clareza do anúncio, semelhança, objeções ou feedback negativo de pagamento/qualidade antes de escalar.

### QA visual e entrega — proposta do plano fonte

O pipeline proposto valida consentimento e arquivo, normaliza orientação/dimensões, verifica um rosto, luz e nitidez adequadas, gera pelo tema/estilo, avalia resultados, retenta dentro de limite, armazena em local privado e acompanha envio por WhatsApp. Exemplos de verificação: semelhança, idade/quantidade de balões, mãos e dedos, pose, artefatos/bordas e aderência ao contexto pedido. Dúvida sobre identidade ou defeito evidente gera ticket; não há promessa de semelhança perfeita.

O plano sugere limites de custo por Pedido/saída/minuto, orçamento diário de API, alertas e pausa do worker em anomalias. A proposta é 2–3 tentativas por imagem, mas um exemplo configura MAX_IMAGE_RETRIES=2; confirmar se o total inclui a primeira tentativa.

Entregar fotos individuais ou arquivo acessível no WhatsApp, com instruções curtas para salvar. Não exigir ZIP, login ou portal externo. Após a janela de 24 horas, usar template aprovado aplicável; não deixar falha de envio silenciosa.

### Suporte, notificações e transações — proposta do plano fonte

Separar tickets urgentes, aguardando, prévias e falhas técnicas; ordenar por prioridade e idade; mostrar contexto do Pedido, histórico, custos e próxima ação sugerida. Persistir notificações de ticket com prioridade, motivo e resumo; eliminar duplicatas por conversa/categoria aberta e enviar no máximo uma confirmação ao Cliente. Alertas críticos não devem depender somente de notificação do navegador.

Modelo anterior do plano fonte (não adotado): horário comercial publicado, sem cobertura humana 24/7 e resposta inicial em até quatro horas úteis para escalonamentos comuns. A decisão atual é que não há horário fixo e que a primeira resposta humana é de até 24 horas; o prazo de resolução não está definido. Em casos graves, mostrar idade do ticket e não alegar SLA de resolução não medido.

A sequência técnica proposta valida e persiste eventos Meta únicos, responde prontamente ao webhook e depois encaminha processamento para worker. O worker reconstrói contexto, valida saída estruturada, autoriza ferramentas tipadas, persiste estado e envia com idempotência e callbacks de entrega. Um debounce de 2–4 segundos é sugerido para rajadas de mensagens.

Guardrails candidatos para arquitetura: confirmar status do provedor e correspondência de cobrança/valor/moeda/conta; gerar somente após pagamento confirmado ou orçamento de Prévia autorizado; exigir operador autenticado, reserva atômica diária/por Cliente, auditoria e idempotência para aprovar Prévia; bloquear respostas comerciais da IA durante Atendimento humano até retomada explícita; entregar apenas arquivos prontos.

Antes de escalar, a fonte propõe confirmar idempotência Pix, handoff humano, restauração de backup, controles de custo, retenção definida, política comercial publicada, teste com pelo menos cinco pessoas de baixa afinidade digital e ausência de incidente crítico de privacidade ou cobrança. Rotas internas, ferramentas permitidas, estados, tabelas/índices, reconciliação e regras de token do Asaas seguem como candidatos para Arquitetura.

## Preferência registrada durante a descoberta do PRD

The user prefers that the attendant not proactively identify as virtual, and that it answer truthfully if asked. The PRD reflects this preference in FR-4. Validate current platform rules and applicable transparency obligations before launch; do not imply a human identity.

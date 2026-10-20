# Addendum — details for downstream planning

This file keeps technical and operational detail from the supplied source plan that informs UX and architecture. Values below are proposals or hypotheses unless explicitly marked as product constraints. The PRD remains the source of customer-facing and operational requirements.

## Technical direction from the source plan

- Decision (2026-10-20): keep the repository's modular TypeScript monolith: Next.js app plus a separate long-running Node worker, PostgreSQL through the existing `pg` package, and no Redis. The repository does not currently select an ORM or migration tool; keep that choice open until implementation details are reviewed.
- Selected durable job processing uses PostgreSQL with pg-boss, transactional outbox, bounded retries, idempotency keys, and periodic reconciliation. Redis is excluded.
- Proposed AI boundary: the model returns structured intent, entities, tone, confidence, escalation state, response draft, and requested action. Backend policy checks authorize typed actions; model text is never authoritative for price, payment, refunds, discounts, or sample approval.
- Providers for WhatsApp, Pix, conversational AI, and image generation remain candidates. Private object storage is selected as a Railway Bucket through an S3-compatible adapter.
- The admin panel is restricted to Isaac and his business partner through two individually listed accounts with MFA and audit history. No public registration or shared credentials; either partner admin can perform permitted administrative actions.
- Decision (2026-10-20): Railway is the deployment target for the Next.js app, Node worker, and PostgreSQL. The consulted Railway pricing table does not publish region-specific rates, so no cheaper region can be substantiated from published prices. Select US East / Virginia (`us-east4-eqdc4a`) for services and IAD (`iad`) for the Bucket as the closest listed region to São Paulo and the best geographic latency estimate; actual application latency remains to be measured after deployment. The Bucket region cannot be changed after creation, and its data will be stored in the US.
- Security gate (2026-10-20): the repository currently pins Next.js 16.4.0, which is included in the versions affected by the official 2026-10-14 critical/high advisories. Upgrade to a patched release before any internet-facing deployment; 16.4.2 is the latest stable release checked for this decision ([security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [release](https://github.com/vercel/next.js/releases/tag/v16.4.2)). The code dependency is not changed by this architecture decision.
- Deployment uses HTTPS webhooks, separated environments/secrets, private database networking, Railway Bucket credentials limited to server/worker, and tested database recovery. Railway hard limits are billing-cycle limits in USD and can stop all workloads; they supplement, but do not enforce, the app's category limits in BRL.

## Provisional operational values and unresolved rules

- Test package prices are R$19.90, R$39.90, and R$59.90 for 1, 5, and 10 images; validate conversion and contribution margin before treating them as final.
- The plan proposes at most one preview per WhatsApp ID in 30 days, an R$8 daily preview budget, and an R$25 monthly preview budget. The brief only confirms that previews require manual approval and daily/customer limits; exact values need confirmation.
- The plan suggests a four-business-hour initial response target for ordinary escalations. The user decided there are no fixed support hours and that the first human response is due within 24 hours; no resolution deadline is defined. The plan’s four-business-hour target is not adopted.
- The plan suggests retaining abandoned-cart data for 7 days and completed-order data for 30 days after delivery. The brief requires minimum retention and deletion support but does not set periods; validate before committing.

- The source plan has inconsistent retry wording: one section proposes 2–3 attempts per image, while an example setting uses MAX_IMAGE_RETRIES=2. Confirm whether this includes the initial attempt.
- The plan proposes counting an approved preview as the first image in a paid package; the brief does not explicitly confirm this accounting rule.
- Escalation priority rules, notification channels, and a resolution deadline remain open; there are no fixed support hours, and the first human response is due within 24 hours.

## Pilot economics and controls

- Decision (2026-10-20): the R$500 total and the following category ceilings are authorized for the pilot. Include committed, reserved, incurred, unbilled, tax, and FX costs in reconciliation; no category balance moves automatically to another category.

| Category | Approved ceiling |
| --- | ---: |
| Instagram/Meta ads | R$220 |
| AI providers | R$110 |
| Railway app, worker, PostgreSQL, Bucket, storage, service egress, and backups | R$65 |
| Domain/accessories | R$25 |
| Reserve for Meta/Pix fees, FX, and retries | R$80 |
| **Pilot total** | **R$500** |

- Alert at 60%, 80%, and 95% of the total and each category. Block a new paid action when cost/balance is unknown or a cap is reached. Either partner admin may pause spending; release a reservation only after terminal outcome and reconciliation, with audit evidence. Set provider-level caps where available; otherwise reconcile external and unbilled costs before resuming.
- Railway's published Bucket storage rate is US$0.015/GB-month; uploads from a Railway service incur service egress charges. Convert platform charges to BRL using the recorded rate/fees in the ledger. A Railway Bucket hard limit suspends access while stored data continues to incur charges; a compute hard limit takes workloads offline, so neither is a substitute for the app-level budget gate.
- Track cost per order and conversation, CAC, conversion, contribution margin, delivery success, retries, refunds/revisions, preview conversion, and partner handling time. The numerical targets in the brief are initial hypotheses, not forecasts.
- The Railway Bucket is private and S3-compatible, but current documentation does not list server-side encryption, object versioning, or bucket lifecycle configuration as supported. Validate international transfer, encryption, retention/deletion and backup handling for all personal data processed in the US before using real customer data; synthetic-only flows may proceed through platform gates.

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

- Decision (2026-10-20): category ceilings, 60/80/95% alerts, fail-closed behavior, and the partner pause/release authority are approved as recorded above. Configure provider caps where available; otherwise reconcile committed and unbilled external charges before resuming. Include FX and taxes in the R$500 total.
- A fonte sugere Dev A para API, integrações, domínio comercial, pagamento e worker; Dev B para agente conversacional, qualidade, painel/inbox e UX; ambos para segurança, testes e deploy. É uma sugestão de trabalho, não atribuição confirmada.
- A validação comercial proposta inclui simulação de economia unitária e sensibilidade de CAC, campanha pequena, experimento de anúncios, teste assistido com pelo menos cinco pessoas de baixa afinidade digital e decisão de continuar apenas com CAC e margem de contribuição positivos.
- Detalhes de arquitetura a manter fora dos FRs incluem rotas internas, ferramentas tipadas permitidas, estados e transições de pedido/conversa, tabelas e índices únicos, sequência de webhook e worker, e implementação da reserva atômica de custo de prévia. São insumos para arquitetura e tickets; tetos, bloqueio fail-closed, alertas e reconciliação já são requisitos aprovados no PRD/AD-6.
- A fonte também propõe uma lista de QA visual, limites de custo por saída, pausa do worker em anomalias, e envio direto pelo WhatsApp sem ZIP ou portal externo. Transformar esses pontos em critérios de aceite após confirmar o padrão de qualidade, orçamento por imagem e experiência de entrega.
- Operação do canal deve guardar opt-in/opt-out, janela de 24 horas, uso de templates aprovados fora da janela e salvaguardas contra notificações duplicadas. Validar regras e custos na conta real antes de lançar.

## Alocação aprovada do orçamento do piloto — 2026-10-20

Os sócios autorizaram gasto até R$500 no total do piloto, com os seguintes tetos por categoria:

| Categoria | Teto aprovado |
| --- | ---: |
| Anúncios no Instagram/Meta | R$220 |
| Provedores de IA | R$110 |
| Railway: app, worker, PostgreSQL, Bucket, armazenamento, egress e backups | R$65 |
| Domínio e acessórios | R$25 |
| Reserva para Meta, Pix, câmbio e retentativas | R$80 |
| **Total** | **R$500** |

Alertas ocorrem em 60%, 80% e 95% do total e da categoria. Bloquear novas ações pagas quando custo/saldo for desconhecido ou qualquer teto for atingido; não transferir saldo entre categorias automaticamente. Qualquer um dos dois sócios administradores pode pausar gastos e liberar reservas após estado terminal e conciliação, com auditoria. Configurar teto no provedor externo quando disponível; sem esse controle, reconciliar valores realizados, comprometidos e não faturados antes de retomar.

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

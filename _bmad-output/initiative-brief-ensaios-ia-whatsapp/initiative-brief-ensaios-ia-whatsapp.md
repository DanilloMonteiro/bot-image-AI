---
tracker_id: ""
key: ""
type: initiative
title: "Ensaios IA por WhatsApp"
parent: none
covers: ["CAP-1", "CAP-2", "CAP-3", "CAP-4", "CAP-5", "CAP-6", "CAP-7"]
after: []
assignee: ""
risk: high
---

# Ensaios IA por WhatsApp

## Description

Entregar um MVP que permite a um adulto contratar pelo WhatsApp um retrato individual gerado por IA, com conversa natural, consentimento explícito, pagamento Pix, prévia revisável, entrega e atendimento dos sócios. A primeira demonstração percorre compra até entrega em sandbox, usando dados e imagem sintéticos, sem cobrança ou fotos reais. As ações com clientes, dinheiro e provedores reais continuam bloqueadas até que as decisões de fornecedor, privacidade, retenção e operação estejam aprovadas.

## Outcome

Uma pessoa adulta consegue concluir, em sandbox, o fluxo iniciado por uma mensagem recebida no WhatsApp até a confirmação de entrega do retrato, enquanto os sócios conseguem acompanhar custos, segurança e qualidade para decidir se o piloto pode continuar.

## Requirements

- CAP-1 — conversa natural, apresentação e contratação do retrato pelo WhatsApp.
- CAP-2 — consentimento e tratamento responsável de identidade, mensagens e imagens.
- CAP-3 — catálogo, pedido, cobrança Pix e reconciliação.
- CAP-4 — geração, revisão, entrega e recuperação do retrato.
- CAP-5 — operação dos sócios para prévia e decisões de qualidade.
- CAP-6 — atendimento humano, escalonamento e solicitação de direitos sobre dados.
- CAP-7 — limite de custos, observabilidade e decisão de continuidade do piloto.

## Boundaries

- MVP limitado a um retrato individual para adulto, iniciado por mensagem recebida no WhatsApp.
- Primeiro demo usa sandbox, pagamentos e eventos sintéticos e imagens de teste; não usa dinheiro nem fotos reais.
- Arquitetura modular monolítica: aplicação Next.js e worker Node.js separados; módulos conversam por casos de uso públicos e não escrevem diretamente nas tabelas de outros módulos.
- Conversas é dona da identidade interna, vínculo WhatsApp, conversa e evidência de consentimento; Pedidos/Pagamentos é dono de catálogo, pedido e cobrança; Retratos é dono de elegibilidade por imagem, geração, qualidade e entrega; Operações é dono da interface dos sócios, atribuição e tomada de controle; Orçamento é dono do livro razão, reservas e relatório autoritativo.
- CAP-1 é dividido: Conversas implementa diálogo/FAQ e Pedidos/Pagamentos implementa catálogo e aceitação de pedido.
- CAP-2 é dividido: Conversas revela a política e coleta consentimento; Retratos revalida consentimento e elegibilidade para a imagem, finalidade e destino exatos antes de chamar provedor; Operações coordena direitos sobre dados e só conclui pedidos com evidências dos módulos e fornecedores.
- CAP-5 é dividido: Operações é dona da decisão e interface de aprovação; Retratos mantém estado da prévia e geração; Orçamento fornece reserva atômica.
- CAP-7 é dividido: Base/Orçamento fornece contabilização, bloqueio e relatório autoritativos; Operações apresenta uma visão somente leitura e registra a avaliação; esta iniciativa registra a decisão final de continuar ou parar.
- Railway para aplicação/worker e PostgreSQL, Railway Bucket privado em IAD e os tetos de custo do piloto foram escolhidos. Ainda faltam validar conta e configuração efetivas, termos/segurança e custos do provedor, provedores de WhatsApp/Pix/IA, política de retenção/exclusão, preços de venda, estornos e limiares finais de qualidade.

## Ownership by epic

- `epic-platform-foundation`: infraestrutura, banco, fila durável, CI/CD e observabilidade.
- `epic-pilot-budget-data-policy`: ledger, reservas e políticas de dados do piloto.
- `epic-whatsapp-conversation-consent`: canal WhatsApp, conversa e consentimento.
- `epic-orders-pix`: pedidos e integração Pix.
- `epic-partner-operations`: painel, permissões, auditoria e suporte humano.
- `epic-portrait-fulfillment`: fornecedor de IA, armazenamento privado, ciclo de vida e entrega de fotos.
- `epic-preview-approval`: aprovação e fluxo de prévia.

Tracer path: mensagem recebida → FAQ e consentimento → foto de teste → Pix de sandbox → retrato de teste → confirmação de entrega ou exceção visível à operação; a prévia opcional cruza painel, reserva de custo e processamento de imagem.

## DoneWhen

- [ ] A demonstração em sandbox percorre mensagem recebida, divulgação de política, consentimento, pedido, Pix sintético, imagem sintética, revisão e recibo explícito de entrega.
- [ ] Os módulos e suas fronteiras seguem a arquitetura aprovada; eventos duráveis, idempotência, reconciliação e recuperação não deixam cobranças ou entregas duplicadas.
- [ ] O orçamento contabiliza custos reais e comprometidos, bloqueia novas ações antes de ultrapassar R$ 500 e também respeita limites por categoria aprovados pelos sócios.
- [ ] Mensagem ou mídia antecipada, recusa, consentimento ambíguo, cobrança divergente e falha de geração não iniciam ações irreversíveis; 100% dos pedidos explícitos de atendimento humano chegam a uma pessoa com contexto.
- [ ] Operações consegue revisar uma prévia, assumir e retomar conversas explicitamente, acompanhar pendências e medir primeira resposta humana em até 24 horas; após entrega o fluxo pergunta se a pessoa recebeu os arquivos, convida feedback conforme opt-out/regras do canal e encaminha feedback negativo sem prometer alteração/reembolso.
- [ ] Os sócios registram a avaliação CAP-7 e uma decisão explícita de continuar ou parar; quaisquer liberações de dinheiro, fotos reais ou provedores reais dependem das aprovações externas listadas nos épicos.

## References

- `spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md`
- `prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md` e `prd-ensaios-ia-whatsapp/addendum.md`
- `architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md`
- `ux-ensaios-ia-whatsapp/EXPERIENCE.md` e `ux-ensaios-ia-whatsapp/DESIGN.md`

## Notes

- Decisão do usuário (2026-10-15): MVP completo, cobrindo CAP-1 a CAP-7; decisões ainda abertas devem permanecer registradas como incertezas.
- Decisão do usuário (2026-10-15): dividir épicos por capacidade/domínio, com limites claros entre os dois desenvolvedores.
- Decisão do usuário (2026-10-15): primeira demonstração de compra até entrega em sandbox, sem dinheiro ou fotos reais.
- Decisão do usuário (2026-10-15): a árvore inicial de quatro épicos foi substituída pela divisão vigente em sete épicos por capacidade; a divisão vigente está registrada em `tickets.toml`.
- Decisão do usuário (2026-10-14): limites e dependências explícitos entre os sete épicos, com plataforma primeiro.
- Há conflito de fonte: o plano antigo descreve temas amplos e entrada por Instagram; a especificação atual define adulto, retrato individual e início pela primeira mensagem recebida no WhatsApp. O PRD UJ-1 ainda descreve anúncio/clique antes da mensagem, mas a reconciliação de UX deixa aquisição, clique e transição pelo Instagram fora da experiência do sistema; apenas metadados de campanha efetivamente fornecidos pelo canal podem ser usados. Nenhum épico implementa anúncios ou clique.
- A proposta Fastify/Drizzle do plano antigo foi substituída pela arquitetura final Next.js + worker Node.js. PostgreSQL, pg-boss, Railway para aplicação/worker e Railway Bucket privado em IAD foram escolhidos; os tetos de custo também foram aprovados. A conta Railway ainda não está conectada e faltam validar a configuração efetiva, backup/restauração, segurança, privacidade, termos e custo medido. Provedores de WhatsApp/Pix/IA e suas condições continuam sem decisão.
- Perguntas abertas: conexão e configuração efetiva do Railway; termos e custo medido de hospedagem; provedores e disponibilidade de sandbox de WhatsApp/Pix/IA; retenção, exclusão, cópias de fornecedores e backups; regra de liberação de reserva; preço, reembolso, tentativas e qualidade; contas, MFA e permissões dos sócios; alertas, acessibilidade e métricas/limiares de decisão.

---
type: epic
title: Orçamento do piloto e política de dados
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-7, CAP-2]
after: []
assignee: ""
risk: high
---

# Orçamento do piloto e política de dados

## Description

Permitir que os sócios operem dentro do teto total de R$500 e aprovem a política efetiva de tratamento de dados antes de qualquer coleta ou processamento de foto. O épico entrega o ledger e os guardrails econômicos, além do inventário e da versão aprovada da política que será consumida pelos épicos de Conversas, Retratos e Operações.

## Outcome

Cada operação com custo é autorizada somente quando seu custo cabe no saldo conhecido, e cada cliente recebe a política de dados aprovada antes de enviar uma foto.

## Done when

1. O ledger registra gastos realizados, comprometidos, reservados e ainda não faturados, incluindo anúncios e operação, e calcula o saldo contra R$500 e os limites aprovados por categoria: R$220 anúncios, R$110 IA, R$65 Railway (app/worker/PostgreSQL/Bucket/egress/backups), R$25 domínio/acessórios e R$80 reserva Meta/Pix/câmbio/retentativas.
2. A operação com custo é recusada quando o custo ou o saldo é desconhecido ou insuficiente; reservas e liberações repetidas não duplicam valores.
3. Provedores e tratamentos de foto original, resultados, conversa/consentimento, backups e cópias externas foram avaliados e a política versionada informa finalidade, acesso, retenção, exclusão e exceções.
4. A versão aprovada e seus requisitos de apresentação/gate estão disponíveis ao épico de Conversas; ele apresenta a política antes da coleta e bloqueia coleta/processamento enquanto faltar aprovação ou informação.
5. O Budget expõe custos reconciliados, saldo e dados necessários à avaliação de margem para Operações, mantendo hipóteses claramente marcadas e sem anunciar preços de teste como valores finais.
6. O tracer sintético de aplicação e worker está implantado e validado usando a capacidade entregue pela story 1.6, sem exigir o fechamento administrativo do Epic 1 e sem usar dados pessoais, tráfego real de WhatsApp ou operações reais de custo.

## Boundaries

Épico dono do módulo Budget, do ledger/reservas/reconciliação, do snapshot autoritativo e do inventário e aprovação da política de dados. A Base de Plataforma é dona da aplicação/worker, CI, implantação, backups e operação do provedor. Conversas apresenta a política e coleta consentimento; Retratos aplica a política ao ciclo de vida das imagens; Operações é dona da interface e das ações dos sócios. Este épico não implementa conversas, interface geral, pagamentos Pix ou pipeline de imagem.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-2, CAP-7, Constraints e Open Questions
- PRD — prd-ensaios-ia-whatsapp.md, §5 NFR-5/NFR-8, §6.4, §10 perguntas 3, 8, 10–12
- addendum — _bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/addendum.md, Pilot economics e provisional operational values
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulos Budget e Data Policy

## Notes

- Source conflict: `initiative-brief-ensaios-ia-whatsapp.md` ainda informa que infraestrutura, regiões, limites e provedores não foram aprovados; decisões datadas de 2026-10-20 na spec, no addendum do PRD, na arquitetura e neste épico aprovam Railway, regiões e tetos por categoria. As decisões de 2026-10-25 abaixo e na story 2.2 resolvem as escolhas de Pix, IA, WhatsApp e retenções acordadas. A rota concreta do WhatsApp e seus termos devem ser registrados na política; transferência internacional, criptografia e execução verificável da exclusão continuam gates antes do uso de dados reais.
- Handoff de política: a story 2.2 entrega a política aprovada e versionada e o contrato de decisão fechado por padrão; o Epic 3 exibe a política e registra consentimento, e o Epic 6 revalida política e consentimento antes do processamento de imagens. O Epic 2 não entrega a interface conversacional.
- Decision (2026-10-21): o breakdown do Epic 2 tem nove stories; o tracer sintético vem primeiro, a política de dados tem uma story HITL própria, CI/isolamento/backup/deploy permanecem na fundação, e o épico fecha com refactor sweep e E2E restritos aos módulos Budget e Data Policy.
- Decision (2026-10-21): o candidato `epic-base-segura-custos` foi reconciliado com este épico oficial; seu conteúdo original foi arquivado para manter o histórico, e sua story duplicada de CI/controles não faz parte do escopo ativo.

- Decision (2026-10-20): os tetos acima autorizam gastos até R$500 no piloto; emitir alertas em 60/80/95% do total e da categoria, falhar fechado com custo/saldo desconhecido, reconciliar cobranças externas/não faturadas e não transferir saldo entre categorias automaticamente.
- Decision (2026-10-20): Isaac e seu sócio são as únicas contas administradoras do painel, com contas individuais, MFA e auditoria. Qualquer um pode pausar gastos e liberar uma reserva após estado terminal e conciliação.
- Decision (2026-10-20): Railway foi escolhida para app, worker e PostgreSQL; Railway Bucket privado em IAD foi escolhido para objetos. Serviços em US East/Virgínia. O preço da plataforma é medido em USD e a localização dos objetos é EUA; configurar limites e reconciliar câmbio/egress dentro dos tetos em BRL.
- Decision (2026-10-25, owner-approved): usar AbacatePay para Pix; Google Vertex AI Gemini 3.8 Flash (multi-região nos EUA) para conversa e Nano Banana 2.1 (endpoint global) para imagens. O usuário aceita cópias e retenção do Google, inclusive o processamento global das imagens; isso não significa que a exclusão na aplicação apague cópias do provedor. Usar serviço pago, sem conceder uso para treinamento, publicidade ou portfólio; usos adicionais continuam exigindo consentimento separado. Validar com exemplos sintéticos que o modelo de conversa entende mensagens ambíguas de pessoas idosas e responde naturalmente antes de expor o serviço a clientes.
- Decision (2026-10-25, owner-approved): manter fotos originais e resultados por até 7 dias após a entrega, para suporte e avaliação do serviço no painel, com acesso restrito aos dois sócios administradores; apagar no primeiro processamento possível após o prazo. Conversa completa e prova mínima de consentimento ficam por até 7 dias após o encerramento; apagar no primeiro processamento possível após o prazo. O Railway Bucket não tem lifecycle, então a aplicação/worker deve executar a exclusão dos objetos. Registros de transação mantidos por AbacatePay e parceiros podem durar mais quando exigido por lei/regulação. Dumps PostgreSQL da Railway seguem a configuração já aprovada (pg_dump a cada 3 dias, retenção de 6 dias); cópias de conversas/consentimento em dumps existentes podem sobreviver à exclusão ativa até a expiração do dump. Não alterar tecnologias, frequência ou retenção dos backups Railway.
- Decision (2026-10-25, owner-approved): incluir a Plataforma WhatsApp Business oficial/Meta na política como provedora do canal e documentar o tratamento e as cópias segundo os termos vigentes ([política oficial](https://business.whatsapp.com/policy/preview?lang=pt_BR)); registrar também qualquer intermediário/BSP efetivamente usado. Essa aprovação não libera tráfego real: a rota concreta, transferência, criptografia e exclusão verificável ainda devem ser validadas.
- Open question: validar margem antes de fixar preços. R$19,90/R$39,90/R$59,90 são hipóteses de teste, não preços aprovados.
- Open gate: não processar foto real até a política de dados, criptografia adequada, exclusão/retenção e tratamento de cópias terem sido validados.
- Decision: saldo/custo desconhecido ou insuficiente bloqueia novo gasto até reconciliação; a liberação de reserva é auditada e pode ser feita por qualquer um dos dois sócios administradores depois de terminalidade e conciliação.
- Decision (2026-10-21): o candidato `epic-base-segura-custos` foi integrado neste épico oficial. A história candidata de endurecimento genérico de CI/ambiente/backup foi absorvida pela Base de Plataforma (histórias 1.5 e 1.6), evitando duplicar sua propriedade; o tracer de produção permanece condicionado à 1.6 e à conexão do workspace Railway.
- Historical decision (2026-10-21; superseded for epic-level sequencing on 2026-10-23): o primeiro tracer do Budget será sintético e usa a capacidade implantada pela story 1.6. A decisão anterior de aguardar o fechamento de todo o Epic 1 foi removida; as dependências internas das stories continuam válidas.
- Decision (2026-10-21): Conversas é responsável por apresentar a versão aprovada e bloquear a coleta sem ela; Retratos é responsável por executar retenção/exclusão nos dados de imagem; este épico fornece o inventário e a política aprovados.
- Resolved historical gate (2026-10-21; resolved on 2026-10-23): o workspace Railway está conectado e a configuração de produção foi verificada; as stories 1.1–1.7 estão marcadas como concluídas. As pendências de privacidade, custo, backup natural, alertas e RTO continuam sendo gates para tráfego real, fotos ou operações pagas, mas não bloqueiam o desenvolvimento sintético do Epic 2.
- Decision (2026-10-23): o desenvolvimento do Epic 2 pode começar sem aguardar o fechamento do Epic 1. A story 2.1 usa a capacidade já entregue pela story 1.6, sem bloqueio cruzado formal; todas as dependências internas deste epic permanecem. Continuar apenas com dados e operações sintéticos até que as aprovações operacionais correspondentes sejam registradas.

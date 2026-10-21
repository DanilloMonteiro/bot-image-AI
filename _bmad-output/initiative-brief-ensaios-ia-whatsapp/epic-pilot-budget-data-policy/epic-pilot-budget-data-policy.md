---
type: epic
title: Orçamento do piloto e política de dados
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-7, CAP-2]
after: [epic-platform-foundation]
assignee: ""
risk: high
---

# Orçamento do piloto e política de dados

## Description

Permitir que os sócios operem dentro do teto total de R$500 e aprovem a política efetiva de tratamento de dados antes de qualquer coleta ou processamento de foto. O épico cobre o ledger e guardrails econômicos, além da decisão e apresentação da política por fornecedor e tipo de dado.

## Outcome

Cada operação com custo é autorizada somente quando seu custo cabe no saldo conhecido, e cada cliente recebe a política de dados aprovada antes de enviar uma foto.

## Done when

1. O ledger registra gastos realizados, comprometidos, reservados e ainda não faturados, incluindo anúncios e operação, e calcula o saldo contra R$500 e os limites aprovados por categoria: R$220 anúncios, R$110 IA, R$65 Railway (app/worker/PostgreSQL/Bucket/egress/backups), R$25 domínio/acessórios e R$80 reserva Meta/Pix/câmbio/retentativas.
2. A operação com custo é recusada quando o custo ou o saldo é desconhecido ou insuficiente; reservas e liberações repetidas não duplicam valores.
3. Provedores e tratamentos de foto original, resultados, conversa/consentimento, backups e cópias externas foram avaliados e a política aprovada informa finalidade, acesso, retenção, exclusão e exceções.
4. A jornada de produção pode exibir a versão aprovada da política antes da coleta; sem aprovação ou informação registrada, o sistema bloqueia a coleta e o processamento.
5. Os sócios consultam conciliação e margem com hipóteses claramente marcadas, sem anunciar os preços de teste como valores finais.

## Boundaries

Épico dono do ledger do piloto, orçamento/reservas e gate de política de dados. Não implementa o fluxo conversacional, a interface geral do painel, pagamentos Pix ou pipeline de imagem. O provedor de login e fornecedores seguem decisões externas a este épico quando a escolha exigir validação de custo e privacidade.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-2, CAP-7, Constraints e Open Questions
- PRD — prd-ensaios-ia-whatsapp.md, §5 NFR-5/NFR-8, §6.4, §10 perguntas 3, 8, 10–12
- addendum — _bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/addendum.md, Pilot economics e provisional operational values
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulos Budget e Data Policy

## Notes

- Source conflict: `initiative-brief-ensaios-ia-whatsapp.md` ainda informa que infraestrutura, regiões, limites e provedores não foram aprovados; decisões datadas de 2026-10-20 na spec, no addendum do PRD, na arquitetura e neste épico aprovam Railway, regiões e tetos por categoria. Para esses itens, prevalecem as decisões datadas; isso não aprova provedores externos de WhatsApp/Pix/IA nem os tratamentos de dados, retenção, exclusão, transferência e exceções, que continuam abertos.
- Handoff de política: a story 2.2 entrega a política aprovada e versionada e o contrato de decisão fechado por padrão; o Epic 3 exibe a política e registra consentimento, e o Epic 6 revalida política e consentimento antes do processamento de imagens. O Epic 2 não entrega a interface conversacional.
- Decision (2026-10-21): o breakdown do Epic 2 tem nove stories; o tracer sintético vem primeiro, a política de dados tem uma story HITL própria, CI/isolamento/backup/deploy permanecem na fundação, e o épico fecha com refactor sweep e E2E restritos aos módulos Budget e Data Policy.
- Decision (2026-10-21): o candidato `epic-base-segura-custos` foi reconciliado com este épico oficial; seu conteúdo original foi arquivado para manter o histórico, e sua story duplicada de CI/controles não faz parte do escopo ativo.

- Decision (2026-10-20): os tetos acima autorizam gastos até R$500 no piloto; emitir alertas em 60/80/95% do total e da categoria, falhar fechado com custo/saldo desconhecido, reconciliar cobranças externas/não faturadas e não transferir saldo entre categorias automaticamente.
- Decision (2026-10-20): Isaac e seu sócio são as únicas contas administradoras do painel, com contas individuais, MFA e auditoria. Qualquer um pode pausar gastos e liberar uma reserva após estado terminal e conciliação.
- Decision (2026-10-20): Railway foi escolhida para app, worker e PostgreSQL; Railway Bucket privado em IAD foi escolhido para objetos. Serviços em US East/Virgínia. O preço da plataforma é medido em USD e a localização dos objetos é EUA; configurar limites e reconciliar câmbio/egress dentro dos tetos em BRL.
- Open question: fornecedores, transferência, retenção exata, cópias/backups, exclusão e exceções por tipo de dado; fechar e informar antes da coleta de fotos.
- Open question: validar margem antes de fixar preços. R$19,90/R$39,90/R$59,90 são hipóteses de teste, não preços aprovados.
- Open gate: não processar foto real até a política de dados, criptografia adequada, exclusão/retenção e tratamento de cópias terem sido validados.
- Decision: saldo/custo desconhecido ou insuficiente bloqueia novo gasto até reconciliação; a liberação de reserva é auditada e pode ser feita por qualquer um dos dois sócios administradores depois de terminalidade e conciliação.

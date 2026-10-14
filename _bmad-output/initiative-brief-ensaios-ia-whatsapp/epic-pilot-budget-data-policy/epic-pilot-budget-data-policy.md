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

1. O ledger registra gastos realizados, comprometidos, reservados e ainda não faturados, incluindo anúncios e operação, e calcula o saldo contra R$500.
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

- Open question: alocação por categoria, reconciliação de cobranças não faturadas e pessoas autorizadas a pausar gastos.
- Open question: fornecedores, transferência, retenção exata, cópias/backups, exclusão e exceções por tipo de dado; fechar e informar antes da coleta de fotos.
- Open question: validar margem antes de fixar preços. R$19,90/R$39,90/R$59,90 são hipóteses de teste, não preços aprovados.
- Decision: teto total do piloto de R$500; saldo desconhecido ou insuficiente bloqueia novo gasto.

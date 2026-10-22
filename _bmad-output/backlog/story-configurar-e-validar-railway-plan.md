---
title: "Configurar e validar o ambiente de produção no Railway"
ticket: 1
status: in-progress
---

## Estado inicial

- 2026-10-22 — O usuário informou que criou somente a conta Railway. Nenhuma outra etapa foi informada como concluída; por isso, somente a primeira caixa do checklist está marcada.

## Próxima etapa

- Confirmar o workspace dedicado, administradores, MFA e o valor aprovado para o Compute hard limit antes de criar recursos.

## Gates pendentes

- Aprovação do plano antes de aplicar mudanças no Railway.
- Confirmar se os R$65 cobrem Compute apenas ou a fatura inteira, incluindo Bucket e impostos.
- Confirmar se o Hobby permite os dois administradores individuais exigidos pelo guia.
- Mecanismo adicional verificado para alertas em 60%, 80% e 95%.
- Evidências de custo, privacidade, limite de Compute, autoridade de pausa e backup/restauração antes de definir as flags de produção.

## Diário de execução

Adicione uma linha datada para cada ação, incluindo o resultado e a evidência não sensível. Não registre valores de segredos.

- 2026-10-22 — Conta Railway criada. Workspace, projeto de produção e demais controles ainda não foram confirmados.
- 2026-10-22 — Documentação oficial consultada: Hobby inclui US$5 de uso no mínimo mensal de US$5; o hard limit restringe Compute, não Bucket. Critérios e pendências atualizados no ticket.

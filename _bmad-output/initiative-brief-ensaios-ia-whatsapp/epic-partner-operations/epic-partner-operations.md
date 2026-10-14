---
type: epic
title: Operação dos sócios e suporte
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-2, CAP-6, CAP-7]
after: [epic-pilot-budget-data-policy, epic-whatsapp-conversation-consent, epic-orders-pix]
assignee: ""
risk: high
---

# Operação dos sócios e suporte

## Description

Entregar aos dois sócios um painel de produção para acompanhar conversas, pedidos, pagamentos, falhas, dados e orçamento; responder aos clientes quando pedirem uma pessoa; tratar pedidos de acesso/exclusão; e avaliar o piloto com evidências econômicas e operacionais.

## Outcome

Os sócios identificam a próxima ação e seu contexto, atendem solicitações humanas em até 24 horas, atribuem ações sensíveis a contas individuais e tomam a decisão de continuar ou parar com métricas observáveis.

## Done when

1. Dois sócios usam contas individuais com MFA; aprovações e alterações sensíveis registram o ator e horário, com permissões limitadas às ações autorizadas.
2. Inbox de produção mostra contexto acionável de conversa/Pedido, causa e idade da exceção; um sócio pode assumir o atendimento, suspendendo respostas comerciais automáticas até retomada explícita.
3. Todo pedido explícito de atendimento humano chega ao painel e pode ser atribuído e acompanhado até a primeira resposta; o prazo observado é de até 24 horas, sem prazo de resolução prometido.
4. Operadores encontram e executam o fluxo aprovado de acesso/exclusão por pessoa e veem as evidências de política e consentimento necessárias sem exposição indevida de fotos.
5. Painel apresenta orçamento/saldo e sinais disponíveis de procura, conversão, qualidade e esforço; os sócios registram os limiares e a decisão de continuar/parar antes do encerramento do piloto.
6. A interface própria é utilizável por teclado, com foco visível, mensagens de estado acessíveis e reflow em 320 CSS px, conforme a base aprovada de UX.

## Boundaries

Épico dono do painel operacional, inbox, contas/permissões/auditoria, coordenação do atendimento humano e visualização de métricas/decisão. Consome casos de uso públicos de Conversas, Pedidos, Orçamento e Retratos; não altera tabelas desses módulos. Não executa geração de imagem nem decide automaticamente reembolso, ajuste ou insatisfação.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-2, CAP-6, CAP-7 e Assumptions
- UX — _bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/DESIGN.md e EXPERIENCE.md
- PRD — prd-ensaios-ia-whatsapp.md, §10 perguntas 5, 7, 11–13 e 16
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulo Operations, acesso e auditoria

## Notes

- Decision: painel para dois sócios com contas individuais, MFA e registro de quem autorizou cada ação sensível.
- Decision: sem horário fixo; primeira resposta humana em até 24 horas; sem prazo de resolução aprovado.
- Open question: provedor de login e matriz detalhada de permissões, sujeitos a validação de custo e definição operacional.
- Open question: prioridades de triagem, canal de notificação e retomada da automação ficam por definir; o sistema deve preservar contexto e não responder comercialmente enquanto um sócio assumiu.
- Open question: os sócios definem métricas/limiares e avaliam margem, qualidade, procura e capacidade; nenhum limiar numérico está aprovado.

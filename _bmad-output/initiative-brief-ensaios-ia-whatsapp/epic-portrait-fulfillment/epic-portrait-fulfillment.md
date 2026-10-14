---
type: epic
title: Processamento e entrega dos retratos
parent: initiative-brief-ensaios-ia-whatsapp
covers: [CAP-2, CAP-4]
after: [epic-pilot-budget-data-policy, epic-whatsapp-conversation-consent, epic-orders-pix, epic-partner-operations]
assignee: ""
risk: high
---

# Processamento e entrega dos retratos

## Description

Processar com privacidade a foto elegível da própria cliente adulta, gerar o pacote vinculado ao Pedido autorizado, armazenar e entregar os resultados pelo WhatsApp e registrar confirmação ou falha recuperável. Cada operação valida política, consentimento, orçamento e autorização de pagamento ou de prévia antes de incorrer em custo.

## Outcome

A cliente recebe apenas as imagens do próprio Pedido e sabe se a entrega foi concluída ou falhou, enquanto operadores conseguem recuperar exceções e executar a política aprovada de ciclo de vida dos dados.

## Done when

1. Foto é obtida e processada somente após política informada, consentimento afirmativo revalidado, elegibilidade e autorização válida de Pedido pago ou Prévia aprovada/reservada.
2. O fornecedor de geração e armazenamento está aprovado segundo custo e privacidade; originais e resultados não são públicos nem compartilhados entre clientes.
3. Cada imagem e entrega permanece vinculada ao Pedido correto; status de geração e envio é persistido e eventos repetidos não geram cobrança nem entrega duplicada.
4. Retratos passam por critérios visuais aprovados e limite de tentativas configurado antes do piloto; exceções e falhas persistem para recuperação e aparecem à Operação.
5. Entrega e confirmação ao cliente ocorrem pelo WhatsApp; não se exige ZIP, login externo ou portal, e não se declara sucesso antes da confirmação do canal.
6. A exclusão e a retenção executam prazos, cópias e exceções aprovadas para originais, resultados e armazenamento de fornecedores, com evidência para atendimento a solicitações.

## Boundaries

Épico dono do módulo Retratos: ingresso/eligibilidade do arquivo, integrações de geração e armazenamento privado, geração/QA, entrega, estado e evidências do ciclo de vida de mídia. Usa consentimento e orçamento por APIs dos módulos responsáveis e consome autorização de Pedido ou Prévia. Não decide consentimento, preço, pagamento, revisão comercial ou suporte.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, CAP-2, CAP-4, Constraints e Open Questions
- UX — _bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/EXPERIENCE.md
- PRD — prd-ensaios-ia-whatsapp.md, §10 perguntas 6, 8, 10 e 15
- addendum — _bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/addendum.md, QA visual e entrega (propostas)
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, módulo Portraits e ciclo de vida de mídia

## Notes

- Open question: fornecedor, transferência, cópias, retenção, exclusão e tratamento de originais/resultados; nenhuma foto real antes da política correspondente estar aprovada e informada.
- Open question: prazo comunicado, padrão básico de qualidade, quantidade/contagem de tentativas e política de revisão; validar capacidade antes de anunciar.
- Decision: falha de geração/envio é exceção recuperável e não pode ser apresentada como entrega concluída.
- Decision: entrega pelo WhatsApp; sem ZIP, login ou portal externo obrigatório.

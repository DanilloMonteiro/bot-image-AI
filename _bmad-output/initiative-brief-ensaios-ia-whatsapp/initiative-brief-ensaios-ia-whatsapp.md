---
type: initiative
title: Ensaios IA por WhatsApp
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7]
assignee: ""
risk: high
---

# Ensaios IA por WhatsApp

## Description

Validar, em piloto controlado de retratos individuais de aniversário para adultos, se a jornada iniciada por mensagem recebida no WhatsApp atende clientes, preserva fotos e pode ser operada pelos dois sócios dentro do teto total de R$500. As capacidades, limites e sinais de sucesso estão na spec da iniciativa.

## Outcome

Os sócios decidem se continuam o piloto com base nos sinais de procura e conversão, qualidade percebida, margem e esforço operacional definidos na spec, sem exceder R$500 nem processar fotos sem política informada e consentimento afirmativo.

## Done when

1. As sete capacidades da spec estão disponíveis em produção para o escopo do MVP; anúncio e transição do Instagram ficam fora do sistema.
2. Conversas de teste percorrem oferta e FAQ, elegibilidade, consentimento, Pix, geração e entrega; eventos repetidos não duplicam cobrança ou geração paga.
3. Nenhuma foto ou resultado é coletado/processado antes da política aplicável estar aprovada e informada e do consentimento afirmativo estar registrado; pedidos de acesso/exclusão chegam à operação.
4. Pedidos explícitos de atendimento humano são encaminhados, a automação comercial fica suspensa durante o atendimento e a primeira resposta humana ocorre em até 24 horas.
5. Gastos realizados, comprometidos, reservados e ainda não faturados contam contra o teto de R$500; operação com custo é bloqueada se o saldo for desconhecido ou insuficiente.
6. Os sócios avaliam as medidas e limiares de continuidade; preço, prazo, qualidade e regras comerciais são aprovados antes dos anúncios e da operação correspondente.

## Boundaries

Sistema modular único, em TypeScript e criado do zero, com Next.js e worker separado no mesmo código-base. Inclui painel dos sócios e jornada a partir da primeira mensagem recebida no WhatsApp, pagamento Pix, processamento privado de fotos, geração, entrega e controle do piloto. Anúncios, clique e transição do Instagram ficam fora da experiência do sistema. Consulte os não-objetivos da spec.

Touch point: infraestrutura, banco, fila durável, CI/CD e observabilidade — owner: epic-platform-foundation.
Touch point: canal WhatsApp, conversa e consentimento — owner: epic-whatsapp-conversation-consent.
Touch point: pedidos e integração Pix — owner: epic-orders-pix.
Touch point: painel, permissões, auditoria e suporte humano — owner: epic-partner-operations.
Touch point: fornecedor de IA, armazenamento privado, ciclo de vida e entrega de fotos — owner: epic-portrait-fulfillment.
Touch point: ledger e reservas contra o teto do piloto — owner: epic-pilot-budget-data-policy.
Touch point: aprovação e fluxo de prévia — owner: epic-preview-approval.

Tracer path: mensagem recebida → FAQ e consentimento → foto de teste → Pix de sandbox → retrato de teste → confirmação de entrega ou exceção visível à operação; a prévia opcional cruza painel, reserva de custo e processamento de imagem.

## References

- spec — _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md, Capabilities, Constraints, Non-goals, Success signal e Open Questions
- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, decisões AD-1 a AD-9 e contratos entre módulos
- PRD — prd-ensaios-ia-whatsapp.md, requisitos e métricas do produto
- UX — _bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/DESIGN.md e EXPERIENCE.md

## Notes

- Decision: divisão de sete épicos aprovada pelo usuário em 2026-10-14; limites por capacidade e dependências explícitas, com plataforma primeiro.
- Decision: como a equipe não definiu regra própria de divisão, usar capacidade (ou par fortemente acoplado) entregue em produção por um owner.
- Open question: hospedagem, banco/fila e fornecedores de IA/pagamento — fechar após validar custo, privacidade e operação.
- Open question: retenção, exclusão, cópias/backups e exceções por tipo de dado — fechar e informar antes de coletar fotos.
- Open question: preços/margem, prazo, critérios de qualidade e tentativas, política de revisão/reembolso, regras de prévia e limites de continuidade — fechar antes de anunciar ou ativar as partes correspondentes.
- Source conflict: brief e plano fonte contêm temas, provedores, stack, prazos de retenção e valores operacionais propostos que não são decisões; a spec vigente limita o MVP a aniversário e a arquitetura deixa hospedagem, persistência, fila e provedores para validação.

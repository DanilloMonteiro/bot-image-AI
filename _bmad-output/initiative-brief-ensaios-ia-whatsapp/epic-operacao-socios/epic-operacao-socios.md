---
tracker_id: ""
key: ""
type: epic
title: "Operação dos sócios: prévias, atendimento e privacidade"
parent: initiative-brief-ensaios-ia-whatsapp
covers: ["CAP-2", "CAP-5", "CAP-6", "CAP-7"]
after: []
assignee: ""
risk: medium
---

# Operação dos sócios: prévias, atendimento e privacidade

## Description

Entregar a superfície autenticada usada pelos sócios para revisar prévias, assumir conversas, tratar pedidos de privacidade e acompanhar custo, qualidade e atendimento. Cada ação sensível precisa de autorização e trilha auditável. Assumir uma conversa suprime automações enfileiradas e novas até retomada explícita. Solicitação de acesso ou exclusão só é concluída quando houver evidência dos módulos donos, fornecedores e cópias aplicáveis; o painel não presume que um registro local prova exclusão externa.

## Outcome

Os sócios conseguem decidir sobre a prévia, assumir exceções e avaliar segurança, custo, qualidade e prazo com estado rastreável e sem automação concorrente.

## Requirements

- CAP-2 — coordenação de pedidos de privacidade e evidências de conclusão.
- CAP-5 — revisão de prévias e decisão de aprovação/rejeição.
- CAP-6 — handoff, atendimento humano, atribuição e acompanhamento de 24 horas para primeira resposta.
- CAP-7 — leitura de custos/qualidade e registro da avaliação dos sócios.

## DoneWhen

- [ ] Contas individuais dos sócios usam MFA e permissões explícitas; leitura e ações sensíveis são auditadas com ator, horário, alvo e resultado.
- [ ] Aprovação de prévia é explícita, idempotente e coordenada com estado de Retratos e reserva atômica de Orçamento; a revisão mostra imagem em baixa resolução com marca-d’água, custo reservado e limites restantes, e após aprovar chama Retratos para gerar e enviar a prévia respeitando os limites.
- [ ] Tomada de controle pausa automações já enfileiradas e novas até que um sócio retome explicitamente a conversa.
- [ ] Pedidos de acesso/exclusão e escaladas têm responsável e estados recuperáveis; 100% dos pedidos explícitos de pessoa, reclamações graves, disputas financeiras, privacidade, alterações após entrega, falhas repetidas, frustração persistente e feedback negativo geram contexto acionável; a primeira resposta humana ocorre em até 24 horas, e direitos só são concluídos com evidência dos módulos, fornecedores e backups aplicáveis.
- [ ] Painel de operação apresenta custos autoritativos de Orçamento, qualidade/entrega de Retratos e métricas de prévia em leituras, sem alterar estado dos módulos donos.
- [ ] A superfície de operações está implantada em produção com contas/fixtures sintéticas e ações reais protegidas até as aprovações; os sócios registram avaliação CAP-7 e decisão de continuar ou parar.

## Boundaries

- Operações é dona de interface de sócios, contas/autorizações, auditoria de ações, atribuição e tomada de controle, coordenação de solicitações e avaliação do piloto.
- Retratos é dono de prévia, geração, qualidade e entrega; Orçamento é dono de reservas, livro razão, bloqueios e snapshot; Conversas é dona de identidade, consentimento e direitos coletados.
- A ação de aprovar é coordenada pela interface, mas estado da prévia e reserva permanecem nos módulos donos e são acionados por casos públicos.
- Esta iniciativa registra a decisão final de continuar/parar; Operações fornece evidência e fluxo de decisão, mas não muda critérios financeiros de Orçamento.
- Operações apresenta métricas de prévia publicadas por Retratos, o snapshot de custos de Orçamento e o resultado de feedback/handoff de Conversas.

## References

- `../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md` (CAP-2, CAP-5, CAP-6 e CAP-7)
- `../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` (AD-5, AD-6, AD-7 e fronteiras dos módulos)
- `../prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md` e `../prd-ensaios-ia-whatsapp/addendum.md`
- `../ux-ensaios-ia-whatsapp/EXPERIENCE.md` e `../ux-ensaios-ia-whatsapp/DESIGN.md`

## Notes

- Provedores, regra de retenção/exclusão, MFA, matriz de acesso, alertas e política aplicável às cópias e backups precisam de validação externa antes de uso com dados reais.
- A avaliação de 24 horas mede a primeira resposta humana; não promete prazo de resolução.
- O `after` em `tickets.toml` registra entregas que algumas histórias de Operações consomem, sem bloquear todas as histórias do épico; cada `after` de história será fixado na inception.

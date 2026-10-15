---
tracker_id: ""
key: ""
type: epic
title: "Conversas WhatsApp e consentimento"
parent: initiative-brief-ensaios-ia-whatsapp
covers: ["CAP-1", "CAP-2", "CAP-6"]
after: []
assignee: ""
risk: medium
---

# Conversas WhatsApp e consentimento

## Description

Implementar o domínio Conversas para atender uma pessoa adulta que inicia contato no WhatsApp, responder perguntas frequentes e orientar a contratação sem depender de menus rígidos. O módulo mantém identidade interna estável, vínculo de canal, conversa, divulgação da política e evidência de consentimento afirmativo. Ele não aceita um pedido nem inicia geração: antes de solicitar ou encaminhar uma imagem, precisa deixar claros o uso, destino e direitos aplicáveis.

## Outcome

Uma pessoa entende o fluxo e pode consentir ou recusar com clareza, enquanto os demais domínios recebem identidade e evidências verificáveis por interfaces públicas.

## Requirements

- CAP-1 — diálogo natural, apresentação e FAQ no canal WhatsApp.
- CAP-2 — divulgação antes da solicitação/coleta, consentimento afirmativo e tratamento de recusa, ambiguidade, mídia antecipada e direitos de dados.
- CAP-6 — detectar pedidos explícitos de pessoa e criar handoff durável com contexto para Operações; E4 opera a fila, assume o atendimento e mede a primeira resposta.
- FR de atendimento e identidade definidos no PRD reconciliado.

## DoneWhen

- [ ] Pelo menos 90% das conversas de teste completam a compra sem menus, atalhos ou códigos, usando fixtures/casos públicos para os domínios posteriores; a iniciativa verifica o percurso integrado completo.
- [ ] Antes de solicitar imagem, a pessoa recebe a política aprovada para cada tipo de dado: finalidade, uso de IA, fornecedor e tratamento externo, destino e regras aplicáveis de retenção/exclusão; depois confirma separadamente maioridade, titularidade da imagem e consentimento afirmativo registrado com versão/contexto.
- [ ] Recusa, ambiguidade ou mídia recebida antes da divulgação não acionam download, encaminhamento ou processamento; todo pedido explícito de pessoa/privacidade cria handoff durável com contexto para Operações, e só é confirmado ao cliente após persistir.
- [ ] Casos públicos permitem que Pedidos/Pagamentos consulte identidade e que Retratos revalide consentimento vigente para uso, destino e imagem exatos.
- [ ] A experiência E2 está implantada em produção em modo seguro; coleta de dados de clientes e integrações reais permanecem desativadas até aprovação de fornecedor, política de canal, região e retenção.

## Boundaries

- Dono: identidade interna do cliente, ligação com WhatsApp, conversa, FAQ e evidências de divulgação/consentimento, inclusive revogação.
- Não é dono de catálogo, preço, pedido, cobrança, elegibilidade por imagem, geração, painel dos sócios nem comprovação final de exclusão em sistemas externos.
- É dono da identificação de pedidos humanos/privacidade e do handoff durável; Operações é dona da fila de sócios, resposta e tratamento.
- Fornece casos públicos para os outros módulos; não permite escrita direta nas tabelas de Conversas.
- Evidência de consentimento não substitui a checagem imediatamente antes da chamada de geração, pertencente a Retratos.

## References

- `../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md` (CAP-1, CAP-2 e handoff CAP-6)
- `../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` (AD-2, AD-4, AD-5 e AD-9)
- `../prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md` e `../prd-ensaios-ia-whatsapp/addendum.md`
- `../ux-ensaios-ia-whatsapp/EXPERIENCE.md`

## Notes

- O limiar de 90% é a meta conversacional já registrada no PRD; definir amostra e critério de aprovação antes de executar essa avaliação.
- Regra vigente de WhatsApp, retenção e fornecedores ainda precisam de validação externa antes de ativar tráfego real.
- O `after` em `tickets.toml` declara necessidades entre capacidades; não é um gate para todas as histórias deste épico. Os `after` de cada história serão fixados na inception usando os IDs E1 que entregarem os casos e contratos necessários.

---
artifact_type: ux-source-reconciliation
source: ../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
source_id: SPEC-ensaios-ia-whatsapp
status: complete
---

# Reconciliação — Spec de ensaios IA por WhatsApp

Este registro compara a spec confirmada com [DESIGN.md](DESIGN.md) e [EXPERIENCE.md](EXPERIENCE.md). Não altera a spec nem fecha pendências.

## Capturado nos spines

| Referência | Tratamento de UX | Estado |
|---|---|---|
| CAP-1 | Conversa natural no WhatsApp, sem menus obrigatórios, uma pergunta por vez e respostas limitadas ao catálogo/FAQ aprovados. | Capturado; a meta de 90% continua métrica de teste, não promessa de conversão. |
| CAP-2 | Explicação de IA, finalidade e retenção; consentimento e elegibilidade antes de pedir foto; pausa da coleta se a política não estiver definida/informada; encaminhamento de acesso/exclusão. | Capturado em grande parte. Períodos, cópias de fornecedores e confirmação de exclusão seguem abertos. |
| CAP-3 | Pix só é confirmado por confirmação autenticada, ligada ao pedido e valor; o resumo comercial vem antes do pagamento. | Capturado; idempotência continua critério de sistema. |
| CAP-4 | Imagens enviadas pelo WhatsApp, sem afirmar entrega concluída antes da confirmação; semelhança pode variar. | Capturado em parte; formato, recuperação de falha, prazo, critérios visuais e tentativas seguem abertos. |
| CAP-5 | Prévia opcional, baixa resolução, marca-d’água, aprovação de sócio e reserva de custo. | Capturado; contagem no pacote, frequência, limites e orçamento seguem abertos. |
| CAP-6 | Pedido de atendimento humano encaminhado com contexto; automação comercial suspensa; primeira resposta em até 24 horas, sem prazo de resolução. | Capturado; 100% de encaminhamento é métrica, não interação detalhada. |
| CAP-7 | Exibir gastos realizados, comprometidos, reservados e ainda não faturados; teto total de R$500; bloquear qualquer nova operação com custo se saldo for desconhecido/insuficiente e explicar o motivo. | Capturado; divisão do teto entre anúncios e provedores continua aberta. |
| Constraints / Non-goals | MVP individual de aniversário para adulto usando a própria foto; sem app, login, portal obrigatório ou entrega dependente de ZIP. | Capturado. Autorização para publicidade, portfólio ou treinamento não é presumida. |

## Não atribuir à spec

O painel web interno vem do PRD; a spec pede contexto acionável para operadores, mas não determina que a superfície seja web nem define seu layout. Maria, Claudia, Carlos, as ações detalhadas do painel, o dispositivo prioritário e a direção visual AbacatePay são fontes do PRD ou da descoberta de UX, não desta spec.

A conversa começou, por decisão da usuária, na primeira mensagem recebida pelo WhatsApp; o anúncio e a transição do Instagram ficam fora do sistema. Essa correção também é contexto de descoberta, não conteúdo da spec.

## Mantido fora da interação ou ainda em aberto

Idempotência, persistência, recuperação e detalhes de provedores permanecem critérios de sistema. Preços e margem, prazo, retenção, revisão/reembolso, limite e contagem da prévia, divisão do teto, regras da conta WhatsApp, métricas e critérios de continuar/parar o piloto continuam em aberto. A confirmação de cinco pessoas com baixa afinidade digital não cobre todas as métricas da spec.

A UX mostra o bloqueio financeiro e as categorias de custo, mas não substitui o scorecard completo de sucesso do piloto.

# PRD Quality Review — Ensaios IA por WhatsApp

## Overall verdict

UJ-1/2, FR-8/10 and FR-30/35 now specify adult self-photo eligibility, the consent-before-upload sequence, the operator flow, and a first human response that may take up to 24 hours with no fixed hours or resolution deadline. Those prior findings are resolved. The PRD still needs a testable policy for poor results and approved content for pre-Pix questions before UX and production tickets can be finalized; the R$500 cap is stated as an aggregate, while category allocation and execution remain pre-spend decisions.

## Decision-readiness — thin

The customer and operator paths now make several important decisions concrete: only adults sending their own photos are eligible; the photo cannot be uploaded before explicit permission; Carlos reviews accumulated notifications when available; and the first human response may take up to 24 hours, with no promise of resolution. FR-44/NFR-8 also express the R$500 limit as a total across cost categories and block spending when the balance cannot be verified. The remaining commercial policy for a result the customer dislikes is material because the customer pays before seeing the final images. Budget allocation is correctly surfaced as a gate before activating spend, but is not configured yet.

### Findings

- **medium** **A regra de disclosure espontâneo da automação aguarda validação** (FR-4, UJ-1, pergunta 16; addendum, preferência registrada) — A preferência por Claudia não se identificar espontaneamente como virtual inclui transparência se perguntarem, mas a compatibilidade com regras da plataforma e obrigações aplicáveis segue para validação. *Fix:* fechar a validação e aprovar as mensagens antes de congelar a voz da marca.
- **medium** **A alocação operacional do orçamento ainda precisa ser aprovada antes de ativar gastos** (FR-44, NFR-8, §§1 e 6.1, pergunta 11; addendum, “Complementos de validação e operação”) — O requisito já define R$500 como teto agregado de mídia e custos operacionais e bloqueia novas operações quando o saldo não pode ser verificado. O texto ainda diz que “A divisão entre categorias e o método para conter gastos já comprometidos mas ainda não faturados precisam ser definidos”; Q11 pede alocação, rotina/ferramenta de bloqueio, reconciliação e responsável por pausar. *Fix:* definir valores por categoria, como contabilizar compromissos e quem configura, pausa, reconcilia e libera antes de ativar anúncios ou provedores. Este é um gate de operação do piloto, não uma ausência do requisito de teto.

## Substance over theater — adequate

A visão é específica ao uso de WhatsApp para contratar um ensaio sem aprender prompts. UJ-1 detalha escolha do modelo de aniversário, exemplos, preferências, consentimento, envio, prévia, Pix, entrega e feedback; UJ-2 dá uma situação concreta de suporte com Carlos. O recorte para adultos usando a própria foto e um único modelo tem consequências reais de escopo. As métricas ainda se concentram em conclusão do fluxo e controles operacionais.

### Findings

- **medium** **Os indicadores não medem diretamente qualidade percebida ou conversão** (§1, §9) — SM-1 e SM-7 medem concluir a conversa sem comandos; SM-6 mede visibilidade de custo; SM-8 exige CAC e margem positivos para ampliar. Ainda não há medidas ou limiares aprovados para conversão, qualidade percebida e esforço operacional, embora Q12 agora atribua esses pontos antes do piloto. *Fix:* definir as medidas e critérios de continuação e refletir os aprovados na seção 9.

## Strategic coherence — adequate

A tese e o fluxo são coerentes com um piloto de um modelo de aniversário e aquisição pelo Instagram para conversa no WhatsApp. Os controles de Pix, consentimento e orçamento sustentam essa compra de baixo atrito e risco limitado. A decisão sobre ampliar para novos modelos está ligada à qualidade, repetibilidade e margem, mas a régua ainda não foi definida.

### Findings

- **medium** **A expansão do catálogo não tem limiares de sucesso completos** (§8.2, §9) — O texto diz que novos modelos dependem de “validar qualidade, repetibilidade e margem”, mas os indicadores não definem o que conta como qualidade percebida ou repetibilidade suficiente. *Fix:* ligar a expansão do modelo de aniversário a critérios medidos no piloto.

## Done-ness clarity — thin

FR-8 e FR-10 agora dão condições testáveis para consentimento, upload e recusa; FR-44/NFR-8 definem a condição fail-closed do orçamento. A resposta humana também tem expectativa explícita: primeira resposta pode levar até 24 horas, sem prazo de resolução. A saída de qualidade continua aberta: FR-19 depende de critérios a validar e a regra de ajuste/reembolso não dá um resultado verificável para cada situação.

### Findings

- **high** **Não há critérios de aceite nem remédio operacional para uma imagem reprovada ou insatisfatória** (FR-18–21, FR-27–28; perguntas 5–6; UJ-1/2) — Os requisitos distinguem falha técnica de entrega concluída, mas não dizem quando a imagem é aceitável, quantas tentativas ou alterações cabem, nem se o cliente recebe ajuste, regeneração ou reembolso. *Fix:* incluir critérios e limites verificáveis para qualidade, ajuste, autorização de gerações adicionais, prazo e remédio comercial; derivar testes e estados de conversa dessas regras.
- **medium** **Os gatilhos de escalonamento continuam subjetivos** (FR-6, FR-28, FR-30) — “pergunta não resolvida ou repetida”, “reclamação grave” e “frustração persistente” não dizem quando abrir/priorizar um caso. *Fix:* definir exemplos de classificação e fallback em caso de incerteza.

## Scope honesty — adequate

O documento distingue decisões fechadas de perguntas pendentes e agora marca Q1 como bloqueio de UX, Q5 como pendência antes de publicar termos comerciais, Q11 antes de ativar gastos e Q13 para detalhar a operação das notificações. A decisão de elegibilidade e a primeira resposta humana não estão mais tratadas como lacunas: estão repetidas em PRD, journeys e addendum. A quantidade de pendências é alta, mas não está escondida.

### Findings


Nenhum finding independente. A pendência pré-Pix está explicitamente marcada como bloqueio e detalhada em Downstream usability.

## Downstream usability — adequate

UJ-1 e UJ-2 têm protagonistas nomeados e cobertura suficiente para extrair os fluxos principais. A sequência consentimento→foto está clara, e o fluxo de insatisfação transfere o caso, comunica a expectativa de primeira resposta e deixa claro que não há prazo de resolução. FR-1/2 também dão comportamento para perguntas livres, pergunta por vez, mudança de assunto e retorno sem repetição. O handoff de UX ainda precisa das dúvidas pré-Pix aprovadas e das regras de qualidade/recurso.

### Findings

- **high** **Dúvidas e respostas pré-Pix não estão preenchidas na jornada que bloqueia UX** (UJ-1, FR-1/2/6, pergunta 1) — Os mecanismos conversacionais estão especificados; o conteúdo de compra não. A própria pergunta 1 marca a confirmação desses pontos como necessária antes do handoff. *Fix:* incluir as dúvidas e respostas aprovadas na UJ-1 e nos requisitos de FAQ antes de produzir mensagens e tickets de UX.

## Shape fit — adequate

O formato agora atende a um produto conversacional de consumo e à operação multiator: UJ-1 cobre a compra e UJ-2 cobre Carlos analisando notificações acumuladas. O modelo único de aniversário reduz o escopo e evita formalizar uma plataforma maior que a hipótese do piloto. A incompletude restante é de política e conteúdo, não de ausência de jornadas ou de forma inadequada para o produto.

### Findings

Nenhum finding adicional de shape fit; a pendência do conteúdo pré-Pix está registrada em Downstream usability.

## Mechanical notes

- **Glossário:** o separador de “Cliente” foi corrigido para travessão. “Prévia” ainda alterna com “amostras” (FR-26/SM-C3) e “preview” no addendum; alinhar ou explicar a diferença.
- **Continuidade e referências:** FR-1 a FR-44, NFR-1 a NFR-8, SM-1 a SM-8 e SM-C1 a SM-C3 são únicos e sequenciais; UJ-1/UJ-2 têm protagonistas. Referências de FR nos SMs resolvem; não encontrei IDs inexistentes.
- **Índice de hipóteses:** a hipótese dos preços de teste em §6.4 agora aparece no índice; o teto agregado e a alocação proposta também estão distinguidos.
- **Operação humana:** UJ-2/FR-30/35/Q7/Q13/addendum agora documentam Carlos, notificações acumuladas, ausência de horário fixo, primeira resposta em até 24 horas e nenhum prazo de resolução; findings anteriores de jornada do operador e SLA inicial foram removidos. A decisão explícita de não prometer prazo de resolução é mantida.
- **Addendum:** o fragmento interrompido na lista de regras operacionais foi corrigido; conteúdo permanece em inglês enquanto outras seções estão em português.
- **Seções:** componentes essenciais presentes. Aceite de qualidade/revisão, conteúdo de dúvidas pré-Pix e configuração do teto continuam pendentes, conforme findings acima.


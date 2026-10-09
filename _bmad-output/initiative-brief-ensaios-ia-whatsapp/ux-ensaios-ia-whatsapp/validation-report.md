# Validation Report — ImageSystem

- **DESIGN.md:** `_bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/EXPERIENCE.md`
- **Run at:** 2026-10-09T14:56:27-03:00

## Overall verdict

A dupla registra o limite aprovado pela usuária — a primeira mensagem recebida no WhatsApp — e preserva as principais restrições de privacidade, pagamento, prévia e handoff. Ainda não é um contrato pronto para implementação: contraste de links, inventário de componentes, fluxos de falha e estados operacionais precisam de mais definição. A revisão de acessibilidade e consentimento também identificou que o gate da foto precisa cobrir os dados e fornecedores envolvidos e explicar claramente o destino e o tratamento da imagem.

## Category verdicts

- Flow coverage — thin
- Token completeness — thin
- Component coverage — thin
- State coverage — thin
- Visual reference coverage — adequate
- Bloat & overspecification — adequate
- Inheritance discipline — thin
- Shape fit — adequate

## Findings by severity

### Critical (0)
Nenhum.

### High (4)

**Token completeness — contraste de links** (DESIGN.md, `components.link`; Colors; Components). `{colors.verde}` (`#58C411`) tem contraste calculado de 2,25:1 em branco e 1,82:1 em `{colors.fundo}`. *Correção sugerida:* usar cor de texto que atinja o alvo de contraste nas superfícies previstas, ou reservar o token para ênfase não textual e definir tratamento acessível de link.

**Component coverage — inventário visual e comportamental desalinhado** (DESIGN.md, Components; EXPERIENCE.md, Component Patterns). Seis tokens visuais não têm entradas comportamentais correspondentes; cartão de escalonamento, detalhe de atendimento, estados do pedido e operações não têm regras visuais correspondentes. *Correção sugerida:* alinhar um inventário de componentes e especificar regras visuais e comportamentais, ou identificar componentes herdados/nativos e a fonte correspondente.

**Acessibilidade e consentimento — destino e tratamento da foto** (EXPERIENCE.md, Foundation e Component Patterns; PRD FR-8/Q10; addendum, Technical direction). O texto explica a finalidade geral, mas não identifica processamento por fornecedor externo, retenção pelo fornecedor ou reutilização da imagem. *Correção sugerida:* manter o gate fechado até fornecedor e condições aprovadas serem conhecidos; antes da coleta, informar o processamento externo e os limites aplicáveis em linguagem curta.

**Acessibilidade e consentimento — gate de retenção incompleto** (EXPERIENCE.md, Foundation e State Patterns; PRD FR-41/Q8). A política pode ser considerada definida sem cobrir resultado, conversa/consentimento, backups ou cópias de fornecedores. *Correção sugerida:* exigir uma matriz aprovada por tipo de dado que defina prazo, marco inicial, fornecedores/cópias, exclusão e exceções; resumir isso antes do consentimento e manter a coleta pausada enquanto houver lacuna relevante.

### Medium (9)

**Flow coverage — jornadas sem IDs, forma completa ou caminhos de falha** (EXPERIENCE.md, Key Flows 1–5; PRD UJ-1/UJ-2). UJ-1/UJ-2 não aparecem como IDs; três fluxos não têm passos numerados e nenhum explicita recuperação de falha. *Correção sugerida:* preservar os IDs e títulos-fonte nos fluxos mapeados e adicionar passos numerados, clímax e recuperação aplicável sem alterar o início aprovado no WhatsApp.

**Flow coverage — rastreabilidade de requisitos** (EXPERIENCE.md, Key Flows; spec CAP-1–CAP-7; PRD FR-1–FR-44). Não há mapa entre capacidades/requisitos e os fluxos. *Correção sugerida:* acrescentar referências compactas por fluxo ou uma pequena matriz; manter detalhes puramente técnicos fora das narrativas da cliente.

**State coverage — estados de superfície e recuperação ausentes** (EXPERIENCE.md, Information Architecture e State Patterns; PRD FR-7, FR-12, FR-20–21, FR-37). Faltam estados aplicáveis de inbox vazio/carregando/erro/offline/acesso negado/conflito de responsável e recuperação para foto inválida, falha de Pix e envio temporariamente indisponível. *Correção sugerida:* definir estado, recuperação e status verdadeiro por superfície.

**Acessibilidade e consentimento — recusa, dúvida ou desistência** (EXPERIENCE.md, State Patterns, Interaction Primitives e Key Flow 1). Não há saída explícita para resposta ambígua, recusa, pedido de explicação ou mudança de ideia antes da geração. *Correção sugerida:* habilitar processamento somente após confirmação afirmativa inequívoca; pausar sem bloquear dúvidas e aplicar regra aprovada de descarte à desistência.

**Acessibilidade e consentimento — elegibilidade e foto incompatível** (EXPERIENCE.md, IA e Key Flow 1; PRD FR-7/FR-10). Idade e titularidade são perguntadas juntas; faltam respostas para “não”, “não sei” e foto incompatível. *Correção sugerida:* confirmar os dois fatos separadamente, não inferir idade pela aparência e impedir envio para geração/fornecedor quando o arquivo reprovar.

**Acessibilidade e consentimento — confirmação de pedido de privacidade** (EXPERIENCE.md, State Patterns e Key Flow 5; PRD FR-40/FR-41). O pedido escala, mas não há confirmação imediata à cliente nem estado/checklist no painel para verificar originais, cópias e backups. *Correção sugerida:* confirmar recebimento, informar apenas o prazo de primeira resposta já aprovado e fechar o caso somente após verificação registrada das cópias aplicáveis.

**Acessibilidade e consentimento — contraste do token de link** (DESIGN.md, `components.link`; EXPERIENCE.md, Accessibility Floor). A cor verde de texto falha contraste nas superfícies branca e estrutural; este achado coincide com Token completeness e foi mantido para preservar a avaliação independente da lente. *Correção sugerida:* usar cor acessível, sublinhado e foco visível; validar também estados e texto de botão.

**Acessibilidade e consentimento — mínimo de acessibilidade do painel** (EXPERIENCE.md, Accessibility Floor e Responsive & Platform). Não especifica teclado, foco visível, ampliação/refluxo ou alvos de interação. *Correção sugerida:* declarar alvo de acessibilidade do painel, comportamento por teclado e foco, conteúdo sem corte com ampliação, contraste de controles e larguras prioritárias.

**Inheritance discipline — glossário e nomes de jornada** (EXPERIENCE.md, Key Flows; PRD §2.3 e §3). IDs/títulos de UJ não são herdados literalmente e não há glossário compartilhado ou ponteiro para ele. *Correção sugerida:* preservar UJ-1/UJ-2 e apontar para o glossário do PRD ou registrar um glossário comum curto.

### Low (3)

**Visual reference coverage — referência e precedência dos spines** (DESIGN.md, Brand & Style; EXPERIENCE.md, Inspiration & Anti-patterns). A referência AbacatePay não está linkada inline junto à justificativa, e não há regra única de que os spines prevalecem sobre artefatos visuais. *Correção sugerida:* adicionar o link do guia ao trecho pertinente e declarar a precedência uma vez.

**Bloat & overspecification — repetição de regras** (EXPERIENCE.md, Foundation, IA, Component Patterns, State Patterns e Key Flows). Preço, retenção, consentimento, semelhança e resposta humana se repetem em vários pontos. *Correção sugerida:* registrar cada regra uma vez como fonte canônica e manter nos fluxos apenas o momento da decisão e seu efeito para a cliente.

**Acessibilidade e consentimento — descoberta de ajuda humana** (EXPERIENCE.md, Component Patterns, Accessibility Floor e Key Flow 5; PRD FR-28/Q9). A rota depende de a cliente saber formular um pedido explícito. *Correção sugerida:* mostrar em contexto uma frase literal, como “quero falar com uma pessoa”, sem menu persistente, e validar o formato segundo as regras atuais do WhatsApp.

## Overlap entre lentes

O contraste do link foi apontado pelas duas lentes. O relatório mantém ambos os registros independentes; resolver a escolha do token e o tratamento do link atende aos dois achados. Os demais achados usam escopos diferentes.

## Reviewer files

- `review-rubric.md`
- `review-accessibility-consent.md`

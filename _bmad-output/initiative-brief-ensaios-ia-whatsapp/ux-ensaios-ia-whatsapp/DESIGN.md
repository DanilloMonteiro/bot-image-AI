---
name: ImageSystem
description: "Direção visual adaptada de uma referência; nome e marca comercial permanecem por definir."
status: final
sources:
  - ../../../prd-ensaios-ia-whatsapp.md
  - ../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
  - ../prd-ensaios-ia-whatsapp/addendum.md
  - https://www.abacatepay.com/design
updated: 2026-10-09
colors:
  lima: '#9EEA6C'
  verde: '#58C411'
  verde-escuro: '#244C4E'
  texto: '#4C5267'
  fundo: '#E2E7F1'
  branco: '#FFFFFF'
typography:
  titulo:
    fontFamily: 'Fustat'
    fontWeight: '600'
  corpo:
    fontFamily: 'Inter Tight'
    fontWeight: '500'
rounded:
  full: 600px
components:
  botao-principal:
    background: '{colors.lima}'
    foreground: '{colors.verde-escuro}'
    radius: '{rounded.full}'
    contrastTarget: '>=4.5:1'
  titulo-painel:
    fontFamily: '{typography.titulo.fontFamily}'
    color: '{colors.verde-escuro}'
  link:
    color: '{colors.verde-escuro}'
    textDecoration: underline
    focus: visible
    contrastTarget: '>=4.5:1'
  texto-corpo:
    fontFamily: '{typography.corpo.fontFamily}'
    color: '{colors.texto}'
    contrastTarget: '>=4.5:1'
  superficie-painel:
    background: '{colors.fundo}'
  superficie-cartao:
    background: '{colors.branco}'
  cartao-escalacao:
    background: '{colors.branco}'
    severity: 'text-and-icon-plus-color'
  detalhe-atendimento:
    background: '{colors.branco}'
    focus: 'visible'
  estado-pedido:
    severity: 'text-and-icon-plus-color'
  visao-operacional:
    background: '{colors.fundo}'
  conversa-whatsapp:
    visualSystem: 'native-whatsapp'
---

# Brand & Style

## Identidade

- **Nome comercial e marca gráfica:** [OPEN QUESTION]. ImageSystem identifica o projeto, não é um nome aprovado para clientes.
- **Direção visual:** adaptar clareza, hierarquia, paleta e tipografia do [guia de design da AbacatePay](https://www.abacatepay.com/design) à identidade própria do produto. A referência não implica parceria nem autoriza copiar nome, logotipo, imagens ou textos.
- **Aplicação:** a cliente conversa pela interface nativa do WhatsApp. A direção visual aplica-se principalmente ao painel web interno dos sócios.
- **Imagens de exemplo e retratos gerados:** a direção de arte das fotografias não foi definida.

# Colors

Aplicar os tokens do frontmatter:

- {colors.lima}: ações, botões e destaques.
- {colors.verde}: ênfase visual não textual e detalhes que não dependem de cor para comunicar significado.
- {colors.verde-escuro}: títulos, links e texto sobre {colors.lima}.
- {colors.texto}: texto corrido.
- {colors.fundo}: superfícies estruturais.
- {colors.branco}: superfícies claras.

Para texto normal, manter contraste mínimo de 4,5:1; para texto grande e componentes visuais relevantes, no mínimo 3:1. {colors.verde-escuro} atinge pelo menos 7:1 como texto sobre {colors.branco} e {colors.fundo}. Verificar também foco, hover, estados desabilitados e rótulos dentro dos botões na implementação. Não comunicar estado ou prioridade só pela cor.

# Typography

- Títulos: {typography.titulo.fontFamily}, peso semibold, espaçamento entre letras compacto e cor {colors.verde-escuro}.
- Corpo: {typography.corpo.fontFamily}, peso medium, espaçamento entre linhas amplo e cor {colors.texto}.
- Usar português brasileiro conciso e direto; apresentar o benefício antes dos detalhes em conteúdo explicativo.
- Fallbacks tipográficos não foram especificados; confirmar antes da implementação.

# Layout & Spacing

Priorizar leitura rápida no painel: exceções e ações ficam evidentes sem exigir leitura de conversas rotineiras. A cliente conserva a conversa nativa do WhatsApp. Grid, largura, breakpoints e escala de espaçamento seguem em aberto.

# Elevation & Depth

Sem escala aprovada; usar tipografia, cores e estrutura para hierarquia. Acrescentar sombra somente quando houver necessidade definida.

# Shapes

Não há escala geral de raios. {rounded.full} é uma [ASSUMPTION] restrita a ações em formato de pílula; não aplicar a cartões, campos ou outros componentes.

# Components

- **{components.botao-principal}:** preenchimento {colors.lima}, texto {colors.verde-escuro}; mostrar uma ação principal por contexto. Estados indisponíveis exibem também o motivo.
- **{components.titulo-painel}:** título de página ou seção, sem aparência de controle interativo.
- **{components.link}:** texto {colors.verde-escuro}, sublinhado e foco visível; não depender apenas da cor.
- **{components.texto-corpo}:** texto essencial em {colors.texto}, sem informação importante escondida em tooltip.
- **{components.superficie-painel} e {components.superficie-cartao}:** separar estrutura e conteúdo sem inventar sombras, grids ou raios.
- **{components.cartao-escalacao}:** superfície clara com motivo, resumo, idade da solicitação e contexto do pedido. Gravidade e estado usam rótulo e ícone além de cor.
- **{components.detalhe-atendimento}:** agrupar histórico, pedido relacionado, responsável e ações disponíveis; manter foco visual na próxima ação válida.
- **{components.estado-pedido}:** rótulo textual e ícone para pagamento, prévia, geração, qualidade e entrega; estado não depende só da cor.
- **{components.visao-operacional}:** agrupar custos, qualidade e falhas para leitura rápida; gráficos e hierarquia visual detalhada seguem em aberto.
- **{components.conversa-whatsapp}:** conservar bolhas, envio de imagens e controles nativos do canal.

# Do's and Don'ts

## Do

- Adaptar os tokens à identidade própria do produto.
- Manter o painel enxuto, com hierarquia clara para exceções, contexto e ações operacionais.
- Usar texto e ícone além de cor para estados e prioridades.
- Manter em aberto o nome e a marca gráfica comerciais.

## Don't

- Copiar nome, logotipo, imagens ou textos da referência, sugerir parceria ou usar imagens de fruta como símbolo do produto.
- Inventar estilo para os retratos, espaçamentos, sombras ou grids sem decisão.
- Criar uma interface de cliente que substitua o WhatsApp ou exija login, formulário, app ou portal.
- Tratar mockups ou imports como regras quando divergirem destes spines.





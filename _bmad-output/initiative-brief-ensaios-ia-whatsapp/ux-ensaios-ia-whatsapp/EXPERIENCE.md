---
name: ImageSystem
status: final
sources:
  - ../../../prd-ensaios-ia-whatsapp.md
  - ../spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
  - ../prd-ensaios-ia-whatsapp/addendum.md
updated: 2026-10-20
---

# Foundation

## Experiência e limite do sistema

O produto permite que uma pessoa adulta encomende um retrato individual de aniversário em uma conversa no WhatsApp. A cliente entende as condições antes de enviar a própria foto, recebe a oferta, paga por Pix e recebe as imagens pelo mesmo canal. Isaac e seu sócio usam o painel web interno por contas individuais protegidas por MFA, sem cadastro público ou credenciais compartilhadas; ambos são administradores. DESIGN.md define a identidade visual; este documento define arquitetura, comportamento e estados.

- **Início do sistema:** primeira mensagem recebida no WhatsApp. O anúncio, o clique e a transição pelo Instagram ficam fora desta UX.
- **Superfícies:** conversa da cliente no WhatsApp e painel web interno dos sócios.
- **Fora de escopo:** app, conta ou login de cliente, formulário obrigatório, portal externo e entrega dependente de ZIP.

## Protagonistas

- **Maria:** cliente adulta que busca um retrato de aniversário e pode ter baixa afinidade digital ou receio de pagar sem entender o resultado.
- **Claudia:** atendente automatizada. Interpreta e explica, mas não decide preço, pagamento, reembolso, desconto ou aprovação de geração.
- **Carlos:** um dos dois sócios. Analisa Escalações, aprova prévias e decide sobre geração adicional.

## Restrições e gates

- O catálogo ativo contém somente retrato individual de aniversário. A pessoa deve ter 18 anos ou mais e enviar a própria foto. Imagens de terceiros, menores, grupos, múltiplas pessoas e celebridades não seguem para geração.
- **Gate de foto fechado por padrão:** não pedir nem encaminhar foto a um provedor de IA até que fornecedor e tratamento estejam conhecidos e validados e exista uma política aprovada por tipo de dado. Para cada item — foto original, resultados gerados, conversa, registro de consentimento, backups e cópias mantidas por fornecedores —, a política define prazo de retenção e seu marco inicial, condições de exclusão e exceções aplicáveis. A cliente recebe um resumo compreensível antes de consentir.
- Antes de pedir a foto, explicar finalidade, processamento por IA, eventual processamento por fornecedor externo e condições de retenção/reuso aprovadas. Só uma confirmação afirmativa inequívoca autoriza o processamento. Consentimento para gerar o retrato não autoriza publicidade, portfólio ou treinamento; cada uso adicional exige autorização separada e explícita.
- Não inferir idade pela aparência. Perguntar separadamente se Maria é adulta e se a foto é dela. Não encaminhar arquivo incompatível para geração ou fornecedor; pedir uma nova foto ou oferecer atendimento humano.
- Não garantir semelhança facial. Preço, prazo, critérios de qualidade, limite de tentativas, revisão, ajuste e reembolso seguem pendentes até aprovação.
- Só confirmação autenticada do provedor, vinculada ao pedido e ao valor, autoriza geração paga. Mensagem ou comprovante enviado pela cliente não confirma Pix.
- A primeira resposta humana deve ocorrer em até 24 horas; não há prazo de resolução aprovado. Durante atendimento humano, Claudia suspende respostas comerciais até retomada explícita por um sócio.

# Information Architecture

| Superfície | Como chega | Propósito e fluxos |
| --- | --- | --- |
| Conversa da cliente no WhatsApp | Primeira mensagem recebida | Intenção, exemplos e preferências; dúvidas pré-Pix; consentimento e foto; oferta e Pix; entrega, feedback e ajuda. Ver UJ-1 e fluxos 2, 3 e 5. |
| Inbox de Escalações | Sócio autenticado abre o painel | Filtrar pendências por gravidade/estado e decidir o próximo atendimento. Ver UJ-2 e fluxo 5. |
| Detalhe de atendimento | Abrir uma Escalação | Consultar contexto, assumir, responder, atribuir, resolver e decidir retomada da automação. Ver UJ-2. |
| Pedidos e aprovações | Pedido selecionado no painel | Consultar pagamento, foto/resultados autorizados, prévia, falhas, qualidade e entrega. Ver UJ-1, fluxo 3 e UJ-2. |
| Operação e custos | Área interna do painel | Acompanhar gasto, qualidade, falhas e campanha; bloquear nova operação com custo se o saldo for desconhecido/insuficiente. Ver CAP-7 e FR-44. |

A conversa da cliente não exige app, formulário, conta, login ou portal externo. O painel permanece web; prioridade de dispositivo e breakpoints seguem em aberto.

# Voice and Tone

- **Idioma:** português brasileiro, acessível e direto; não exigir conhecimento de fotografia, prompts, tecnologia ou códigos.
- Adaptar tom, entusiasmo, comprimento e vocabulário ao que a cliente demonstra. Não inferir estilo por idade, gênero ou outros dados demográficos.
- Não usar pressão, falsa urgência nem intimidade exagerada.
- Claudia não precisa se identificar espontaneamente como virtual; se perguntada, responde com transparência e nunca afirma ser humana. Validar essa preferência com as regras vigentes da plataforma e obrigações aplicáveis.
- Separadamente, explicar em linguagem simples que a foto será processada com IA antes de obter consentimento.
- Não inventar preço vigente, estimativa de entrega, garantia de qualidade, regra de prévia, ajuste, reembolso, fornecedor ou período de retenção. Encaminhar o que não tiver resposta aprovada.

# Component Patterns

Este documento define o comportamento; as regras visuais correspondentes estão na seção Components de DESIGN.md.

| Componente | Uso | Regra comportamental |
| --- | --- | --- |
| `botao-principal` | Ação principal disponível no painel | Uma ação principal por contexto. Desabilitar enquanto uma condição necessária não estiver confirmada e mostrar o motivo. Confirmar explicitamente ações que gerem gasto/imagem, alterem preço/pagamento, liberem reserva, exponham/excluam dado pessoal ou mudem acesso/takeover; basta o sócio autenticado que executa, sem segunda aprovação. |
| `titulo-painel` | Página e seções do painel | Identifica a área atual na ordem de leitura; não se apresenta como controle interativo. |
| `link` | Navegação e referências | Operável por teclado, com foco visível e texto sublinhado; o nome informa o destino ou propósito. |
| `texto-corpo` | Instruções, contexto e estados | Informação essencial aparece em texto direto, sem depender de cor, imagem ou tooltip. |
| `superficie-painel` | Estrutura do painel | Agrupa áreas relacionadas; estado de carregamento, erro ou ausência de dados permanece explícito dentro da área. |
| `superficie-cartao` | Agrupamento de dados do pedido | Mantém fatos do mesmo pedido juntos; não parece clicável se não tiver ação. |
| `cartao-escalacao` | Inbox | Abre o detalhe ao acionar o item. Expõe motivo, idade, gravidade/estado e contexto; texto e ícone acompanham a cor. |
| `detalhe-atendimento` | Conversa assumida pelo sócio | Identifica responsável atual e ações permitidas. Bloqueia envio manual concorrente e indica quando o caso está atribuído a outra pessoa. |
| `estado-pedido` | Pagamento, prévia, geração, qualidade e entrega | Usa rótulo e ícone junto à cor. Só usa “confirmado” ou “entregue” após evidência correspondente. |
| `visao-operacional` | Custos, qualidade e campanha | Diferencia valor realizado, comprometido, reservado e ainda não faturado; bloqueio de operação mostra causa e próxima ação segura. |
| `conversa-whatsapp` | Atendimento à cliente | Conserva mensagens, envio de foto e controles nativos do canal; uma pergunta de cada vez e contexto preservado. |

## Padrões de conversa

- **FAQ pré-Pix:** responder somente com fatos aprovados. Semelhança pode variar e não é garantida; preço e prazo só aparecem após aprovação. Retenção e tratamento da foto precisam estar definidos antes da coleta.
- **Consentimento:** dúvidas e recusas podem continuar como conversa comercial sem envio de foto. Resposta ambígua não vale como consentimento. Pedido para parar persiste a revogação e cancela trabalho ainda não despachado. Se a submissão externa já foi autorizada/começou e pode ter sido recebida, bloquear resultado e entrega, pedir exclusão upstream quando suportada, registrar o estado e escalar; nunca alegar exclusão sem evidência.
- **Elegibilidade:** perguntar maioridade e titularidade em turnos separados. Se a pessoa não confirmar qualquer condição ou a imagem não for individual/própria, pausar, explicar brevemente e pedir outra imagem ou oferecer sócio.
- **Resumo e Pix:** apresentar modelo, pacote, quantidade e preço liberado; pedir confirmação antes de criar cobrança. Usar estados pendente, confirmado, divergente ou não verificado com base no registro do provedor.
- **Prévia:** explicar que depende de aprovação e reserva de custo, é enviada em baixa resolução e contém marca-d’água. Não sugerir que pedir prévia inicia geração ou define o abatimento do pacote.
- **Rota humana:** quando houver dúvida sem resposta aprovada, reclamação ou pedido de privacidade, confirmar o encaminhamento com contexto. Em pontos relevantes, mostrar a frase simples “Se preferir, escreva ‘quero falar com uma pessoa’”.
- **Entrega e feedback:** enviar pelo WhatsApp; instruir brevemente como salvar; declarar entrega depois de confirmação; então perguntar se chegou e convidar feedback conforme opt-out, janela e templates permitidos.

# State Patterns

## Cliente — WhatsApp

| Estado | Comportamento |
| --- | --- |
| Política/finalidade incompleta | Manter o gate fechado; não solicitar nem encaminhar foto. Explicar que a equipe ainda está preparando essa informação e oferecer outra dúvida ou contato humano. |
| Consentimento ausente, ambíguo ou recusado | Não processar nem encaminhar a imagem. Responder à dúvida; permitir continuar sem foto ou encerrar sem pressão. |
| Desistência antes da geração | Cancelar trabalho ainda na fila e conferir consentimento antes da chamada externa. Se o provedor já recebeu a solicitação, suprimir resultado/entrega, pedir exclusão quando suportada e escalar; nunca afirmar exclusão sem evidência. |
| Pessoa/foto inelegível ou arquivo inválido | Não gerar nem enviar ao provedor de IA. Dizer o que precisa mudar e aceitar nova foto; se houver dúvida, encaminhar ao sócio. |
| Pix pendente, divergente ou não verificado | Não iniciar geração paga; explicar o estado verdadeiro. Não pedir pagamento repetido enquanto o evento estiver incerto; reconciliar pelo provedor. |
| Falha na criação do Pix | Informar que a cobrança não foi confirmada e indicar o próximo passo seguro; não duplicar pedido ou cobrança por suposição. |
| Prévia aguardando decisão ou saldo | Não gerar; mostrar que depende de aprovação do sócio e reserva de custo. Recusa ou saldo desconhecido não dispara tentativa. |
| Geração/qualidade em andamento | Mostrar somente status confirmado. Limite de tentativas e critério de qualidade precisam estar aprovados antes do lançamento. |
| Falha temporária de envio | Não declarar entrega. Informar que o envio não foi confirmado e criar estado recuperável; limite de retentativas e abertura de Escalação seguem regra operacional aprovada. |
| Reclamação ou necessidade humana | Criar uma Escalação com contexto, confirmar recebimento e informar que os sócios darão a primeira resposta em até 24 horas; não prometer prazo de resolução. |
| Pedido de privacidade | Confirmar recebimento imediatamente. Registrar tipo do pedido; sócio verifica foto original, resultados, registros e cópias aplicáveis; confirmar conclusão somente após verificação. |

## Sócios — painel web

| Estado | Comportamento |
| --- | --- |
| Primeira carga | Indicar carregamento e não mostrar dados parciais como definitivos. |
| Inbox vazio | Explicar que não há Escalações pendentes, sem inventar trabalho recomendado. |
| Falha de leitura | Informar que os dados atuais não foram confirmados e oferecer nova tentativa; não permitir decisão sensível baseada em estado desatualizado. |
| Sem conexão ou dado atual desconhecido | Preservar contexto visível, marcar dados como desatualizados e bloquear ações que dependem de confirmação recente, incluindo gasto novo. |
| Acesso negado | Servir objetos protegidos do painel apenas pelo proxy autenticado do servidor, revalidando permissão por objeto em cada requisição; não usar URL pré-assinada no navegador. Explicar falta de permissão sem revelar bytes, metadados, nome ou existência do objeto. |
| Visualização de imagem | Permitir visualização normal sem confirmação adicional após autenticação e autorização por objeto; registrar ator, horário e objeto. Download, exportação e exclusão exigem confirmação explícita antes da ação. |
| Atendimento atribuído a outro sócio | Mostrar responsável e impedir resposta manual concorrente; permitir atualizar o estado. |
| Pedido de privacidade em andamento | Mostrar responsável, itens/cópias que precisam ser verificados e estado de cada verificação; não oferecer fechamento como concluído sem evidência. |
| Saldo insuficiente ou desconhecido | Bloquear qualquer nova operação que gere custo e explicar a causa; reabrir somente após reconciliação e saldo confirmado. |

## Teto do piloto

O teto do piloto é R$500: anúncios R$220; IA R$110; aplicação, worker, PostgreSQL, Bucket, armazenamento, tráfego de serviço e backups Railway R$65; domínio/acessórios R$25; reserva para tarifas Meta/Pix, câmbio e retentativas R$80. Mostrar gastos realizados, comprometidos, reservados e ainda não faturados. Alertar em 60%, 80% e 95% do total e de cada categoria; não transferir saldo entre categorias automaticamente. Bloquear nova ação paga quando o saldo ou custo for desconhecido/insuficiente ou qualquer teto for alcançado. Qualquer um dos sócios pode pausar gastos. Para liberar reserva, o resultado do provedor deve ser terminal e o uso/cobrança ligado ao ID da ação deve estar conciliado; custos não faturados conhecidos continuam comprometidos, e divergência ou saldo desconhecido mantém o bloqueio. Registrar ator, motivo e horário.

# Interaction Primitives

- Linguagem livre; sem menus, códigos numéricos, formulários obrigatórios ou login para clientes.
- Fazer uma pergunta por vez e não solicitar novamente dados já informados sem motivo.
- A confirmação de consentimento deve ser afirmativa e inequívoca; dúvida, silêncio ou recusa não habilitam processamento.
- Confirmar resumo comercial antes do Pix. O estado financeiro vem do registro verificado do provedor, não do modelo nem de captura de comprovante.
- Atender pedido explícito de pessoa e suspender resposta comercial automática durante atendimento humano.
- Um sócio autorizado aprova prévias e gerações adicionais. As decisões financeiras sensíveis ficam registradas.
- No painel web, todas as ações são utilizáveis por teclado, seguem a ordem de leitura e exibem foco visível.

# Accessibility Floor

- [ASSUMPTION] Adotar WCAG 2.2 AA como meta mínima do painel web. Texto normal mantém contraste de pelo menos 4,5:1; texto grande e componentes visuais relevantes, 3:1. Ver os pares definidos em DESIGN.md.
- Operar por teclado, mostrar foco visível, não prender o foco e manter a ordem de navegação igual à ordem de leitura.
- [ASSUMPTION] Permitir ampliação de texto a 200% e reflow em largura de 320 CSS px sem perda de conteúdo ou ação. Confirmar o alvo de dispositivo principal dos sócios.
- Combinar cor com texto/ícone; controles, estados de bloqueio e mensagens de erro têm rótulo compreensível. Alvos interativos devem ter pelo menos 24 × 24 CSS px ou atender à exceção de espaçamento equivalente do padrão adotado.
- No WhatsApp, usar frases curtas para explicar IA, finalidade, fornecedor, retenção, consentimento, pagamento e próximo passo. Descrever exemplos visuais em texto breve, sem depender da imagem para explicar opções.
- Projetar para baixa afinidade digital: não exigir app, conta, formulário, senha, código ou vocabulário técnico.
- Validar entendimento de consentimento, oferta, estado do Pix e rota humana com pelo menos cinco pessoas de baixa afinidade digital, conforme a meta de usabilidade do PRD.
- Validar regras vigentes da conta WhatsApp, opt-in/opt-out, janela de mensagens, templates e atendimento humano antes do lançamento. Áudio não está decidido; não indicar que notas de voz são suportadas.

# Responsive & Platform

| Superfície | Plataforma e comportamento |
| --- | --- |
| Cliente | WhatsApp no celular; conservar a interface e os controles nativos do canal. |
| Sócios | Painel web interno; suportar leitura e teclado. O dispositivo prioritário e os breakpoints seguem em aberto. A meta assumida de reflow de 320 CSS px não define qual tela é prioritária. |

A direção visual da referência não define o layout responsivo do painel. Confirmar foco, dimensões e regras de mensagem conforme a conta WhatsApp efetivamente usada.

# Inspiration & Anti-patterns

- A direção visual da referência e os limites de uso estão em DESIGN.md.
- A cliente pede ajuda em linguagem natural; não manter um menu de ajuda persistente.

# Key Flows

## 1. UJ-1 — Maria encomenda um ensaio de aniversário

**Início:** Maria envia a primeira mensagem ao WhatsApp depois de encontrar o anúncio do Instagram; anúncio e clique estão fora do sistema. **Clímax:** recebe as imagens no WhatsApp e uma confirmação verdadeira de entrega, sem aprender comandos ou abrir outro produto.

1. Claudia entende a mensagem livre, mostra exemplos do modelo ativo e pergunta sobre preferências opcionais.
2. Claudia responde dúvidas pré-Pix usando somente a FAQ aprovada e preserva o contexto da compra.
3. Antes de pedir a foto, Claudia explica a finalidade, o uso de IA e, quando aplicável, o processamento por fornecedor externo. Também apresenta um resumo da política de dados aprovada.
4. Claudia pergunta separadamente se Maria tem 18 anos ou mais e se enviará uma foto própria; então solicita confirmação afirmativa e inequívoca para o processamento descrito.
5. Só após consentimento e elegibilidade confirmados, Claudia pede a imagem. Se a foto for incompatível ou a validação ficar incerta, o sistema não a envia ao provedor nem inicia geração; pede outra imagem ou oferece atendimento humano.
6. Se Maria pedir prévia, a solicitação segue para o fluxo de aprovação e aguarda reserva de custo antes de qualquer geração.
7. Claudia resume modelo, pacote, quantidade e preço vigente aprovado; explica que a semelhança pode variar. Estimativa de entrega só aparece após teste de capacidade e aprovação do prazo.
8. Maria confirma o resumo e paga o Pix. Só confirmação autenticada e correspondente do provedor libera geração paga.
9. O sistema gera e verifica as imagens e as envia pelo WhatsApp. Claudia afirma que foram entregues somente após confirmação do envio.
10. Claudia pergunta se Maria recebeu os arquivos e convida a compartilhar feedback conforme as regras aprovadas do canal.

**Recuperação:** recusa ou dúvida mantém o processamento pausado e permite continuar a conversa sem foto. Pix incerto não dispara nova cobrança ou geração; foto incompatível não segue para fornecedor; falha de envio não é chamada de entrega e vira estado recuperável/escalonável.

## 2. Maria pergunta antes do Pix

**Início:** Maria pergunta sobre modelo, preço, foto, IA, prévia, qualidade, prazo, Pix ou entrega. **Clímax:** recebe informação aprovada e continua no contexto ou sabe como falar com os sócios.

1. Claudia identifica o tema e responde com fatos da FAQ aprovada.
2. Se a resposta depender de preço, prazo, retenção, limite de prévia, qualidade, ajuste ou reembolso ainda não aprovados, ela diz que a condição não está definida e não a inventa.
3. Maria pode fazer outra pergunta, continuar quando houver resposta aprovada ou escrever “quero falar com uma pessoa”.

**Recuperação:** se Claudia não entender a dúvida ou não tiver resposta aprovada, preserva o contexto e encaminha aos sócios sem pressionar a compra.

## 3. Maria pede prévia antes do Pix

**Início:** Maria pede uma prévia. **Clímax:** recebe imagem de baixa resolução com marca-d’água apenas após aprovação e reserva de custo, ou recebe o próximo passo se a solicitação for recusada.

1. Claudia registra solicitação, pedido/intenção de compra e estado, sem gerar imagem.
2. O painel mostra o pedido ao sócio autorizado, que aprova ou recusa e reserva o custo aplicável.
3. Se aprovada e com saldo confirmado, a prévia é gerada e enviada com baixa resolução e marca-d’água.
4. Claudia explica como continuar para um pacote somente com preço vigente aprovado.

**Recuperação:** recusa, saldo desconhecido ou ausência de aprovação mantêm a geração bloqueada. Limites, frequência e contabilização da prévia no pacote continuam em aberto.

## 4. UJ-2 — Carlos acompanha uma solicitação de alteração

**Início:** Maria relata insatisfação ou pede alteração depois da entrega. **Clímax:** Carlos encontra contexto suficiente para conduzir o caso; a automação só retorna após retomada explícita.

1. O painel cria uma Escalação com motivo, resumo, histórico, pedido relacionado, gravidade/estado e idade.
2. Claudia confirma a Maria que recebeu o pedido e informa que os sócios darão a primeira resposta em até 24 horas, sem prometer resolução, geração adicional ou reembolso.
3. Carlos abre a solicitação acumulada, assume o atendimento e consulta somente os dados autorizados.
4. Carlos decide se autoriza imagens adicionais; qualquer ação sensível fica registrada.
5. Depois de resolver conforme a política comercial aprovada, Carlos escolhe explicitamente se retoma a automação.

**Recuperação:** se o painel ou notificação estiver indisponível, a solicitação permanece pendente e visível quando a conexão/serviço voltar; Claudia não anuncia resolução nem envia respostas comerciais conflitantes.

## 5. Maria pede atendimento humano ou ajuda sobre seus dados

**Início:** Maria pede uma pessoa, acesso ou exclusão de dados/imagem. **Clímax:** recebe confirmação do recebimento e os sócios verificam o pedido sem alegar conclusão antes da evidência.

1. Claudia reconhece o pedido em linguagem simples e confirma o recebimento somente depois de persistir a solicitação; se envolver revogação ou exclusão de trabalho ativo, bloquear novo processamento antes da confirmação e manter o bloqueio durante falhas até a reconciliação. Mostrar quando o encaminhamento ao painel ainda está pendente.
2. Para ajuda humana ou privacidade, informa que os sócios darão a primeira resposta em até 24 horas, sem indicar prazo de resolução.
3. O painel registra tipo do pedido, conversa/pedido relacionado, responsável e itens que precisam de verificação.
4. O sócio verifica foto original, resultados, registros e cópias de fornecedor/backup aplicáveis segundo a política aprovada.
5. A resposta de conclusão é enviada somente após a verificação; se ainda houver item pendente, a cliente recebe o estado verdadeiro e o próximo passo.

**Recuperação:** falha no envio do pedido ao painel mantém um estado pendente e dispara a rota operacional de recuperação. Claudia não afirma exclusão nem interrompe retenção obrigatória sem verificação e orientação aprovada.

## Rastreabilidade das jornadas e capacidades

Os nomes de UJ-1 e UJ-2 seguem o PRD. O início de UJ-1 foi ajustado à decisão da usuária para começar na primeira mensagem recebida pelo WhatsApp. Termos do fluxo seguem o glossário do PRD (§3).

| Fluxo/superfície | Referências principais |
| --- | --- |
| UJ-1 — encomenda | CAP-1, CAP-2, CAP-3, CAP-4; FR-1–21; FR-43 |
| Dúvidas pré-Pix | FR-5, FR-6, FR-16, FR-27 |
| Pedido de prévia | CAP-5; FR-17, FR-22–26 |
| UJ-2 — alteração/insatisfação | CAP-6; FR-21, FR-27–39 |
| Atendimento humano e privacidade | FR-28–35, FR-40–41 |
| Painel operacional e custos | CAP-6, CAP-7; FR-35–39, FR-42, FR-44 |

A matriz liga requisitos às consequências observáveis da experiência. Idempotência, autenticação, persistência, armazenamento e recuperação técnica continuam especificados nas fontes de produto/arquitetura, não nesta narrativa.

## Decisões e gates ainda abertos

- **Antes da coleta de foto:** nome do fornecedor, condições de envio/reuso e política por tipo de dado (foto original, resultados, conversa/consentimento, backups e cópias de fornecedores), incluindo prazo, marco inicial, exclusão e exceções. O gate permanece fechado até decisão e validação.
- Preços finais e margem; prazo após teste de capacidade; critérios de qualidade e número de tentativas; limites e contabilização da prévia; política de ajuste, cancelamento e reembolso. A IA não cria nem autoriza descontos ou reembolsos; até haver regra aprovada, a decisão cabe ao sócio autorizado e fica registrada.
- Prioridade/canal das notificações, comportamento de falhas e prazo de resolução humana; regras vigentes da conta WhatsApp, opt-in/opt-out, janela e templates; áudio e cadência de pós-venda.
- Dispositivo prioritário e breakpoints do painel; fallback tipográfico; validação da meta de acessibilidade assumida; direção de arte das fotografias; nome e marca gráfica comerciais.
- O valor de teste R$19,90 / R$39,90 / R$59,90 para 1 / 5 / 10 imagens não é oferta ativa sem validação de margem.






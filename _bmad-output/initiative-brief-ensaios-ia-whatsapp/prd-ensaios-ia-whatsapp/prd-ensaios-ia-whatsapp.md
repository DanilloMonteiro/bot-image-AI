---
title: Ensaios IA por WhatsApp
status: draft
created: 2026-10-08
updated: 2026-10-27
---

# PRD: Ensaios IA por WhatsApp

_Nome de trabalho derivado do brief; nome e identidade comerciais permanecem a definir._

## 0. Propósito do documento

Este PRD descreve o MVP de um serviço brasileiro de ensaios fotográficos individuais gerados com IA e vendidos pelo WhatsApp. Ele orienta produto, UX, arquitetura e implementação, separando capacidades do produto das escolhas técnicas propostas. Os requisitos abaixo usam IDs estáveis; decisões ainda não confirmadas aparecem como perguntas ou hipóteses.

Fontes de entrada: [brief v2.0](../../../brief-ensaios-ia-whatsapp.md) e [plano fonte v2.0](../../../plano_ensaios_ia_whatsapp_v2_fonte.md), ambos de 2026-10-08. O [addendum](addendum.md) conserva detalhes técnicos, operacionais e de pesquisa para as etapas seguintes.

## 1. Visão

O produto permite que uma pessoa encomende fotos personalizadas sem aprender a escrever prompts, instalar um aplicativo ou preencher um formulário. Ela inicia uma conversa a partir de um anúncio no Instagram, explica o ensaio com as próprias palavras, envia uma foto, entende o preço e recebe as imagens no WhatsApp.

A experiência deve parecer simples e acolhedora, enquanto o sistema trata dinheiro, autorização de imagem, geração e entrega por regras verificáveis. A IA interpreta e redige mensagens; regras de negócio e dados autenticados controlam preço, pedido, Pix, reembolso, amostras e transferência para uma pessoa.

O piloto comercial deve validar procura, qualidade percebida, conversão, custo variável e capacidade operacional de dois sócios. AbacatePay e Google Vertex AI foram escolhidos em 2026-10-25; em 2026-10-27, após pesquisa de candidatos solicitada pelo proprietário, a rota recomendada e adotada para o piloto é WhatsApp Cloud API diretamente pela Meta, sem BSP. Custos ainda não confirmados seguem desconhecidos e bloqueiam operações pagas. Em 2026-10-20, os sócios aprovaram o teto de R$500 para o piloto e sua distribuição por categoria: anúncios R$220; IA R$110; aplicação/worker/PostgreSQL/Bucket/armazenamento/egress/backups Railway R$65; domínio/acessórios R$25; reserva para tarifas Meta/Pix, câmbio e retentativas R$80. Os gastos precisam ser reconciliados com compromissos e cobranças ainda não faturadas.

## 2. Público e necessidades

### 2.1 Usuário principal e trabalhos a realizar

**Pessoa adulta que quer um ensaio individual e prefere resolver tudo pelo WhatsApp.** Pode ter baixa afinidade digital, não saber descrever um estilo fotográfico e desconfiar de pagar antes de entender o resultado.

- Conseguir um retrato bonito para aniversário, ocasião especial ou uso pessoal sem estúdio nem conhecimento de edição.
- Explicar o que deseja em linguagem comum e receber perguntas apenas quando faltarem informações importantes.
- Entender preço, uso da foto, prazo e próximos passos antes de pagar.
- Enviar uma foto com confiança e receber confirmação do pedido e das imagens no mesmo canal.
- Obter ajuda humana quando a conversa, o pagamento, a privacidade ou o resultado exigir atenção.

**Compradores por presente:** fora do MVP. O Cliente precisa ser adulto e enviar a própria foto; pedidos para retratar outra pessoa exigiriam fluxo de autorização futuro.

**Usuários internos:** Isaac e seu sócio, as únicas duas contas administradoras permitidas no painel, que acompanham exceções, custos, aprovações de prévia, reclamações e pedidos sem ler cada conversa normal. Cada um usa conta individual com MFA e ações auditadas.

### 2.2 Limites de público no MVP

O MVP atende somente adultos que enviem a própria foto. Fotos de terceiros e de menores são recusadas antes de qualquer processamento. Grupos, múltiplos rostos, celebridades e uso de imagem sem autorização também ficam fora do escopo.

### 2.3 Jornadas do usuário

**UJ-1 — Maria encomenda um ensaio de aniversário.** Maria encontra um anúncio no Instagram, toca nele e abre o WhatsApp com uma mensagem pronta. Ela escreve: “Olá, quero uma foto de aniversário”. Claudia pergunta qual modelo ela quer; no MVP, o catálogo oferece apenas aniversário e Claudia mostra exemplos desse modelo. Em seguida, pergunta se Maria quer alguma característica específica, como cor da roupa, pose ou cenário. Claudia explica que a foto será processada com IA para gerar o ensaio, pede permissão e solicita que Maria a envie se concordar; o consentimento e o arquivo são registrados antes de gerar qualquer imagem. Uma prévia com marca-d’água pode ser liberada antes do Pix, conforme aprovação manual e limite de custo; Claudia informa as condições e pede o pagamento. Após a confirmação do Pix, envia as fotos e recolhe feedback. Se Maria pedir alteração ou demonstrar insatisfação, o painel notifica os sócios; Claudia confirma o encaminhamento e não promete alteração ou reembolso antes da decisão humana. Os sócios avaliam e autorizam gerações adicionais quando necessárias. A base da FAQ pré-Pix aprovada em 2026-10-09 registra como pacotes de teste 1 imagem por R$19,90, 5 por R$39,90 e 10 por R$59,90; esses valores só podem ser apresentados como oferta vigente depois da validação de margem. Claudia informa uma estimativa de entrega somente após testes de capacidade e antes do Pix; nenhum prazo está aprovado ainda. Ela explica que a semelhança pode variar e não é garantida. A retenção local aprovada em 2026-10-25 é de até 7 dias após a entrega; a política v2 exige comprovar a exclusão do armazenamento controlado pela aplicação antes de coleta ou processamento reais. A preferência informada é que Claudia não se identifique espontaneamente como virtual, mas responda com transparência se perguntarem; validar regras aplicáveis antes do lançamento.

**UJ-2 — Carlos acompanha uma solicitação de alteração.** Quando Maria pede uma alteração ou relata insatisfação, o painel acumula uma notificação. Carlos, um dos sócios, abre o painel quando estiver disponível, analisa e conduz a resolução do caso; quando a solução exigir novas imagens, decide se autoriza geração adicional. Claudia informa que os sócios responderão em até 24 horas. Não há horário fixo de atendimento nem prazo definido para concluir a análise ou a alteração; Claudia não promete resultado nem reembolso antes da decisão dos sócios.

## 3. Glossário

- **Cliente** — pessoa adulta que conversa com o serviço e solicita um ensaio. No MVP, deve ser a pessoa retratada e enviar a própria foto; comprar para outra pessoa está fora do escopo.
- **Conversa** — troca de mensagens de um Cliente pelo WhatsApp e seu estado de atendimento.
- **Pedido** — registro comercial de tema, pacote, quantidade, preço, consentimentos, pagamento e entrega.
- **Pacote** — oferta configurada de uma ou mais imagens com preço definido pelo negócio.
- **Foto de entrada** — arquivo enviado para orientar o ensaio.
- **Prévia** — imagem de baixa resolução com marca-d’água, gerada antes da compra do pacote completo mediante aprovação administrativa.
- **Pagamento confirmado** — estado baseado em informação autenticada do provedor e validação do Pedido, nunca apenas em texto ou comprovante enviado pelo Cliente.
- **Escalação** — solicitação priorizada para intervenção dos sócios.
- **Atendimento humano** — modo em que um operador assumiu a Conversa e as respostas comerciais automáticas ficam suspensas.
- **Provedor de imagem** — fornecedor externo que gera as imagens solicitadas.

## 4. Funcionalidades

### 4.1 Conversa, descoberta e oferta

O Cliente descreve tema, ocasião e preferências livremente. A conversa mantém contexto do Pedido, informa opções e resolve dúvidas sem impor árvore de menus.

**FR-1 — Entender mensagens livres.** O Cliente pode descrever o ensaio em português brasileiro por texto e, após confirmação explícita antes do primeiro processamento de voz na conversa, por mensagem de áudio. O áudio original é usado apenas durante o processamento e não fica guardado no banco nem no Bucket; a transcrição fica como texto da Conversa por até sete dias após seu encerramento. Se o Cliente recusar ou o áudio não puder ser entendido, o serviço pede que continue por texto.
**Consequências:** mensagens naturais podem iniciar, corrigir ou complementar a intenção; quando falta informação, o serviço faz uma pergunta por vez e aceita resposta livre, sem exigir menu, comando ou código.

**FR-2 — Manter contexto da compra.** O sistema conserva os dados relevantes da Conversa e do Pedido entre mensagens e solicita apenas o dado necessário que ainda estiver faltando.  
**Consequências:** uma informação já fornecida não é solicitada novamente sem motivo; se o Cliente mudar de assunto, perguntar por preço ou privacidade e depois retomar, o contexto útil permanece sem reiniciar a compra nem repetir fatos, sujeito à política de retenção.

**FR-3 — Adaptar a forma de falar.** O texto pode ajustar tom, entusiasmo, comprimento e vocabulário ao estilo demonstrado pelo Cliente, mantendo a identidade da marca.  
**Orientação de voz:** diante de entusiasmo, é calorosa; diante de formalidade, serena e objetiva; diante de preocupação, acolhedora. **Consequências:** a adaptação não usa idade, gênero ou outros atributos demográficos inferidos; não pressiona, manipula nem exagera intimidade.

**FR-4 — Ser transparente sobre automação.** O serviço não precisa informar espontaneamente que o atendimento é automatizado; se o Cliente perguntar, responde com transparência e não afirma ser humano. A aplicação dessa preferência precisa ser validada contra regras atuais de plataforma e obrigações aplicáveis.  
**Consequências:** nenhuma resposta afirma ou sugere que a IA seja uma pessoa.

**FR-5 — Explicar catálogo e preço vigentes.** O Cliente recebe os modelos ativos, exemplos visuais, quantidade, preço e condições do pacote antes de criar o Pedido.  
**Consequências:** exemplos e valores vêm do catálogo comercial vigente; no lançamento do MVP, só o modelo de aniversário está ativo; a IA não cria modelos, descontos, altera preços ou promete condições que não estejam configuradas.

**FR-6 — Responder dúvidas antes do Pix sem interromper a compra.** O serviço responde perguntas comuns sobre o modelo de aniversário, pacotes, uso da foto, processamento por IA, Prévia, qualidade, prazo, Pix e entrega com base em informação aprovada.  
**Consequências:** valores só podem ser apresentados como oferta vigente depois da validação de margem; prazo de entrega só é informado após teste de capacidade; a resposta explica que a semelhança pode variar e não é garantida, e encaminha dúvidas sem resposta aprovada sem inventar condições. A política de retenção deve estar definida e informada antes da coleta da foto; uma pergunta não resolvida ou repetida pode abrir Escalação.

### 4.2 Foto, autorização e privacidade

O Cliente envia a Foto de entrada e recebe explicação clara sobre geração por IA, finalidade e uso da imagem antes do processamento.

**FR-7 — Receber e validar a foto.** O sistema aceita arquivo pelo WhatsApp e verifica condições básicas necessárias para prosseguir.  
**Consequências:** arquivo inválido, ilegível ou insuficiente gera orientação clara para tentar novamente; critérios técnicos de qualidade ainda precisam de definição.

**FR-8 — Registrar autorização antes do processamento.** Antes de pedir o envio da Foto de entrada, o serviço informa que ela será processada com IA para gerar o Pedido, explica a política aprovada de retenção e solicita consentimento explícito.  
**Consequências:** Claudia informa o uso com IA, o período de retenção aprovado e pede autorização antes de solicitar o envio da foto; sem consentimento afirmativo e arquivo recebido, a imagem não é processada; uso em publicidade, portfólio ou treinamento exige autorização separada e não é presumido. A coleta não começa enquanto a política de retenção não estiver definida.

**FR-9 — Restringir acesso às imagens.** Fotos e resultados ficam privados e associados ao Pedido autorizado.  
**Consequências:** uma Conversa não pode obter arquivos de outro Cliente; links e armazenamento não devem tornar imagens publicamente acessíveis.

**FR-10 — Aplicar limites de conteúdo do MVP.** O serviço atende retratos individuais dentro das regras aprovadas e recusa ou escala solicitações fora do escopo.  
**Consequências:** o Cliente confirma que tem 18 anos ou mais e que a foto enviada é sua; pedidos com menores, fotos de terceiros, múltiplas pessoas ou celebridades são recusados antes de qualquer geração.

### 4.3 Pedido e pagamento Pix

O Pedido registra a oferta aceita. A cobrança e a confirmação dependem de dados do provedor de pagamento e de validações do sistema.

**FR-11 — Registrar a oferta aceita.** O Cliente pode confirmar tema, Pacote, quantidade e preço antes da cobrança.  
**Consequências:** o resumo apresentado ao Cliente corresponde ao Pedido persistido; alterações exigem nova confirmação.

**FR-12 — Criar cobrança individualizada.** O sistema solicita uma cobrança Pix vinculada a um único Pedido e apresenta instruções claras de pagamento.  
**Consequências:** a cobrança informa valor e validade; falha de criação não gera estado de pagamento confirmado.

**FR-13 — Validar a confirmação do pagamento.** O Pedido só avança após confirmação autenticada do provedor, correspondência do Pedido e validação do valor.  
**Consequências:** mensagem do Cliente, imagem de comprovante ou texto gerado pela IA não confirmam pagamento; valor divergente vai para exceção.

**FR-14 — Tratar eventos repetidos com segurança.** Receber novamente o mesmo evento de pagamento não duplica cobrança, Pedido pago, geração ou entrega.  
**Consequências:** reenvio e concorrência preservam um único resultado comercial por Pedido.

**FR-15 — Conciliar estados incertos.** O sistema permite consultar o provedor e identificar pagamentos pendentes, divergentes ou atrasados sem liberar geração por suposição.  
**Consequências:** inconsistências abrem Escalação ou incidente; o Cliente recebe apenas informação compatível com o estado verificado.

**FR-16 — Manter autoridade comercial determinística.** Desconto, cancelamento, reembolso e alteração de preço exigem regra comercial ou autorização humana.  
**Consequências:** a IA pode explicar ou solicitar uma ação, mas não aprova nem executa por conta própria reembolso, desconto ou exceção financeira.

### 4.4 Geração, qualidade e entrega

A geração só começa para um Pedido pago ou para uma Prévia aprovada dentro dos limites autorizados.

**FR-17 — Liberar geração após autorização comercial.** O sistema libera imagens do Pacote apenas quando o pagamento está confirmado; uma Prévia exige aprovação e orçamento reservado.  
**Consequências:** estados de pagamento pendente, divergente ou desconhecido não criam imagens faturáveis.

**FR-18 — Gerar imagens com tentativas limitadas.** O serviço envia a solicitação autorizada ao Provedor de imagem e limita novas tentativas em caso de falha.  
**Consequências:** tentativa e custo são associados ao Pedido; a quantidade exata de tentativas permanece aberta até resolver a inconsistência do plano fonte.

**FR-19 — Verificar qualidade antes da entrega.** O sistema verifica critérios básicos de qualidade acordados para detectar falha técnica ou resultado evidentemente impróprio.  
**Consequências:** imagens reprovadas não são marcadas como entregues; limiar visual, fidelidade facial aceitável e necessidade de revisão humana precisam de validação.

**FR-20 — Entregar no canal combinado.** O Cliente recebe as imagens do Pedido pelo WhatsApp da Conversa associada.  
**Consequências:** arquivos e confirmação de entrega ficam vinculados ao Pedido; falha no envio não é comunicada como entrega concluída.

**FR-21 — Abrir exceção em falhas persistentes.** Falha após o limite de tentativas, qualidade reprovada ou entrega não confirmada cria incidente ou Escalação com o estado do Pedido.  
**Consequências:** o Cliente recebe atualização verdadeira e não recebe prazo de resolução inventado.

### 4.5 Prévia controlada

O Cliente pode solicitar uma Prévia com marca-d’água. A geração depende de aprovação manual e controle financeiro.

**FR-22 — Registrar pedido de Prévia.** O sistema registra solicitação, Cliente, Pedido ou intenção de compra, custo estimado e estado da aprovação.  
**Consequências:** solicitar não gera a imagem nem compromete orçamento por si só.

**FR-23 — Aprovar e reservar limite antes da geração.** Um sócio aprova ou recusa a Prévia; o limite disponível é reservado de forma atômica antes de gerar.  
**Consequências:** solicitações concorrentes não ultrapassam o limite configurado; uma recusa explica o próximo passo sem prometer exceção.

**FR-24 — Marcar a Prévia e controlar sua apresentação.** Prévia aprovada é gerada em baixa resolução com marca-d’água e enviada ao Cliente.  
**Consequências:** uma imagem de Prévia não pode ser confundida com a entrega final nem enviada sem autorização administrativa.

**FR-25 — Oferecer a continuação comercial com clareza.** Após a Prévia, o serviço pode explicar qual Pacote permite receber o resultado final.  
**Consequências:** preço e quantidade vêm do catálogo; a regra para contar a Prévia como parte do Pacote permanece em aberto.

**FR-26 — Medir gasto e conversão de Prévia.** O sistema registra custo, aprovação, envio, conversão e motivo de não conversão.  
**Consequências:** métricas permitem avaliar amostras não convertidas sem exceder os limites definidos; valores exatos ainda precisam de confirmação.

### 4.6 Suporte e transferência para pessoa

O sistema resolve dúvidas frequentes e casos simples, e encaminha assuntos sensíveis, repetidos ou sem solução confiável.

**FR-27 — Resolver suporte de rotina.** O serviço responde perguntas frequentes, instruções de Pix e status de Pedido; pedidos de ajuste são registrados e encaminhados para avaliação humana.  
**Consequências:** resposta depende de estado verificado; o serviço confirma o recebimento do pedido de ajuste e não promete alteração ou reembolso antes da decisão dos sócios; quando a política não cobre o caso, transfere em vez de improvisar.

**FR-28 — Detectar necessidade de intervenção.** Solicitação explícita de pessoa, reclamação grave, disputa financeira, privacidade, pedido de exclusão, pedido de alteração após entrega, falhas repetidas e frustração persistente devem criar Escalação para intervenção humana.  
**Consequências:** todo pedido explícito de atendimento humano é escalado; pedidos de alteração ou insatisfação notificam os sócios; Claudia confirma o recebimento sem prometer resultado ou reembolso; nenhuma geração adicional acontece sem autorização de um sócio.

**FR-29 — Fornecer contexto acionável na Escalação.** O operador vê resumo, histórico, motivo, prioridade e dados de Pedido relevantes.  
**Consequências:** o Cliente não precisa repetir o relato já disponível; fotos só são exibidas a operadores autorizados.

**FR-30 — Priorizar e notificar.** Escalações são ordenadas por gravidade e notificadas aos sócios com base em regras configuradas. **Consequências:** canais de notificação e prioridades precisam de definição; o prazo para a primeira resposta humana é de até 24 horas, mas não há prazo aprovado para resolução.

**FR-31 — Permitir assumir e suspender respostas comerciais.** Ao assumir uma Conversa, o operador muda o atendimento para Atendimento humano e impede resposta comercial automática simultânea.  
**Consequências:** no máximo um operador assume a mesma Conversa por vez; mensagens transacionais seguem fluxo separado, baseado em eventos autorizados, e não podem contradizer a resposta humana.

**FR-32 — Responder e resolver como operador.** O operador pode responder, atribuir responsável, resolver e consultar estado de Pedido e pagamento.  
**Consequências:** ações relevantes ficam auditadas; a IA permanece suspensa enquanto a pessoa conduz o atendimento.

**FR-33 — Retomar automação de forma explícita.** Depois de resolver, um operador pode retomar a IA expressamente.  
**Consequências:** resolver um ticket, por si só, não retoma a automação; o Cliente não recebe respostas automáticas durante o Atendimento humano.

**FR-34 — Oferecer rota clara e imediata para suporte humano.** A automação informa em contexto como pedir uma pessoa e encaminha a solicitação sem bloqueio; não mantém um menu ou botão de ajuda exibido continuamente.  
**Consequências:** validar na conta real, antes do lançamento, a regra vigente da plataforma e como apresentar a rota sem exibição contínua.

### 4.7 Painel e operação dos sócios

O painel concentra exceções e tarefas que precisam de intervenção, sem exigir leitura contínua de todas as conversas.

**FR-35 — Operar uma inbox de Escalações.** O painel acumula notificações e permite aos sócios abrir, filtrar por gravidade e estado, consultar histórico, assumir atendimento e registrar uma decisão. Exibe o tempo desde a abertura e o alvo de até 24 horas para a primeira resposta humana. **Consequências:** cada Escalação exibe motivo e resumo; incidentes de entrega ou pagamento são distinguíveis de dúvidas de rotina. Não há horário fixo de atendimento nem prazo aprovado para resolução.

**FR-36 — Acompanhar Pedidos e aprovações.** Operadores consultam pedidos, pagamentos, fotos, resultados, prévias, falhas e estados de entrega com permissão apropriada.  
**Consequências:** ações administrativas não alteram histórico financeiro sem autorização e deixam trilha de auditoria.

**FR-37 — Evitar atendimento simultâneo conflitante.** O painel identifica quem assumiu a Conversa e impede dois operadores de enviar respostas manuais concorrentes.  
**Consequências:** uma tentativa concorrente mostra quem está responsável.

**FR-38 — Consultar qualidade e custo.** Os sócios acompanham custo por Pedido e Conversa, gasto com prévias, tentativas, falhas de geração, reaberturas, entregas e desempenho de campanha.  
**Consequências:** custos incluem uso de IA, mensagens, armazenamento, retentativas e amostras sem conversão quando a medição do fornecedor permitir.

**FR-39 — Auditar decisões e ações administrativas.** O sistema registra alterações de estado, aprovação de Prévia, transferência, retomada de IA e ações financeiras autorizadas.  
**Consequências:** o registro identifica ator e momento e pode ser consultado para investigação operacional.

### 4.8 Direitos e atribuição de campanha

**FR-40 — Receber pedidos de privacidade.** O Cliente pode solicitar ajuda para acessar ou excluir dados e imagens em linguagem natural.  
**Consequências:** a solicitação gera Escalação priorizada; o sistema não afirma que a exclusão foi concluída antes de verificar a ação. **FR-41 — Aplicar retenção e exclusão local.** A aplicação mantém conversas e prova mínima de consentimento no PostgreSQL, e imagens no Bucket privado, somente pelos prazos da política aprovada; após o prazo ou pedido de exclusão, remove as cópias ativas sob controle da aplicação.  
**Consequências:** confirmar conclusão somente após evidência da remoção das cópias ativas da aplicação; dumps existentes seguem sua retenção documentada. A decisão de 2026-10-27 substitui qualquer exigência anterior de exclusão externa: cópias WhatsApp/Meta e Google ficam fora do escopo e a aplicação não solicita nem comprova sua exclusão. **FR-42 — Relacionar conversas à origem de campanha quando disponível.** O sistema registra metadados de origem fornecidos pelo canal para medir campanhas do Instagram.
**Consequências:** não exige formulário ou cadastro para identificar o Cliente; a forma de atribuição depende dos dados realmente enviados pela plataforma.

### 4.9 Pós-venda

**FR-43 — Recolher feedback após a entrega.** Depois de enviar as fotos, o serviço pergunta se o Cliente recebeu os arquivos e convida a compartilhar feedback sobre o Pedido.  
**Consequências:** a mensagem respeita opt-out, janela e templates permitidos pelo canal; feedback negativo cria uma notificação para os sócios conforme FR-28; Claudia não promete alteração ou reembolso antes da avaliação humana. Horário e número de contatos permanecem em aberto.

### 4.10 Controle de gastos do piloto

**FR-44 — Controlar o teto total e os limites por categoria do piloto.** O sistema acompanha gastos realizados, comprometidos e reservados em todas as categorias e considera custos ainda não faturados, câmbio e taxas antes de autorizar novas operações com custo.

**Consequências:** o teto autorizado é R$500: anúncios R$220; IA R$110; infraestrutura Railway (app, worker, PostgreSQL, Bucket, armazenamento, egress e backups) R$65; domínio/acessórios R$25; reserva de tarifas Meta/Pix, câmbio e retentativas R$80. Não há transferência automática entre categorias. Alertas ocorrem em 60%, 80% e 95% do total e da respectiva categoria. Custo/saldo desconhecido ou limite atingido bloqueia nova ação paga. Antes de ativar cobrança externa, configura-se teto no provedor quando disponível ou reconciliação manual antes de retomar; qualquer um dos dois sócios administradores pode pausar gastos e liberar reserva apenas após estado terminal e conciliação, com auditoria.

## 5. Requisitos não funcionais transversais

- **NFR-1 — Integridade transacional:** repetição de webhook, mensagem ou tarefa não pode duplicar cobrança, confirmar pagamento indevido, gerar imagens faturáveis em duplicidade nem liberar prévia além do orçamento.
- **NFR-2 — Privacidade e acesso:** fotos e resultados ficam em armazenamento privado; somente as duas contas individuais de Isaac e seu sócio, incluídas explicitamente na lista permitida, acessam o painel, com MFA, sem cadastro público nem credenciais compartilhadas; transferência de dados usa canal seguro. O sistema mantém trilha de auditoria das ações sensíveis.
- **NFR-3 — Confiabilidade operacional:** falhas de webhook, fila, geração e entrega ficam visíveis como estados recuperáveis, com retentativas limitadas, alertas e caminho de exceção. Metas numéricas de disponibilidade, RTO e RPO ainda não foram definidas.
- **NFR-4 — Clareza e acessibilidade conversacional:** a experiência funciona em português brasileiro, com frases diretas e sem exigir habilidade técnica, cadastro, formulário, instalação de aplicativo ou memorização de comandos.
- **NFR-5 — Observabilidade de custo e qualidade:** custos variáveis, uso de provedores, falhas, retentativas, conversão de prévia e resultados de entrega podem ser auditados por período e Pedido.
- **NFR-6 — Transparência e direitos:** o produto explica o uso de IA e das imagens em linguagem compreensível, honra pedidos de atendimento humano e oferece um fluxo para solicitações de privacidade. Prazos e textos finais dependem de validação jurídica e de plataforma.
- **NFR-7 — Prazo verificável:** o prazo prometido ao Cliente precisa ser definido a partir de testes de capacidade; o sistema distingue estimativa, processamento e entrega efetiva, sem alegar conclusão antes da confirmação.
- **NFR-8 — Teto de custos:** o total de gastos realizados, comprometidos e reservados para o piloto, incluindo valores ainda não faturados em qualquer categoria, não ultrapassa R$500. Se o saldo ou o custo projetado não puder ser verificado, novas operações geradoras de custo ficam bloqueadas até a reconciliação.

## 6. Restrições e guardrails

### 6.1 Negócio e operação

- Operação inicial por dois sócios; o painel deve destacar exceções e aprovações em vez de depender de leitura constante das conversas.
- O teto autorizado do piloto é R$500, abrangendo mídia e custos operacionais. Limites aprovados: anúncios R$220; IA R$110; Railway (app, worker, PostgreSQL, Bucket, armazenamento, egress e backups) R$65; domínio/acessórios R$25; reserva Meta/Pix, câmbio e retentativas R$80. Contabilizar valores comprometidos e ainda não faturados, impostos e câmbio; não migrar saldos de categoria sem decisão explícita.
- O catálogo inicial contém somente o modelo individual de aniversário; novos modelos dependem de decisão posterior. Preços e pacotes de teste são hipóteses, não promessas comerciais.

### 6.2 Segurança, privacidade e conteúdo

- O Cliente adulto autoriza o uso da própria foto antes da geração; terceiros, menores, treinamento de modelos ou publicidade ficam fora do MVP e não são presumidos autorizados.
- Nenhum arquivo privado é enviado a outra Conversa. Requisições de exclusão, disputa financeira e privacidade recebem intervenção humana.
- A IA interpreta e redige; o backend é a autoridade para estado, preço, cobrança, desconto, reembolso, aprovação de Prévia e permissão de ferramenta.
- O MVP atende adultos enviando a própria foto e recusa terceiros, menores, grupos, múltiplos rostos e celebridades; o Cliente confirma idade e titularidade antes do processamento.
- A conta e o uso da Plataforma do WhatsApp devem cumprir as regras vigentes sobre consentimento, mensagens, janela de atendimento e suporte. A regra específica para oferecer rota humana sem menu persistente precisa ser validada.

### 6.3 Estética, voz e canal

- Atendimento caloroso, claro e respeitoso, com tom adaptado ao estilo explicitamente demonstrado pelo Cliente.
- Não usar estereótipos, pressão emocional, falsa urgência ou afirmação de que a IA é humana.
- Superfície principal: conversa no WhatsApp iniciada por campanha do Instagram. Superfície interna: painel web compacto de operação, aprovações e exceções.

### 6.4 Monetização

**[HIPÓTESE: valores de teste sem validação de margem]**: 1 imagem por R$19,90; 5 imagens por R$39,90; 10 imagens por R$59,90. O modelo comercial do MVP é pagamento por Pix por Pedido, sem cartão, parcelamento, assinatura, marketplace ou afiliados.

## 7. Não objetivos do MVP

- Formulário obrigatório, árvore de menus, comandos ou códigos numéricos.
- Aplicativo móvel, CRM completo, marketplace, afiliados ou SaaS para outros comerciantes.
- Cobrança por cartão, parcelamento, assinatura, desconto criado pela IA ou estorno automático sem autorização.
- Geração irrestrita, edição livre de prompts, múltiplos rostos, grupos ou retratos de celebridades.
- Uso de fotos para publicidade, portfólio ou treinamento sem autorização separada.
- Infraestrutura de microsserviços, Kubernetes, AWS ECS/Fargate ou dependência de automação no-code.
- Prometer prazo, taxa de aprovação facial, SLA humano, política de reembolso ou garantia de resultado antes de validar capacidade e política comercial.

## 8. Escopo do MVP

### 8.1 Incluído

- Aquisição por campanhas do Instagram que abrem conversa no WhatsApp Business Platform oficial.
- Conversa em português brasileiro com intenção e contexto; catálogo inicial com um modelo de aniversário, exemplos visuais e preferências opcionais de roupa, pose ou cenário; pacotes configuráveis.
- Recebimento de foto, verificação básica, autorização e aviso de geração por IA.
- Pix por Pedido, confirmação autenticada, proteção contra eventos repetidos e conciliação.
- Geração via fornecedor, tentativas limitadas, verificação básica, fila de exceções e entrega pelo WhatsApp.
- Prévia de baixa resolução com marca-d’água, aprovação manual e controle de orçamento.
- FAQ, instruções de pagamento, status de Pedido, primeiro ajuste e detecção de Escalação.
- Inbox para os sócios com prioridade, responsável, resumo, histórico, aprovações e transferência entre IA e pessoa.
- Painel de pedidos, pagamentos, prévias, qualidade, custos e campanhas.
- Armazenamento privado, retenção mínima, solicitações de exportação/exclusão, logs, backups e alertas.

### 8.2 Fora do MVP

- Uso em múltiplos canais além do WhatsApp e campanhas do Instagram.
- Fotos em grupo, múltiplas pessoas, celebridades, uso não autorizado ou geração de conteúdo irrestrito.
- Pagamentos diferentes de Pix e automação de reembolso.
- Garantia de amostra grátis sem controle, política de prazo sem teste de capacidade ou operação sem intervenção humana em disputas e privacidade.
- Inclusão de novos modelos além de aniversário antes de validar qualidade, repetibilidade e margem do primeiro modelo.

## 9. Métricas de sucesso

Metas iniciais de validação; revisar depois de testes assistidos e piloto. As métricas de conversação devem vir de auditoria amostral, eventos e reaberturas, não de autoavaliação da IA.

### Primárias

- **SM-1 — Compra sem comandos:** pelo menos 90% das conversas de teste completam a compra sem menus, atalhos ou códigos numéricos. Valida FR-1, FR-2, FR-5.
- **SM-2 — Resolução de dúvidas comuns:** pelo menos 80% das dúvidas comuns são resolvidas sem intervenção, aferidas por auditoria amostral e taxa de reabertura. Valida FR-6 e FR-27.
- **SM-3 — Handoff humano:** 100% dos pedidos explícitos de pessoa são encaminhados; 100% das reclamações graves geram notificação prioritária. Valida FR-28 a FR-35.
- **SM-4 — Entrega:** pelo menos 95% dos pedidos são entregues dentro do prazo comunicado, depois que o prazo for confirmado. Valida FR-18 a FR-21.
- **SM-5 — Integridade de pagamento e custo:** zero duplicidade de cobrança, geração faturável ou liberação de prévia em testes de webhook repetido e concorrência. Valida FR-13 a FR-18 e FR-22 a FR-26.
- **SM-6 — Visibilidade econômica:** custo variável por Pedido e por Conversa é conhecido, incluindo tokens, mensagens, retentativas e prévias não convertidas. Valida FR-26 e FR-38.
- **SM-7 — Validação de usabilidade:** pelo menos cinco pessoas com baixa afinidade digital completam teste assistido sem aprender comandos. Valida FR-1 a FR-6.
- **SM-8 — Piloto controlado:** gasto total realizado, comprometido e reservado permanece dentro do teto de R$500; ampliar investimento somente com CAC e margem de contribuição positivos. Valida FR-38, FR-42 e FR-44.

### Métricas de proteção

- **SM-C1 — Privacidade:** zero compartilhamento de imagem entre Clientes e zero processamento sem autorização registrada. Contrabalança SM-1 e SM-2.
- **SM-C2 — Pressão de suporte:** acompanhar reclamações repetidas, solicitações de pessoa e reabertura para evitar otimizar apenas a taxa de automação. Limiares a definir.
- **SM-C3 — Gasto com Prévias:** acompanhar custo de Prévias não convertidas e violações de limite; orçamento máximo a confirmar. Contrabalança SM-6 e SM-8.

## 10. Perguntas em aberto

Itens para resolver ou atribuir antes de usar este PRD como contrato completo de UX, arquitetura e histórias. Os itens sobre jornada, autorização de imagem, canal e transações afetam diretamente o desenho do fluxo.

1. **[Base aprovada para handoff de UX; copy final antes do anúncio] FAQ pré-Pix — fundadores/UX.** A base aprovada inclui o único modelo de aniversário, pacotes de teste sujeitos à validação de margem, uso de IA e elegibilidade da foto, ausência de garantia de semelhança perfeita e encaminhamento de insatisfação aos sócios, com primeira resposta humana em até 24 horas e sem promessa de resolução, ajuste ou reembolso. O handoff pode usar essa base; preço final e estimativa de entrega precisam estar aprovados antes do anúncio conforme Q3 e Q6. Apresentar a política v2 antes de pedir dados; manter coleta/processamento reais bloqueados até comprovar a exclusão local e liberar os controles independentes de produção.
2. **[Antes de publicar] Nome e transparência da marca — fundadores.** Definir nome comercial e texto de apresentação do atendimento automatizado.
3. **[Antes de anunciar] Pacotes e preços finais — fundadores.** Validar quantidade, preço e margem dos pacotes de teste (1/5/10 imagens por R$19,90/R$39,90/R$59,90) antes de publicar anúncios; estes valores continuam sendo hipóteses, não preços finais.
4. **[Antes de ativar a Prévia] Regra de Prévia — fundadores.** Confirmar se a Prévia conta como primeira imagem do Pacote, limite por cliente e valores diário/mensal.
5. **[Antes de publicar termos comerciais] Política de revisão, cancelamento e reembolso — fundadores/jurídico.** O painel e o aviso sem promessa estão definidos; faltam critérios de resultado não conforme, quantidade/prazo de ajustes, eventuais cobranças e autoridade/opções de reembolso. Fechar antes de publicar termos comerciais.
6. **[Antes de anunciar prazo e iniciar geração] Prazo e qualidade — fundadores/operadores.** Definir prazo após testes de capacidade, critérios básicos de qualidade visual/fidelidade e número máximo de tentativas, esclarecendo se a contagem inclui a tentativa inicial. A comunicação ao Cliente deve dizer que a semelhança pode variar e não é garantida.
7. **[Parcialmente decidido antes do piloto] Suporte humano — fundadores.** Não há horário fixo; o prazo para a primeira resposta humana é de até 24 horas. Definir prioridade e canal de notificação; prazo de resolução continua em aberto.
8. **[Conteúdo resolvido em 2026-10-25; escopo confirmado em 2026-10-27] Retenção e exclusão local — fundadores.** Fotos originais e resultados ficam disponíveis aos dois sócios administradores para suporte e avaliação por até 7 dias após a entrega; conversa completa e prova mínima de consentimento ficam por até 7 dias após o encerramento. O expurgo local ocorre no primeiro processamento possível após o prazo. A aplicação comprova apenas a remoção das cópias ativas sob seu controle; dumps PostgreSQL Railway mantêm a configuração atual de `pg_dump` a cada 3 dias com retenção de 6 dias e podem conservar cópias de texto até expirarem. Cópias WhatsApp/Meta e Google estão fora do escopo de exclusão da aplicação. A política v2 está na [story 2.2 — Aprovar e versionar a política de dados](../epic-pilot-budget-data-policy/story-aprovar-e-versionar-a-politica-de-dados-plan.md). Região e cópias externas não são gates da política; sua prontidão operacional exige comprovar a exclusão local ativa. Esta decisão não libera dados reais nem flags de produção.
9. **[Antes de ativar o canal] WhatsApp Business Platform — fundadores/operadores.** Confirmar elegibilidade da conta, regras de opt-in/templates/janela, custos efetivos no Brasil e a forma de oferecer rota clara e imediata para suporte humano sem menu persistente.
10. **[Escolhas de provedor resolvidas em 2026-10-25/27; operar após confirmações] Provedores e custos externos — fundadores.** Usar AbacatePay para Pix, Google Vertex AI Gemini 3.8 Flash em multi-região nos Estados Unidos para conversa, Nano Banana 2.1 em endpoint global para imagens e, após a comparação solicitada pelo proprietário, a recomendação WhatsApp Cloud API diretamente pela Meta, sem BSP no piloto. Seguir os padrões de proteção das ferramentas selecionadas; não usar para treinamento, publicidade ou portfólio sem consentimento separado. Confirmar preços e limites concretos antes das integrações pagas; o custo Meta no Brasil e sua classificação para este negócio permanecem desconhecidos até confirmação no Billing Hub, e o Budget bloqueia operações pagas enquanto desconhecido. A política v2 é versionada na [story 2.2 — Aprovar e versionar a política de dados](../epic-pilot-budget-data-policy/story-aprovar-e-versionar-a-politica-de-dados-plan.md). Região e cópias externas não são gates dessa política; comprovar a exclusão de dados sob controle da aplicação antes de qualquer coleta ou processamento real. Hospedagem escolhida: Railway, região US East/Virgínia para serviços e IAD para Bucket; medir latência após implantação sem usar região como gate operacional.
11. **[Resolvido em 2026-10-20; operacionalizar antes de gastos externos] Limites do piloto — fundadores/operadores.** Teto total e alocação aprovados conforme §6.1/FR-44. Antes de cada integração externa, configurar limite no provedor quando disponível ou reconciliar manualmente compromissos e cobranças não faturadas; alerta sozinho não garante interrupção imediata.
12. **[Antes do piloto] Pesquisa e métricas — fundadores.** Definir medidas e limiares para procura/conversão, qualidade percebida dos ensaios e capacidade/esforço operacional dos dois sócios, além das medidas de usabilidade, prazo de entrega, suporte, CAC e margem; registrar critérios para decidir se o piloto continua ou é interrompido.
13. **[Detalhar no handoff de UX] Operação das notificações — fundadores/UX.** UJ-2 registra que Carlos abre notificações acumuladas quando disponível e que os sócios responderão em até 24 horas. Detalhar prioridade de triagem, critérios de resolução e quando a automação retoma a conversa; não há horário fixo nem prazo de resolução aprovado.
14. **[Resolvido em 2026-10-27; implementar no Epic 3] Áudio — fundadores/UX.** Notas de voz fazem parte do MVP. Antes do primeiro processamento na conversa, explicar o uso de IA e pedir confirmação explícita; processar o original transitoriamente, sem armazená-lo no banco ou no Bucket; guardar apenas a transcrição como texto da Conversa por até sete dias após o encerramento. Recusa ou falha de interpretação oferece texto.
15. **[Antes de automatizar contatos] Pós-venda — fundadores/operadores.** Definir momento, número de contatos e templates permitidos para confirmar recebimento e oferecer suporte após a entrega.
16. **[Antes de publicar mensagens] Transparência sobre automação — fundadores/jurídico.** Validar se regras atuais da plataforma e obrigações aplicáveis permitem não se identificar espontaneamente como virtual; manter resposta verdadeira se perguntarem.

## Decision Change Log

- **2026-10-27 — owner-approved scope / route selected after requested candidate research:** avaliar Meta direta e BSPs conforme solicitação do proprietário e adotar a recomendação de WhatsApp Cloud API direta pela Meta, sem BSP no piloto; manter desconhecido o custo Meta até confirmação no Billing Hub e bloquear operações pagas enquanto isso. A política v2 cobre PostgreSQL e Bucket privados sob controle da aplicação; somente exclusão local verificada é gate de Data Policy. Exclusão de cópias Meta/Google e região ficam fora desse gate. A decisão não habilita dados, flags, chamadas, cobrança ou tráfego reais.
- **2026-10-27 — audio approved:** include voice messages with explicit confirmation before the first audio is processed in a conversation; do not retain the original audio in the application database or Bucket; retain only its transcript as conversation text for up to seven days; on refusal or recognition failure, continue by text.

## 11. Índice de hipóteses

- **Decisão das fontes, detalhada pelos sócios em 2026-10-20:** teto total autorizado de R$500 e limites de R$220 para anúncios, R$110 para IA, R$65 para Railway/app/worker/PostgreSQL/Bucket/backups/egress, R$25 para domínio/acessórios e R$80 de reserva para Meta/Pix/câmbio/retentativas. Alertas em 60/80/95%; bloquear quando custo/saldo for desconhecido ou teto atingido; não transferir saldo automaticamente e reconciliar cobrança externa/não faturada antes de liberar reserva.
- **Hipótese das fontes:** os preços de 1, 5 e 10 imagens listados em §6.4 são valores de teste, ainda sem validação de margem.
- **Decisão registrada:** apenas adultos enviando a própria foto podem usar o MVP; fotos de terceiros e de menores são recusadas.
- **Decisão registrada:** pedidos de alteração/insatisfação vão ao painel; Claudia confirma o encaminhamento sem prometer ajuste ou reembolso antes da decisão dos sócios.
- **Decisão registrada em 2026-10-09:** a base da FAQ pré-Pix foi aprovada. Os valores R$19,90/R$39,90/R$59,90 permanecem hipóteses até validação de margem; prazo de entrega segue pendente. A retenção que ainda estava aberta naquele momento foi aprovada em 2026-10-25 e atualizada na Data Policy v2 em 2026-10-27. A FAQ informa uso de IA, exige autorização antes de pedir foto própria de adulto e não promete semelhança perfeita, ajuste, reembolso ou prazo de resolução.
- **Hipótese das fontes:** metas de conversão, resolução automática e entrega do brief são metas iniciais a validar em testes e piloto, não resultados já demonstrados.
- **[NOTE FOR PM] Jornada UJ-1:** consentimento e foto própria adulta precedem a geração; a prévia é opcional e sujeita a aprovação; insatisfação vai aos sócios, sem promessa de ajuste/reembolso antes da decisão. Confirmar dúvidas pré-Pix antes do handoff de UX.

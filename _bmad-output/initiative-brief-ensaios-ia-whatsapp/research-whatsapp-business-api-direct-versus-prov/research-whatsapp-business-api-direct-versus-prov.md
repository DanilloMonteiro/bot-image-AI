---
title: 'pesquisa técnica: conexão do WhatsApp Business via Meta ou provedor'
type: technical
topic: 'WhatsApp Business API direct versus provider'
decision: 'Choose a WhatsApp Business connection for the Brazil pilot'
source: run
status: complete
preset: standard
validation: normal
created: 2026-10-27
updated: 2026-10-27
claims_verified: 7
claims_unverified: 2
claims_disputed: 2
---

# Conexão do WhatsApp Business: Meta direto ou provedor

**Decisão que a pesquisa apoia:** escolher como conectar o WhatsApp Business oficial ao serviço do piloto: diretamente à Meta ou por uma empresa intermediária.

## Resumo executivo

**Resultado da pesquisa solicitada pelo proprietário em 2026-10-27: adotar a WhatsApp Cloud API diretamente pela Meta, sem BSP no piloto.** A FAQ da Meta diz que não há taxa extra pelo acesso direto e que as primeiras 1.000 mensagens de serviço por número/mês são grátis. A própria FAQ ainda contém uma resposta antiga por conversa, e a página geral de preços continua dizendo que mensagens de serviço não são cobradas. A tarifa brasileira depois da franquia e a classificação aplicável a este negócio não foram confirmadas: o cartão da Meta exigiu login e a documentação primária sobre provedores de IA não carregou. Portanto, o Budget mantém desconhecido o custo Meta até confirmação no Billing Hub e bloqueia a operação paga enquanto isso. [1][2][3][15][16]

A rota direta evita uma tarifa fixa de BSP conhecida e usa o serviço Node existente. A equipe configura o número, as mensagens e os avisos automáticos; a Meta oferece números, exemplos e ambiente de teste gratuitos. A franquia anunciada não basta para estimar o custo do piloto sem a classificação e a cobrança aplicáveis confirmadas. [1][4][5]

Os materiais públicos da Meta divergem sobre cobrança. Antes de qualquer operação paga, confirme no Billing Hub a tarifa brasileira, a moeda e a classificação para este negócio. A escolha de Meta direta não autoriza tráfego ou gasto real enquanto o Budget não tiver um custo confirmado. Se o suporte humano 24/7 justificar uma mensalidade no futuro, avalie a 360dialog: €49 por número/mês e primeira resposta em até quatro horas. [1][2][3][10][15]

## Escopo usado

- Requisitos: API oficial, uso por uma empresa no Brasil e compatibilidade com o serviço próprio em Node/Railway.
- Critérios: custo (40%), esforço de integração (30%), suporte (20%) e facilidade de troca futura (10%). Os pesos são provisórios e servem para comparar opções para um piloto pequeno, considerando o orçamento total de R$ 80 para Meta, Pix, câmbio e reenvios.
- A região onde os fornecedores processam dados não foi usada como critério de escolha. A pesquisa não avaliou a exclusão de cópias guardadas pelo WhatsApp/Meta ou pelo Google; considerou apenas os dados que ficam no banco sob controle do sistema.
- Foram priorizadas páginas oficiais dos fornecedores e da Meta, acessadas em 2026-10-27. Não há volume de mensagens aprovado, então a comparação usa tarifas e cobranças fixas publicadas, não uma conta mensal completa.

## Comparação simples

| Opção | O que se paga | Ajuda para configurar | Ajuste ao piloto |
|---|---|---|---|
| **Meta direta — recomendada pela pesquisa e adotada para o piloto** | A FAQ informa sem taxa extra de acesso direto e 1.000 mensagens de serviço grátis por número/mês. Há conflito com a página geral de preços; tarifa Brasil, moeda e enquadramento de IA seguem desconhecidos até confirmação no Billing Hub. | Meta oferece autoatendimento e portal de suporte, mas não foi encontrado prazo garantido de resposta. | Sem mensalidade de BSP conhecida; nossa equipe configura o caminho de mensagens e avisos. Não autoriza operação paga até o custo estar confirmado. [1][2][3][4][5][15][16] |
| **Twilio** | A página consultada lista US$ 0,005 por mensagem recebida ou enviada, além da cobrança Meta, mas indica vigência até 2026-09. O preço vigente em outubro não foi confirmado. | Mais guiada: há SDK e exemplos oficiais em Node.js. O suporte gratuito não garante prazo; os planos com SLA têm valor mínimo de US$ 250/mês ou 4% do gasto, valendo o maior dos dois. | Pode reduzir esforço de integração, mas o custo por mensagem precisa ser reconfirmado e suporte com SLA é caro para o piloto. [7][8][9] |
| **360dialog** | €49 fixos por número/mês, além das tarifas da Meta. | Melhor compromisso de suporte publicado: atendimento humano 24/7, primeira resposta em até quatro horas. | Boa se houver necessidade real de apoio rápido; o valor fixo não combina com um piloto cujo orçamento de Meta/Pix/câmbio/reenvios é R$ 80. A página de migração diz na introdução que o número pode ser transferido sem perder histórico, mas a tabela de ativos marca o histórico de mensagens e chats como não migrado. Não presumir portabilidade do histórico; confirmar por escrito antes de contratar. [10][11] |
| **Zenvia Customer Cloud** | O pacote de canais de R$ 100/mês inclui até 182 envios de templates WhatsApp. A página lista as primeiras 1.000 mensagens de serviço grátis e R$ 0,069 por mensagem excedente no primeiro pacote (até 1.449 mensagens trocadas); as taxas variam nos pacotes maiores. Também mostra ativação de R$ 649 no primeiro mês e uma promoção de ativação grátis. A oferta é Customer Cloud, não uma cotação comparável de API avulsa. | Produto mais amplo, voltado a atendimento e canais; suporte no Brasil depende do plano. | O pacote parte de R$ 100/mês, acima do orçamento de R$ 80 reservado para Meta/Pix/câmbio/reenvios. Antes de escolher, seria preciso cotar o produto exato, ativação e uso apenas da API. [12][13][14] |

## Como a pontuação foi feita

Notas de 1 a 5; 5 é melhor. É uma triagem qualitativa com pesos provisórios, não uma cotação final nem uma decisão automática. O total dá uma pequena vantagem à Twilio por esforço de integração, mas o preço publicado está datado de setembro e inclui uma taxa por mensagem; a Meta direta evita adicionar uma camada paga de BSP e se encaixa no serviço Node existente. Não há volume mensal nem mistura de categorias definida, o preço Meta continua desconhecido até consulta ao Billing Hub e a tabela Zenvia descreve um pacote Customer Cloud. A recomendação direta não autoriza gasto.

| Critério | Peso provisório | Meta direta | Twilio | 360dialog | Zenvia |
|---|---:|---:|---:|---:|---:|
| Custo para piloto pequeno | 40% | 3 | 3 | 1 | 2 |
| Facilidade de integração | 30% | 3 | 4 | 4 | 3 |
| Ajuda quando algo falha | 20% | 2 | 2 | 5 | 3 |
| Facilidade para trocar depois | 10% | 5 | 3 | 3 | 2 |
| **Total ponderado** | **100%** | **3,0 / 5** | **3,1 / 5** | **2,9 / 5** | **2,5 / 5** |

**Por que a pesquisa recomenda a rota direta:** o proprietário pediu a comparação entre Meta direta e BSPs e delegou a escolha do melhor caminho para o piloto. A nota provisória dá à Twilio uma vantagem pequena porque sua integração é mais guiada; ela não muda a recomendação porque o preço Twilio consultado não foi atualizado para outubro, enquanto a rota direta evita uma taxa de BSP conhecida e aproveita o serviço Node existente. A Meta não cobra acesso direto extra segundo a FAQ, mas seu custo de mensagens no Brasil continua desconhecido. Não autorizar gasto pago até confirmar tarifa, moeda e classificação no Billing Hub. A equipe configura e mantém o recebimento dos avisos de mensagem. [1][2][4][5][15][16]

**Quando a 360dialog vence:** se a prioridade mudar para receber ajuda humana a qualquer hora, e a empresa aceitar a cobrança fixa mensal. A assistência publicada é a mais clara entre os candidatos. [10]

**Quando a Twilio pode valer:** se reduzir o trabalho de integração compensar a tarifa vigente — a página consultada lista US$ 0,005 por mensagem, mas indica vigência até 2026-09, então reconfirmar antes de comparar — e a equipe não precisar comprar um plano de suporte com SLA. A Twilio tem guias e SDK para Node.js, mas sua página de preços ainda mostra uma regra de atendimento que não bate com o FAQ e as tarifas Meta em vigor desde outubro. [7][8][9]

## Requisitos práticos para a conexão direta

- A configuração direta usa uma conta empresarial Meta, um número registrado, uma aplicação Meta, tokens de acesso e um endereço do sistema para receber avisos automáticos. A Cloud API envia texto, fotos e templates; avisos de recebimento e de entrega chegam por webhooks. [4][5]
- A Meta oferece números de teste e um sandbox sem custo para validar a conexão antes do número de produção. [4]
- A tarifa brasileira exata e a elegibilidade para cobrança em reais não puderam ser confirmadas no cartão primário: a página da Meta exigiu login. Trate custo e câmbio como desconhecidos no Budget até a confirmação no Billing Hub; não usar o valor anteriormente atribuído de R$ 0,035 como tarifa estabelecida. [2]
- Respostas em texto a mensagens da cliente dentro da janela de atendimento parecem ser mensagens de serviço, mas a categorização e o preço efetivo precisam ser confirmados. A Meta também documenta uma cobrança separada para Meta Business Agent; a página acessível não esclareceu se alguma regra especial de provedores de IA se aplica a este negócio. [1][15]
- Para automação, a Meta exige uma forma clara de contato ou encaminhamento para atendimento humano. Para iniciar uma conversa fora da janela de 24 horas, exige template aprovado. Essas regras valem mesmo com um provedor intermediário. [6]

## Pontos que ainda não têm resposta pública suficiente

- **Custo total do piloto:** depende do volume, de quantas mensagens o bot envia por solicitação e da categoria atribuída pela Meta. As primeiras 1.000 mensagens de serviço entregues por número/mês são grátis; a tarifa brasileira da mensagem 1.001 em diante não ficou verificável. Não há previsão de volume aprovada. [1][2][16]
- **Divergência de preços da Meta:** a FAQ mantém uma resposta antiga por conversa e outra seção atualizada por mensagem, com 1.000 mensagens de serviço grátis; a página geral ainda informa que serviço e algumas respostas de utilidade não são cobrados. A página primária do cartão exigiu login e não revelou a tarifa brasileira, a moeda ou a elegibilidade da conta. A Gupshup confirma a franquia em uma fonte secundária, mas não publica a tarifa brasileira nem a moeda elegível. Tratar o custo como desconhecido até confirmação no Billing Hub. [1][2][3][16]
- **Classificação para cobrança de IA:** a página da Twilio resume uma regra Meta para provedores de assistentes de IA de uso geral e diz que negócios comuns não são afetados. A documentação primária Meta ligada pela Twilio não carregou nesta auditoria. Não está confirmado se vender retratos gerados por IA enquadra o piloto nessa definição, inclusive quando a conexão é direta; isso pode mudar a cobrança. Confirmar no Billing Hub e manter o custo desconhecido e bloqueado até lá. Esta avaliação é uma inferência a partir de fonte secundária, não uma conclusão da Meta. [15]
- **Zenvia:** a página pública Customer Cloud informa 1.000 mensagens de serviço gratuitas e R$ 0,069 por mensagem excedente no primeiro pacote (até 1.449 mensagens trocadas), além de valores diferentes nos pacotes maiores. A documentação de suporte diz que mensagens de API são faturadas/intermediadas pela Zenvia. O preço não estabelece uma oferta de API avulsa comparável, nem separa a parcela Meta; solicitar cotação do produto exato antes de comparar custo total. [12][13]

## Recomendação operacional

1. Manter a conexão direta com a Meta, sem BSP, como rota aprovada do piloto e usar uma camada própria do sistema para enviar e receber mensagens do WhatsApp. Reavaliar a rota se o volume ou a necessidade de suporte mudar.
2. Fazer um teste com o número de teste da Meta e confirmar que o sistema recebe fotos, responde com imagens e recebe avisos de entrega. Confirmar também como o cliente pode entrar em contato com o atendimento antes de migrar para o número de produção.
3. Registrar mensagens entregues por categoria e número. Antes de qualquer operação paga, confirmar no Billing Hub a tarifa brasileira, a moeda, o efeito da franquia de serviço e a classificação aplicável ao negócio, inclusive eventual enquadramento como AI Provider. Até essa confirmação, o Budget deve manter o custo como desconhecido e bloquear a operação paga. [1][2][15][16]
4. Não selecionar Twilio, 360dialog ou Zenvia para este piloto sem uma razão concreta para pagar pela camada adicional de integração, suporte ou atendimento multicanal.

## Evidências citadas

| Ref. | Afirmação apoiada | Fonte oficial | Publicação / acesso | Confiança |
|---|---|---|---|---|
| [1] | Acesso direto sem taxa adicional; seção recente da FAQ diz que as primeiras 1.000 mensagens de serviço por número/mês são grátis; a mesma FAQ mantém uma resposta antiga por conversa | [FAQ do WhatsApp Business](https://whatsappbusiness.com/resources/faq/) | Sem data de publicação indicada; acessada em 2026-10-27 | Alta para os trechos da FAQ; baixa para prever a cobrança deste piloto devido à contradição interna e à página [3] |
| [2] | Local do cartão primário de tarifas; a tarifa exata do Brasil, a moeda e a elegibilidade BRL não foram verificáveis nesta checagem | [Documentação de preços e cartões da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#rate-cards-and-volume-tiers) | Cartão efetivo em 2026-10-01; acessado em 2026-10-27 | Baixa; a página exige login e não expõe a tarifa ao público desta pesquisa |
| [3] | Página geral ainda afirma que mensagens de serviço e respostas de utilidade não são cobradas | [Página geral de preços do WhatsApp Business](https://whatsappbusiness.com/products/platform-pricing/) | Sem data de publicação indicada; acessada em 2026-10-27 | Alta para o texto da página, mas conflitante com a seção atual da FAQ em [1] |
| [4] | Testes gratuitos, números de teste e passos iniciais | [Developer Hub](https://whatsappbusiness.com/developers/developer-hub/), [guia de configuração](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) | Sem data de publicação indicada; acessados em 2026-10-27 | Alta |
| [5] | Envio de texto, fotos e templates e recebimento de avisos de estado | [Mensagens da Cloud API](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages), [webhooks](https://www.postman.com/meta/whatsapp-business-platform/folder/lboq68h/webhooks) | Documentação oficial; acessada em 2026-10-27 | Alta |
| [6] | Opt-in, templates fora da janela de 24 horas e caminho claro para suporte humano | [Política de mensagens empresariais](https://whatsappbusiness.com/policy/) | Atualizada em 2026-09-23; acessada em 2026-10-27 | Alta |
| [7] | A página lista taxa Twilio de US$ 0,005 por mensagem recebida ou enviada, além das tarifas Meta; não confirma preço vigente depois de 2026-09 | [Preços de WhatsApp da Twilio](https://www.twilio.com/en-us/whatsapp/pricing) | Página indica vigência até 2026-09; acessada em 2026-10-27 | Média para o valor publicado até setembro; baixa para o preço atual em outubro |
| [8] | Suporte Twilio: plano gratuito sem SLA e plano Production com mínimo de US$ 250/mês ou 4% do gasto | [Planos de suporte Twilio](https://www.twilio.com/en-us/support-plans) | Sem data de publicação indicada; acessada em 2026-10-27 | Alta |
| [9] | SDK e exemplos Node.js para troca de mensagens e imagens | [Guia Twilio para mensagens de mídia em Node.js](https://www.twilio.com/docs/whatsapp/tutorial/send-and-receive-media-messages-whatsapp-nodejs) | Sem data de publicação indicada; acessado em 2026-10-27 | Alta |
| [10] | Plano 360dialog de €49 por número/mês e suporte 24/7 com primeira resposta em até quatro horas | [Preços da 360dialog](https://360dialog.com/br/pricing) | Sem data de publicação indicada; acessada em 2026-10-27 | Alta para a oferta anunciada |
| [11] | Webhooks e migração de número; a introdução diz que histórico não se perde, mas a tabela de ativos diz que histórico de mensagens/chats não migra | [Webhooks](https://docs.360dialog.com/docs/messaging/webhook), [migrações](https://docs.360dialog.com/docs/hub/migrations) | Documentação oficial; acessada em 2026-10-27 | Média; conflito dentro da página exige confirmação antes de planejar portabilidade do histórico |
| [12] | Pacotes públicos da Zenvia, templates, taxa de mensagem de serviço excedente e ativação | [Preços da Zenvia Customer Cloud](https://zenvia.com/precos/) | Sem data de publicação indicada; acessada em 2026-10-27 | Média para aplicabilidade do preço; a tabela pública é de Customer Cloud e não é cotação de API avulsa |
| [13] | Documentação de API e horário de suporte da Zenvia | [Portal Zenvia Developers](https://zenvia.com/en/devs/), [contato do suporte](https://support.zenvia.com/kb/en/article/565407/como-falar-com-o-suporte-tecnico-da-zenvia) | Artigo de suporte atualizado em 2026-04-15; acessado em 2026-10-27 | Alta |
| [14] | Limitação de evidência sobre saída de contas Zenvia Customer Cloud | [Migração entre BSPs](https://support.zenvia.com/kb/en/article/363720/o-que-e-a-migracao-entre-bsps-provedores-do-whatsapp), [condições de migração](https://support.zenvia.com/kb/en/article/384841/passos-e-condicoes-para-a-migracao-entre-bsps) | Artigos atualizados em 2023-08; acessados em 2026-10-27 | Média; material antigo e específico de outro produto Zenvia |
| [15] | A Twilio resume uma regra Meta de preço para AI Providers e diz que empresas comuns não são afetadas; não se sabe se o piloto se enquadra, inclusive com Meta direta | [Artigo de preços da Twilio](https://help.twilio.com/articles/360037672734-How-Much-Does-it-Cost-to-Send-and-Receive-WhatsApp-Messages-with-Twilio-), [documentação Meta de AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) | Sem data de publicação indicada; acessados em 2026-10-27 | Baixa; é resumo de terceiro e a fonte primária Meta respondeu 429 nesta checagem |
| [16] | Fonte de parceiro confirma a franquia de 1.000 mensagens de serviço a partir de 2026-10-01 | [Aviso de preços da Gupshup](https://support.gupshup.io/hc/en-us/articles/62362400519705-WhatsApp-Service-Messages-Pricing-w-e-f-01-Oct-2026) | Publicado em 2026-09-22; acessado em 2026-10-27 | Média para a franquia; não informa a tarifa brasileira nem substitui a fonte Meta |

## Mapa de atualização

O mapa automático, com janela de 3 meses para preços e 6 meses para regras e triagem de fornecedores, encontrou fontes antigas da Zenvia que só pesam se ela voltar a ser candidata. A página de preços Twilio deve ser revista até **2026-12-01**; o cartão da Meta até **2027-01-01**; e a política da Meta até **2027-03-23**. A tarifa Meta no Brasil permanece sem confirmação acessível nesta pesquisa; verificar no Billing Hub antes de operação paga. Reavaliar esta escolha se o volume deixar de ser pequeno ou se suporte humano com SLA passar a ser prioridade.

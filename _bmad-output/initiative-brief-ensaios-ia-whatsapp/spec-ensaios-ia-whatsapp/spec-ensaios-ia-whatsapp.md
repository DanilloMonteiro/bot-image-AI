---
id: SPEC-ensaios-ia-whatsapp
companions:
  - ../../../prd-ensaios-ia-whatsapp.md
  - ../prd-ensaios-ia-whatsapp/addendum.md
  - ../ux-ensaios-ia-whatsapp/DESIGN.md
  - ../ux-ensaios-ia-whatsapp/EXPERIENCE.md
  - ../architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md
sources: []
---

# Ensaios IA por WhatsApp

## Why

Adultos que querem retratos personalizados podem não saber criar prompts ou preferir fazer a compra pelo WhatsApp. O MVP testa procura, qualidade percebida e capacidade operacional dos dois sócios com um retrato individual de aniversário e teto total de R$500. A aquisição pode vir do Instagram, mas a experiência do sistema começa na primeira mensagem recebida pelo WhatsApp; anúncio, clique e transição ficam fora do escopo.

## Capabilities

- **CAP-1**
  - **intent:** A pessoa adulta pode pedir um ensaio de aniversário em linguagem natural no WhatsApp e entender a oferta antes do Pix.
  - **success:** Em testes, pelo menos 90% das conversas concluem a compra sem menus, atalhos ou códigos; respostas usam apenas catálogo e FAQ aprovados e fazem uma pergunta por vez.

- **CAP-2**
  - **intent:** A pessoa pode autorizar o processamento privado da própria foto adulta e pedir suporte sobre seus dados.
  - **success:** Elegibilidade é verificada separadamente; fornecedor e política aprovada para foto, resultados, conversa/consentimento, backups e cópias de fornecedores são informados antes da coleta; consentimento afirmativo precede o processamento; pedidos de acesso ou exclusão chegam a um operador.

- **CAP-3**
  - **intent:** A pessoa pode confirmar um pacote e pagar um Pedido por Pix.
  - **success:** Geração paga só começa após confirmação autenticada do provedor, vinculada ao Pedido e valor; eventos repetidos não duplicam cobrança, Pedido ou geração.

- **CAP-4**
  - **intent:** A pessoa que pagou pode receber as imagens pelo WhatsApp e saber se a entrega foi concluída ou falhou.
  - **success:** Resultados e confirmação de entrega ficam vinculados ao Pedido; falhas persistem como exceções recuperáveis, sem alegar entrega antes da confirmação.

- **CAP-5**
  - **intent:** A pessoa pode receber uma Prévia opcional antes do Pix.
  - **success:** Cada Prévia exige aprovação de um sócio e reserva de custo, é enviada em baixa resolução com marca-d’água e respeita limites configurados.

- **CAP-6**
  - **intent:** Clientes e sistema podem encaminhar reclamações, pedidos de ajuda e exceções aos sócios para análise.
  - **success:** Pedidos explícitos de atendimento humano são todos encaminhados; o operador vê contexto acionável; a automação comercial fica suspensa durante o Atendimento humano. A primeira resposta humana ocorre em até 24 horas, sem promessa de resolução.

- **CAP-7**
  - **intent:** Os sócios podem operar um piloto limitado e avaliar seu resultado comercial e operacional.
  - **success:** Gastos realizados, comprometidos, reservados e ainda não faturados contam contra o teto de R$500; nova operação com custo é bloqueada se o saldo for desconhecido ou insuficiente; as métricas e limiares de continuidade são avaliados pelos sócios.

## Constraints

- O MVP vende somente retrato individual de aniversário para pessoa adulta usando a própria foto; imagens de terceiros, menores, grupos, múltiplas pessoas e celebridades não seguem para geração.
- Não coletar nem encaminhar foto até fornecedor, tratamento externo e política por tipo de dado — foto original, resultados, conversa/consentimento, backups e cópias —, prazos/marcos, exclusão e exceções estarem aprovados e informados. Processar somente após consentimento afirmativo inequívoco.
- Consentimento para gerar o retrato não autoriza publicidade, portfólio ou treinamento de IA; cada uso adicional exige autorização separada e explícita.
- Pix confirmado, preço, desconto, reembolso e autorização de Prévia ou geração adicional dependem de regras verificáveis ou de um sócio autorizado; texto do modelo não autoriza essas ações.
- Decisão de 2026-10-20: o teto de R$500 autoriza até R$220 em anúncios, R$110 em IA, R$65 em aplicação/worker/PostgreSQL/Bucket/egress/backups Railway, R$25 em domínio/acessórios e R$80 de reserva para tarifas Meta/Pix, câmbio e retentativas. Incluir valores reservados, comprometidos, impostos e cobranças não faturadas; não transferir saldo automaticamente entre categorias. Bloquear gasto novo se custo/saldo for desconhecido ou limite atingido; os dois sócios administradores podem pausar gastos e liberar reservas após conciliação, com auditoria.
- Decisão de arquitetura de 2026-10-20: Railway com PostgreSQL + pg-boss, sem Redis, e Railway Bucket privado para objetos. App/worker/PostgreSQL em US East/Virgínia; Bucket em IAD. Somente Isaac e seu sócio acessam o painel, por contas individuais com MFA e auditoria. Antes de tratar quaisquer dados pessoais reais na Railway nos EUA — incluindo fotos, resultados, conversas e consentimentos — validar transferência internacional, criptografia adequada, retenção e exclusão.
- Preços de teste de R$19,90, R$39,90 e R$59,90 para 1, 5 e 10 imagens não são finais; não anunciar antes da validação de margem. Não prometer prazo antes de teste de capacidade nem semelhança perfeita.
- Insatisfação é avaliada pelos sócios. Não prometer ajuste, reembolso ou prazo de resolução antes de decisão; geração adicional requer autorização.
- O sistema começa na primeira mensagem recebida no WhatsApp. Anúncio, clique e transição pelo Instagram ficam fora da experiência do produto; atribuição de campanha usa somente metadados fornecidos pelo canal.

## Non-goals

- Temas de ensaio além de aniversário durante o MVP.
- Fotos de menores, terceiros, grupos, múltiplas pessoas ou celebridades.
- Pagamentos diferentes de Pix, descontos criados pela IA, estorno automático ou resolução autônoma de disputas.
- App separado, portal obrigatório, login externo ou entrega que exija ZIP.
- Implementar anúncios ou o fluxo de clique/transição do Instagram dentro do sistema.
- Marketplace, assinatura, CRM amplo ou plataforma para múltiplos comerciantes.

## Success signal

No piloto, pelo menos 90% das conversas de teste concluem a compra sem comandos, 100% dos pedidos explícitos de atendimento humano são encaminhados, não há coleta/processamento sem política informada e consentimento, não há duplicidade financeira e o gasto total permanece em até R$500. Os sócios definem e avaliam medidas de procura/conversão, qualidade percebida, margem e esforço/capacidade operacional antes de decidir continuar.

## Assumptions

- [ASSUMPTION] O painel dos sócios busca WCAG 2.2 AA, teclado/foco visível e reflow em 320 CSS px. Confirmar dispositivo prioritário e breakpoints antes do handoff de layout.

## Decisions

- Decisão do proprietário em 2026-10-25, registrada na story 2.2 do Epic 2: AbacatePay para Pix; Google Vertex AI Gemini 3.8 Flash em multi-região nos EUA para conversa e Nano Banana 2.1 no endpoint global para imagens; incluir a Plataforma WhatsApp Business oficial/Meta na política. Foram aprovados 7 dias para fotos após entrega e para conversa/prova mínima de consentimento após encerramento. Seguir os padrões dos serviços selecionados; backups PostgreSQL da Railway mantêm a configuração atual e podem conservar cópias até expirarem.
- Decisão de 2026-10-27: o proprietário definiu que a exclusão coberta pelo sistema se limita aos dados sob controle da aplicação — conversa e prova mínima no PostgreSQL e imagens no Bucket privado. Cópias Meta/Google e localização de processamento não são gates da política; a aplicação não promete solicitar ou comprovar exclusão externa. Após pesquisa de candidatos solicitada pelo proprietário, adotar a recomendação de WhatsApp Cloud API direta, sem BSP no piloto.

## Open Questions

- Antes de dados reais: versionar e apresentar a política; seguir os controles padrão de proteção dos serviços escolhidos; validar acesso restrito e a exclusão local das cópias ativas sob controle da aplicação, incluindo conversas no PostgreSQL e objetos no Bucket. Dumps de banco expiram segundo a configuração existente. Região e cópias Meta/Google não bloqueiam o uso; a exclusão local implementada e comprovada continua como gate.
- Quais preços, pacotes e limiar de margem serão aprovados antes de anunciar?
- Qual prazo de entrega será comunicado após os testes de capacidade, e quais critérios visuais e limite de tentativas serão usados?
- Qual política de revisão, quantidade de ajustes, cancelamento e reembolso vale para resultados insatisfatórios?
- A Prévia conta como a primeira imagem do pacote? Quais limites de frequência e orçamento serão configurados?
- Como configurar na prática os limites dos provedores externos selecionados e reconciliar câmbio, impostos e cobranças não faturadas dentro dos tetos já aprovados?
- Quais regras de elegibilidade, preço, consentimento, templates, janela, rota humana e transparência se aplicam à conta WhatsApp escolhida? Quais provedores de WhatsApp/Pix/IA serão aprovados e como seus termos de dados atendem ao gate de fotos?
- Quais métodos e limiares medem procura/conversão, qualidade percebida, usabilidade, suporte, CAC, margem e esforço/capacidade dos sócios, e que resultados determinam continuar ou parar?
- Áudio, prioridades de triagem, canais de notificação, contatos pós-entrega e retomada da automação fazem parte do MVP?
- Qual dispositivo será prioritário para o painel e quais larguras/breakpoints e meta de acessibilidade serão confirmados?

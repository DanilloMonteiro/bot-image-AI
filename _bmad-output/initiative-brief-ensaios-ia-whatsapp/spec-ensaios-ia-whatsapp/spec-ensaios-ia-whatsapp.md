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
- O teto total de R$500 inclui anúncios e custos operacionais. Saldos desconhecidos, custos reservados, comprometidos e ainda não faturados são considerados antes de autorizar gasto novo.
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

## Open Questions

- Qual fornecedor de IA será usado e quais condições se aplicam a transferência, retenção, reutilização e exclusão de fotos/resultados?
- Quais prazos, marcos iniciais, cópias, backups, exceções e etapas de exclusão valem para cada tipo de dado e fornecedor?
- Quais preços, pacotes e limiar de margem serão aprovados antes de anunciar?
- Qual prazo de entrega será comunicado após os testes de capacidade, e quais critérios visuais e limite de tentativas serão usados?
- Qual política de revisão, quantidade de ajustes, cancelamento e reembolso vale para resultados insatisfatórios?
- A Prévia conta como a primeira imagem do pacote? Quais limites de frequência e orçamento serão configurados?
- Como o teto de R$500 será dividido e imposto entre anúncios e provedores, incluindo custos não faturados, e quem pode pausar cada fonte?
- Quais regras de elegibilidade, preço, consentimento, templates, janela, rota humana e transparência se aplicam à conta WhatsApp escolhida? Quais provedores e custos de hospedagem serão aprovados?
- Quais métodos e limiares medem procura/conversão, qualidade percebida, usabilidade, suporte, CAC, margem e esforço/capacidade dos sócios, e que resultados determinam continuar ou parar?
- Áudio, prioridades de triagem, canais de notificação, contatos pós-entrega e retomada da automação fazem parte do MVP?
- Qual dispositivo será prioritário para o painel e quais larguras/breakpoints e meta de acessibilidade serão confirmados?

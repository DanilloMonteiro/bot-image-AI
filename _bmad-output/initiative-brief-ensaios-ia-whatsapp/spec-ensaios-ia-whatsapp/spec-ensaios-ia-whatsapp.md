---
id: SPEC-ensaios-ia-whatsapp
companions:
  - ../../../prd-ensaios-ia-whatsapp.md
  - ../prd-ensaios-ia-whatsapp/addendum.md
sources: []
---

# Ensaios IA por WhatsApp

## Why

Adultos que querem retratos personalizados podem não saber criar prompts ou preferir resolver tudo pelo WhatsApp. O produto testa uma compra de ensaio de aniversário iniciada no Instagram; dois sócios precisam validar procura, qualidade percebida e capacidade operacional dentro de um piloto total de R$500.

## Capabilities

- **CAP-1**
  - **intent:** A pessoa adulta pode pedir um ensaio de aniversário em linguagem natural no WhatsApp e entender a oferta antes do Pix.
  - **success:** Em testes, pelo menos 90% das conversas concluem a compra sem menus, atalhos ou códigos; respostas usam apenas catálogo e FAQ aprovados e fazem uma pergunta por vez.

- **CAP-2**
  - **intent:** A pessoa pode autorizar o processamento privado da própria foto adulta e pedir suporte sobre seus dados.
  - **success:** Elegibilidade é verificada; consentimento e política aprovada de retenção são registrados antes do processamento; pedidos de acesso ou exclusão chegam a um operador.

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
  - **success:** Pedidos explícitos de atendimento humano são todos encaminhados; o operador vê contexto acionável; a automação comercial fica suspensa durante o Atendimento humano. A primeira resposta humana pode levar até 24 horas, sem promessa de resolução.

- **CAP-7**
  - **intent:** Os sócios podem operar um piloto limitado e avaliar seu resultado comercial e operacional.
  - **success:** Gastos realizados, comprometidos, reservados e ainda não faturados contam contra o teto de R$500; nova operação com custo é bloqueada se o saldo for desconhecido ou insuficiente.

## Constraints

- O MVP vende somente o modelo individual de aniversário e aceita apenas foto própria de pessoa adulta; fotos de terceiros e de menores são recusadas antes do processamento.
- O serviço explica o uso de IA, obtém consentimento antes de solicitar a foto e não coleta fotos enquanto a política de retenção não estiver definida e informada.
- Pix confirmado, preço, reembolso, desconto e autorização de Prévia ou geração adicional dependem de regras verificáveis ou de um sócio autorizado; texto do modelo não autoriza essas ações.
- O teto de R$500 inclui anúncios e custos operacionais. Saldos desconhecidos, custos reservados, comprometidos e ainda não faturados devem ser considerados antes de autorizar gastos.
- Os preços de teste de R$19,90, R$39,90 e R$59,90 para 1, 5 e 10 imagens não são finais e não podem ser anunciados antes da validação de margem.
- Nenhum prazo de entrega é prometido antes de testes de capacidade. A comunicação informa que a semelhança pode variar; não há garantia de semelhança perfeita.
- Insatisfação é avaliada pelos sócios. Não se promete ajuste, reembolso ou prazo de resolução; toda geração adicional requer autorização de um sócio.
- Fotos não são implicitamente autorizadas para publicidade, portfólio ou treinamento de modelos.

## Non-goals

- Temas de ensaio além de aniversário durante o MVP.
- Fotos de menores, terceiros, grupos, múltiplas pessoas ou celebridades.
- Pagamentos diferentes de Pix, descontos criados pela IA, estorno automático ou resolução autônoma de disputas.
- Aplicativo separado, portal obrigatório, login externo ou entrega que exija ZIP.
- Marketplace, assinatura, CRM amplo ou plataforma para múltiplos comerciantes.

## Success signal

No piloto, pelo menos 90% das conversas de teste concluem a compra sem comandos, 100% dos pedidos explícitos de atendimento humano são encaminhados, não há processamento sem consentimento nem duplicidade financeira e o gasto total permanece em até R$500. Antes de decidir continuar, os sócios definem e avaliam medidas de procura/conversão, qualidade percebida, margem e esforço/capacidade operacional.

## Open Questions

- Quais preços, pacotes e limiar de margem serão aprovados antes de anunciar?
- Qual prazo de entrega será comunicado após os testes de capacidade, e quais critérios visuais e limite de tentativas serão usados?
- Quais períodos de retenção valem para cada dado, como cópias em fornecedores serão tratadas e como acesso ou exclusão serão confirmados?
- Qual política de revisão, ajustes e reembolso vale para resultados insatisfatórios?
- A Prévia conta como a primeira imagem do pacote? Quais limites de frequência e orçamento serão configurados?
- Como o teto de R$500 será dividido e imposto entre anúncios e provedores, incluindo custos não faturados, e quem pode pausar cada fonte?
- Quais regras de elegibilidade, preço, consentimento, templates, janela e suporte se aplicam à conta WhatsApp escolhida? Quais provedores e custos de hospedagem serão aprovados?
- Quais métodos e limiares medem procura/conversão, qualidade percebida, usabilidade, suporte, CAC, margem e esforço/capacidade dos sócios, e que resultados determinam continuar ou parar?
- Áudio, prioridades de triagem, canais de notificação, contatos pós-entrega e retomada da automação fazem parte do MVP?
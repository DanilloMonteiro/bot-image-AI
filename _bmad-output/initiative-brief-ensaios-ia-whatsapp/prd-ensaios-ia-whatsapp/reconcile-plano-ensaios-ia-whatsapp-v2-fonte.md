# Reconciliação da entrada — plano_ensaios_ia_whatsapp_v2_fonte.md

## Elementos preservados

- Direção técnica proposta foi mantida no addendum, fora dos requisitos de capacidade: monorepo TypeScript, API/worker/painel, PostgreSQL/pg-boss, outbox, idempotência, adapters, provedor Pix, IA de conversa/imagem, armazenamento privado e candidatos de hospedagem.
- O addendum conserva recomendações de privacidade, QA, entrega direta pelo WhatsApp, operação do painel, notificações, reconciliação, estimativas de custo, riscos e critérios go/no-go.

## Gaps, divergências e reconciliações

1. **Orçamento e economia unitária.** Foram incluídos no addendum o split sugerido de R$220 anúncios, R$110 créditos IA, R$65 hospedagem/banco/backup, R$25 domínio/acessórios e R$80 reserva; alertas de 60/80/95%; e simulação do pacote de cinco imagens e sensibilidade de CAC. O teto de R$500 é tratado como total do piloto; alocação e controles continuam propostas.
2. **Operação de suporte.** O PRD exige prioridade e handoff. O addendum registra deduplicação por conversa/categoria, confirmação única ao cliente, idade/prioridade do ticket, contexto e aviso crítico fora do navegador como proposta. A recomendação da fonte de quatro horas úteis não foi adotada: a decisão atual não define horário fixo e permite até 24 horas para a primeira resposta humana; resolução segue sem prazo definido.
3. **QA e entrega.** O addendum mantém checks sugeridos de arquivo, orientação/dimensões, rosto, luz/nitidez, semelhança, contexto e artefatos; controles de custo e pausa em anomalias; e entrega pelo WhatsApp sem ZIP, login ou portal. Critérios de qualidade e tentativas permanecem abertos.
4. **Detalhes de implementação.** Sequência de webhook/worker, debounce, ferramentas tipadas, estados, tabelas, índices, APIs e reserva atômica de prévia permanecem no addendum como material para Arquitetura; não viraram decisões do PRD.
5. **Valores conflitantes/provisórios.** O plano sugere prévia contar como primeira foto, limites de uma prévia/30 dias e valores diários/mensais; SLA de quatro horas; retenção de 7/30 dias; e 2–3 tentativas, enquanto um exemplo usa duas. O PRD adota o alvo de até 24 horas para a primeira resposta humana, conforme decisão dos fundadores; os demais pontos permanecem abertos até confirmação.
6. **Jornada de suporte e política do canal.** A rota humana precisa permanecer natural e sem opção exibida continuamente, ao mesmo tempo que a conta/Meta requer uma rota clara de suporte; a UX e elegibilidade da conta são pendências de validação.

7. **Catálogo inicial.** O plano fonte lista mais de um modelo/tema. Durante a descoberta, o usuário decidiu iniciar apenas com aniversário; o PRD registra essa decisão mais recente e deixa a expansão para depois de validar qualidade e margem.

## Decisões necessárias antes de downstream

Confirmar política comercial e de revisão, prazo/SLA, retenção, regras exatas de prévia e tentativas, elegibilidade e rate card WhatsApp, provedores/custos e limites de gastos ainda não faturados. O PRD restringe o MVP a adultos usando a própria foto e recusa menores/terceiros.

---
type: epic
title: Base de plataforma do piloto
parent: initiative-brief-ensaios-ia-whatsapp
covers: []
after: []
assignee: ""
risk: high
---

# Base de plataforma do piloto

## Description

Criar a fundação greenfield para o monólito modular em TypeScript, com aplicação Next.js e worker no mesmo código-base, fronteiras de módulo e ambiente operacional suficiente para entregar os demais épicos em produção. Railway para aplicação/worker, PostgreSQL com pg-boss e Railway Bucket privado em IAD foram escolhidos; a conta e a configuração efetivas ainda aguardam validação de custo, backup/restauração e privacidade antes da ativação.

## Outcome

Os demais owners conseguem entregar capacidades no mesmo produto com execução web e assíncrona implantável, observável e recuperável sem acoplamento direto entre dados de módulos.

## Requirements

- F1: Estabelecer monólito modular em TypeScript, Next.js e worker separado no mesmo código-base; cada módulo é dono dos próprios dados. (Architecture, Design Paradigm, AD-1)
- F2: Implantar aplicação web e worker no ambiente de produção escolhido e validado. (Architecture, AD-8)
- F3: Manter estado durável e trabalho recuperável; falhas ou repetições não podem duplicar efeitos financeiros ou imagens faturáveis. (Architecture, AD-3; PRD, §5 NFR-1, NFR-3)
- F4: Disponibilizar mecanismo de backup e demonstrar restauração para a persistência escolhida. (Addendum, Technical direction — propostas de implantação)

- F5: Emitir sinais de uso/custo dos provedores e da execução para auditoria e reconciliação pelo módulo Orçamento; ledger e bloqueio pertencem a Orçamento. (PRD, §5 NFR-5, NFR-8; Architecture, AD-2, AD-6)

## Done when

1. A aplicação Next.js e o worker são implantados juntos a partir do mesmo código-base em um ambiente de produção controlado.
2. Um caminho de ponta a ponta em staging recebe um evento, persiste estado, executa trabalho assíncrono e expõe sucesso e falha à observabilidade.
3. Uma falha recuperável pode ser retomada sem duplicar seu efeito; restauração de backup é demonstrada.
4. Cada módulo novo segue propriedade de dados e casos de uso públicos definidos na arquitetura.
5. A escolha de hospedagem, banco e fila tem validação de custo e privacidade registrada antes de ativar tráfego e fotos reais.

## Boundaries

Épico de plataforma: scaffold, execução web/worker, deploy, CI, segredos, observabilidade, backups e recuperação. Mantém as escolhas registradas de Railway, PostgreSQL/pg-boss e Bucket e valida sua configuração efetiva; não as altera por conveniência nem implementa regras de Conversas, Pedido, Retrato, Operação ou Orçamento. Consulte os não-objetivos da spec.

## References

- architecture — _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md, Design Paradigm e AD-1, AD-2, AD-3, AD-6, AD-8
- PRD — prd-ensaios-ia-whatsapp.md, §5 NFR-1, NFR-2, NFR-3, NFR-5 e NFR-8
- addendum — _bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/addendum.md, Technical direction (propostas sujeitas a validação)

## Notes

- Decision: monólito modular, TypeScript, Next.js mais worker no mesmo código-base e propriedade dos dados por módulo foram confirmados pelo usuário.
- Open question: o workspace Railway ainda não está conectado; validar conta, custo medido, configuração, backup/restauração, segurança e privacidade antes da ativação de tráfego e dados reais.
- Source conflict: o plano fonte propõe Fastify, Drizzle e Railway/Lightsail. A decisão vigente fixa Next.js e worker no mesmo código-base, PostgreSQL com pg-boss, Railway para app/worker e Railway Bucket privado em IAD; falta validar a configuração efetiva e os termos/custos do provedor.
- Decision: 2026-10-21 — Railway, PostgreSQL/pg-boss e Railway Bucket privado em IAD foram escolhidos. A conexão do workspace e as verificações de produção permanecem pendentes; histórias que exigem produção aguardam acesso autorizado e a conclusão da base.
- Decision: 2026-10-14 — observabilidade e backup/restauração podem avançar em paralelo após isolamento dos ambientes; deploy de produção espera ambos; o Refactor sweep fecha o épico.

---
title: "Aprovar e versionar a política de dados"
type: feature
ticket: 2
created: 2026-10-25
status: built
baseline_revision: b37d0b213bd13e04aa78e09bb8c4b6dd74913d77
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Não existe contrato versionado de política de dados que os épicos de Conversas e Retratos possam consultar. As decisões do proprietário estão registradas, mas uma aprovação da política não deve abrir o uso de dados reais enquanto transferência, criptografia e exclusão verificável não forem validadas.

**Approach:** Criar uma versão imutável e consumível da política, com dados, fornecedores, finalidade, acesso, localização, retenção, exclusão e exceções. Separar aprovação do conteúdo pelo proprietário da liberação operacional; ausência, incompletude ou estado não aprovado bloqueiam coleta e processamento.

## Boundaries & Constraints

**Always:** Registrar as decisões do proprietário de 2026-10-25: AbacatePay para Pix; Gemini 3.8 Flash em multi-região nos EUA; Nano Banana 2.1 em endpoint global; Plataforma WhatsApp Business/Meta; e eventual intermediário usado. Registrar cópias dos provedores conforme os termos vigentes, sem prometer exclusão externa. Originais e resultados ficam disponíveis aos dois sócios administradores para suporte e avaliação do serviço por até 7 dias após entrega; conversa completa e prova mínima de consentimento por até 7 dias após encerramento. Expurgo local no primeiro processamento possível após o prazo. Publicidade, portfólio e treinamento exigem consentimento separado. Dumps PostgreSQL Railway mantêm a configuração atual de `pg_dump` a cada 3 dias e retenção de 6 dias; podem conservar cópias de texto até expirarem. O gate de dados reais continua fechado.

**Never:** Fazer chamadas reais a provedores, coletar dados de cliente, publicar a política no WhatsApp, mudar configuração/tecnologia de Railway ou habilitar `PRODUCTION_PRIVACY_APPROVED`. Não tratar cópia de backup ou retenção legal de fornecedor como apagada pelo expurgo da aplicação. Não declarar validação jurídica ou técnica que ainda não ocorreu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Política aprovada | Versão v1 completa e aprovada pelo proprietário | Consumidor recebe snapshot versionado e resumo informativo; estado operacional continua fechado | Nenhum efeito externo |
| Política ausente ou incompleta | `null` ou campo obrigatório ausente/inválido | Decisão bloqueada para coleta e processamento, com motivo estável | Não aplicar defaults permissivos |
| Política não aprovada | Snapshot válido, mas sem aprovação do proprietário | Decisão bloqueada | Retornar motivo de não aprovação |
| Uso real sem validação operacional | Política v1 aprovada; transferência, criptografia ou exclusão ainda pendente | Leitura da política permitida; ação com dado real bloqueada | Não alterar flags/env nem emitir chamada |

</frozen-after-approval>

## Code Map

- `src/contracts/platform-usage/v1.ts` — padrão local de contrato versionado, type guard e preservação de custo desconhecido.
- `src/modules/budget/` — exemplo de fronteira de módulo; não importar infraestrutura no domínio.
- `src/adapters/http/production-traffic-gate.ts` — rotas de cliente/mídia exigem `PRODUCTION_PRIVACY_APPROVED` e mais cinco aprovações; seguir fail-closed sem habilitar flags.
- `src/proxy.ts` — aplica o gate existente às rotas HTTP.
- `tests/platform-smoke.test.mjs` — padrão de testes Node sobre `dist`; já verifica bloqueio das rotas sem as aprovações.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` — AD-5/AD-7 definem consentimento, cópias, acesso e propriedade do ciclo de vida da mídia.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-pilot-budget-data-policy/tickets.toml` — decisão do proprietário e verificação sintética desta story.
- `docs/platform-staging.md` — backups lógicos PostgreSQL a cada três dias, retenção de seis dias; media Bucket privado sem lifecycle, exclusão futura pertence ao app/worker.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/data-policy/v1.ts` — definir contrato imutável, versionado e validável para tipos de dado, finalidade, fornecedor, acesso, região/transferência, retenção, exclusão e exceções.
- [x] `src/modules/data-policy/policy-v1.ts` — registrar decisões aprovadas, cópias Meta/Google, exceções de AbacatePay e backups Railway, resumo informativo e validações operacionais ainda pendentes.
- [x] `src/modules/data-policy/use-cases.ts` — expor leitura da versão aprovada e decisão de uso fail-closed; manter aprovação do proprietário separada de prontidão para dados reais.
- [x] `tests/data-policy.test.mjs` — cobrir snapshot v1, ausência, incompletude, não aprovação e gate operacional fechado com fixtures sintéticas.
- [x] `_bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md` — marcar Q8/Q10 resolvidas por decisão de 2026-10-25 e referenciar a story 2.2; preservar gates de validação antes de fotos/dados reais.

**Acceptance Criteria:**
- Given a versão v1 completa e aprovada, when um consumidor pede a política, then recebe os mesmos dados versionados e o resumo aprovado.
- Given uma política ausente, incompleta ou não aprovada, when um consumidor tenta autorizar coleta ou processamento, then recebe bloqueio fail-closed e motivo estável.
- Given a versão v1 aprovada, mas validações operacionais pendentes, when uma ação exige dado real, then a ação segue bloqueada e nenhuma configuração Railway ou flag de produção é habilitada.
- Given os prazos aprovados, when a política é consultada, then distingue retenção local de cópias Google/Meta, registros legais de pagamento e cópias nos dumps Railway.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

A política será versionada como artefato imutável no código, consumível por casos de uso públicos, sem exigir banco, painel administrativo ou serviço novo. A versão aprovada pelo proprietário pode ser lida, mas o processamento real também exige validação operacional; `PRODUCTION_PRIVACY_APPROVED` e os demais gates Railway permanecem desabilitados. Os sete dias se aplicam à cópia ativa da aplicação; o contrato discrimina cópias de provedor e dumps já gerados, e não afirma que o sistema consegue apagá-las no mesmo prazo.

## Verification

**Commands:**
- `npm run build` — não passou neste Windows por falta dos bindings nativos SWC exigidos pelo Turbopack; `npm run build -- --webpack` passou sem alterar dependências.
- Compilação TypeScript do worker — passou.
- `node --test tests/data-policy.test.mjs` — fixtures provam as decisões e bloqueios do contrato.
- `npm run check:boundaries` — o novo módulo não importa adapters, app, worker ou SDKs de infraestrutura.

Resultado: build Webpack, worker TypeScript, 7 testes da story e check de boundaries passaram. A revisão quick não encontrou achados.

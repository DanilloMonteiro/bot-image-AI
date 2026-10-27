---
title: 'Finalizar decisões e aceite do Epic 2'
type: 'feature'
ticket: ''
created: '2026-10-27'
status: 'built'
baseline_revision: '311ecf92210c0ad9653fece61653e2e9130383b4'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-pilot-budget-data-policy/epic-pilot-budget-data-policy.md'
  - '_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-pilot-budget-data-policy/story-aprovar-e-versionar-a-politica-de-dados-plan.md'
  - '_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-pilot-budget-data-policy/story-conciliar-custos-e-liquidar-ou-liberar-reservas-plan.md'
  - '_bmad-output/initiative-brief-ensaios-ia-whatsapp/research-whatsapp-business-api-direct-versus-prov/research-whatsapp-business-api-direct-versus-prov.md'
---

<frozen-after-approval reason="decisões explícitas do proprietário e autorização para concluir o Epic 2">

## Intent

**Problem:** As histórias 2.2 a 2.9 foram implementadas, mas seguem em revisão. As decisões recentes mudaram o escopo de exclusão, e o proprietário pediu uma comparação entre Meta direta e BSPs; o contrato de política atual e o aceite do épico ainda não representam o escopo decidido nem a rota recomendada.

**Approach:** Preservar a política aprovada anterior como v1 e publicar uma v2 que use a Cloud API da Meta diretamente, não faça da região nem da política de cópias de Meta/Google uma condição de uso, e trate apenas o armazenamento controlado pelo sistema. Manter o uso de dados reais bloqueado até comprovar a exclusão local. Registrar as regras já aprovadas da conciliação 2.5, corrigir a pesquisa com a auditoria de fontes, validar o fluxo sintético e fechar as histórias quando seus critérios estiverem cobertos.

## Boundaries & Constraints

**Always:** Manter os dados sob controle do app no PostgreSQL e no Bucket privado, com os prazos previamente aprovados; dumps PostgreSQL mantêm a configuração atual de 3 dias de intervalo e 6 dias de retenção. Nenhum gate de terceiros ou de região pode bloquear o uso por decisão do proprietário. Política ausente/incompleta/não aprovada ou exclusão local não verificada continua falhando fechado. Meta direta é a rota escolhida para o piloto, sem BSP; custos Meta não confirmados permanecem desconhecidos e bloqueiam gastos pagos. Na 2.5, um dos dois sócios autorizados decide: liquida custo final positivo comprovado, libera apenas custo final zero comprovado e mantém custo incerto reservado.

**Never:** Alterar ou apagar a política v1; prometer a remoção de cópias guardadas por WhatsApp/Meta ou Google; declarar teste de exclusão local sem implementação executável; habilitar dados reais, flags de produção, chamadas externas, cobrança ou tráfego real.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Política v2 aprovada | Meta direta, finalidade/acesso e retenção local completos; exclusão local pendente | Leitura disponível; coleta/processamento continuam bloqueados | Nenhuma integração é chamada |
| Cópias externas e região | Provedor aplica suas proteções padrão; localização não é critério do proprietário | Não entram na avaliação nem no gate de exclusão da aplicação | Não afirmar que a aplicação apaga cópias externas |
| Cobrança confirmada | Estado terminal, custo positivo conhecido e decisão de sócio autorizado | Liquida uma vez e registra autor, motivo e horário | Sem evidência ou autorização, mantém reserva |
| Custo zero comprovado | Estado terminal, evidência de custo exatamente zero e decisão autorizada | Libera a reserva uma vez e audita a decisão | Custo desconhecido/pendente segue reservado |

</frozen-after-approval>

## Code Map

- `src/contracts/data-policy/v1.ts` and `src/modules/data-policy/policy-v1.ts` — preserve the already approved policy history unchanged.
- `src/contracts/data-policy/` and `src/modules/data-policy/` — add the new current policy version and restrict its operational gate to verified deletion in app-controlled storage.
- `src/modules/data-policy/use-cases.ts` — return only the current approved policy and fail closed until local deletion is verified.
- `tests/data-policy.test.mjs`, `tests/budget-data-policy-e2e.test.mjs` — cover the current policy version, local deletion gate, provider-free behavior, and rejection of a stale snapshot.
- `src/modules/budget/use-cases.ts`, `src/adapters/postgres/budget-repository.ts`, `tests/budget-reconciliation.test.mjs` — existing terminal reconciliation, admin verifier, settlement/release and audit behavior for story 2.5; preserve it.
- `tests/budget-*.test.mjs` and story plans 2.3–2.9 — synthetic verification evidence for the remaining Epic 2 acceptance criteria.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-pilot-budget-data-policy/` — epic scope, owner decisions, story plans, and repo ticket state.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/research-whatsapp-business-api-direct-versus-prov/` — provider comparison and fresh citation-audit digest.

## Tasks & Acceptance

**Execution:**
- [x] `src/contracts/data-policy/` and `src/modules/data-policy/` — add the approved v2 policy while leaving v1 intact; represent Meta Cloud API direct, app-controlled retention/deletion and only the local deletion readiness check.
- [x] `tests/data-policy.test.mjs`, `tests/budget-data-policy-e2e.test.mjs` — update fixtures and prove v1 cannot replace v2, real-data use stays blocked pending local deletion, and no provider callback occurs.
- [x] `_bmad-output/initiative-brief-ensaios-ia-whatsapp/research-whatsapp-business-api-direct-versus-prov/` — correct source confidence, Zenvia service pricing, 360dialog migration caveat, Meta rate uncertainty, and the recommendation's billing condition.
- [x] Epic 2, PRD, architecture, and story 2.2/2.5 plans — record the 2026-10-27 owner decisions, update the handoff and acceptance scope, and retain a dated change log.
- [x] Epic 2 ticket tree — closure check accepted after the v1 criterion was marked historical; stories 2.2–2.9 and the Epic 2 container are done, with no dependency warnings.

**Acceptance Criteria:**
- Given the owner-approved v2, when consumers read the policy, then it names the selected providers and covers app-controlled data, while external provider copies and region are not operational gates.
- Given local deletion has not been implemented and proven, when collection or processing is requested, then it remains blocked and makes no real provider call.
- Given unknown WhatsApp cost, when a paid operation is reserved, then Budget keeps cost unknown and blocks the spend.
- Given terminal reconciliation, when one authorized partner approves a positive confirmed charge or proven zero cost, then settlement or release is idempotent and audited; uncertain cost remains reserved.
- Given all synthetic checks and the epic closure audit pass, when ticket status is updated, then stories 2.2–2.9 and Epic 2 are done without enabling production data or traffic.

## Implementation Notes

The v2 policy is immutable and leaves v1 unchanged. It records conversations/consent in PostgreSQL and original/generated images in the private Bucket, retains the previously approved periods, and treats Meta/Google copies and region as informational. Collection and processing remain blocked until local deletion is implemented and verified. The existing Budget reconciliation rules are preserved; an unconfirmed Meta charge is unknown and blocks paid work. The candidate comparison recommends Meta direct for the pilot; the exact Brazilian rate and the AI-provider classification remain unresolved pending Billing Hub confirmation.

The formal Epic 2 closure audit accepted the updated story 2.2 addendum, which marks its earlier v1 acceptance criterion as historical and confirms v2 as current. All nine stories are done and the container is done. This closes the synthetic Epic scope only; local deletion proof, Meta Billing Hub confirmation, and independent production controls still gate real use.

## Plan Change Log

- **2026-10-27 — decisions and scope:** owner decisions recorded for app-controlled deletion, default provider protections, Meta candidate research, and 2.5 settlement/release rules. Research recommends Meta Cloud API direct without a BSP; no paid production operation is enabled.

## Review Triage Log

- **medium — patch —** `_bmad-output/plan-epic2-finalize-decisions.md` — At first review, the closure task and story statuses were still open. Formal closure then passed, stories 2.2–2.9 were marked done, Epic 2 was marked done, and this plan now records that result.
- **medium — patch —** `_bmad-output/initiative-brief-ensaios-ia-whatsapp/research-whatsapp-business-api-direct-versus-prov/digests/meta-pricing-verification-r1-verify_meta_pricing.md` — The digest overstated exact Brazil rates as confirmed despite the independent citation audit's login wall. It now marks the earlier exact-rate observation and BRL eligibility unverified and requires an accessible official card or Billing Hub confirmation.

## Design Notes

The app stores conversations/consent in PostgreSQL and image files in its private Railway Bucket. Both are app-controlled storage; WhatsApp/Meta and Google copies are outside this policy's deletion gate. Earlier approved image retention remains in force. Provider charges that cannot be confirmed through Meta's Billing Hub remain unknown to Budget.

## Verification

**Commands:**
- `npx tsc -p tsconfig.worker.json` — expected: success.
- `node --test tests/data-policy.test.mjs tests/budget-data-policy-e2e.test.mjs tests/budget-contracts.test.mjs tests/budget-ledger.test.mjs tests/budget-reconciliation.test.mjs tests/budget-signals.test.mjs tests/budget-snapshot.test.mjs` — expected: all synthetic Budget/Data Policy tests pass.
- `npm run check:boundaries` — expected: success.
- `npx next build --webpack` — expected: optimized build succeeds using the existing WASM fallback if native SWC is unavailable.
- `git diff --check` — expected: no whitespace errors.

**Results:**
- `npx tsc -p tsconfig.worker.json` — passed.
- Seven-file synthetic Node suite listed above — passed, 51/51.
- `npm run check:boundaries` — passed.
- `npx next build --webpack` — passed; Next completed using the Webpack build path. It emitted a warning about a `package-lock.json` outside the repository.
- `git diff --check` — passed.
- `tickets.py status initiative-brief-ensaios-ia-whatsapp` — all 16 stories report done; Epic 2 reports done; no `problems`, `unpinned_after`, `undeclared_after`, or `order_conflict`.
- Research helpers — all 16 citation markers resolve; tally is 7 verified, 2 unverified, 2 disputed.

No real customer data, database, provider call, production flag, charge, or WhatsApp traffic was used. Local deletion is still not implemented or verified; it remains the gate for any real-data use.

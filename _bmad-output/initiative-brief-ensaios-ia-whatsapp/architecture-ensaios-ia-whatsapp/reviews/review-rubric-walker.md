# Architecture Spine Review — Good-Spine Rubric Walker

**Reviewed:** 2026-10-09  
**Artifact:** `architecture-ensaios-ia-whatsapp.md`  
**Lens:** Initiative-to-implementation divergence, AD enforceability, Deferred gaps, stack currency, capability coverage, brownfield fit, and operational/environment envelope.

## Verdict

**Conditional pass.** The spine is well-shaped for an initiative-level modular monolith: it maps all seven capabilities, carries the approved product guardrails, and gives the implementation team useful runtime, privacy, payment, budget, and human-handoff constraints. It is not yet fully handoff-ready because module ownership and delivery-state terms can still be implemented incompatibly, the selected Next.js baseline is no longer current, and minimum production alerting is left implicit.

## Findings

### R1 — High: Module ownership is named, but not assigned to authoritative entities

**Evidence:** AD-2 names the five modules and says each owns its mutations. The capability map distributes CAP-2 across `conversations`, `portraits`, and `partner-operations`; CAP-5 across `portraits`, `partner-operations`, and `budget`; and CAP-6 across `partner-operations` and `conversations`. No rule says which module is the sole writer/source of truth for consent and its version, photo/media lifecycle, portrait approval/delivery state, human assignment, or privacy request state.

**Why it matters:** Two implementers can both obey “no writes to another module’s tables” while independently persisting the same business fact in their own module, or while disagreeing which module’s status authorizes the next action. This weakens the user-approved ownership boundary at its most sensitive seams.

**Disposition:** Amend before handoff with a compact entity/state-to-owner map for the cross-module facts above, plus the allowed public use case/event each neighboring module uses. Keep the one-writer rule in AD-2. The map need not prescribe schemas.

### R2 — Medium: “Channel confirmation” does not define the delivery state

**Evidence:** AD-3 requires marking delivery only after “confirmação do canal” and separately says final failures must remain recoverable. It does not distinguish provider acceptance, send attempt, delivered callback, or read receipt.

**Why it matters:** A handler could mark an order delivered on an HTTP acceptance response while another waits for a provider delivery callback. That yields incompatible customer status, retry, and support behavior when accepted messages later fail.

**Disposition:** Specify which provider signal makes the product’s delivery state terminal and which states remain pending/retryable. If provider selection is still deferred, record this as a launch gate tied to the selected channel adapter.

### R3 — Medium: The Next.js version baseline is stale as of the review date

**Evidence:** The Stack lists Next.js 16.3.8 as the verified baseline. The official Next.js releases page shows **v16.4.0 marked Latest**, released October 7, 2026; the official blog announces 16.4. The version should be revalidated before starting the greenfield application. The same release registry lists TypeScript 7.0.2 as well as 6.0.3, so the TypeScript 6 choice should be recorded as a compatibility decision, not treated as latest by implication. Node 24 LTS and PostgreSQL 18.6 are current on their official release/support pages; pg-boss 12.37.0 is its current listed release.

**Disposition:** Update the Next.js baseline to the verified compatible release, or explicitly pin 16.3.8 with a reason and a before-bootstrap compatibility check. Verify TypeScript compatibility against that exact Next version and retain the exact date/source for the chosen baseline. Sources: [Next.js releases](https://github.com/vercel/next.js/releases), [Next.js 16.4 announcement](https://nextjs.org/blog), [TypeScript releases](https://github.com/microsoft/TypeScript/releases), [Node.js releases](https://nodejs.org/en/about/previous-releases), [PostgreSQL versioning](https://www.postgresql.org/support/versioning/), [pg-boss releases](https://github.com/timgit/pg-boss/releases).

### R4 — Medium: Basic detection and response for production failures is not explicit

**Evidence:** AD-3 says final failures are recoverable and escalated; AD-7 says partners are notified. Deferred leaves notification channel, priority, and coverage open. The deployment envelope does not state how operators detect a stopped worker, growing queue lag, missed provider callbacks, failed reconciliation, or unavailable database/media service, or who receives and owns that alert. Backup restoration is required but has no acceptance/response target.

**Why it matters:** The system can satisfy the architecture rules while a paid order or privacy task remains stuck without a visible, actionable alert. This matters even in a small pilot because async processing and personal photos are core paths.

**Disposition:** Add a pre-production Deferred item for minimum health/queue/webhook/payment/media signals, alert routing and ownership, plus a restoration objective that fits the pilot. A full SRE model is not needed at this altitude.

## Rubric checks

- **Real divergence points:** Strong coverage of payment authority, cost reservation, privacy gating, external processing, retries, idempotency, human takeover, and customer-channel scope. R1–R2 remain material implementation seams.
- **AD enforceability:** Most rules are testable as architecture constraints. AD-2 is not sufficiently entity-specific yet; AD-3’s terminal delivery signal is ambiguous. Authorization wording (“authorized approval”) also depends on the eventual partner permission model, but can remain a pre-panel implementation decision if captured as a gate.
- **Deferred:** Provider, exact retention, budget category caps, accessibility detail, commercial quality/retry rules, and campaign attribution each have sensible timing gates. Add minimum operational alerting/recovery as R4. None of the deferred infrastructure choices contradicts the user’s explicit decision to leave hosting open.
- **Technology currentness:** Stack candidates are appropriately marked non-adopted where relevant, but the selected Next.js baseline is stale at review time (R3). The spine does not embed dated source links, so this currentness check cannot be repeated from the artifact alone.
- **Brownfield fit:** No application infrastructure/codebase exists per initiative context, so there is no existing architecture to ratify or contradict. The proposed greenfield runtime is consistent with that context.
- **Capability coverage:** CAP-1 through CAP-7 appear in the capability map and are governed by listed ADs. No capability is omitted.
- **Operational/environment envelope:** Production runtime, HTTPS webhooks, environment/secret separation, private persistence/media, and tested backup restore are covered. Alert detection/ownership and recovery expectations need the bounded addition in R4.


## Follow-up verification — 2026-10-09

**Verdict: The four original findings are addressed; one medium implementation policy gap remains to capture.**

- **R1 — Resolved.** AD-2 now assigns the conversation and consent evidence to Conversas, orders/payments to Pedidos/Pagamentos, photo and per-image generation/delivery state to Retratos, takeover/escalation/audit state to Operação dos Sócios, and cost ledger/reservations to Orçamento. It requires other modules to call public use cases and refer to IDs. AD-5 further distinguishes the consent evidence in Conversas from the per-image authorization reference in Retratos and checks active consent before external processing. This is a useful single-writer map without prescribing schema.
- **R2 — Resolved.** AD-3 now separates accepted/sent, delivered, read-if-available, and failed states; only an explicit delivery receipt satisfies “delivered.” Correlation, deduplication, and out-of-order event handling are also stated.
- **R3 — Resolved for the chosen baseline.** The Stack now pins Next.js 16.4.0 with a verification date and a source link. The official releases registry showed 16.4.0 as the latest stable release on 2026-10-09 (released October 7); 16.5 entries were canary pre-releases. TypeScript 6 is explained by its JavaScript Compiler API compatibility with Next, while the cited Next.js discussion documents the TypeScript 7 native-port incompatibility and a supported compatibility path. Node 24 LTS and PostgreSQL 18.6 also match their official release/support status. The new Deferred bootstrap/cache check is appropriate for the private panel. Sources checked: [Next.js releases](https://github.com/vercel/next.js/releases), [Next.js 16.4](https://nextjs.org/blog/next-16-4), [TypeScript 7 compatibility discussion](https://github.com/vercel/next.js/discussions/95633).
- **R4 — Resolved at spine altitude.** Deferred now requires production monitoring for the app/worker, webhooks, queue, delivery failures, and budget blocks; it also requires alert recipients and partner recovery/reconciliation steps before launch. The runtime rule still requires restoration testing.
- **Remaining Medium — Partner authorization thresholds are not captured.** AD-4 still requires “aprovação autorizada,” while AD-6 says one partner may release a budget block. Individual MFA accounts and actor audit identify users, but neither AD-7 nor Deferred says which partner actions either account may approve, or whether any action needs both partners. Add a short pre-panel permission/approval policy item to Deferred so the implementation does not infer an approval threshold for previews, additional generation, financial decisions, privacy requests, or budget release. This does not block the stack or architecture shape, but it is an unresolved authorization rule before production.

Other checklist dimensions remain covered: all seven capabilities are mapped; no brownfield application exists to ratify; hosting and providers remain deliberately open with pre-integration or pre-deployment gates; and the operational envelope is no longer silent.


## Final follow-up verification — 2026-10-09

**Verdict: Pass; no remaining material good-spine checklist gap found in this pass.**

- **Partner authorization matrix — Resolved.** AD-6 and AD-7 now require explicit permission checks and tie budget release to a permission matrix. Deferred defines that the matrix must list which partner may perform each action and which actions require both partners, before the panel goes into production.
- **pg-boss version — Verified.** The Stack now uses 12.37.1 and links directly to the project release. The official GitHub release page marks 12.37.1 “Latest,” published October 8, 2026.
- **TypeScript/Next.js compatibility — Verified with an explicit production boundary.** The spine pins TypeScript 6.0.3 as the conservative baseline, cites Next.js 16.4’s official useTypeScriptCli documentation, and defers any TypeScript 7 migration until the experimental checker path is suitable for production. The current docs identify the CLI checker path as experimental and not recommended for production; Next.js 16.4 is the documented version. The Next.js baseline 16.4.0 remains current in the official docs/release listing.
- **Ownership and state contracts — Strengthened.** AD-2 now also assigns the stable customer ID and WhatsApp identity links to Conversas, while cross-module customer references use that ID. AD-3 defines conflicting/out-of-order delivery receipt precedence. AD-4 prevents duplicate payment events from silently causing another paid generation. These close the key adversarial divergence seams identified in the prior passes.
- **Remaining checklist dimensions:** The authorization policy is now a dated implementation gate; all CAP-1–CAP-7 are bound and mapped; greenfield fit and the deployment/monitoring envelope are accounted for. Storage provider, queue/storage technology, hosting, privacy terms/retention, and launch constraints remain explicitly deferred to appropriate gates.

Current primary sources checked: [Next.js 16.4 TypeScript checker documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli), [Next.js releases](https://github.com/vercel/next.js/releases), [pg-boss 12.37.1 release](https://github.com/timgit/pg-boss/releases/tag/12.37.1).

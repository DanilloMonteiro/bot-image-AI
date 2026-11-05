---
title: 'EPIC 3 — Conversas e consentimento no WhatsApp'
type: 'feature'
ticket: 'EPIC 3 (stories 3.1–3.7)'
created: '2026-11-05'
status: 'in-progress'
baseline_revision: 'd07210de39e8e769aee567989336e876a98219ab'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository has no durable WhatsApp conversation flow, so the seven planned EPIC 3 stories cannot yet safely receive, resume, and respond to messages or record consent.

**Approach:** Implement the Conversations module, persistence, narrow channel/provider adapters, and synthetic end-to-end coverage. Use only approved content and existing consent, data-policy, and budget gates; leave real provider traffic and photo processing disabled until their external checks pass.

## Boundaries & Constraints

**Always:** Keep stable internal customer/conversation IDs, idempotent inbound handling, monotonic delivery evidence, and serialized consent revocation. Answer in Brazilian Portuguese from approved FAQ material, one question at a time, without invented price, ETA, or human identity. Store audio only transiently and persist its transcript. Emit a durable, idempotent human/privacy handoff contract for EPIC 5. Reserve budget before any external cost and block on unknown balance or cost.

**Conversation lifecycle:** Close a conversation after 24 hours without an inbound message. A later inbound message reuses the stable customer ID and creates a new conversation ID; the seven-day retention period begins at closure.

**Never:** Enable live Meta/Gemini calls or accept real photos without the story’s account, cost, and local-deletion gates; write to Orders/Payments; add the EPIC 5 inbox or UI; log message text, provider payloads, audio, or photos; weaken DATA_POLICY_V2.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Duplicate or reordered webhook | Same inbound event or later receipt arrives first | One response; delivery state never regresses | Idempotent acknowledge; retry durable work |
| Eligibility/consent | Adult/ownership answers, policy version, refusal or revocation | Persist evidence; no photo request/process without affirmative eligibility and consent | Keep gate closed and explain/route safely |
| Voice | Synthetic OGG with explicit conversation-level audio consent | Transcript becomes a text message; source audio is not retained | Offer text on refusal or transcription failure |
| Channel/handoff | Opt-out, expired/unknown send rules, human or privacy request | Block disallowed send; create one durable handoff | Safe response; no unapproved send or duplicate handoff |

</frozen-after-approval>

## Code Map

- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-whatsapp-conversation-consent/tickets.toml` — exact scope and verification expectations for stories 3.1–3.7.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` and `_bmad-output/initiative-brief-ensaios-ia-whatsapp/ux-ensaios-ia-whatsapp/EXPERIENCE.md` — ownership, ordering, safety, channel, consent, and customer-facing rules.
- `src/modules/data-policy/policy-v2.ts` and `src/modules/data-policy/use-cases.ts` — approved policy and photo collect/process gate; reuse without changing readiness.
- `src/modules/budget/use-cases.ts`, `src/contracts/budget/v1.ts` — authorization and cost reservation; never use synthetic reservation for provider calls.
- `src/adapters/postgres/runtime.ts` and `src/adapters/postgres/smoke-repository.ts` — pool, transaction, worker, and durable/idempotent persistence patterns.
- `src/app/api/internal/smoke/route.ts`, `src/adapters/http/production-traffic-gate.ts`, `src/proxy.ts` — narrow HTTP composition and production allowlist; add only the signed webhook path.
- `scripts/check-boundaries.mjs`, `scripts/check-platform-isolation.mjs` — module import and exposed-route constraints.
- `tests/platform-smoke.test.mjs`, `tests/data-policy.test.mjs`, `tests/budget-data-policy-e2e.test.mjs`, and `tests/fixtures/budget/memory-repository.mjs` — test conventions and synthetic fixtures.

## Tasks & Acceptance

**Execution:**
- [x] Conversation domain/contracts and durable Postgres adapter — customer identity, conversation lifecycle, ordered messages, idempotency, receipts, and handoffs.
- [x] WhatsApp and Gemini adapters plus webhook boundary — signature validation, safe normalization, provider send/transcription interfaces, config gates, and no sensitive logging.
- [x] Conversation policy/orchestration — approved FAQ, eligibility and versioned consent, voice consent, opt-in/out, handoff, one-question replies, budget/data-policy gates.
- [x] Boundary/platform checks and synthetic test coverage — close refactor findings and exercise all story 3.1–3.7 paths without real photos, external calls, or Orders/Payments writes.

**Acceptance Criteria:**
- Given a duplicate, delayed, or reordered event, when processed repeatedly, then one correlated response is recorded and delivery evidence does not regress.
- Given missing/negative eligibility, consent, audio consent, channel configuration, or budget authorization, when processing would require that permission, then the operation is blocked and the safe text/handoff path is used.
- Given approved text or consented synthetic audio, when handled, then replies follow FAQ policy, transcript only is persisted, and human/privacy handoffs are durable and unique.
- Given the synthetic EPIC 3 suite, when run, then refusal, failure, revocation, and resume are covered with no real media, provider calls, or Orders/Payments writes.

## Real Integration Completion Gate

EPIC 3 remains in progress until one controlled real end-to-end test succeeds: send a text message from an authorized personal WhatsApp account to Meta's app-provisioned test number, receive it through the signed webhook, classify it using the real Gemini Vertex AI endpoint, and deliver exactly one approved FAQ reply through WhatsApp Cloud API. Record provider delivery evidence and reconcile actual costs without logging message contents or credentials. Use only text and synthetic test content; no real photos or production customer traffic. Run this only after the WhatsApp account, recipient, send rules, and cost are approved, Budget authorizes both provider calls, and the canonical Data Policy local-deletion gate is verified. The synthetic suite alone does not close EPIC 3.

## Implementation Notes

- Implemented stories 3.1–3.7 across durable conversation state, WhatsApp text/audio intake, approved FAQ classification, eligibility and versioned consent, opt-out/revocation, and EPIC 5 handoff contracts.
- Conversations close 24 hours after the last inbound receipt. A later message within retention reuses the stable customer ID and opens a new conversation ID; active conversation and handoff metadata expire seven days after closure.
- Ingress checks live traffic, account, cost, and Data Policy collection readiness before persistence. Each external adapter also checks the canonical Data Policy process gate, approval flags, and Budget before transport. These gates remain closed by default; no real media is accepted.
- Outbound retries are limited to explicit HTTP 429 responses. Ambiguous provider outcomes are not resent and create an idempotent delivery handoff. Send-window time is checked after acquiring the per-customer lock.
- `npm test` passed: Next.js build, worker TypeScript compilation, and 110 tests. Boundary, platform-isolation, and `git diff --check` checks passed. No live Meta/Gemini calls or PostgreSQL integration run was performed.

## Plan Change Log

- 2026-11-05 — Isaac clarified that EPIC 3 must remain in progress until a controlled live WhatsApp + Gemini end-to-end test succeeds. Added the acceptance gate above; provider/data-policy/budget gates remain mandatory.

## Review Triage Log

- [quick] `src/app/api/webhooks/whatsapp/route.ts:20` — **high / patch** — The public POST path persists signed real inbound messages without the live-traffic gate; the production allowlist exposes the route, so inbound data can enter PostgreSQL while traffic is disabled. Add a fail-closed ingress gate before persistence.
- [quick] `src/adapters/gemini/faq-classifier.ts:17`, `src/adapters/gemini/ogg-transcriber.ts:16`, `src/adapters/whatsapp/cloud-api.ts:133`, `src/adapters/whatsapp/media-downloader.ts:15` — **high / patch** — These adapters check environment approvals but do not consult Data Policy V2; `localDeletion` remains `pending`, so enabled flags can still send conversation/audio data to providers. Apply the canonical local-deletion decision before any provider call.
- [quick] `src/worker/conversation-outbound-handler.ts:27` — **medium / patch** — Provider failures are marked blocked and the job completes; queue and job retry limits are zero. A safely retryable rejection can permanently lose a reply. Add bounded retries for explicit safe rejections and retain ambiguous outcomes for human recovery.
- [quick] `src/worker/conversation-outbound-handler.ts:25` — **medium / patch** — A send blocked by unknown rules or an expired window returns without creating a durable handoff, despite the plan’s channel/handoff matrix. Record one idempotent delivery handoff for blocked outbound work.
- [quick] `src/worker/conversation-outbound-handler.ts:18` — **medium / patch** — `now` is captured before waiting for the per-customer lock, then reused by `claimOutbound`; if the wait crosses the 24-hour boundary, an expired send can pass. Read the clock after acquiring the lock.
- [self-audit] `src/adapters/postgres/conversation-repository.ts:781` — **medium / patch** — Expiring a conversation cascaded its messages and events but left the separate handoff envelope indefinitely; that envelope is conversation metadata covered by the seven-day policy. Delete handoffs for expiring conversations in the same purge transaction and cover the fixture behavior.
- [self-audit] `src/app/api/webhooks/whatsapp/route.ts:22` — **high / patch** — The ingress gate checked traffic/account/cost but not Data Policy collection readiness, so real messages could still be stored while local deletion remained unverified. Check the canonical collect decision before composing or invoking persistence.

## Design Notes

The EPIC 5 handoff is a minimal versioned envelope: stable internal conversation/customer IDs, `human_help` or `privacy_request`, safe reason/context, and an idempotency key. Assignment, notifications, takeover UI, and resolution belong to Operations/EPIC 5.

## Verification

**Commands:**
- `npm test` — build plus repository test suite passes.
- `npm run check:boundaries` — module boundaries pass.
- `npm run check:platform-isolation` — public route and environment isolation checks pass.
- `git diff --check` — no whitespace errors.

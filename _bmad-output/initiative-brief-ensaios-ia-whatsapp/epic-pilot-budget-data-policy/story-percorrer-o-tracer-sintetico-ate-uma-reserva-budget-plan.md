---
title: 'Percorrer o tracer sintético até uma reserva Budget'
type: 'feature'
ticket: '1'
created: '2026-10-23'
status: 'in-progress'
baseline_revision: 'b01f7e3dddbc9e8a1734146b39b867189473dc1b'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The deployed synthetic smoke path creates a fresh random task/job for every request and the repository has no Budget reservation capability. It cannot prove that replaying one synthetic event yields one durable job and one reservation.

**Approach:** Add a narrow authenticated Budget trace endpoint identified by a stable UUID `Idempotency-Key`. A public Budget use case and PostgreSQL adapter will persist one reservation and enqueue one durable pg-boss job under the same action ID; retries return the existing result.

## Boundaries & Constraints

**Always:** Budget owns reservation rules and persistence; the reservation has a stable action ID and is idempotent. Reuse PostgreSQL, pg-boss, the worker, environment-specific bearer auth, and no-store responses. Accept only a synthetic request with no body. Fail closed when reservation details are absent or persistence/enqueue fails.

**Never:** Enable customer/media routes, process personal data or real photos, call WhatsApp/Pix/AI providers, or create an external charge. Do not put reservation logic in `platform-usage/v1.ts` or change existing platform-smoke behavior. Keep real-traffic approval flags unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First trace | Authorized POST, UUID key, empty body | One reservation and one durable job share the action ID; return accepted result | No error expected |
| Replay | Same authorized UUID key sent again | Return the existing action; no second reservation or job | No error expected |
| Invalid request | Missing/invalid auth, key, or non-empty body | No database or queue writes | Safe 401/400 with `no-store` |
| Unavailable storage | PostgreSQL or pg-boss cannot commit | No partial accepted state | Safe 503; transaction rolls back |

</frozen-after-approval>

## Code Map

- `src/app/api/internal/smoke/route.ts` and `src/adapters/http/smoke-submit-handler.ts` — existing authenticated, bodyless synthetic entry pattern; keep this endpoint's behavior unchanged.
- `src/adapters/http/staging-auth.ts` — constant-time bearer validation using the environment-specific secret.
- `src/adapters/postgres/smoke-repository.ts` — PostgreSQL/pg-boss startup, transaction-backed enqueue, stable job IDs, and safe readiness; reuse the transaction pattern without making Budget import this adapter.
- `src/modules/platform-smoke/repository.ts` and `src/modules/platform-smoke/use-cases.ts` — current Platform Smoke contract; Budget must have its own public use case/repository.
- `src/worker/index.ts` and `src/worker/platform-smoke-handler.ts` — worker registration, durable job validation, retry and completion patterns.
- `src/adapters/http/production-traffic-gate.ts` — exact internal paths admitted by the proxy; the new route still needs bearer authorization.
- `tests/platform-smoke.test.mjs`, `tests/platform-isolation.test.mjs`, `scripts/check-platform-isolation.mjs`, `scripts/smoke-local.mjs` — HTTP, isolation, boundary, and PostgreSQL/pg-boss verification patterns.
- `src/contracts/platform-usage/v1.ts` — provider-usage interchange contract; do not use it as the Budget reservation ledger.
- `_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md` — AD-2 module ownership, AD-3 durable idempotency, AD-6 reservation rules, AD-8 deployment constraints.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/budget/` — add a public reservation use case and repository contract keyed by the stable action ID; keep domain code independent of Next.js and database SDKs.
- [x] `src/adapters/postgres/` — persist the Budget reservation and enqueue its pg-boss job idempotently under one transaction; return the existing reservation/job on replay.
- [x] `src/app/api/internal/budget/trace/route.ts`, its HTTP handler, and `src/adapters/http/production-traffic-gate.ts` — add the bodyless, authenticated trace path and allowlist only that internal path.
- [x] `src/worker/` — consume the synthetic Budget job through the existing worker runtime and preserve idempotency across redelivery; perform no external paid action.
- [x] `tests/` and `scripts/` — add coverage for auth, body/key validation, concurrent replays, one job plus one reservation, worker redelivery, database failure, and route isolation.

**Acceptance Criteria:**
- Given an authorized first request with a valid stable key and approved reservation details, when the tracer accepts it, then one reservation and one durable job are stored with that action ID.
- Given the same key is replayed or delivered concurrently, when the requests complete, then each returns the same action and the database contains exactly one reservation and one job.
- Given unauthorized, malformed, or body-bearing requests, when they reach the route, then they receive safe no-store errors and create no state.
- Given a worker redelivery, when the job is processed again, then the reservation is not duplicated and the synthetic job reaches a stable terminal result.
- Given any trace request, then customer and media paths remain gated and no provider or real customer data is touched.

## Open Questions

None. Isaac approved R$0.01 (`1` BRL minor unit) in the `synthetic_trace` category, excluded from real pilot caps.

## Implementation Notes

This is a synthetic idempotency sentinel, not an estimate of provider spend or an external charge. Keep it separately identifiable so the later ledger and cap implementation cannot include it in real category totals.

## Plan Change Log

- 2026-10-23: Resolved the minimum reservation as R$0.01 in a synthetic-only category excluded from real pilot caps; implementation started.
- 2026-10-23: Added the idempotent Budget trace route, transactional reservation/job persistence, and worker consumer; verification remains pending.
- 2026-10-23: Added unit and isolated Compose acceptance coverage. Build/tests (35), module boundaries, and platform isolation passed; Compose execution was blocked because Docker Desktop is unavailable. Production route still returns 404 because this change is not deployed.

## Review Triage Log

## Design Notes

Keep the current platform-smoke endpoint separate from the Budget trace. The request key identifies the synthetic event, the Budget action ID, and the pg-boss job; the database uniqueness constraint is the authority for concurrent replays. The route allowlist permits routing only, while the existing bearer check remains the authorization boundary.

## Verification

**Commands:**
- `npm run check:boundaries` — expected: Budget domain imports only its own domain and public use cases.
- `npm test` — expected: all unit and isolation checks pass.
- `npm run smoke:local` — expected: repeated synthetic key leaves one reservation and one durable job in the isolated Compose database.

**Execution evidence:** `npm test` passed (build and 35 tests); `npm run check:boundaries`, `npm run check:platform-isolation`, and `rtk git diff --check` passed. `npm run smoke:local` could not start because the Docker Desktop engine pipe was unavailable. A read-only production request to `/api/internal/budget/trace` returned 404, confirming this code is not deployed there. Production acceptance verification remains pending.

**Manual checks:**
- After release to the synthetic production environment, repeat one UUID key and confirm one reservation/job; verify customer/media routes remain blocked. Do not expose or store the bearer secret in source or logs.

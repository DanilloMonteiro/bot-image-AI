---
title: "Falhas e uso de plataforma ficam observáveis"
type: feature
ticket: 4
created: '2026-10-20'
status: done
assignee: "Isaac"
baseline_revision: 'f2db8a3dd45e3097eb1e8368f71abdc0261412ee'
route: oneshot
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The worker handler imports the `PlatformEvent` type from the console adapter, reversing the architecture's dependency direction. This couples platform orchestration to a logging implementation even though the handler already receives an emitter port.

**Approach:** Move the event type to the `platform-smoke` module's public event contract. Let both the worker handler and console adapter depend on that contract, preserving the existing runtime serialization, emitted fields, and composition in `worker/index.ts`.

</frozen-after-approval>

## Implementation Notes

Oneshot is appropriate because this is a focused type-boundary correction with no runtime behavior change. Existing 1.4 lifecycle events, usage contract and reconciliation guidance, PostgreSQL smoke evidence, and privacy allowlist are already present.

- Moved `PlatformEvent` into `src/modules/platform-smoke/events.ts`; the worker handler and console adapter now depend on the module-owned contract. `src/worker/index.ts` remains the composition root that connects the production emitter.
- Quick review found that `SIGKILL` could interrupt buffered console output in the crash-after-commit smoke case. Removed that case's log assertion; the non-crashing recovery path still verifies a correlated completion event from the real worker.

## Prior Code Review (2026-10-20)

The earlier code review applied all five patch findings and rejected one false positive. The `blind-hunter` review layer could not start because the session agent limit was reached.

- [x] Guard null or non-object queue data before reading `correlationId` (`src/worker/index.ts`).
- [x] Require own properties when validating usage contract records (`src/contracts/platform-usage/v1.ts`).
- [x] Verify events through the production worker entry point (`scripts/smoke-local.mjs`).
- [x] Assert PostgreSQL-backed reads expose the attempt number (`scripts/smoke-local.mjs`).
- [x] Cover duplicate same-attempt processing against PostgreSQL (`scripts/smoke-local.mjs`).
- Rejected false positive: an object correlation ID cannot reach the event serializer because the worker entry point requires a string UUID before invoking the handler.

## Review Triage Log

- medium — Patched `scripts/smoke-local.mjs`: the smoke no longer assumes logs from a process killed immediately after emitting have flushed; a later live worker completion remains asserted.

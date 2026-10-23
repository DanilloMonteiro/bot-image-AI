---
title: 'Guia reproduzível de configuração do Railway para o piloto'
created: '2026-10-21'
baseline_revision: '8b6fd85a2cd0f0b75e4a1e7c349dff08fb1ff198'
route: 'oneshot'
route_source: 'pinned'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/docs/platform-staging.md'
  - '{project-root}/docs/platform-usage-contract.md'
  - '{project-root}/.railway/railway.ts'
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md'
---

This file is a historical implementation and review record for the Railway setup guide, not a separate ticket. Current setup work and status live in `backlog/story-configurar-e-validar-railway.md` and its plan.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Isaac and Danillo do not yet have a Railway account or provider resources, and the existing staging guide does not provide a full, repeatable onboarding path. The IaC and safety requirements exist, but the plan cost, account roles, setup order, environment variables, Bucket treatment, and operational evidence are easy to misconfigure.

**Approach:** Add a Portuguese runbook that maps the current Railway IaC and approved pilot controls into a reproducible sequence for Isaac and Danillo. Separate free account creation from paid-plan decisions and billable provisioning, list every environment variable by source and service, and give checkpoints for plan review, verification, evidence, and handoff.

</frozen-after-approval>

## Implementation Notes

One-shot documentation change: the service graph and guardrails are already implemented, so this adds their operator-facing setup path without changing application behavior or provisioning provider resources.

- Added `docs/railway-pilot-setup.md` with account/cost gates, current resources and variable ownership, CLI plan/apply sequence, provider verification, and replication evidence for Isaac and Danillo.
- Linked the new guide from `docs/platform-staging.md`. Kept the existing `PRODUCTION_*` approval gates unset and Bucket credentials disconnected; this change provisions no Railway resource and creates no secrets.

## Plan Change Log

- 2026-10-22 — Runbook status updated after production setup: Hobby account/MFA, workspace `botimageai`, project `ensaios-ia-whatsapp-pilot`, hard/soft limits, web/worker smoke, PostgreSQL retained in IAD, and Hobby-compatible three-day logical backup recorded. Manual backup and isolated restore passed; first natural cron run and full RTO remain pending.
- 2026-10-22 — GitHub diagnosis: the configured `main` branch does not exist in `DanilloMonteiro/bot-image-AI`; user selected `production`. The local implementation adds the backup service/Bucket, updates all GitHub source refs, and preserves `PRODUCTION_BACKUP_RESTORE_VERIFIED` to prevent IaC deletion. Railway plan is 0 adds, 3 branch updates, 0 deletions; it has not been applied.
- 2026-10-22 — Implementation is in [PR #14](https://github.com/DanilloMonteiro/bot-image-AI/pull/14) (`a88aa50`, follow-up tracking commit `d46648b`), targeting `production`. Its CI fails because `tests/platform-isolation.test.mjs` asserts the old PostgreSQL region; no test file was changed. GitHub requires PR review. This documentation PR #13 targets `develop` and does not itself publish the service implementation to production.
- 2026-10-22 — PR #13 checks are also failing because the CI smoke timed out waiting for the worker health check after simulated database loss (`worker health reports database loss`). This update documents that result; no tests were run locally and no unrelated changes were included.


## Review Triage Log

- Quick review identified four operator-facing gaps: scheduled volume restore cannot target another environment; the Compute hard limit did not reserve the separate Bucket allocation; public-domain assignment was described as both before and after HTTPS validation; and the variable inventory omitted `POSTGRES_PASSWORD` for manual local Compose. Fixed by documenting isolated PITR restore to a sibling service (with its cost and access caveats), reserving Bucket costs and keeping it empty until an effective control exists, making domain assignment an explicit approved exposure step followed by HTTPS verification, and listing the local-only Compose password. Aligned the existing staging guide's budget and domain steps as well. A follow-up check found one stale sentence repeating the old domain order; it now clearly says the domain is public on assignment and keeps non-smoke routes and real traffic closed until the checks pass. No open review findings remain.

## Verification

**Commands:**
- `rtk git diff --check` — expected: no whitespace errors.

**Manual checks:**
- Verify the runbook matches `.railway/railway.ts`, the current production gate, and the approved cost/privacy/backup constraints; ensure it contains no credentials or claim that Railway resources exist.

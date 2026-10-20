---
title: "Base web e worker é implantada em produção"
type: feature
ticket: '6'
created: '2026-10-20'
status: built
assignee: "Isaac"
baseline_revision: 'c05978e1910710bb597774deb312e2a06620aea0'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - _bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md
  - _bmad-output/initiative-brief-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp/spec-ensaios-ia-whatsapp.md
  - docs/platform-usage-contract.md
  - docs/platform-staging.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository currently runs only in local/CI staging. It has no Railway production resources, app health probes, production backup drill, or verified production cost signals. Its pinned Next.js 16.4.0 also must be patched before exposure.

**Approach:** Deploy the existing Next.js web app and long-running Node worker from this repository to Railway, using the approved PostgreSQL + pg-boss stack and private Railway Bucket. Keep production synthetic-only and gated from customer and media traffic while enabling health, backup/restore, and cost reconciliation.

## Boundaries & Constraints

**Always:** Use a Railway workspace dedicated to this pilot and set its Compute hard limit to the USD equivalent of the approved R$65 infrastructure allocation at setup; reaching it can take the pilot's services offline. Reconcile Bucket storage charges separately because stored objects may continue to incur charges after access is suspended. Use the approved Virginia service region (`us-east4-eqdc4a`) and IAD Bucket (`iad`); keep PostgreSQL private and use its private `DATABASE_URL`; run pg-boss in PostgreSQL with no Redis; keep secrets distinct per environment and out of source control; patch Next.js to a fixed release before production exposure; use only synthetic smoke data. Keep the pilot ceiling at R$500 with the approved 60/80/95% alerts and admin pause authority. Only Isaac and his partner are admins, using individual allowlisted accounts and MFA. Public access is limited to the web health/synthetic-smoke paths required by this story; customer and media routes remain closed until privacy gates are approved.

**Never:** Accept real personal data or photos; add customer, media, or admin-panel features; expose the database or Bucket publicly; add Redis; put credentials in GitHub or logs; or implement the budget ledger owned by the budget epic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Web health | `GET /api/health` | 200 with non-sensitive readiness only | 503 if required runtime dependency is unavailable |
| Worker health | Worker starts and queue connection succeeds | Internal probe reports ready; worker emits structured readiness | Probe stays unhealthy and deployment does not pass when worker/DB is unavailable |
| Synthetic smoke | Valid environment-specific secret and synthetic event | Existing durable PostgreSQL/pg-boss path completes with a correlation ID | Invalid/missing secret returns 401/403 and writes no task |
| Cost/backup gate | Provider usage or restore state is unknown | No real customer/media traffic is enabled | Keep the deployment synthetic-only and record the unresolved gate |

</frozen-after-approval>

## Code Map

- `package.json` — `build`, `start:web`, and `start:worker`; Next.js is pinned at 16.4.0 and pg-boss at 12.37.1.
- `Dockerfile` and `compose.yaml` — existing shared image and local service split; preserve staging behavior while giving Railway separate web/worker start commands.
- `src/worker/index.ts` — long-running worker startup and `worker_ready` log; add readiness probing without exposing a public worker domain.
- `src/adapters/postgres/smoke-repository.ts` — private `DATABASE_URL`, synthetic tables, and pg-boss setup; keep smoke records synthetic and avoid a Redis dependency.
- `src/adapters/http/staging-auth.ts` and `src/app/api/internal/smoke/**` — current staging-secret guard and synthetic smoke endpoints; support an environment-specific secret name/value without weakening auth.
- `src/app/**` — placeholder web app; add a minimal health route and keep customer/media routes absent.
- `docs/platform-usage-contract.md` and `docs/platform-staging.md` — provider-neutral usage signals and current staging/privacy gates; extend with production operations and recovery instructions.
- `.railway/railway.ts` — new single Railway IaC graph for web, worker, PostgreSQL, and private IAD Bucket.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `package-lock.json` — pin a patched Next.js release (at least 16.4.1) and add the Railway TypeScript IaC package so deployment does not expose the known vulnerable pin.
- [x] `src/app/api/health/route.ts`, `src/worker/index.ts` — expose non-sensitive web and internal worker readiness for Railway health checks and structured logs.
- [x] `src/adapters/http/staging-auth.ts`, `src/app/api/internal/smoke/**`, staging env/config — use a per-environment smoke secret; retain authentication and synthetic-only writes.
- [x] `tests/*.test.mjs` — cover web/worker readiness, rejected smoke credentials without writes, and the synthetic-only deployment gate when privacy, cost, or backup evidence is missing.
- [x] `.railway/railway.ts` — define separate web and worker services, private PostgreSQL, and private `media` Bucket in the approved regions; link only private database variables and give no public domain to the worker/database/Bucket.
- [x] `docs/platform-staging.md`, `docs/platform-usage-contract.md` — document Railway plan/apply, isolated secrets, HTTPS, workspace cost controls, provider usage reconciliation, scheduled backup, and an isolated synthetic restore drill. Keep real-data gates explicit.

**Acceptance Criteria:**
- Given a Railway production environment, when the reviewed IaC is applied, then web and worker deploy from the same repository in Virginia with PostgreSQL private and Bucket private in IAD.
- Given the patched release, when production starts, then web and worker readiness are observable and secrets or personal data do not appear in logs.
- Given a valid production smoke secret, when a synthetic event is submitted, then the durable smoke path completes; invalid credentials create no work.
- Given a configured backup, when the isolated restore drill runs, then synthetic smoke state is restored and queryable without exposing it publicly.
- Given unknown provider usage, backup status, or privacy approval, then the environment remains synthetic-only with no customer or media route enabled.

## Implementation Notes

- Local verification passed: `npm run build`; the implementation run also passed `npm test` (33/33), boundary and platform-isolation checks, local Docker smoke, Railway IaC TypeScript validation, and `git diff --check`. After the final cost-gate patch, its focused test passed (1/1) and the production build passed again.
- Provider verification remains pending: no Railway account is connected, so `railway config plan`/apply, live HTTPS/private-access and secret checks, usage-alert validation, scheduled backups, and the provider restore drill were not run. Keep all six production approval flags unset; customer/media traffic stays closed.

## Plan Change Log


## Review Triage Log

- medium — `src/adapters/http/smoke-submit-handler.ts:10-15` (patch): the original finding was real; the handler now inspects the request stream with read/time bounds and rejects body bytes with 400 before `accept()`. The focused test proves a `customer_upload` body creates no task and an authorized empty body still returns 202.
- medium — `_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/reviews/review-tech-currentness.md:8,14` (defer): the separately modified, dated review says the repo still pins Next.js 16.4.0, while the story updates package and lock to 16.4.1; preserve that user artifact and track the post-change review update separately.
- high — `src/adapters/http/production-traffic-gate.ts:3-10` (patch): the original gate could expose customer/media paths after only privacy, cost-reconciliation, and backup flags; it now also requires separate evidence flags for the 60/80/95% alerts, effective Compute hard limit, and pause authority. The focused test removes each flag and confirms both path families stay blocked.
- high — `docs/platform-staging.md:3,35-41` (defer): live Railway deployment and the provider backup/isolated restore remain unverified because no Railway account is connected and the IaC has not been applied; the provider plan, HTTPS/private-access checks, alert configuration, backup schedule, and restore evidence require an owner in the dedicated workspace.

## Design Notes

Use Railway's current TypeScript Infrastructure as Code in one `.railway/railway.ts`; the older `railway.toml`/`railway.json` path is deprecated. Review `railway config plan` before applying. The IaC graph describes resources; account-level backup and usage controls still need provider configuration and verification. The dedicated workspace isolates the approved Compute hard limit to the pilot. Keep Bucket storage reconciliation separate, and keep the production smoke route narrowly authenticated and synthetic.

References: [Railway IaC](https://docs.railway.com/infrastructure-as-code), [IaC reference](https://docs.railway.com/infrastructure-as-code/reference), [cost controls](https://docs.railway.com/pricing/cost-control), [Postgres backup/restore](https://docs.railway.com/guides/postgres-backups-restores), [Next.js security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).

## Verification

**Commands:**
- `npm run build` — expected: Next.js web and worker TypeScript compile successfully.
- `railway config plan` — expected: only the approved production resources/settings are added or changed; no unrelated or destructive resource changes.

**Manual checks:**
- Verify HTTPS web health, worker readiness, private database networking, private Bucket access, and environment-isolated secrets in Railway.
- Submit only a synthetic smoke event; verify rejected credentials create no work and logs omit secrets/personal data.
- Verify usage/cost signals and alerts, then complete a restore into an isolated environment before marking the story done.

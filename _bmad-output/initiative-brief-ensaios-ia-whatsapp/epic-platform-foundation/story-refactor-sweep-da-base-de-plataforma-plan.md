---
title: "Refactor sweep da base de plataforma"
type: "refactor"
ticket: 7
created: "2026-10-20"
status: done
baseline_revision: "ce7ce6b14849e98392f685cf38a58e12f9681457"
route: "oneshot"
route_source: "auto"
risk: "medium"
review: "quick"
review_source: "pinned"
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - _bmad-output/initiative-brief-ensaios-ia-whatsapp/epic-platform-foundation/story-base-web-e-worker-e-implantada-em-producao-plan.md
  - _bmad-output/initiative-brief-ensaios-ia-whatsapp/deferred-work.md
  - docs/platform-staging.md
---

<frozen-after-approval reason="human-owned intent; locked after approval">

## Intent

**Problem:** Story 1.6 updated the repository pin from Next.js 16.4.0 to 16.4.1, but the dated technology-currentness review still says the repository uses 16.4.0. The 1.6 review triage and the first entry in deferred-work record this stale statement for the 1.7 sweep.

**Approach:** Append a dated post-1.6 note that records the repository pin as 16.4.1 and distinguishes it from the official latest stable, 16.4.2 as of 2026-10-20 ([release notes](https://github.com/vercel/next.js/releases/tag/v16.4.2)). Preserve the historical review text and do not change dependency versions. Remove only the resolved first entry from deferred-work; keep the Railway account, alerting, and provider backup/restore work open and unchanged.

</frozen-after-approval>

## Implementation Notes

This is a one-shot documentation cleanup limited to the technology-currentness review and the active deferred-work list. Runtime behavior and public contracts stay unchanged. The live Railway gate and all six production approval flags remain untouched.

- Added a 2026-10-20 follow-up distinguishing the repository pin (16.4.1) from the latest stable release (16.4.2); removed only the resolved currentness item from deferred-work.
- Verification passed: `npm test` (33/33), boundaries, platform isolation, local smoke, local synthetic backup/restore, and `git diff --check`. The external Railway plan/apply and provider backup drill remain unverified.
- Quick review completed with no findings.

## Verification

**Commands:**
- npm test — the platform quality tests pass.
- npm run check:boundaries and npm run check:platform-isolation — both checks pass.
- npm run smoke:local and npm run backup:restore:local — synthetic web/worker and local restore paths pass.
- git diff --check — no whitespace errors.

**Manual checks:**
- Confirm the review note matches the locked Next.js pin and does not call 16.4.1 the latest release.
- Confirm the only remaining deferred item is provider-side Railway setup and verification, with production traffic still gated.

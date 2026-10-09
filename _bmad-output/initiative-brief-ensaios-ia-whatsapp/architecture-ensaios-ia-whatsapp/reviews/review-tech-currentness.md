# Architecture review: technology currentness

**Review date:** 2026-10-09  
**Scope:** current official releases, compatibility, fit for the selected Next.js + Node worker structure, and greenfield starter defaults. PostgreSQL and pg-boss were checked as candidates only; this review does not adopt them.

## Verdict

**Changes required before finalizing the spine.** The architecture shape is compatible with the reviewed technologies, and the data/queue choices are correctly marked as candidates. Refresh two stale version entries and explain why TypeScript 6 is the compatibility baseline while TypeScript 7 is current.

## Findings

### P1 — Refresh the Next.js baseline

The stack table lists Next.js 16.3.8 as the verified baseline, but the official Next.js releases page marks **16.4.0** as the latest stable release, published October 7, 2026. Replace 16.3.8 with 16.4.0 or explicitly label 16.3.8 as a provisional pin that must be revalidated when implementation begins. The architecture’s Next.js choice itself fits: Route Handlers support HTTP methods needed for webhooks, and the official Node.js server deployment supports all Next.js features. [Next.js releases](https://github.com/vercel/next.js/releases) · [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) · [deployment options](https://nextjs.org/docs/app/getting-started/deploying)

### P2 — Refresh the pg-boss candidate version, without adopting it

The stack and Deferred section list pg-boss 12.37.0, but official releases show **12.37.1** as latest, published October 8. Update the candidate reference to 12.37.1 or remove the patch version until the queue decision is made. Keep the explicit “candidate, not adopted” status: pg-boss requires Node 22.12+ and PostgreSQL 13+, so Node 24 and PostgreSQL 18.6 meet its declared minimums if the team later selects it. [pg-boss releases](https://github.com/timgit/pg-boss/releases) · [pg-boss requirements and capabilities](https://github.com/timgit/pg-boss)

### P2 — Clarify the TypeScript 6 baseline rationale

TypeScript 6.0.3 is a real stable release and is a reasonable compatibility baseline, but it is no longer the newest stable major: Microsoft lists TypeScript 7.0.2 as the latest release. Keeping 6.0.3 is defensible for this stack because TypeScript 7’s native package does not expose the JavaScript Compiler API that Next.js currently loads for TypeScript integration; the Next.js discussion documents a build detection failure and a compatibility approach that retains TypeScript 6 for Next.js. State that TypeScript 6 is the selected baseline for Next.js integration, and defer a TypeScript 7 migration until the Next.js integration path is verified. Avoid describing 6.0.3 as the latest version. [TypeScript releases](https://github.com/microsoft/TypeScript/releases) · [TypeScript 7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [Next.js TypeScript 7 integration discussion](https://github.com/vercel/next.js/discussions/95633)

## Verified decisions and fit

- **Node.js 24 LTS** is appropriate for production. Node 26 is Current, while Node 24 is LTS; production guidance recommends Active or Maintenance LTS. Next.js lists Node 20.9 as its minimum, and pg-boss lists 22.12, so Node 24 satisfies both. [Node.js release status](https://nodejs.org/en/about/previous-releases) · [Next.js requirements](https://nextjs.org/docs/app/getting-started/installation) · [pg-boss requirements](https://github.com/timgit/pg-boss)
- **PostgreSQL 18.6** is the current supported minor for PostgreSQL 18, supported through November 14, 2030. It is a current candidate version; keep it unadopted until the architecture’s storage decision is made. [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- **Next.js + a separate long-lived Node worker in the same codebase** is compatible with the deployment model recorded in AD-1 and AD-8. Next.js supports a full-featured Node server deployment; the dedicated worker must be deployed as its own long-running process and not assumed to run inside a request/route execution environment. The current structural seed already represents the worker as a separate process.
- **Greenfield starter defaults:** current `create-next-app --yes` defaults include TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, the `@/*` import alias, and an `AGENTS.md` guide. These defaults are compatible with the proposed source layout. The spine does not need to adopt Tailwind or a package manager at architecture altitude; record the choices when implementation scaffolding is created. [Next.js installation defaults](https://nextjs.org/docs/app/getting-started/installation)

## Candidate status check

The spine consistently describes PostgreSQL and pg-boss as **candidates, not decisions**, and says AD-3 must be satisfied without depending on them. Preserve that wording after updating their version references. No database, queue, migration tool, hosting provider, or ORM is adopted by this review.

## Addendum — verification against current spine (2026-10-09)

This addendum supersedes any earlier version-currentness statements above where they differ from the current spine or these live primary-source checks.

- **Next.js:** the current spine now lists 16.4.0. Confirmed correct: the official release page marks v16.4.0 latest stable and gives its release date as October 7, 2026. The earlier P1 finding about the spine listing 16.3.8 is resolved. [Next.js v16.4.0 release](https://github.com/vercel/next.js/releases/tag/v16.4.0)
- **pg-boss:** the current spine still lists 12.37.0. The official releases page, checked live for this addendum, lists **12.37.1** as Latest, released October 8, 2026, with fixes over 12.37.0. Update the candidate version to 12.37.1, or omit its patch version pending the queue decision. The page also shows why an earlier check could differ: 12.37.0 was released October 5 and 12.37.1 followed three days later. Keep both PostgreSQL and pg-boss labeled as unadopted candidates. [pg-boss releases](https://github.com/timgit/pg-boss/releases)
- **TypeScript + Next.js 16.4:** the current spine’s TypeScript 6.0.3 baseline is a sound conservative choice, but its explanation should be qualified. TypeScript 7.0.2 is stable and newer; Next.js 16.4 documents TypeScript 7 through its CLI type-checking backend. That integration is still marked experimental and “not recommended for production.” The same current docs say the CLI checker is enabled by default and can be switched off with `experimental.useTypeScriptCli: false` to use the JavaScript Compiler API path. Next.js 16.4 source retains an API backend dependency on `typescript@^6.0.0`. Thus TypeScript 6.0.3 is the safer production baseline today, while TypeScript 7 is an available but experimental integration path; do not describe TypeScript 7 as unsupported or imply that an explicit opt-in is necessarily required by the latest docs. [Next.js TypeScript CLI configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli) · [Next.js 16.4 TypeScript setup source](https://github.com/vercel/next.js/blob/v16.4.0/packages/next/src/lib/verify-typescript-setup.ts) · [TypeScript releases](https://github.com/microsoft/TypeScript/releases)

**Updated verdict against the current spine:** Next.js currentness is resolved. One candidate reference remains stale (pg-boss 12.37.0). TypeScript 6.0.3 is sensible for the pilot’s conservative baseline; add the experimental status and current behavior of Next.js’s TypeScript 7 path to keep the rationale accurate. PostgreSQL and pg-boss remain candidates, not architectural decisions.

## Final check against the updated spine (2026-10-09)

I re-read the current stack and Deferred entries and checked the official release/docs pages again.

- **No remaining architecture-level version/default issue.** The spine now lists Next.js 16.4.0 (latest stable; 16.5.0 entries are canaries), pg-boss 12.37.1 (latest), PostgreSQL 18.6 (current supported minor), and Node.js 24 LTS. The Node release page currently identifies 24.21.0 as the latest LTS patch; selecting the exact patch belongs in implementation runtime pinning, while the architecture’s major-LTS constraint is correct.
- **TypeScript rationale now matches the official documentation.** TypeScript 7.0.2 is stable, but the Next.js 16.4 CLI checker that enables it is explicitly experimental and not recommended for production. The docs say the CLI checker is enabled by default and can be disabled to use the JavaScript API path. The spine correctly keeps TypeScript 6.0.3 as the conservative production baseline and defers a TypeScript 7 migration. It does not incorrectly claim that TypeScript 7 is unsupported or requires an explicit opt-in.
- **Greenfield defaults are accurate and need no architecture change.** Current create-next-app --yes docs list TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, @/*, and AGENTS.md. The spine defers bootstrap details to implementation, so it does not need to adopt those defaults now; implementation should retain the stated TypeScript 6.0.3 baseline in the manifest/lockfile.

**Final verdict:** the current spine reflects the latest primary-source verification. PostgreSQL and pg-boss remain clearly marked as candidates; no remaining version/default issue is flagged.

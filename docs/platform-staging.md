# Platform staging smoke

This story runs a staging equivalent locally and in CI. It does not create an external staging account or deploy a paid service. External hosting, region, spending cap and privacy terms require a later decision. Do not connect customer traffic, real photos, Pix or image generation to these endpoints.

## Run

Install Node 24 and Docker Compose. Run `npm ci`, `npm run check:boundaries`, `npm run build`, then `npm run smoke:local`. The smoke script creates an ephemeral secret, starts private PostgreSQL and the web process, posts a synthetic task while the worker is stopped, starts the worker, confirms completion with the same ID, checks unauthorized access and database loss, then removes the local volume. It uses port 3000 on localhost. All test data is synthetic.

For manual operation, provide `POSTGRES_PASSWORD` and a random `STAGING_SMOKE_SECRET` of at least 32 characters, then run `docker compose up -d --build`. POST `/api/internal/smoke` with `Authorization: Bearer <secret>` and no body. The 202 response includes `id`. GET `/api/internal/smoke/<id>` with the same header to view `queued`, `processing`, `completed` or `failed`. Both endpoints disable caching. Missing or incorrect secrets return 401. Database failure returns 503 without an acceptance ID.

Only the web process binds a host port, and only to `127.0.0.1`. PostgreSQL has no host port. In an external environment, provide private database networking and a distinct secret; place the web process behind HTTPS and restrict these internal endpoints at the network edge. Do not reuse a local or CI secret. The database contains only UUID correlations, state and timestamps; queue payloads contain a synthetic marker. Logs contain no credential, personal data or media bytes.

The task and job enter PostgreSQL in one transaction. The worker can resume a queued job after restart. This demonstration has no external side effect; deduplication and reconciliation of external effects belong to story 1.2. A `failed` state is queryable; inspect worker logs for the generic error and recover operationally. Backups and external recovery procedures belong to later platform stories.

## Cost and deployment gate

Local Compose and CI need no external account. Do not provision external infrastructure until the owners approve provider, region, realistic total cost, an effective spending limit within the R$500 pilot ceiling, and privacy terms. The CI workflow builds and runs the staging equivalent in GitHub Actions; it does not claim an external staging deployment.

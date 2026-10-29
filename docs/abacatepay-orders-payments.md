# Orders, Payments and AbacatePay

Epic 4 exposes a private synthetic offer for integration exercises only. The offer is not a customer price and `productionOffers` stays empty until an owner-approved offer exists. The internal order routes require the staging bearer secret and return 404 in production:

- `POST /api/internal/orders`
- `POST /api/internal/orders/{orderId}/pix`
- `POST /api/internal/orders/{orderId}/simulate-pix`
- `POST /api/internal/orders/{orderId}/reconcile`
- `GET /api/internal/orders/unmatched-events`
- `POST /api/internal/orders/reconcile-unmatched`
- `POST /api/webhooks/abacatepay?webhookSecret=...`

The flow stores only opaque customer/conversation IDs and the consent version; it never calls WhatsApp. Pix instructions go through the local fake sender in tests or the local staging harness. The fulfillment authorization is a durable, one-per-order outbox record for the future Epic 6 consumer.

## Dev mode setup

Use only AbacatePay Dev mode credentials for local/staging exercises:

1. Set `ABACATEPAY_MODE=dev`, `ABACATEPAY_ACCOUNT_ID`, and `ABACATEPAY_DEV_API_KEY` in an untracked local `.env`.
2. Configure a webhook in the AbacatePay Dev mode dashboard. Set its URL to the HTTPS webhook route above.
3. Configure the same URL secret as `ABACATEPAY_WEBHOOK_SECRET` and the HMAC verification key as `ABACATEPAY_WEBHOOK_HMAC_KEY`. Keep both values out of source control and logs.
4. Start the app and database, submit a synthetic order with the staging bearer secret and explicit synthetic consent, then create its Pix.
5. Call the simulate route for that order. The adapter invokes AbacatePay `POST /v2/transparents/simulate-payment?id={checkoutId}`. Wait for the signed `transparent.completed` webhook.

AbacatePay Dev mode simulates payments and does not collect real money. The create adapter uses `POST /v2/transparents/create`, requests PIX, sends only the amount and opaque `externalId`, and checks the returned `devMode`, amount, QR instructions, and expiry. Its timeout is treated as an unknown provider outcome. The system does not issue a second create request for the same order after a timeout; reconcile the existing provider attempt before any manual recovery.

## Webhook handling

The handler verifies the `webhookSecret` query parameter and HMAC-SHA256 signature over the raw request body with a constant-time comparison. It accepts only the documented event ID, event type, Dev mode flag, payment ID, external ID, amount and currency needed for reconciliation. It stores the event ID, event type and normalized outcome only; it never stores the raw body, signature, query secret or provider key. Duplicate event IDs converge on the recorded result.

A payment is authorized only when account, order external ID, provider payment ID, amount, BRL currency and environment match the stored Pix attempt. `paidAt` must be explicitly present in the authenticated event and fall between attempt creation and Pix expiry. Missing/untrusted time, late payment, conflicting payment, or account/amount mismatch remains a durable exception. Webhook receipt time is never used as a substitute for provider payment time.

## Exception reconciliation

An operator with the staging internal bearer credential can submit a durable decision at `POST /api/internal/orders/{orderId}/reconcile`. Supply a unique `reconciliationId`, `operatorId`, and stable `evidenceRef` that identifies the provider lookup or case record; never put a receipt, raw webhook, secret, or customer data in this request.

- `confirm_paid` requires provider terminality, a completed reconciliation, and proof matching the saved external order ID, provider reference (when already known), account, amount, BRL currency, environment, trusted `paidAt`, and expiry. It creates the single fulfillment authorization.
- `close_unpaid` requires provider terminality and a completed reconciliation, plus matching external order/reference and an `unpaid` or `refunded` provider outcome. It closes the order. For production attempts, the reconciliation and readiness-release outbox entry commit together; the readiness service is called after commit.
- Replaying the same request ID and payload returns the recorded result. If readiness release fails after commit, the outbox remains pending and the same request ID and payload retries that idempotent release. A failed paid-confirmation consume happens before commit and leaves no reconciliation decision. Reusing the ID with changed evidence or making a second decision for the order returns a conflict.

Do not close an attempt because its Pix expired. Verify the provider's terminal state first, record the stable evidence reference, then submit the matching decision. The route is hidden in production until the authenticated operations surface and all production gates are approved.

Signed `transparent.completed` events with no local attempt remain in an internal unmatched-event queue as normalized provider fields. Review the event against the provider dashboard, then close it at `POST /api/internal/orders/reconcile-unmatched` only after terminal reconciliation as `unpaid` or `refunded`. The request must repeat the stored payment identifiers, account, amount, currency, environment, and timestamp exactly. This path never authorizes fulfillment; it records why the orphan was closed. The queue and closure endpoint are staging-authenticated and hidden in production.

The AbacatePay webhook documentation defines the common v2 envelope and event ID, but leaves event-specific payload fields to individual references. It also says other 4xx responses are not retried. The exact `transparent.completed` shape therefore still needs a signed Dev-mode capture before operational acceptance; until then, the normalizer is provisional. Missing or invalid `paidAt` is retained as an untrusted-time exception and never authorizes fulfillment. [Webhook format and retries](https://docs.abacatepay.com/pages/webhooks).

## Production remains locked

The provider adapter contains production configuration, but this Epic 4 checkout only has the synthetic sandbox offer and the repository does not provide an Epic 6 readiness implementation. Production Pix is rejected before Budget, readiness or provider calls for the sandbox offer. All production approval flags default to false. Production also remains closed while the production offer, provider costs, payment-record retention, Epic 6 readiness, webhook verification, reconciliation procedure, manual test and platform controls remain unapproved.

Data Policy v2 does not approve local retention for real Pix payment records. The sandbox exercise uses synthetic data; do not enable real customer records or charges until retention and deletion are explicitly approved and verified. A Portraits readiness reservation is per order/package, idempotent, consumed once with fulfillment authorization, and may be released only after both provider terminality and reconciliation. Pix expiry alone is not release evidence.

## Official provider references

- [Dev mode](https://docs.abacatepay.com/pages/devmode)
- [Create transparent Pix](https://docs.abacatepay.com/pages/transparents/create)
- [Simulate transparent payment](https://docs.abacatepay.com/pages/transparents/simulate-payment)
- [Webhook events](https://docs.abacatepay.com/pages/webhooks)
- [Webhook signature verification](https://docs.abacatepay.com/pages/webhooks/security)

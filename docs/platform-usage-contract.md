# Platform usage contract v1

`src/contracts/platform-usage/v1.ts` defines a platform-neutral record that future consumers, including Budget, can import without depending on platform adapters or module internals. It describes observed usage and sourced cost only. It does not calculate prices, reserve spending, enforce a ceiling, or implement a ledger.

## Record fields

| Field | Meaning |
| --- | --- |
| `version` | The literal `v1`; incompatible shape changes require a new version. |
| `resource` | One of `hosting`, `database`, `queue`, or `execution`. |
| `metric` | A normalized lowercase identifier such as `reported_usage`, `job_count`, `attempt_count`, or `duration_seconds`. |
| `quantity` and `unit` | A non-negative finite amount and its normalized unit. Counts are whole numbers; durations or provider-reported usage may be fractional when their source reports that precision. |
| `period.from` and `period.to` | UTC calendar dates in `YYYY-MM-DD`; the interval includes `from` and excludes `to`. |
| `origin` | `manual_reconciliation`, `application_observation`, or `provider_telemetry`. Use provider telemetry only after that provider and source are approved. |
| `cost` | Optional sourced amount in integer minor currency units and an uppercase three-letter currency code. Omit the entire field when the price is unknown or has not been reconciled. |

Omitting `cost` means unknown or not yet sourced; it is not equivalent to zero. Record a zero amount only when a source explicitly confirms zero. The validator rejects impossible dates (for example, `2026-02-30`), empty or unnormalized metric/unit identifiers, negative quantities, and malformed sourced costs. It does not apply defaults.

## Manual reconciliation while providers remain unapproved

- **Hosting:** use the hosting provider's usage export and invoice for the same reporting period. Record the metric and unit the export actually reports, with `origin: "manual_reconciliation"`. Copy cost only from the corresponding invoice; do not estimate it from traffic.
- **Database:** use the database provider's usage export and invoice for the same period. Keep the full invoiced database amount on the `database` resource record.
- **Queue:** count jobs and attempts from retained pg-boss records for the period, using `job_count` and `attempt_count` with `origin: "application_observation"`. pg-boss shares the configured PostgreSQL resource, so do not report a separate queue provider charge. Any analytical allocation of database cost to queue activity must follow an approved Budget allocation rule, retain the database invoice as the billing source, and avoid counting the same spend twice. Until such a rule is approved, leave `queue.cost` absent.
- **Execution:** count attempts and derive worker duration from correlated safe worker lifecycle events for the same task UUID and attempt. Use `attempt_count` and `duration_seconds` with `origin: "application_observation"`. Add a cost only after an execution tariff is approved and the applicable source supports the amount; otherwise omit it.

Hosting/database provider exports, invoices, a queue allocation rule, execution tariffs, and provider telemetry remain subject to owner approval. This contract selects no vendor, provisions no service, and claims no real external cost. Manual records should contain aggregate usage and source category only; do not put customer data, media bytes, credentials, exception text, or event payloads into usage records.

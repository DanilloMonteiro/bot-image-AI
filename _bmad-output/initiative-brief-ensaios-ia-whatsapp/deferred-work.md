
- source_plan: `C:\Users\eigenheeri.BRCL214\Desktop\bot-image-AI\_bmad-output\initiative-brief-ensaios-ia-whatsapp\epic-platform-foundation\story-base-web-e-worker-e-implantada-em-producao-plan.md`
  summary: Complete the Railway production plan/apply and provider checks, including the alert controls and isolated synthetic backup restore, before treating Story 1.6 deployment acceptance as complete.
  evidence: No Railway account is connected here; the staging guide states that the IaC graph has not been applied and that provider HTTPS, usage alerts, scheduled backups, and the isolated restore drill remain unverified.

- source_plan: `C:\Users\monteirod.BRCL350\AppData\Local\Temp\ImageSystem-epic4-orders-pix-20261028\_bmad-output\initiative-brief-ensaios-ia-whatsapp\plan-epic4-orders-pix.md`
  summary: Capture a signed AbacatePay Dev-mode `transparent.completed` event or obtain an event-specific schema, then verify the provider normalizer's field names and timestamp behavior.
  evidence: The [official webhook documentation](https://docs.abacatepay.com/pages/webhooks) documents the common v2 envelope and event IDs, says event-specific fields are documented separately, and says 4xx responses other than 408/429 are not retried. It does not establish the exact `transparent.completed` payload; current tests use synthetic fixtures, so a valid provider event may still be normalized incorrectly.

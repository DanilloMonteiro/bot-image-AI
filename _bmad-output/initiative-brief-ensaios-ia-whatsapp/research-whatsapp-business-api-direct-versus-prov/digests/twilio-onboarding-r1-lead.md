# Digest — Twilio onboarding and portability — round 1

Accessed 2026-10-27. Source: Twilio-owned WhatsApp Self Sign-up documentation.

- **Claim:** Twilio self-sign-up requires an upgraded Twilio account and administrator access to a Meta Business Portfolio; if the portfolio is new or unverified, Meta business verification must be completed before production. Twilio says Meta's verification can take several weeks. **Source:** https://www.twilio.com/docs/whatsapp/self-sign-up — Twilio Docs, copyright 2026, accessed 2026-10-27. **Confidence:** high for Twilio's published onboarding process; **class:** implementation effort.
- **Claim:** The number must be able to receive a verification code and must not already be registered with WhatsApp unless it is migrated/released through the described process. **Source:** https://www.twilio.com/docs/whatsapp/self-sign-up — Twilio Docs, copyright 2026, accessed 2026-10-27. **Confidence:** high; **class:** integration requirements.
- **Claim:** In its self-sign-up flow, Twilio warns not to choose a WABA created outside Twilio; if an approved sender is already with another provider, Twilio directs the customer to create a new WABA for Twilio. Twilio also requires senders in one Twilio account to use the same WABA. **Source:** https://www.twilio.com/docs/whatsapp/self-sign-up — Twilio Docs, copyright 2026, accessed 2026-10-27. **Confidence:** high for the documented flow; **class:** vendor dependency.
- **Claim:** After sender registration, the Twilio Console exposes inbound-message webhook configuration; Twilio's quickstart offers a Sandbox for sending/receiving tests before sender registration. **Source:** https://www.twilio.com/docs/whatsapp/self-sign-up and https://www.twilio.com/docs/whatsapp/quickstart — Twilio Docs, n.d./copyright 2026, accessed 2026-10-27. **Confidence:** high; **class:** integration compatibility.

**Interpretation:** Twilio's self-sign-up adds Twilio account approval, a Twilio-managed API credential and WABA relationship to Meta's own business/number verification. Its documented WABA restrictions are a switching consideration, though its separate migration docs need to be read before estimating actual exit cost.

**Looked for but not established:** No public support SLA or guarantee of a shorter live-production approval path was found.

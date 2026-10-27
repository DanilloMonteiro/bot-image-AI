# Digest — Meta rate-card access — round 1

Accessed 2026-10-27.

- **Finding:** Following the public WhatsApp Business pricing page's rate-card link led to https://developers.facebook.com/docs/whatsapp/pricing, which returned HTTP 429 in this run. The direct business-messaging pricing page separately required login. **Publisher:** Meta. **Confidence:** high for the access failure; **class:** source availability.
- **Finding:** The public price calculator's Brazil/market selector is rendered dynamically and the web reader did not expose its selected rates; it lists a separate developer rate-card link that returned the 429 above. **Source:** https://whatsappbusiness.com/products/platform-pricing/ — Meta/WhatsApp Business, page copyright 2026, accessed 2026-10-27. **Confidence:** high for the available page text; **class:** source availability.
- **Finding:** Exact-title/domain searches for Meta's rate card effective 2026-10-01 and Brazil BRL prices returned no indexed results. **Publisher searched:** Meta/WhatsApp Business; accessed 2026-10-27. **Confidence:** high for the search result only; **class:** source availability.

**Next route:** Search Meta-owned public pages and downloadable rate-card URLs; if the current Brazil card cannot be accessed directly, leave exact rates unverified and do not substitute third-party reproductions for Meta's source.

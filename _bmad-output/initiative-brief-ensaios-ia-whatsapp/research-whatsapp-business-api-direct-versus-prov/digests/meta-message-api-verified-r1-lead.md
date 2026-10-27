# Digest — Meta direct API details verified — round 1

Accessed 2026-10-27. Opened Meta's official WhatsApp Business Platform Postman workspace directly.

- **Verified claim:** The direct Cloud API `/{Phone-Number-ID}/messages` endpoint sends text, media (audio, documents, images, video), and templates; it uses message IDs, supports marking incoming messages read, and exposes delivery/status notifications through webhooks. **Source:** https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages — Meta official Postman workspace, n.d., accessed 2026-10-27. **Confidence:** high; **class:** integration compatibility.
- **Verified claim:** The Meta collection lists an access token with `whatsapp_business_messaging` permission and a registered phone-number ID as prerequisites. **Source:** https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages — Meta official Postman workspace, n.d., accessed 2026-10-27. **Confidence:** high; **class:** version/compatibility.
- **Verified claim:** The Meta collection includes examples for inbound messages, delivery/status updates, WABA subscriptions, and message structures for text, media, and templates. **Source:** https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages — Meta official Postman workspace, n.d., accessed 2026-10-27. **Confidence:** high; **class:** implementation support.

**Interpretation:** Direct integration is a standard HTTP API call and webhook flow; Node/Railway can host the callback, but the project must set up Meta account credentials and implement the connection itself. The Node fit is an engineering inference from HTTP endpoints and the existing Node stack, not a Meta claim.

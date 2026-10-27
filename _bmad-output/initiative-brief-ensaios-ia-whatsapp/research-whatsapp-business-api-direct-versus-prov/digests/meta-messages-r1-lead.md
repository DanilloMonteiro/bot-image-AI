# Digest — Meta direct messages API — round 1

Accessed 2026-10-27. Source is Meta's official WhatsApp Business Platform Postman workspace.

- **Claim:** The direct Meta Cloud API sends text, media, and approved message templates through `/{Phone-Number-ID}/messages`; the collection shows an access token with `whatsapp_business_messaging` permission and a registered phone-number ID as prerequisites. **Source:** https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages — Meta's official Postman workspace, page date not shown (n.d.), accessed 2026-10-27. **Confidence:** high; **class:** integration compatibility.
- **Claim:** The same endpoint can mark an incoming message as read; sent-message status can be tracked from webhook events using the returned message ID. **Source:** https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages — Meta's official Postman workspace, page date not shown (n.d.), accessed 2026-10-27. **Confidence:** high; **class:** integration compatibility.
- **Claim:** Meta's public collection includes API documentation, environments, and examples under the official Meta workspace, so developers can test direct requests without a third-party messaging API layer. **Source:** https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api — Meta's official Postman workspace, page date not shown (n.d.), accessed 2026-10-27. **Confidence:** medium; **class:** implementation/support.

**Interpretation:** Direct use still requires the project to manage a Meta app, access token, phone-number ID, webhook URL, and subscription to WABA events. These are setup tasks inside the chosen application, not a recurring BSP platform fee.

**Looked for but not established:** Exact current production-token permanence/rotation guidance is still unverified from Meta's accessible sources; do not infer it from third-party setup guides.

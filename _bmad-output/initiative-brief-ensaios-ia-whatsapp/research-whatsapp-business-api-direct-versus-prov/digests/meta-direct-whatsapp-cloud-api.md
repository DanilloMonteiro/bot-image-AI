# Meta direct WhatsApp Cloud API digest

Accessed 2026-10-27. Evidence is limited to Meta/WhatsApp pages and Meta-hosted rate-card files. The current Meta Developer pages returned HTTP 429 in the web browser fetcher; direct requests to the same public Meta pages and their linked rate cards succeeded. No project files were read. Brazil and Railway are task context, not claims about the repository.

## Findings

[
  {
    "claim": "Meta documents a self-service Cloud API setup path covering developer registration, creating a Meta app, sending a first message, configuring a test webhook, creating secure access tokens, and sending messages with or without templates. The guide is now at the current Business Messaging documentation URL.",
    "source_url": "https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started",
    "publisher": "Meta for Developers",
    "pub_date": "n.d.",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "direct-eligibility-and-setup"
  },
  {
    "claim": "Meta's direct Cloud API setup requires a Meta business portfolio, a WhatsApp Business Account, and a business phone number; it uses the Meta Graph API, with the app subscribed to the WABA so inbound and status webhook events reach the configured callback. This supports a direct connection without a BSP being the API intermediary; Meta remains the platform dependency.",
    "source_url": "https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform; https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview; https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages",
    "publisher": "Meta for Developers",
    "pub_date": "n.d.",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "eligibility-and-vendor-dependency"
  },
  {
    "claim": "Meta's WhatsApp pricing documentation says qualified solution providers and directly integrated businesses can create messaging accounts billed in BRL when their Sold-To country is Brazil in Meta Billing Hub. The Brazil rollout began July 1, 2026; all qualified customers had this option from July 16. Meta says BRL accounts are billed by Facebook Brasil. Qualified customers must migrate all messaging accounts to BRL by June 30, 2027; Meta says it will stop delivering messages from their non-BRL accounts from July 1, 2027.",
    "source_url": "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#billing-localization-for-brazil",
    "publisher": "Meta for Developers",
    "pub_date": "n.d. (dates are stated as effective dates in the current page)",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "brazil-direct-eligibility-and-billing"
  },
  {
    "claim": "Meta charges per delivered message, based on recipient market and message category. The Meta rate cards effective October 1, 2026 list Brazil at USD $0.0625 marketing, $0.0068 utility, $0.0068 authentication, and $0.0068 service; the BRL card lists R$0.3217 marketing, R$0.035 utility, R$0.035 authentication, and R$0.035 service. Meta's pricing page identifies volume tiers for utility and authentication.",
    "source_url": "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#rate-cards-and-volume-tiers; USD file: https://scontent.fcpq5-1.fna.fbcdn.net/v/t39.8562-6/829311379_1537421421402610_366484812346475911_n.csv?_nc_cat=111&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=b8d81d&_nc_ohc=QS7M9FIPoy4Q7kNvwFfIukg&_nc_oc=Adp9Fr9r3j4q3g1MHnnWkZec1qoiD3Bt-L-rb5ex0H5Xn4d03LeKIVHKThLSrJ7Vdt0&_nc_zt=14&_nc_ht=scontent.fcpq5-1.fna&_nc_gid=h0QSYvafzQrJBh9gSEJG2Q&_nc_ss=7c20f&oh=00_AQMprIUkF8Z-TMYGQosZuLPCAwQDV4eMJTnpGndYnEN_mg&oe=6AE65F42; BRL file: https://scontent.fcpq5-1.fna.fbcdn.net/v/t39.8562-6/829788045_1617107983472492_8786695655875075995_n.csv?_nc_cat=110&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=b8d81d&_nc_ohc=V_Yd5i-hHYMQ7kNvwEYaTwM&_nc_oc=Adq4tTF0l3lsajeU6UAkqM4uHFMb09fOnrYqwo8sx15QFFA2AYuOf6GT-A6h4ajd6fc&_nc_zt=14&_nc_ht=scontent.fcpq5-1.fna&_nc_gid=h0QSYvafzQrJBh9gSEJG2Q&_nc_ss=7c20f&oh=00_AQM6mm8vDlIiphC0_4w_90ThJbiEiFpU0IE4hd9ckkfwlg&oe=6AE677C0",
    "publisher": "Meta for Developers / Meta-hosted rate-card files",
    "pub_date": "2026-10-01 effective date on each card",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "message-cost"
  },
  {
    "claim": "The WhatsApp Business Platform pricing landing page says businesses are charged per delivered message by recipient and category, but also says service messages and utility messages sent in response to users are not charged. That summary conflicts with the current October 1 rate cards, which list non-zero service and utility rates. Treat the landing-page summary as stale or incomplete for current service/utility billing until reconciled against the separate Meta FAQ and current billing rules.",
    "source_url": "https://whatsappbusiness.com/products/platform-pricing/; https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#rate-cards-and-volume-tiers",
    "publisher": "WhatsApp Business / Meta for Developers",
    "pub_date": "n.d. (rate cards effective 2026-10-01)",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "pricing-source-conflict"
  },
  {
    "claim": "Outside the 24-hour customer-service window, businesses may initiate or continue messaging only with approved templates. The policy also requires user opt-in, honoring opt-outs, an accurate support contact in the business profile, and clear escalation paths when automated replies are used (for example human agent, phone, email, or web support). These add ongoing policy and support-process work to a direct integration.",
    "source_url": "https://business.whatsapp.com/policy/preview?lang=pt_BR",
    "publisher": "WhatsApp Business / Meta",
    "pub_date": "n.d.",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "template-rules-and-operational-burden"
  },
  {
    "claim": "The messages API supports text, media, and templates; inbound events and delivery status are handled through webhooks. Media support is a separate API surface, so media intake or sending requires integrating Meta's media endpoints in addition to the basic send-message call.",
    "source_url": "https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages; https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media; https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview",
    "publisher": "Meta for Developers",
    "pub_date": "n.d.",
    "accessed": "2026-10-27",
    "confidence": "high",
    "class": "implementation-effort"
  },
  {
    "claim": "Meta's public WhatsApp Business page links to Developer Support and API Status, but I could not verify a response-time commitment, direct technical-support SLA, or support entitlement for a directly integrated pilot from the pages available without login. The policy page does publish operational customer-support requirements for the business itself.",
    "source_url": "https://whatsappbusiness.com/products/platform-pricing/; https://developers.facebook.com/support; https://metastatus.com/",
    "publisher": "WhatsApp Business / Meta for Developers / Meta",
    "pub_date": "n.d.",
    "accessed": "2026-10-27",
    "confidence": "medium",
    "class": "support"
  }
]

## Useful leads

- Current setup guide: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- Current overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
- Current webhooks guide: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
- Current templates guide: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/template-messages
- Current send-message guide: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- Current media guide: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media
- Evergreen rate-card landing page: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#rate-cards-and-volume-tiers
- The USD and BRL CDN URLs above were the exact links in the Meta page at access time. They are signed Meta CDN links and may expire; use the evergreen rate-card page to retrieve fresh copies.

## Looked for but could not verify from accessible Meta primary text

- The separate October 1 FAQ's 1,000-free-service-message allowance. The current rate cards expose a non-zero service list rate; the public pricing landing page still says service and utility replies are free. The run owner has separately verified the 1,000-free FAQ and will reconcile it with the landing-page copy.
- A published SLA or support response-time commitment for direct Cloud API customers. The Developer Support destination did not expose its content in the available fetch.
- A complete current list of business-verification prerequisites or thresholds for an ordinary direct pilot. The public setup guide confirms a self-service route but the web fetch did not establish which verification steps are mandatory for the owner's exact business profile and messaging volume.
- Project-specific implementation effort, required number migration, and ongoing provider costs; no project files or vendor materials were consulted.

# Spine Pair Review — ImageSystem

## Overall verdict

The pair records the user-approved boundary at the first incoming WhatsApp message and carries the major privacy, payment, preview, and handoff constraints into the UX. It is not yet a clean implementation contract: the link color has low contrast, component visual and behavioral inventories do not align, and several flows and operational states lack explicit failure handling.

## 1. Flow coverage — thin

Checked source journeys UJ-1 and UJ-2, capabilities CAP-1–CAP-7, and functional requirements FR-1–FR-44. Five Key Flows cover the main customer, preview, support, and data-rights paths; the later user decision to start at the first inbound WhatsApp message correctly supersedes the source's Instagram entry point.

### Findings
- **medium** Key Flows do not preserve the source journey IDs or fully use the required flow shape: Flow 1 approximates UJ-1 without the `UJ-1` label; Flow 4 addresses UJ-2 but has a different title; Flows 2, 3, and 5 have no numbered steps, and none has an explicit failure path despite applicable photo, Pix, preview, and delivery failures (EXPERIENCE.md:142–188; PRD §2.3). *Fix:* retain the user-approved WhatsApp start, label the mapped journeys with their source IDs, and give each flow numbered steps, a climax, and applicable recovery paths.
- **medium** Requirement traceability is not explicit: CAP-1–CAP-7 and FR-1–FR-44 have no ID-to-flow mapping in the spine, so a consumer cannot verify requirement coverage from the five narratives (EXPERIENCE.md:142–188; spec §Capabilities; PRD §4). *Fix:* add compact source-ID references to the relevant flows or a small coverage map; keep implementation-only requirements out of customer narratives.

## 2. Token completeness — thin

All color tokens have valid hex values; typography, radius, component tokens, and every `{path.to.token}` reference resolve against DESIGN.md frontmatter. No dark-mode pair is required by the declared web-panel scope. Contrast is described as something to verify, but no target or verified load-bearing pair is recorded.

### Findings
- **high** `components.link` uses `{colors.verde}` (`#58C411`) without a safe background or alternate text color. Its calculated contrast is 2.25:1 on white and 1.82:1 on `{colors.fundo}`; the current color-role definition therefore leaves ordinary link text materially under-specified (DESIGN.md:11–16, 36, 60, 66, 93). *Fix:* choose a text color that meets the product's stated contrast target on each allowed surface, or reserve this token for non-text emphasis and define an accessible link treatment.

## 3. Component coverage — thin

DESIGN.md defines six frontmatter component tokens and describes panel inbox and native WhatsApp presentation. EXPERIENCE.md has useful behavioral rules for conversational patterns and partner-panel tasks, but the names and coverage do not form a matching visual-and-behavioral inventory.

### Findings
- **high** `botao-principal`, `titulo-painel`, `link`, `texto-corpo`, `superficie-painel`, and `superficie-cartao` have no matching behavioral entries in Component Patterns; conversely, the escalation card, service detail, order states, and operations have no corresponding visual component rules beyond generic colors and surfaces (DESIGN.md:27–44, 91–97; EXPERIENCE.md:71–90). The inbox/card specs omit appearance and interaction states such as focus, disabled, loading, and severity treatment. *Fix:* use a shared component-name inventory and give every listed component a concise visual rule in DESIGN plus a behavioral rule in EXPERIENCE, or explicitly mark inherited/native components and their source.

## 4. State coverage — thin

The state section covers consent and eligibility, verified payment, preview approval, generation and delivery, cost blocking, human handoff, privacy requests, and unknown policy/state. It does not complete state coverage for the customer conversation or the partner panel.

### Findings
- **medium** Panel surfaces have no empty-inbox, cold-load, load/error, offline, access-denied, or already-assigned/conflict treatment; customer recovery for invalid photos, failed Pix creation, and transient WhatsApp send failure is also absent from the state patterns (EXPERIENCE.md:51–57, 93–102; PRD FR-7, FR-12, FR-20–21, FR-37). *Fix:* add states only where applicable to each IA surface, with recovery/action and truthful customer-facing status.

## 5. Visual reference coverage — adequate

`imports/`, `.working/`, and the workspace contain no mockup or wireframe files, so there are no local visual-reference orphans. AbacatePay is named and its design guide is present in DESIGN.md sources; EXPERIENCE.md states which principles it borrows and what must not be copied.

### Findings
- **low** The AbacatePay reference is linked only in DESIGN.md frontmatter, not inline beside the visual rationale; EXPERIENCE.md names it without a direct link, and neither spine states once that the spines win on conflict (DESIGN.md:5–8, 48–52; EXPERIENCE.md:133–136). *Fix:* link the guide inline at the relevant reference sections and add one explicit conflict-resolution sentence.

## 6. Bloat & overspecification — adequate

DESIGN.md stays mostly concise and avoids unsupported pixel detail. EXPERIENCE.md is relevant to downstream behavior, but repeats the same price, retention, consent, likeness, and human-response constraints across Foundation, IA, Component Patterns, State Patterns, and Key Flows.

### Findings
- **low** Repeated policy text creates multiple places to keep synchronized, especially the open retention and price decisions (EXPERIENCE.md:28–37, 42–49, 73–82, 142–168, 190). *Fix:* keep the authoritative rule once and have flows demonstrate only the decision point and its customer-visible consequence.

## 7. Inheritance discipline — thin

The three file sources in each spine resolve to the root PRD, spec, and addendum; the external design-guide URL is well-formed. The user-approved WhatsApp boundary is recorded in `.memlog.md` and the spine. Token references resolve, but source naming and terminology are not fully inherited.

### Findings
- **medium** Source journey names are not carried verbatim as IDs in the UX flows, and the source PRD's glossary is not mirrored or otherwise declared shared; downstream readers cannot confirm exact journey/term inheritance from the spine pair (PRD §2.3 and §3; EXPERIENCE.md:142–188). *Fix:* retain UJ-1/UJ-2 labels and add a compact shared glossary or an explicit pointer to the PRD glossary.

## 8. Shape fit — adequate

DESIGN.md follows the canonical section order. EXPERIENCE.md contains all required defaults in order; Responsive & Platform is justified by WhatsApp plus a web panel, and Inspiration & Anti-patterns is justified by the chosen external visual reference. Added Foundation and IA detail sections earn their place. No shape defect blocks consumption.

## Mechanical notes

- All three local `sources` paths resolve in both frontmatters; AbacatePay's URL is present in DESIGN.md sources.
- Found source labels: UJ-1 and UJ-2 in PRD §2.3; CAP-1–CAP-7 in the spec; FR-1–FR-44 and NFR-1–NFR-8 in the PRD. The addendum distinguishes provisional technical proposals from adopted UX requirements.
- Every color has a hex value; all DESIGN.md and EXPERIENCE.md token references resolve. `rounded.full: 600px` is explicitly marked an assumption for pill actions only.
- `imports/` and `.working/` are empty; there are no `mockups/` or `wireframes/` directories/files and no Mermaid diagrams to validate.
- The PRD glossary is not reproduced in either spine; shared-term consistency therefore needs an explicit pointer or glossary.

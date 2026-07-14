# Chem IRL Solutions — platform-first rule, boundary, and integration points

_Last updated: 2026-07-13._ What the Chem IRL Solutions platform is, the
platform-first build rule, where the repo/runtime boundary sits, and every
place this repo touches it.

## What Solutions is

Since the 2026-07-06 pivot, **Chem IRL Solutions is the main business**: the AI
stack that runs this app — support inbox, photo safety, and marketing agents —
deployed for other businesses. In the marketing page's own words: "Every agent
action logged, costed, capped, and kill-switchable." The dating app in this
repo is **tenant #1 and the reference case study**, not the other way around.

## Where it lives

- **Repo:** `NatoDoyle/chem-irl-solutions-platform` — all platform code,
  tenant provisioning, metering, and API contracts.
- **Runtime:** `solutions.chemirl.app`.
- **No platform code lives in this repo.** Platform-side reading for anyone
  working on the boundary: that repo's `docs/CHEM_IRL_TENANT.md` (this app as
  a tenant) and `docs/DOMAINS.md` (domain/routing layout) — both cited in
  `moderate-photo`'s header comments.

## The platform-first build rule

Adopted company-wide 2026-07-06 (the pivot); the master policy is the
platform repo's `docs/suite/TENANCY_POLICY.md` (2026-07-04). **Major new
capabilities — features, workflows, tools, services, agents — are built
multi-tenant on the platform by default and consumed here as a tenant.**
Chem IRL is a software company; this app is the testing ground and the
public case study.

- **Heuristic:** could a second customer plausibly use it? Moderation,
  support intake, AI agents, analytics, notifications, CRM/marketing,
  billing, trust & safety, and admin tooling are platform-shaped.
  Dating-product mechanics/UI, app-specific copy/brand/config, and thin
  tenant-side adapters are app-local by nature.
- **Two valid tenancy shapes** (per the master policy): a **platform
  module** — workspace-scoped rows behind RLS, metered via `usage_events`,
  exposed via the dashboard and/or `api/v1/*` behind workspace API keys
  (`cis_…`) — or a **per-tenant instance** — a dedicated runtime (e.g. an
  agent seat on its own VPS) registered to a workspace in the control plane
  for identity, metering, and kill switches.
- **What the rule forbids:** a new capability wired only to Chem IRL's own
  schema/secrets with no workspace concept — the shape the original
  single-tenant `moderate-photo` had before its cutover.
- **Deviation protocol (default with judgment):** building something
  platform-shaped app-local is allowed when pragmatic, but the PR
  description must say so explicitly ("built app-local because …"). This is
  a default, not a stop-and-ask gate.

## The boundary rule

Repo boundary follows runtime boundary:

- **Belongs here (tenant side):** env-gated calls out to the platform, the
  marketing page, and the data-protection records for those forwards.
- **Belongs in the platform repo:** platform behavior, tenant provisioning,
  metering/billing, agent implementations, and API contract definitions.

## Integration points in this repo

| Touchpoint | Files | Env secrets | Behavior when unset |
|---|---|---|---|
| **Photo moderation cutover** (PR #172) | `supabase/functions/moderate-photo/index.ts` | `PHOTO_PLATFORM_URL` (e.g. `https://solutions.chemirl.app/api/v1/moderate`) + `PHOTO_PLATFORM_KEY` (workspace key, `cis_…`) | Direct Anthropic call |
| **Support intake forwarding** (PR #170) | `supabase/functions/support-submit/index.ts` | `SUPPORT_AGENT_INTAKE_URL` + `SUPPORT_AGENT_INTAKE_KEY` (`Authorization: Bearer`) | Row stored in Supabase only; no forward |
| **Marketing page + inquiry form** (PR #171) | `web/src/app/solutions/page.tsx`, `web/src/components/SolutionsInquiryForm.tsx`, footer link in `web/src/components/Footer.tsx` | — (static page) | n/a |
| **Data-protection record** (PR #174) | [`docs/operations/DPIA.md`](./operations/DPIA.md) §2.6 "First-party forwards to the Chem IRL Solutions platform" | — | n/a |

Notes:

- **Photo moderation** is a metered tenant call when both secrets are set;
  **any platform failure falls back to direct Anthropic**, so the cutover can
  never reduce availability. Toggle = set/unset the two secrets.
- **Support forwarding** is strictly best-effort: the Supabase
  `support_submissions` row remains the system of record whether or not the
  forward to the platform's support-agent intake succeeds. Solutions-page
  inquiries post through the same function (`kind=contact`,
  `topic=partnership`).
- **DPIA §2.6** documents both forwards as first-party processing; the open
  item on platform-side regions/retention (GAP-8) is tracked in the DPIA, not
  here.

## What does NOT touch the platform (as of 2026-07-09)

- **Deliberately exempt:** Iris (`iris-chat`/`iris-forget`) stays app-local —
  it *is* the dating product's surface, and by prior decision it remains a
  purely additive, opt-in in-app feature. At most the platform later harvests
  its skeleton (streaming, memory, entitlements), never the feature itself.
- **Platform-shaped candidates, app-local today:** analytics
  (`analytics_events`, Supabase-native per decision D1), push notifications
  (`push`), IAP/billing (`validate-receipt`/`validate-subscription` + the
  token economy), and account deletion/GDPR flows (`delete-account`). These
  are direct Supabase/Anthropic today; each is a migration candidate under
  the build rule above.
- **Out of scope per the master policy:** the waitlist funnel (`waitlist-*`
  functions) is consumer-app plumbing, not a product — a candidate only if
  the platform ever grows a generic lifecycle-email module.
- **Per-tenant instances elsewhere:** the CMO/CSO agent ("Alex") runs on its
  own VPS ([OPENCLAW_CMO_VPS.md](./infrastructure/OPENCLAW_CMO_VPS.md),
  [OPENCLAW_CSO.md](./infrastructure/OPENCLAW_CSO.md)) — Chem IRL's instance
  is seat #1 of the platform's marketing/outbound seat offering;
  control-plane registration waits on the platform's seat registry.
  Since 2026-07-10 the platform ships a multi-tenant **Lead Engine** module
  (platform PRs #39/#41; its `docs/suite/LEAD_ENGINE.md`): at cutover the
  CSO's source→enrich→qualify→draft half becomes a platform API consumer
  (adapter staged platform-side as `docs/suite/examples/cso-platform-adapter.py`),
  while the send half stays on the seat, draft-only. Arming is owner-only
  (workspace `cis_` key — tracked in the master manual-tasks file).

## Migrating existing app-local capabilities

Opportunistic, not big-bang. Migrate a candidate when (a) it is next up for
major work anyway, (b) the platform grows the matching module, or (c) a
paying tenant needs it. Cutovers follow the `moderate-photo` template:
env-gated (secrets unset = zero behavior change), fail-open to the existing
app-local path, platform provenance recorded in audit rows. No rewrites for
their own sake.

## Maintenance

When adding a new tenant-side touchpoint (a new call out to
`solutions.chemirl.app`), update **this doc** and **DPIA §2.6** (plus its
Article 30 register rows) in the same change, and keep the env-gated +
fail-open pattern unless there is a strong reason not to. When a capability
moves between the lists above, update the inventory section and its date.

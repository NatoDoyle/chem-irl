# Chem IRL Solutions — platform boundary and integration points

_Last updated: 2026-07-09._ What the Chem IRL Solutions platform is, where the
repo/runtime boundary sits, and every place this repo touches it.

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

## What does NOT touch the platform

The waitlist funnel (`waitlist-*` functions), Iris (`iris-chat`/`iris-forget`),
IAP validation (`validate-receipt`/`validate-subscription`), `push`, and
`delete-account` are all direct Supabase/Anthropic — no platform involvement.

## Maintenance

When adding a new tenant-side touchpoint (a new call out to
`solutions.chemirl.app`), update **this doc** and **DPIA §2.6** in the same
change, and keep the env-gated + fail-open pattern unless there is a strong
reason not to.

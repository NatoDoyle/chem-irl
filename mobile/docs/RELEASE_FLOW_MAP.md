# Mobile Release & Staging Flow Map

There are four operational checklists in this folder. They're intentionally **separate** — each covers a distinct stage with different preconditions and cadence. This map says **when to use which**, so you don't read all four to find the one you need.

## At a glance

| You're doing… | Use | Cadence |
|---|---|---|
| Setting up a brand-new Supabase project (staging or prod) | [STAGING_SETUP_FINAL_CHECKLIST.md](./STAGING_SETUP_FINAL_CHECKLIST.md) | Once per environment |
| Configuring the Supabase dashboard step-by-step (email/phone providers) | [SUPABASE_DASHBOARD_CHECKLIST.md](./SUPABASE_DASHBOARD_CHECKLIST.md) | Reference, as needed |
| Verifying just the OTP email template is code-only | [SUPABASE_OTP_TEMPLATE_CHECKLIST.md](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) | Quick check |
| Shipping a build to TestFlight / the stores | [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | Every release |

## Typical sequence

1. **First-time environment setup** → [STAGING_SETUP_FINAL_CHECKLIST.md](./STAGING_SETUP_FINAL_CHECKLIST.md) (DB migrations + dashboard config, end to end).
   - Need more detail on a dashboard step? → [SUPABASE_DASHBOARD_CHECKLIST.md](./SUPABASE_DASHBOARD_CHECKLIST.md) (the reference-level version).
   - Only the email template is wrong? → [SUPABASE_OTP_TEMPLATE_CHECKLIST.md](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) (the focused subset).
2. **Every release** → [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) (pre-build gates + full smoke test + Sentry/storage verification).

## Why these aren't merged into one

`STAGING_SETUP` and the two Supabase checklists are **one-time / reference** environment setup; `RELEASE_CHECKLIST` runs **every build** and validates the app itself. Merging them would force a per-release reader to wade through one-time dashboard setup, and a setup reader to wade through smoke-test steps. They overlap on the "email OTP must be code-only" requirement by design, so each stays usable standalone.

> Auth is **email OTP code entry** — no magic links. The Supabase checklists exist to keep the confirmation email code-only (`{{ .Token }}`, no links).

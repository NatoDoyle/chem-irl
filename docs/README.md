# Documentation Index

Organized documentation for the Chem IRL dating app.

> **Start here:** the root [`../README.md`](../README.md) (project overview + quick start) and [`../CLAUDE.md`](../CLAUDE.md) — the authoritative reference for architecture, workflow, and conventions. The product definition lives in [`../brand/PRODUCT.md`](../brand/PRODUCT.md).

## Setup

- **[Database Setup](./setup/DATABASE_SETUP.md)** — schema bootstrap and migration workflow
- **[Supabase Setup](./setup/SUPABASE_SETUP.md)** — how the static marketing site connects to Supabase (anonymous edge functions + publishable key)
- **[Cloudflare Email Routing](./setup/POSTMARK_CLOUDFLARE_SETUP.md)** — email routing (note: transactional email now uses Resend, not Postmark — see the file's banner)

## Development

- **[Development Guide](./development/DEVELOPING.md)** — local environment setup, copy-paste commands
- **[Git Push Troubleshooting](./development/GIT_PUSH_TROUBLESHOOTING.md)**

## Deployment

- **[Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md)**
- **[Deployment Checklist](./deployment/DEPLOYMENT_CHECKLIST.md)**
- **[Vercel Single-Project Setup](./deployment/VERCEL_SINGLE_PROJECT_SETUP.md)**
- **[Deployment Troubleshooting](./deployment/DEPLOYMENT_TROUBLESHOOTING.md)**

## Infrastructure

- **[Cloudflare Setup](./infrastructure/CLOUDFLARE_SETUP.md)**
- **[OpenClaw CMO VPS](./infrastructure/OPENCLAW_CMO_VPS.md)** — Hetzner box running the OpenClaw agent platform + Autonomous CMO (architecture, current state, go-live runbook, improvements)
- **[OpenClaw CSO](./infrastructure/OPENCLAW_CSO.md)** — Alex's autonomous LinkedIn sales pipeline on the same box (sourcing → qualify → draft → dry-run send)
- **[Security Audit](./infrastructure/SECURITY_AUDIT.md)**

## Operations (launch + trust & safety)

- **[Moderation Runbook](./operations/MODERATION_RUNBOOK.md)** — how reports are received, triaged, and actioned; 24h SLA queries; enforcement + durable-ban procedure
- **[App Review Compliance Pack](./operations/APP_REVIEW_COMPLIANCE.md)** — dating/UGC App Review checklist mapped to shipped features; reviewer-notes script; the OTP demo-account setup
- **[DSAR Runbook](./operations/DSAR_RUNBOOK.md)** — GDPR access/portability/erasure handling, with the per-user export query
- **[DPIA + Article 30 Records](./operations/DPIA.md)** — mandatory data-protection impact assessment (special-category data + profiling + location) and the processing-activities register; DRAFT for DPO/legal review

## Per-app & data docs

- **[Mobile App README](../mobile/README.md)** — plus detailed guides in [`../mobile/docs/`](../mobile/docs/README.md)
- **[Website README](../web/README.md)**
- **[Database Automation](../db/AUTOMATION.md)** — pg_cron jobs (reference; the deployed jobs live in `supabase/migrations/`)
- **[Chem IRL Solutions boundary](./SOLUTIONS_PLATFORM.md)** — what the Solutions platform is, the repo/runtime boundary, and this repo's tenant-side integration points

## Plans & feature docs (point-in-time — read with caution)

- **[Dublin Launch Plan](./DUBLIN_LAUNCH_PLAN.md)** — GTM strategy; active reference for marketing work
- **[Autonomous CMO](./superpowers/)** — design spec + implementation plan (in-flight); as-built VPS doc under [Infrastructure](./infrastructure/OPENCLAW_CMO_VPS.md)

## Archive

Historical and superseded documents live in [`./archive/`](./archive/), kept for reference only. **If anything there conflicts with the current code or the active docs above, the active source wins.**

## Validating links

```bash
bun run docs:check
```

Checks all markdown links (excluding `archive/`) and reports broken ones.

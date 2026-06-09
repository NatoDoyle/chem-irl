# Documentation Index

Organized documentation for the Chem IRL dating app.

> **Start here:** the root [`../README.md`](../README.md) (project overview + quick start) and [`../CLAUDE.md`](../CLAUDE.md) — the authoritative reference for architecture, workflow, and conventions. The product definition lives in [`../brand/PRODUCT.md`](../brand/PRODUCT.md).

## Setup

- **[Database Setup](./setup/DATABASE_SETUP.md)** — schema bootstrap and migration workflow
- **[Supabase Setup](./setup/SUPABASE_SETUP.md)** — Supabase connection for the web/Vercel app
- **[Cloudflare Email Routing](./setup/POSTMARK_CLOUDFLARE_SETUP.md)** — email routing (note: transactional email now uses Resend, not Postmark — see the file's banner)

## Development

- **[Development Guide](./development/DEVELOPING.md)** — local environment setup, copy-paste commands
- **[Git Push Troubleshooting](./development/GIT_PUSH_TROUBLESHOOTING.md)**
- **[Repo State Explanation](./development/REPO_STATE_SYSTEM_EXPLANATION.md)** — system overview (partially superseded; see its banner)

## Deployment

- **[Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md)**
- **[Deployment Checklist](./deployment/DEPLOYMENT_CHECKLIST.md)**
- **[Vercel Single-Project Setup](./deployment/VERCEL_SINGLE_PROJECT_SETUP.md)**
- **[Deployment Troubleshooting](./deployment/DEPLOYMENT_TROUBLESHOOTING.md)**

## Infrastructure

- **[Cloudflare Setup](./infrastructure/CLOUDFLARE_SETUP.md)**
- **[Security Audit](./infrastructure/SECURITY_AUDIT.md)**

## Per-app & data docs

- **[Mobile App README](../mobile/README.md)** — plus detailed guides in [`../mobile/docs/`](../mobile/docs/README.md)
- **[Website README](../web/README.md)**
- **[Database Automation](../db/AUTOMATION.md)** — pg_cron jobs (reference; the deployed jobs live in `supabase/migrations/`)

## Plans & feature docs (point-in-time — read with caution)

- **[Dublin Launch Plan](./DUBLIN_LAUNCH_PLAN.md)** — GTM strategy; active reference for marketing work
- **[Iris — Phase 1 Verification](./iris/PHASE_1_VERIFICATION.md)** — AI-concierge feature checkpoint
- **[Autonomous CMO](./superpowers/)** — design spec + implementation plan (in-flight)

## Archive

Historical and superseded documents live in [`./archive/`](./archive/), kept for reference only. **If anything there conflicts with the current code or the active docs above, the active source wins.**

## Validating links

```bash
bun run docs:check
```

Checks all markdown links (excluding `archive/`) and reports broken ones.

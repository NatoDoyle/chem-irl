# Contributing to Chem IRL

A human-friendly entry point. The authoritative, detailed reference is **[CLAUDE.md](./CLAUDE.md)** — this file summarizes it and links out; where they differ, CLAUDE.md wins.

## Where things live

- **[README.md](./README.md)** — project overview and quick start
- **[CLAUDE.md](./CLAUDE.md)** — architecture, conventions, and workflow (the source of truth)
- **[docs/](./docs/README.md)** — setup, development, deployment, and infrastructure guides
- **[brand/PRODUCT.md](./brand/PRODUCT.md)** — what Chem IRL is and isn't (the product contract)
- **[mobile/README.md](./mobile/README.md)** and **[web/README.md](./web/README.md)** — per-app guides
- **[agent_docs/](./agent_docs/README.md)** — short, task-specific working rules

## Prerequisites

- **bun** — the package manager and task runner. **Do not use `npm`** (see Package Management in CLAUDE.md).
- **Supabase CLI** (`supabase`) — migrations and schema work.
- **GitHub CLI** (`gh`) — pull requests and reviews.

## Git workflow (worktree-first)

`main` is integration-only and is never edited directly. Every change goes in its own git worktree off fresh `origin/main`:

```bash
git fetch origin --prune
git worktree add -b <type>/<desc> .worktrees/<type>-<desc> origin/main
cd .worktrees/<type>-<desc>
```

- Branch and commit prefixes: `fix:`, `feat:`, `chore:`, `test:`, `docs:`.
- One logical change per commit; open a PR and **squash-merge**.
- Bootstrapping a worktree, stacked PRs, and cleanup are covered in **[agent_docs/git_workflow.md](./agent_docs/git_workflow.md)** and the Git workflow section of [CLAUDE.md](./CLAUDE.md).

## Quality gates

Run the checks relevant to what you changed. For the mobile app (from `mobile/`):

```bash
bun run lint -- --max-warnings 0
bun run type-check
bun run test:unit        # NOT bare `bun test` — that segfaults; see CLAUDE.md
bun run format:check
```

For docs, validate links from the repo root with `bun run docs:check`. More detail in **[agent_docs/validation.md](./agent_docs/validation.md)**.

## High-risk areas — read first

Schema, auth, ranking logic, and production-facing flows are high-risk. Before touching them:

- Database / migrations / RLS / RPCs → **[agent_docs/supabase_safety.md](./agent_docs/supabase_safety.md)**. Treat `supabase/migrations/` as the deployed source of truth; the `db/*.sql` files are reference snapshots that may lag.
- Brand colors, fonts, or copy → edit `brand/tokens.ts`, then run `bun run brand:tokens` (never hand-edit the generated `brand.ts` / `globals.css` files).

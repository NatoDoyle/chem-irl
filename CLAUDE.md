# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Chem IRL is a dating app optimized for real-world follow-through and reduced time-to-date, not endless in-app engagement. Core mechanic: users propose 2-3 specific meeting times within 7 days; proposals expire after 72 hours.

## Repo map

- `mobile/` — React Native (Expo SDK 54) client (primary product)
- `supabase/` — database migrations (authoritative for deployed state), edge functions, config
- `db/` — reference SQL files (schema, RLS, RPCs, triggers, scoring). These are canonical design docs but may lag behind applied migrations; treat `supabase/migrations/` as the source of truth for what's deployed.
- `web/` — static Next.js marketing site, deployed to Vercel as static export
- `docs/` — product, architecture, and implementation docs. Sub-areas: `docs/setup/` (env + Supabase bootstrap), `docs/deployment/`, `docs/development/`, `docs/infrastructure/`. Top-level files like `DUBLIN_LAUNCH_PLAN.md`, `PAYMENT_PROCESSOR_PLAN.md`, and dated drift reports (e.g. `SUPABASE_MIGRATION_DRIFT_*.md`) are point-in-time records — read with caution.
- `agent_docs/` — task-specific agent instructions
- `scripts/` — root-level utility scripts (markdown link checker, test email sender)

## Package Management

- Use `bun` instead of `npm` for all package operations (install, add, remove, run, etc.)
- Never use `npm install`, `npm run`, or any `npm` CLI commands.
- If a README, guide, or any project documentation references `npm`, update it to use `bun` so the docs stay consistent and up to date.

## Available tools (CLIs and MCP)

Prefer these over writing instructions for the user to run by hand. The default should be "I'll do it via the CLI/MCP," not "go do this in a web dashboard."

- **Supabase CLI (`supabase`)** — installed and on PATH. Use it for migration and schema work:
  - `supabase migration list --linked` — see which timestamps are applied on the linked project (replaces manual `SELECT … FROM supabase_migrations.schema_migrations`).
  - `supabase migration new <slug>` — scaffold a new migration with a non-colliding timestamp.
  - `supabase db diff --linked --schema public` — preview what a local migration will change on the remote.
  - `supabase db push` — apply local migrations to the linked project (only when the user has approved the change).
  - `supabase functions deploy <name>` — deploy edge functions in `supabase/functions/`.
- **Supabase MCP** — `mcp__claude_ai_Supabase__*` tools (`list_projects`, `execute_sql`) may be loaded in the session for read-only checks. If available, use them for one-off queries against the live DB. Treat MCP-issued SQL as production access: read-only by default, mutations only with explicit approval.
- **GitHub CLI (`gh`)** — installed and on PATH. Use for PRs, issues, runs: `gh pr create`, `gh pr view --comments`, `gh run list`, `gh run watch`, `gh issue list`.
- **bun** — see Package Management above.
- **Expo MCP** — `expo-mcp` is configured at the project scope; use it for Expo-specific introspection if it loads in the session.

Manual Dashboard / web-UI steps should only appear in instructions when the action is destructive, requires SSO/2FA, or genuinely cannot be scripted.

## Build and development commands

### Mobile app (run from `mobile/`)
```bash
bun install              # install dependencies
bun start                # start Expo dev server
bun run ios              # start on iOS simulator
bun run android          # start on Android emulator
```

### Quality gates (run from `mobile/`)
```bash
bun run lint -- --max-warnings 0   # ESLint (zero warnings enforced)
bun run type-check                 # TypeScript strict check (tsc --noEmit)
bun test                           # unit tests (jest, node environment)
bun run format:check               # Prettier check
```

### Running a single test
Default `bun test` runs the unit (node) suite only. RN component tests require `bun run test:native` (or the explicit `jest.native.config.js` invocation) — they will not run via `bun test`.
```bash
cd mobile && bunx jest -c jest.unit.config.js --testPathPattern="<pattern>"   # unit (node)
cd mobile && bunx jest -c jest.native.config.js --testPathPattern="<pattern>" # RN component (jest-expo)
```

### Other useful mobile commands
```bash
bun run lint:fix             # auto-fix lint issues
bun run format               # auto-format all files
bun run check:env            # validate .env configuration
bun run use:staging          # switch to staging Supabase env
bun run use:production       # switch to production Supabase env
bun run test:native          # React Native component tests (jest-expo)
bun run verify:staging       # smoke-test the staging Supabase project
bun run test:beta:smoke:new  # scaffold a new beta smoke-test run log
```

### Root-level
```bash
bun run docs:check       # validate markdown links across docs
```

### Web app (run from `web/`)
```bash
bun install              # install dependencies
bun run dev              # next dev (localhost:3000)
bun run build            # next build + pagefind index → ./out
bun run lint             # ESLint (eslint-config-next)
bun run type-check       # tsc --noEmit
```

The web build emits a static export (`output: 'export'`) and runs `pagefind` against `out/` for client-side blog search. There are no API routes — anything dynamic goes through Supabase edge functions.

## Architecture

### Mobile app structure (`mobile/src/`)
- **`navigation/`** — Three navigators: `AuthNavigator` (login/signup), `OnboardingNavigator` (profile setup), `MainNavigator` (main app with bottom tabs)
- **`screens/`** — Organized by feature: `auth/`, `onboarding/`, `discover/`, `matches/`, `profile/`, `debug/`
- **`lib/`** — Shared utilities and service modules (auth, analytics, notifications, image compression, offline queue, Supabase client, Sentry, IAP via `iap.ts` + `tokens.ts`, availability/timezone helpers, error normalization). The app has a paid token economy — see `iap.ts`, `tokens.ts`, `components/TokenPurchaseModal.tsx`, and the `validate-receipt` edge function.
- **`lib/supabase/client.ts`** — Single Supabase client instance, imported throughout the app. Uses a custom `LargeSecureStore` that encrypts session tokens with AES-256 (key in SecureStore, ciphertext in AsyncStorage) to work around Expo SecureStore's 2048-byte value limit.
- **`config/brand.ts`** — Brand colors (aquamarine palette), design tokens, and user-facing copy
- **`contexts/`** — React contexts (e.g., `ProfileRefreshContext`)

### App navigation flow (`App.tsx`)
The root component determines which navigator to show based on auth + profile state:
1. No session **or** `signup_completed` is false → `AuthNavigator`
2. Session exists, signup completed, but `completion_pct < 100` → `OnboardingNavigator`
3. Session + `signup_completed` + `completion_pct >= 100` → `MainNavigator` (Discover, Matches, Profile tabs)

Auth uses **OTP code entry**, not magic links.

### Key schema gotchas
- The live `profiles` table uses **`id`** as its primary key (mapped to `auth.users.id`). Queries use `.eq('id', session.user.id)`. The reference `db/schema.sql` may still reference `user_id`; always check the actual migration or running schema.
- `signup_completed` (boolean) and `completion_pct` (integer) are separate checks — a user can have a session and an incomplete signup (e.g., email verified but name not entered).
- The `ensureProfileExists()` helper in `lib/profile.ts` auto-creates a profile row if one doesn't exist for the authenticated user.

### Main tab navigator (`MainNavigator`)
- **Discover** — swipe-based discovery feed
- **Matches** — stack navigator with MatchesList → MatchDetail → Propose → Chat
- **Profile** — user profile management
- **Debug** — dev-only tab (`__DEV__` gate)

### Backend
No separate backend server. The mobile app connects directly to Supabase (PostgreSQL + Auth + RLS + Realtime + Storage). Business logic lives in:
- RLS policies (row-level security on all tables)
- PostgreSQL functions/RPCs (called via `supabase.rpc()`)
- Edge functions (`supabase/functions/`) for server-side logic like push notifications
- Database triggers (auto-create profile on signup, etc.)
- Scheduled jobs via `pg_cron` (e.g. periodic scoring rollups)

### Web app structure (`web/src/`)
- **`app/`** — Next.js 16 App Router routes: landing, `download/`, `how-it-works/`, `waitlist/`, `blog/` (MDX), plus `about/`, `privacy/`, `safety/`, `terms/`. Static export only — no API routes.
- **`content/`** — MDX blog posts; rendered via `next-mdx-remote` + `gray-matter` + `rehype-pretty-code`.
- **`components/`** — Marketing components (`Nav`, `Footer`, `WaitlistForm`, `PhoneMockup`, `SentryInit`, `blog/*`).
- Waitlist flow: form posts to the `waitlist-signup` edge function → confirmation email → `waitlist-confirm` GET link → optional `waitlist-forget` for GDPR erasure. Blog sidebar uses `waitlist-blog-subscribe`.

### Edge functions (`supabase/functions/`)
- `push` — sends push notifications. Webhook endpoint; `verify_jwt = false`, authenticates via `x-webhook-secret`.
- `validate-receipt` — validates iOS/Android IAP receipts.
- `waitlist-signup`, `waitlist-confirm`, `waitlist-forget`, `waitlist-blog-subscribe` — anonymous-callable from the marketing site; all have `verify_jwt = false` in `supabase/config.toml` and use a service-role client to call SECURITY DEFINER RPCs. Don't re-enable JWT verification without rerouting the callers.

### Testing
Two Jest configurations:
- `jest.unit.config.js` — unit tests in `src/lib/__tests__/` and `src/config/__tests__/` (node environment, default via `bun test`)
- `jest.native.config.js` — React Native component tests (jest-expo preset)

### Environment
Mobile app uses `EXPO_PUBLIC_*` env vars loaded via Expo. See `mobile/.env.example` for required variables (Supabase URL/key, Sentry DSN).

## Core working principles

- Make the smallest possible diff that achieves the requested outcome.
- Do not delete, rename, move, or "clean up" files unless explicitly asked.
- Do not refactor unrelated code for style or quality.
- If a change would touch more than 5 files, or would delete/rename files, stop and ask before proceeding.
- If multiple independent changes are needed, keep them separate and do not mix concerns.

## TypeScript Style

- Never use `enum`. Use `as const` objects with derived union types instead.
- Always prefer literal union types over broad primitives like `string`, `number`, or `boolean` when the set of values is known.
- Example:
```ts
  // Do this
  const Status = { Active: 'active', Inactive: 'inactive' } as const;
  type Status = (typeof Status)[keyof typeof Status];

  // Also good for simple cases
  type Direction = 'up' | 'down' | 'left' | 'right';

  // Never this
  enum Status { Active = 'active', Inactive = 'inactive' }

  // Too loose when values are known
  type Direction = string;
```

## Project safety rules

- Follow existing patterns before introducing new abstractions.
- Treat schema, auth, ranking logic, and production-facing flows as high-risk areas; read the relevant docs before changing them.
- Never modify an already-applied Supabase migration. To check whether a migration is applied, run `supabase migration list --linked` (preferred) or query `supabase_migrations.schema_migrations` via the Supabase MCP / CLI. If the timestamp appears in the applied list, create a new timestamped migration instead.
- Before adding a new migration, check `supabase/migrations/` for an existing file with the same timestamp prefix. Two files sharing a `YYYYMMDDHHMMSS` prefix will collide; pick the next minute (or second) instead. Use `supabase migration new <slug>` to avoid this. See commit `fe85dd6` for the prior incident.
- Do not change an existing RPC/function return shape in place; create a versioned replacement such as `_v2` and update callers.
- When changing PostgREST RPC-related functions or exposed schema behavior, account for schema cache reload requirements (include `SELECT pg_notify('pgrst','reload schema');` in migrations).
- RLS: `upsert` with `onConflict` can trigger UPDATE, so an UPDATE policy is required for that path.

## Git workflow

- Never work directly on `main`. Create a branch per task: `fix/<desc>`, `feat/<desc>`, `chore/<desc>`.
- Before starting work: `git fetch origin --prune`, checkout main, `git pull --ff-only origin main`, ensure `git status --porcelain` is clean.
- Commit prefixes: `fix:`, `feat:`, `chore:`, `test:`, `docs:`
- One logical change per commit; no mixed concerns.
- Prefer PR + squash merge. Do not merge into `main` locally.
- If `main` diverges from `origin/main`, stop and ask before resolving.
- Keep at most 3 active WIP branches. Merged branches should be deleted; abandoned branches should be tagged (`archive/<branch>`) then deleted.
- Read `agent_docs/git_workflow.md` for full details.

### Enforcement hooks
`.claude/hooks/` runs on `PreToolUse` to enforce the rules above:
- `block-edit-on-main.sh` — blocks `Edit`/`Write`/`NotebookEdit` when the target file's working tree is on `main` (worktree-aware: resolves the branch from the file's directory, not the shell CWD).
- `block-push-to-main.sh` — blocks `git push` when the shell's CWD is on `main`.
- `enforce-branch-hygiene.sh` — runs on `git checkout -b` / `git switch -c`; blocks if the working tree is dirty or warns if the local branch count exceeds 5.

If a hook blocks a tool call, the fix is almost always "create or switch to a feature branch first," not bypassing the hook.

### Worktrees (parallel feature work)

Use git worktrees when working on two or more features in parallel across separate terminals. Each worktree is a full working copy with its own checked-out branch.

**Where they live:** `.worktrees/<branch-with-slash-as-dash>/` at the repo root. The directory is gitignored. Convention: branch `feat/mobile-ux-fixes` → worktree `.worktrees/feat-mobile-ux-fixes/`.

**Create a worktree (branch off fresh `origin/main` by default):**
```bash
git fetch origin --prune
git worktree add -b feat/<desc> .worktrees/feat-<desc> origin/main
cd .worktrees/feat-<desc>
```
Exception: if this worktree's code depends on another open PR's code, branch off that PR's branch instead. See **Stacked PRs** below.

**Bootstrap each worktree.** `node_modules` and `.env*` files do not carry over (the former is gitignored, and Expo/RN native modules don't symlink reliably). Per worktree:
```bash
cp ../../mobile/.env.local mobile/.env.local 2>/dev/null || true   # if you have one
cd mobile && bun install                                            # or: cd web && bun install
```

**Avoid dev-server port collisions when running two worktrees at once:**
```bash
cd mobile && bun start --port 8082         # Metro defaults to 8081
cd web && bun run dev -- -p 3001            # Next.js defaults to 3000
```

**Cleanup after merge:**
```bash
git worktree remove .worktrees/feat-<desc>
git branch -d feat/<desc>
git push origin --delete feat/<desc>
```
For abandoned work: `git worktree remove --force` + `git branch -D` (tag `archive/<branch>` first if you want a recovery point).

**Hygiene:**
- Keep ≤3 active worktrees (same limit as branches).
- `git worktree list` to inspect; `git worktree prune` to clean up stale registrations after a manual directory delete.
- Enforcement hooks (`.claude/hooks/`) work per-worktree automatically — they resolve the branch from the file's directory.

### Stacked PRs (when one PR's code depends on another)

When a PR's code imports or otherwise depends on a file introduced in another open PR, branch the dependent PR off its prerequisite's feature branch — **not** off `origin/main`. Otherwise the dependent PR's CI will fail with `Cannot find module …` (or equivalent) until the prerequisite merges and the dependent is rebased.

**Creating a stack:**
```bash
git fetch origin --prune
# PR A (the prerequisite — independent)
git worktree add -b feat/<topic>-base .worktrees/feat-<topic>-base origin/main
# PR B (the dependent — based on A, not main)
git worktree add -b feat/<topic>-dependent .worktrees/feat-<topic>-dependent feat/<topic>-base
```

When opening PRs from a stack, set the dependent PR's base to its prerequisite's branch in the GitHub UI (or `gh pr create --base feat/<topic>-base`), so reviewers see only the incremental diff.

**Recovery if a stack is already pushed against `main` and CI is red:**
1. Merge the prerequisite PR first.
2. Run `gh pr update-branch <num>` on each dependent — this merges `main` into the PR branch and retriggers CI with the dependency in place.
3. Once green, merge that one. Repeat for the next layer.

The "≤3 active worktrees" rule counts the whole stack against the limit, not each level separately.

## How to work

Before making changes, first identify the authoritative files for the feature being touched.

Read only the docs relevant to the task:
- `agent_docs/git_workflow.md` — branch safety, staging, commits, and push rules
- `agent_docs/validation.md` — lint, type-check, test, and format checks
- `agent_docs/supabase_safety.md` — migrations, RLS, RPC/versioning, schema cache notes

## Validation

Run or propose only the validations relevant to the files changed. Prefer root-cause fixes over bypassing checks.

## Reporting and verification discipline

- Never claim a check, build, commit, or push happened unless the relevant command output appears in the current session.
- Banned phrases without proof in the same response: "all checks pass", "tests pass", "committed", "pushed", "verified", "implementation complete".
- If you did not run a command, say so explicitly. If you only inspected files, say "no code changes made".
- When you do run quality gates, paste the actual transcript (or a faithful summary with the exit status), not a description of what they would have shown.
- For commits and pushes, include the SHA from `git log -1 --oneline` and the output of `git status --porcelain`.
- This mirrors the stricter contract in `.cursorrules`; if the two ever conflict, prefer the stricter rule.

## Self-Improvement Protocol

- When you correct an error or override a decision I made, I will propose a new rule to add to this file so the mistake doesn't repeat.
- Format proposed rules as:
```
  📝 Proposed claude.md addition:
  **Section:** [section name]
  **Rule:** [the rule]
  **Reason:** [what went wrong]
```
- I will not auto-edit claude.md — I will always propose and wait for your approval.
- If a proposed rule contradicts an existing one, I will flag the conflict and suggest which to keep.

## Lessons Learned
<!-- Append new lessons here as they're approved -->

### 2026-05-12 — Stacked PRs against `main` red CI on dependents

**What happened:** The `feat/photo-verification` series shipped as 5 PRs (#81–#85), all branched off `origin/main` in parallel worktrees. PRs #84 and #85 imported `mobile/src/lib/photoModeration.ts` from PR #83's branch. CI failed on the dependents' first push with `Cannot find module '../../lib/photoModeration'` because the imported file existed only on #83's branch, not on `main`.

**Why it happened:** "Always branch off fresh `origin/main`" was applied universally — including to PRs that depend on sibling PRs. The CI environment checks out the PR's branch alone, with no knowledge of sibling PRs, so the import failed.

**Resolution:** Merged #81 → #82 → #83 first, then ran `gh pr update-branch 84` to merge updated `main` into #84's branch and retrigger CI. Repeated for #85 after #84 merged.

**Prevention:** See **Stacked PRs** under Git workflow. When a dependent PR imports from a sibling, branch it off the prerequisite's branch with `git worktree add -b feat/<topic>-b .worktrees/feat-<topic>-b feat/<topic>-a` and set its PR base to the prerequisite's branch.

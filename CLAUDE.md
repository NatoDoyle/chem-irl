# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Chem IRL is a dating app optimized for real-world follow-through and reduced time-to-date, not endless in-app engagement. Core mechanic: users propose 2-3 specific meeting times within 7 days; proposals expire after 72 hours.

## Repo map

- `mobile/` — React Native (Expo SDK 54) client (primary product)
- `supabase/` — database migrations (authoritative for deployed state), edge functions, config
- `db/` — reference SQL files (schema, RLS, RPCs, triggers, scoring). These are canonical design docs but may lag behind applied migrations; treat `supabase/migrations/` as the source of truth for what's deployed.
- `web/` — static Next.js marketing site, deployed to Vercel as static export
- `docs/` — product, architecture, and implementation docs
- `agent_docs/` — task-specific agent instructions
- `scripts/` — root-level utility scripts (markdown link checker, test email sender)

## Package Management

- Use `bun` instead of `npm` for all package operations (install, add, remove, run, etc.)
- Never use `npm install`, `npm run`, or any `npm` CLI commands.
- If a README, guide, or any project documentation references `npm`, update it to use `bun` so the docs stay consistent and up to date.

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
```bash
cd mobile && bunx jest -c jest.unit.config.js --testPathPattern="<pattern>"
```

### Other useful mobile commands
```bash
bun run lint:fix         # auto-fix lint issues
bun run format           # auto-format all files
bun run check:env        # validate .env configuration
bun run use:staging      # switch to staging Supabase env
bun run use:production   # switch to production Supabase env
```

### Root-level
```bash
bun run docs:check       # validate markdown links across docs
```

## Architecture

### Mobile app structure (`mobile/src/`)
- **`navigation/`** — Three navigators: `AuthNavigator` (login/signup), `OnboardingNavigator` (profile setup), `MainNavigator` (main app with bottom tabs)
- **`screens/`** — Organized by feature: `auth/`, `onboarding/`, `discover/`, `matches/`, `profile/`, `debug/`
- **`lib/`** — Shared utilities and service modules (auth, analytics, notifications, image compression, offline queue, Supabase client)
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
- Never modify an already-applied Supabase migration. To check if a migration has been applied, run in the Supabase Dashboard SQL Editor: `SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '<timestamp>';` — if it returns a row, create a new timestamped migration instead.
- Do not change an existing RPC/function return shape in place; create a versioned replacement such as `_v2` and update callers.
- When changing PostgREST RPC-related functions or exposed schema behavior, account for schema cache reload requirements (include `SELECT pg_notify('pgrst','reload schema');` in migrations).
- RLS: `upsert` with `onConflict` can trigger UPDATE, so an UPDATE policy is required for that path.

## Git workflow

**STOP. Before ANY file edit, verify you are NOT on `main`.** Run `git rev-parse --abbrev-ref HEAD` and confirm the branch name starts with `fix/`, `feat/`, `chore/`, or `wip/`.

- Never work directly on `main`. Create a branch per task: `fix/<desc>`, `feat/<desc>`, `chore/<desc>`.
- Before starting work: `git fetch origin --prune`, checkout main, `git pull --ff-only origin main`, ensure `git status --porcelain` is clean.
- Commit prefixes: `fix:`, `feat:`, `chore:`, `test:`, `docs:`
- One logical change per commit; no mixed concerns.
- Prefer PR + squash merge. Do not merge into `main` locally.
- If `main` diverges from `origin/main`, stop and ask before resolving.
- Keep at most 3 active WIP branches. Merged branches should be deleted; abandoned branches should be tagged (`archive/<branch>`) then deleted.
- Read `agent_docs/git_workflow.md` for full details.

### Automated enforcement

Claude Code hooks in `.claude/settings.json` enforce critical git rules:
- **Blocked:** Editing files while on `main`
- **Blocked:** `git push` while on `main`
- **Blocked:** Creating a new branch with a dirty worktree
- **Warning:** Creating a new branch when more than 5 local branches exist

If a hook blocks your action, follow its instructions. Do not attempt to bypass hooks.

## How to work

Before making changes, first identify the authoritative files for the feature being touched.

Read only the docs relevant to the task:
- `agent_docs/git_workflow.md` — branch safety, staging, commits, and push rules
- `agent_docs/validation.md` — lint, type-check, test, and format checks
- `agent_docs/supabase_safety.md` — migrations, RLS, RPC/versioning, schema cache notes

## Validation

Run or propose only the validations relevant to the files changed. Prefer root-cause fixes over bypassing checks.

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

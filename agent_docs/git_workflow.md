# Git workflow

> **Default rule:** Every change uses a git worktree. The primary checkout stays on `main`. This file mirrors the worktree-first workflow defined in `CLAUDE.md`; if the two ever drift, `CLAUDE.md` wins.

## Worktree safety
- The primary checkout (the directory `git rev-parse --show-toplevel` reports when run from the repo root) stays on `main`. Never `git checkout` a feature branch in it — the `enforce-branch-hygiene.sh` hook will block `git checkout -b` / `git switch -c` from this directory.
- Every change goes in a worktree at `.worktrees/<branch-with-slash-as-dash>/` (e.g. `feat/foo` → `.worktrees/feat-foo/`).
- Before starting work:
  - `git fetch origin --prune`
  - `git worktree add -b <type>/<short-desc> .worktrees/<type>-<short-desc> origin/main`
  - `cd .worktrees/<type>-<short-desc>`
  - `git status --porcelain` (must be empty)
- If `git status --porcelain` is not empty in a freshly created worktree, something has gone wrong — stop and ask before proceeding.

## Branch naming (applies to the worktree's branch)
- `fix/<short-desc>` for bug fixes
- `feat/<short-desc>` for features
- `chore/<short-desc>` for tooling/docs/maintenance
- `wip/<topic>` for incomplete work that should not yet be merged

## Worktree bootstrap
`node_modules/` and `.env*` files do not carry across worktrees (the former is gitignored; Expo/RN native modules don't symlink reliably). Per worktree:
- Copy env (best effort): `cp ../../mobile/.env.local mobile/.env.local 2>/dev/null || true`
- Install: `cd mobile && bun install` (or `cd web && bun install`)

Avoid dev-server port collisions when running multiple worktrees at once:
- `cd mobile && bun start --port 8082` (Metro defaults to 8081)
- `cd web && bun run dev -- -p 3001` (Next.js defaults to 3000)

## Change isolation
- Make the smallest safe change.
- Do not mix unrelated concerns in one commit.
- Prefer `git add -p` to stage only relevant hunks.
- Review staged changes with `git diff --cached` before committing.

## Atomic commits
- One logical change per commit.
- Commit prefixes:
  - `fix:`
  - `feat:`
  - `chore:`
  - `test:`
  - `docs:`

## Push rules
- First push (from inside the worktree): `git push -u origin <branch>`
- After that: `git push`
- If a non-fast-forward push occurs, stop and ask. Do not auto-merge or auto-rebase without instruction.

## Divergence playbook
If `main` and `origin/main` have diverged:
- From the primary checkout, run:
  - `git fetch origin`
  - `git log --oneline --decorate --graph --left-right main...origin/main`
- Then stop and ask whether to:
  - rebase/merge `origin/main` into a feature worktree, or
  - fast-forward local `main` in the primary checkout to `origin/main`
- Do not choose automatically.

## Main branch stability
- Keep `main` passing the relevant tests/checks.
- Prefer PR + squash merge by default.
- Do not merge into `main` locally unless explicitly instructed.

## Worktree hygiene
- Keep at most 3 active worktrees.
- Before starting new work:
  - `git fetch origin --prune`
  - `git worktree list` (review active worktrees and their branches)
- After a feature merges:
  - `git worktree remove .worktrees/<dir>`
  - `git branch -d <branch>`
  - `git push origin --delete <branch>`
- Abandoned work: `git tag archive/<branch> <sha>` and `git push origin archive/<branch>`, then `git worktree remove --force .worktrees/<dir>` + `git branch -D <branch>`.
- Never delete a worktree or branch unless it is confirmed merged or explicitly archived/tagged first.

## Stacked PRs
When one PR's code depends on another open PR's branch, branch off the prerequisite — not `origin/main`. See the **Stacked PRs** section of `CLAUDE.md` for the full playbook.

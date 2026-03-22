# Git workflow

## Branch safety
- Never work directly on `main`. `main` is for integration only.
- Before starting work:
  - `git fetch origin --prune`
  - `git checkout main`
  - `git pull --ff-only origin main`
  - `git status --porcelain`
- If `git status --porcelain` is not empty, stop and ask whether to restore or stash unrelated changes before proceeding.

## Branch naming
- `fix/<short-desc>` for bug fixes
- `feat/<short-desc>` for features
- `chore/<short-desc>` for tooling/docs/maintenance
- `wip/<topic>` for incomplete work that should not yet be merged

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
- First push: `git push -u origin <branch>`
- After that: `git push`
- If a non-fast-forward push occurs, stop and ask. Do not auto-merge or auto-rebase without instruction.

## Divergence playbook
If `main` and `origin/main` have diverged:
- Run:
  - `git fetch origin`
  - `git log --oneline --decorate --graph --left-right main...origin/main`
- Then stop and ask whether to:
  - rebase/merge on a feature branch, or
  - reset local `main` to `origin/main`
- Do not choose automatically.

## Main branch stability
- Keep `main` passing the relevant tests/checks.
- Prefer PR + squash merge by default.
- Do not merge into `main` locally unless explicitly instructed.

## Branch hygiene
- Keep at most 3 active WIP branches.
- Before starting new work:
  - `git fetch origin --prune`
  - `git branch -vv`
- Never delete a branch unless it is confirmed merged or explicitly archived/tagged first.
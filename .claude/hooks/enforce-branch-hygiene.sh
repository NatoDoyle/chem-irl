#!/bin/bash
# When creating a new branch:
#   1. Block if run from the primary checkout (worktree-first policy)
#   2. Block if worktree is dirty (unstaged/untracked changes)
#   3. Warn if local branch count exceeds 5
# Enforces: "use a worktree per task", "git status --porcelain must be empty",
# and "at most 3 active worktrees" (warn at 5).

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check branch creation commands
if echo "$CMD" | grep -qE 'git\s+(checkout\s+-b|switch\s+-c)'; then
  # Primary checkout vs linked worktree:
  #   primary: --git-dir and --git-common-dir resolve to the same absolute path
  #   linked:  --git-dir is <common>/worktrees/<name>
  GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
  GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
  if [ -n "$GIT_DIR" ] && [ -n "$GIT_COMMON" ]; then
    GIT_DIR_ABS=$(cd "$GIT_DIR" 2>/dev/null && pwd)
    GIT_COMMON_ABS=$(cd "$GIT_COMMON" 2>/dev/null && pwd)
    if [ -n "$GIT_DIR_ABS" ] && [ "$GIT_DIR_ABS" = "$GIT_COMMON_ABS" ]; then
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Branch creation is disabled in the primary checkout (worktree-first policy). Use: git worktree add -b <branch> .worktrees/<dir> origin/main\nSee the Worktree workflow section of CLAUDE.md."
        }
      }'
      exit 0
    fi
  fi

  DIRTY=$(git status --porcelain 2>/dev/null)
  if [ -n "$DIRTY" ]; then
    jq -n --arg dirty "$DIRTY" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("Working directory is not clean. Commit or stash changes before creating a new branch.\n" + $dirty)
      }
    }'
    exit 0
  fi

  COUNT=$(git branch | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 5 ]; then
    jq -n --arg count "$COUNT" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: ("WARNING: You have " + $count + " local branches (max recommended: 3). Run git branch -vv and clean up merged/stale branches before creating new ones.")
      }
    }'
    exit 0
  fi
fi

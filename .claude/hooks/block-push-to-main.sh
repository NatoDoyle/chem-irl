#!/bin/bash
# Block git push when on the main branch.
# Enforces: "Prefer PR + squash merge. Do not merge into main locally."
#
# Scope: LOCAL pushes only. Quoted payloads are stripped before matching so
# remote-repo pushes on other machines (e.g. ssh openclaw 'cd /x && git push')
# and quoted strings that merely mention "git push" don't false-positive —
# those repos are out of this hook's jurisdiction (CLAUDE.md, 2026-06-12).
# Deliberately wrapping a real local push in quotes to evade this hook is a
# bypass, which the workflow rules already forbid.

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# Strip single- and double-quoted segments, then require `git push` at a
# command position (start, or after ; & | ( or whitespace-as-separator).
LOCAL_CMD=$(printf '%s' "$CMD" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")

if printf '%s' "$LOCAL_CMD" | grep -qE '(^|[;&|([:space:]])git[[:space:]]+push' && [ "$BRANCH" = "main" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Pushing directly to main is not allowed. Push from a feature branch in a worktree and open a PR instead."
    }
  }'
fi

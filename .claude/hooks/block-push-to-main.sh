#!/bin/bash
# Block git push when on the main branch.
# Enforces: "Prefer PR + squash merge. Do not merge into main locally."

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if echo "$CMD" | grep -qE 'git\s+push' && [ "$BRANCH" = "main" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Pushing directly to main is not allowed. Push from a feature branch in a worktree and open a PR instead."
    }
  }'
fi

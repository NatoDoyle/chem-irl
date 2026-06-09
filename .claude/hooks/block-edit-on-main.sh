#!/bin/bash
# Block Edit/Write/NotebookEdit when the target file's working tree is on main.
# Enforces: "Never work directly on main."
# Worktree-aware: resolves the branch from the file's directory, not the shell
# CWD, so editing files in a worktree on a non-main branch is allowed even
# when the main checkout itself is on main.

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -n "$FILE_PATH" ]; then
  TARGET_DIR=$(dirname "$FILE_PATH")
  while [ ! -d "$TARGET_DIR" ] && [ "$TARGET_DIR" != "/" ]; do
    TARGET_DIR=$(dirname "$TARGET_DIR")
  done
  BRANCH=$(git -C "$TARGET_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
fi

if [ "$BRANCH" = "main" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Target file is on the main branch. Create a worktree first (git worktree add -b <branch> .worktrees/<dir> origin/main; branch fix/*, feat/*, or chore/*). Never edit files directly on main."
    }
  }'
fi

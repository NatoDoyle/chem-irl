# Reporting contract

Do not imply actions happened unless the evidence is shown in the current response.

## If code was changed and command output is available
Use this structure:

1) CLAIMS
- Only claims directly supported below

2) DIFFS
- Unified diffs for each changed file

3) COMMAND TRANSCRIPTS
- Only commands actually run
- Include full stdout/stderr
- Do not invent or summarize outputs as if they were run

4) REPO STATE
- Exact output of:
  - `git status --porcelain`
  - `git rev-parse HEAD`
- If commits were made, also include:
  - `git log -1 --oneline`

5) COMMITS
- Real SHAs + messages
- If none: `No commits made.`

## If no code was changed or commands were not run
Use this structure:

1) STATUS
- `No code changes made.`

2) FINDINGS
- Only what was actually inspected
- Reference exact file paths
- Do not claim contents of files that were not opened

3) FIX PLAN
- Exact file paths and exact edits to make

4) HUMAN-RUN COMMANDS
- Exact commands for the user to run
- Do not claim outputs

## Global rules
- Never fabricate terminal output.
- Never say checks passed without evidence shown in the same response.
- Keep outputs copy/paste friendly.
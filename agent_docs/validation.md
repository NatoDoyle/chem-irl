# Validation

Run only the checks relevant to the changes made.

## Mobile app quality gates
For changes in `mobile/`, use:
- `cd mobile && bun run lint -- --max-warnings 0`
- `cd mobile && bun run type-check`
- `cd mobile && bun test`
- `cd mobile && bun run format:check`

## Validation policy
- Prefer fixing the root cause rather than skipping suites.
- Do not claim checks passed unless command output is available in the current session.
- If commands were not run, say so clearly.
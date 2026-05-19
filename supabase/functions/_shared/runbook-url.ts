// Build a GitHub URL for the runbook of a Sentry tag.
//
// Used by mobile + edge code to attach `extra.runbook_url` to every Sentry
// event so the dashboard links straight to the on-disk runbook for that tag.
//
// PR-A only ships the helper. PR-C wires it into the shared observability
// helper that wraps every edge function handler; PR-E adds the seed runbooks
// under docs/runbooks/.
//
// Mirrored at mobile/src/lib/runbook-url.ts. Keep in sync.

const REPO_OWNER = 'NatoDoyle';
const REPO_NAME = 'chem-irl';
const REPO_BRANCH = 'main';
const RUNBOOK_DIR = 'docs/runbooks';

// Tag characters are restricted to [A-Za-z0-9._-]; anything else is replaced
// with `_` so a malformed tag still produces a valid URL rather than a 404
// caused by a literal `/` mid-path.
export function runbookUrl(tag: string): string {
  const slug = tag.replace(/[^A-Za-z0-9._-]/g, '_');
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}/${RUNBOOK_DIR}/${slug}.md`;
}

export const RUNBOOK_URL_CONFIG = {
  REPO_OWNER,
  REPO_NAME,
  REPO_BRANCH,
  RUNBOOK_DIR,
} as const;

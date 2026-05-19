import { runbookUrl, RUNBOOK_URL_CONFIG } from '../runbook-url';

describe('runbookUrl', () => {
  it('builds a URL for a simple tag', () => {
    expect(runbookUrl('auth.session_expired')).toBe(
      `https://github.com/${RUNBOOK_URL_CONFIG.REPO_OWNER}/${RUNBOOK_URL_CONFIG.REPO_NAME}/blob/${RUNBOOK_URL_CONFIG.REPO_BRANCH}/${RUNBOOK_URL_CONFIG.RUNBOOK_DIR}/auth.session_expired.md`
    );
  });

  it('preserves dots, underscores, and hyphens in the slug', () => {
    expect(runbookUrl('rpc.propose_meet.invalid-time')).toContain(
      '/rpc.propose_meet.invalid-time.md'
    );
  });

  it('replaces unsafe characters (slashes, spaces, colons) with underscores', () => {
    expect(runbookUrl('layer:edge/fn:push')).toContain('/layer_edge_fn_push.md');
  });

  it('produces a URL with no double slashes in the path', () => {
    const url = runbookUrl('any.tag');
    // After https:// the only slashes should be path separators
    const path = url.replace(/^https:\/\//, '');
    expect(path).not.toMatch(/\/\//);
  });

  it('always points at docs/runbooks/<slug>.md', () => {
    expect(runbookUrl('x')).toMatch(/docs\/runbooks\/x\.md$/);
  });
});

#!/usr/bin/env node
// Prod release gate (#865): sibling to the Clerk-key smoke-check in
// .github/workflows/release.yml. That check greps the deployed bundle for
// pk_live_ and nothing else — an empty or wrong VITE_API_BASE_URL at build
// time ships a build that passes it anyway, because resolveApiBaseUrl
// (apps/web/src/lib/apiBaseUrl.ts) only throws at runtime, in the browser,
// not at build time. This checks the other half of the bundle: does it
// reference the production API host, and only the production API host.
//
// The host is not a secret — it's a public DNS name any browser sees in a
// network request — so it's hardcoded here rather than a new repo variable
// (per the issue's "no new secret or repository variable" constraint).

export const PROD_API_HOST = 'valiant-respect-production-c8bb.up.railway.app';

const HOST_PATTERN = /[a-z0-9-]+\.up\.railway\.app/gi;

/**
 * @param {string} bundleText
 * @param {string} [expectedHost]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkApiHost(bundleText, expectedHost = PROD_API_HOST) {
  const found = [...new Set((bundleText.match(HOST_PATTERN) ?? []).map((h) => h.toLowerCase()))];
  const expected = expectedHost.toLowerCase();

  if (found.includes(expected)) {
    return { ok: true };
  }

  if (found.length > 0) {
    return {
      ok: false,
      reason: `production bundle references ${found.join(', ')} instead of the production API host (${expectedHost})`,
    };
  }

  return {
    ok: false,
    reason: `production bundle has no API host at all (expected ${expectedHost}) — VITE_API_BASE_URL was likely empty at build time`,
  };
}

// CLI: reads the concatenated bundle text from stdin, exits 0/1.
if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  process.stdin.on('data', (d) => chunks.push(d));
  process.stdin.on('end', () => {
    const result = checkApiHost(chunks.join(''));
    if (result.ok) {
      process.stdout.write(`Production API host (${PROD_API_HOST}) is live in the bundle\n`);
      process.exit(0);
    }
    process.stderr.write(`${result.reason}\n`);
    process.exit(1);
  });
}

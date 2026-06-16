// Extract the issue number closed by the most recent Closes/Fixes/Resolves commit.
// Accepts git log --pretty=%B output (full commit bodies, newest first).
// Returns the issue number as a string, or '' if no closing keyword is found.
export function extractWorkedIssue(gitLogOutput) {
  const m = (gitLogOutput || '').match(/(Closes|Fixes|Resolves)\s+#(\d+)/i);
  return m ? m[2] : '';
}

// CLI entry point: read stdin (git log output), print issue number (or nothing).
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const chunks = [];
  process.stdin.on('data', d => chunks.push(d));
  process.stdin.on('end', () => {
    process.stdout.write(extractWorkedIssue(chunks.join('')));
  });
}

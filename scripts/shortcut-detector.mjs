#!/usr/bin/env node
// Shortcut-detector (ADR-0030): pure diff -> violations module.
// Blocks commits that lower the quality bar without surfacing the trade-off.

/**
 * @typedef {{ file: string, text: string, reason: string }} Violation
 */

const ADDED = /^\+(?!\+\+)/;
const REMOVED = /^-(?!--)/;

// Files exempt from detection:
//  - the detector's own source and tests (bootstrap exemption)
//  - markdown/docs: prose that *names* a forbidden pattern (CLAUDE.md, ADRs, PROMPT.md)
//    can't actually suppress lint/types/tests — it isn't executed. The detector guards
//    source code, not documentation that documents the rules.
const EXEMPT = /scripts\/shortcut-detector|\.mdx?$/;

/**
 * @param {string} diff - output of `git diff --cached`
 * @returns {Violation[]}
 */
export function detectViolations(diff) {
  const violations = [];
  let currentFile = '(unknown)';
  let skipFile = false;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      skipFile = EXEMPT.test(currentFile);
      continue;
    }
    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@') ||
      line.startsWith('diff ') ||
      line.startsWith('index ')
    ) {
      continue;
    }

    if (skipFile) continue;

    if (ADDED.test(line)) {
      const code = line.slice(1);

      if (/eslint-disable/.test(code)) {
        violations.push({ file: currentFile, text: line, reason: 'eslint-disable introduced' });
      }
      if (/@ts-ignore/.test(code)) {
        violations.push({ file: currentFile, text: line, reason: '@ts-ignore introduced' });
      }
      // as any without an inline comment (any `//` on the same line is the approved form)
      if (/\bas any\b/.test(code) && !/\/\//.test(code)) {
        violations.push({ file: currentFile, text: line, reason: 'uncommented `as any` introduced' });
      }
      if (/\.(skip|only)\s*\(/.test(code) || /\bxit\s*\(/.test(code) || /\bxdescribe\s*\(/.test(code)) {
        violations.push({ file: currentFile, text: line, reason: 'test skip/only introduced' });
      }
    }

    if (REMOVED.test(line)) {
      const code = line.slice(1);
      if (/\bexpect\s*\(/.test(code)) {
        // Known false-positive: moved assertions (delete + add) also trigger this.
        violations.push({ file: currentFile, text: line, reason: 'assertion deleted' });
      }
    }
  }

  return violations;
}

// CLI: reads staged diff from stdin, exits 1 if violations found.
if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  process.stdin.on('data', (d) => chunks.push(d));
  process.stdin.on('end', () => {
    const diff = chunks.join('');
    const violations = detectViolations(diff);
    if (violations.length > 0) {
      process.stderr.write('Shortcut-detector: commit blocked — lowered-bar patterns found:\n');
      for (const v of violations) {
        process.stderr.write(`  ${v.file}: ${v.reason}\n`);
        process.stderr.write(`    ${v.text}\n`);
      }
      process.exit(1);
    }
  });
}

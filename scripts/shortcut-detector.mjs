#!/usr/bin/env node
// Shortcut-detector (ADR-0030): pure diff -> violations module.
// Blocks commits that lower the quality bar without surfacing the trade-off.

/**
 * @typedef {{ file: string, text: string, reason: string }} Violation
 */

const ADDED = /^\+(?!\+\+)/;
const REMOVED = /^-(?!--)/;

// Bare-id mutation guard (#710 / ADR-0061): a Prisma mutation keyed on the row's own primary
// key (`id`) with no `userId` in the `where` is a cross-tenant write waiting to happen — safety
// then rests entirely on a preceding scoped read (convention, not structure). We flag *new* ones
// in repositories so a future dropped read can't silently reintroduce the gap. Existing methods
// are grandfathered automatically: the detector only sees the staged diff.
const REPO_FILE = /\.repository\.ts$/;
const MUTATION_VERB = /\.(update|updateMany|delete|deleteMany|upsert)\s*\(/;
const READ_VERB = /\.(findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|findMany|count|aggregate|groupBy)\s*\(/;
const SCOPED_SUPPRESS = /scoped-upstream/;

// A `where` selector that references the bare primary key `id` (e.g. `{ id }`, `{ id: setId }`)
// but not `userId`. `{ bookingId, packageId }`-style child scoping is deliberately NOT matched —
// that is the legitimate existing pattern (scoped via an already-owned parent), not the target.
function whereTargetsBareId(code) {
  const idx = code.indexOf('where:');
  if (idx === -1) return false;
  const after = code.slice(idx);
  const open = after.indexOf('{');
  if (open === -1) return false;
  const close = after.indexOf('}', open);
  const inner = close === -1 ? after.slice(open) : after.slice(open, close + 1);
  return /[{,]\s*id\s*[:,}]/.test(inner) && !/\buserId\b/.test(inner);
}

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

  // Per-file assertion tracking to distinguish deletions from replacements.
  // A removed expect() is only a violation if the file has a net loss of assertions.
  let assertionsAdded = 0;
  let assertionsRemoved = 0;
  /** @type {Violation[]} */
  let pendingAssertionViolations = [];

  // A mutation verb whose `where` clause is on a later line (the dominant multi-line style).
  // We look at the next few added lines for its selector. null when not mid-mutation.
  /** @type {{ budget: number, suppressed: boolean } | null} */
  let pendingMutation = null;

  function flushAssertionViolations() {
    if (assertionsRemoved > assertionsAdded) {
      // Net decrease in assertions — flag the removals as real violations.
      violations.push(...pendingAssertionViolations);
    }
    assertionsAdded = 0;
    assertionsRemoved = 0;
    pendingAssertionViolations = [];
  }

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      flushAssertionViolations();
      pendingMutation = null;
      currentFile = line.slice(6);
      skipFile = EXEMPT.test(currentFile);
      continue;
    }
    // Deleted files use "+++ /dev/null" instead of "+++ b/<path>". Flush the previous
    // file's state and skip the deleted file's removed lines — they are retired code, not
    // a quality regression. The CI story-presence scan catches accidentally deleted stories.
    if (line === '+++ /dev/null') {
      flushAssertionViolations();
      pendingMutation = null;
      skipFile = true;
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
      if (/\bexpect\s*\(/.test(code)) {
        assertionsAdded++;
      }

      // Bare-id mutation guard — repositories only (#710).
      if (REPO_FILE.test(currentFile)) {
        const suppressed = SCOPED_SUPPRESS.test(code);
        const hasWhere = /where:/.test(code);
        if (MUTATION_VERB.test(code)) {
          if (hasWhere) {
            // Inline: verb and where on one line (e.g. `.delete({ where: { id } })`).
            if (whereTargetsBareId(code) && !suppressed) {
              violations.push({ file: currentFile, text: line, reason: 'bare-id mutation without userId scoping' });
            }
            pendingMutation = null;
          } else {
            // Multi-line: remember the verb; its `where` comes on a later added line.
            pendingMutation = { budget: 8, suppressed };
          }
        } else if (pendingMutation) {
          if (READ_VERB.test(code)) {
            // A read call intervened — the pending mutation's where is not what follows.
            pendingMutation = null;
          } else if (hasWhere) {
            if (whereTargetsBareId(code) && !(suppressed || pendingMutation.suppressed)) {
              violations.push({ file: currentFile, text: line, reason: 'bare-id mutation without userId scoping' });
            }
            pendingMutation = null;
          } else if (--pendingMutation.budget <= 0) {
            pendingMutation = null;
          }
        }
      }
    }

    if (REMOVED.test(line)) {
      const code = line.slice(1);
      if (/\bexpect\s*\(/.test(code)) {
        // Track per-file — only flag if the file has a net loss of assertions.
        // Replacements (delete old + add new) are not violations.
        assertionsRemoved++;
        pendingAssertionViolations.push({ file: currentFile, text: line, reason: 'assertion deleted' });
      }
    }
  }

  flushAssertionViolations();

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

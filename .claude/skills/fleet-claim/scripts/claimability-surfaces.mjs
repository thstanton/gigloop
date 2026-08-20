#!/usr/bin/env node
// claimability-surfaces.mjs — pure text-parsing half of claimability.sh (#904).
// Kept as a separate Node module (rather than bash/awk) so the logic can be
// unit-tested with node --test, independent of gh/network access.

// Hot append-mostly shared files: touched often by unrelated features, but
// they rebase trivially, so they never count toward a hard-block overlap
// even when declared as a Surfaces bullet.
// Keep in sync with docs/agents/issue-authoring.md §8 — the doc is the
// authority. (Its prose spells the second entry `lib/constants.ts`; either
// spelling matches here since surfacesOverlap()/isHotFile() compare at a
// path boundary, not by exact string.)
export const HOT_FILES = ['apps/web/src/types/api.ts', 'apps/web/src/lib/constants.ts', 'CONTEXT.md'];

/** @param {string} p */
function normalize(p) {
  return p.trim().replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * True when two Surfaces tokens name the same module at a path boundary —
 * either identical, or one is a `/`-bounded suffix of the other. This is
 * what lets `features/bookings` and `apps/web/src/features/bookings` (the
 * same module declared under different roots) collide instead of reading
 * as disjoint.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function surfacesOverlap(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer.endsWith(`/${shorter}`);
}

/**
 * True when `token` names (or path-boundary-matches) one of HOT_FILES.
 * @param {string} token
 * @returns {boolean}
 */
export function isHotFile(token) {
  return HOT_FILES.some((hf) => surfacesOverlap(token, hf));
}

/**
 * Parses declared Surfaces out of markdown text. Two annotation forms:
 *   • Canonical (docs/agents/issue-authoring.md §8): a "## Surfaces" heading
 *     (any level, optional trailing colon) followed by a plain bullet list,
 *     read until the next heading.
 *   • Legacy: a "**Surfaces …:**" bolded line with `backticked` tokens on
 *     the same line (older issues / escalation comments).
 * Fenced ``` code blocks are skipped entirely — including one indented
 * under a list item — so an example snippet illustrating either format
 * (such as the ones inside issue #904's own bug report) is never mistaken
 * for a real declaration.
 * @param {string} text
 * @returns {string[]} sorted, de-duplicated surface tokens
 */
export function parseSurfaces(text) {
  const out = [];
  let inFence = false;
  let inSection = false;

  for (const line of text.split('\n')) {
    if (/^[ \t]*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/^#{1,6}[ \t]*[Ss]urfaces?[ \t:]*$/.test(line)) {
      inSection = true;
      continue;
    }

    if (/\*\*[Ss]urfaces?[^*\n]*\*\*/.test(line)) {
      inSection = true;
      for (const m of line.matchAll(/`([^`]+)`/g)) out.push(m[1]);
      continue;
    }

    if (inSection && /^#{1,6}[ \t]/.test(line)) {
      inSection = false;
      continue;
    }

    if (inSection) {
      const bullet = line.match(/^[ \t]*-[ \t]+(.*)$/);
      if (bullet) {
        out.push(bullet[1].replace(/`/g, '').trim());
        continue;
      }
      if (/^[ \t]*$/.test(line)) continue;
      inSection = false;
    }
  }

  return [...new Set(out.map((s) => s.trim()).filter(Boolean))].sort();
}

/**
 * Surfaces in `mine` that collide with a surface in `theirs`, excluding hot
 * files on either side.
 * @param {string[]} mine
 * @param {string[]} theirs
 * @returns {string[]} sorted, de-duplicated overlapping tokens from `mine`
 */
export function findOverlaps(mine, theirs) {
  const hits = new Set();
  for (const m of mine) {
    if (isHotFile(m)) continue;
    for (const t of theirs) {
      if (isHotFile(t)) continue;
      if (surfacesOverlap(m, t)) {
        hits.add(m);
        break;
      }
    }
  }
  return [...hits].sort();
}

function readStdin() {
  const chunks = [];
  return new Promise((resolve, reject) => {
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'parse') {
    const text = await readStdin();
    const surfaces = parseSurfaces(text);
    process.stdout.write(surfaces.length ? surfaces.join('\n') + '\n' : '');
  } else if (cmd === 'overlaps') {
    const [mineStr = '', theirStr = ''] = rest;
    const mine = mineStr.split('\n').filter(Boolean);
    const theirs = theirStr.split('\n').filter(Boolean);
    const overlaps = findOverlaps(mine, theirs);
    process.stdout.write(overlaps.length ? overlaps.join('\n') + '\n' : '');
  } else {
    console.error('usage: claimability-surfaces.mjs <parse|overlaps mine theirs>');
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

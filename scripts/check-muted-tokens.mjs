#!/usr/bin/env node
// Muted-token guard (#977).
//
// `muted` is this design system's de-emphasised TEXT token — ADR-0011 ("muted
// text ... warm-gray") and ADR-0039 (which audits it as a text colour). It is
// not a background. Two dead class names keep coming back by copy-paste from
// neighbouring files, and both used to render invisible text because `--muted`
// and `--muted-foreground` were declared with the identical HSL triple:
//
//   bg-muted             → use bg-accent (subtle neutral surface)
//                          or bg-border (1px hairline)
//   text-muted-foreground → use text-muted (the alias is deleted)
//
// Translucent washes (`bg-muted/20`…`/50`) ARE legal: they are deliberate
// low-opacity tints of the text grey with no invisible-text failure mode.
//
// The scanner ignores comments, so prose that *names* these classes to explain
// them (as this header does) is not a violation. Strings are scanned, because
// that is where class names actually live.
import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'apps/web/src';

const RULES = [
  {
    // Any `bg-muted` NOT followed by an opacity modifier. `\b` holds after the
    // `:` of a variant (`hover:bg-muted`), so variants are covered too.
    pattern: /\bbg-muted(?![-/\w])/g,
    fix: 'bg-accent (subtle neutral surface) or bg-border (1px hairline)',
  },
  {
    pattern: /\btext-muted-foreground\b/g,
    fix: 'text-muted',
  },
];

// A tiny character-level scanner. Each state advances the cursor and returns
// the next state; `blank(i)` erases a character in place. Splitting one state
// per function keeps each branch trivially readable.
const NORMAL = 'NORMAL';
const LINE = 'LINE';
const BLOCK = 'BLOCK';
const QUOTES = new Set(["'", '"', '`']);

// Every scanner takes (text, i, ctx), where ctx carries `blank` (erase a
// character in place), `allowLineComments` and the current `state`.
function scanNormal(text, i, { blank, allowLineComments }) {
  const c = text[i];
  const opensLineComment = allowLineComments && c === '/' && text[i + 1] === '/';
  if (opensLineComment) {
    blank(i);
    blank(i + 1);
    return { i: i + 2, state: LINE };
  }
  if (c === '/' && text[i + 1] === '*') {
    blank(i);
    blank(i + 1);
    return { i: i + 2, state: BLOCK };
  }
  // A quote character becomes the state, so it doubles as its own terminator.
  if (QUOTES.has(c)) return { i: i + 1, state: c };
  return { i: i + 1, state: NORMAL };
}

function scanLineComment(text, i, { blank }) {
  if (text[i] === '\n') return { i: i + 1, state: NORMAL };
  blank(i);
  return { i: i + 1, state: LINE };
}

function scanBlockComment(text, i, { blank }) {
  if (text[i] === '*' && text[i + 1] === '/') {
    blank(i);
    blank(i + 1);
    return { i: i + 2, state: NORMAL };
  }
  blank(i);
  return { i: i + 1, state: BLOCK };
}

// Inside a string literal: keep the characters, honour escapes. The state IS
// the opening quote character, so it is also what closes the literal.
function scanString(text, i, { state: quote }) {
  if (text[i] === '\\') return { i: i + 2, state: quote };
  if (text[i] === quote) return { i: i + 1, state: NORMAL };
  return { i: i + 1, state: quote };
}

/**
 * Blank out comments so prose naming a dead class is not a violation, while
 * preserving byte offsets (and newlines) so line numbers stay accurate.
 * String literals are deliberately KEPT — class names live in strings.
 * `//` only starts a comment in JS/TS; in CSS it is ordinary text.
 */
export function stripComments(text, ext = '.tsx') {
  const allowLineComments = ext !== '.css';
  const out = text.split('');
  const blank = (n) => {
    if (out[n] !== '\n') out[n] = ' ';
  };

  // Any state that is not one of these three IS the open quote character,
  // and is handled by scanString.
  const scanners = {
    [NORMAL]: scanNormal,
    [LINE]: scanLineComment,
    [BLOCK]: scanBlockComment,
  };

  let i = 0;
  let state = NORMAL;
  while (i < text.length) {
    const scan = scanners[state] ?? scanString;
    ({ i, state } = scan(text, i, { blank, allowLineComments, state }));
  }

  return out.join('');
}

/** Returns [{ line, match, fix }] for one file's contents. */
export function findViolations(text, ext = '.tsx') {
  const scannable = stripComments(text, ext);
  const found = [];
  for (const { pattern, fix } of RULES) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(scannable)) !== null) {
      const line = scannable.slice(0, m.index).split('\n').length;
      found.push({ line, match: m[0], fix });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

const SCANNED = new Set(['.ts', '.tsx', '.css']);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (SCANNED.has(extname(p))) out.push(p);
  }
  return out;
}

// Only run the filesystem scan when invoked directly, so the test can import
// the pure functions above.
if (process.argv[1] && process.argv[1].endsWith('check-muted-tokens.mjs')) {
  const violations = [];
  for (const file of walk(ROOT)) {
    for (const v of findViolations(readFileSync(file, 'utf8'), extname(file))) {
      violations.push({ file, ...v });
    }
  }

  if (violations.length) {
    console.error(
      `Muted-token check FAILED — ${violations.length} use(s) of a dead class name:`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.match}  →  ${v.fix}`);
    }
    console.error(
      '\n`muted` is a TEXT token (ADR-0011, ADR-0039) — it is never a background.',
    );
    console.error(
      'Translucent washes (bg-muted/20…/50) are legal and are not reported here.',
    );
    process.exit(1);
  }
  console.log('Muted-token check: OK.');
}

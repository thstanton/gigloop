#!/usr/bin/env node
// Design-token guard: dead muted classes (#977) and raw palette colors (#1075).
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
const COLOR_UTILITY = String.raw`(?:bg|text|border(?:-[trblsexy])?|ring(?:-offset)?|from|to|via|fill|stroke|divide|outline|placeholder|decoration)`;
const CSS_COLOR_NAMES = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue',
  'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
  'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive',
  'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
  'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown',
  'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey',
  'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
  'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
].join('|');

const RULES = [
  {
    // Any `bg-muted` NOT followed by an opacity modifier. `\b` holds after the
    // `:` of a variant (`hover:bg-muted`), so variants are covered too.
    pattern: /\bbg-muted(?![-/\w])/g,
    fix: 'bg-accent (subtle neutral surface) or bg-border (1px hairline)',
    palette: false,
  },
  {
    pattern: /\btext-muted-foreground\b/g,
    fix: 'text-muted',
    palette: false,
  },
  {
    // Tailwind's default color palette, including its deprecated v2 aliases.
    // Utilities are found independently of variants, so `hover:` and
    // `data-[state=open]:` prefixes need no special handling.
    pattern: new RegExp(
      String.raw`(?<![\w-])${COLOR_UTILITY}-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|lightBlue|warmGray|trueGray|coolGray|blueGray)(?:-\d{2,3})?(?:\/(?:\d{1,3}|\[[^\]\s]+\]))?(?![\w-])`,
      'g',
    ),
    fix: 'replace with a semantic design token such as bg-background, text-foreground or border-border',
    palette: true,
  },
  {
    // Ban literal CSS color values in Tailwind arbitrary-value syntax while
    // allowing arbitrary values that are not colors (e.g. text-[length:14px]).
    pattern: new RegExp(
      String.raw`(?<![\w-])${COLOR_UTILITY}-\[(?:color:)?(?:#[\da-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^\]\r\n]*\)|${CSS_COLOR_NAMES})\](?![\w-])`,
      'gi',
    ),
    fix: 'replace the literal color with a semantic design token such as bg-background or text-foreground',
    palette: true,
  },
];

const PALETTE_EXEMPT_MARKER = 'palette-exempt';
const INVALID_MARKER_FIX = 'add a reason after `palette-exempt:`';

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

function isPaletteExemptPath(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replaceAll('\\', '/');
  const sourceRelative = normalized.replace(/^.*?apps\/web\/src\//, '');
  return (
    sourceRelative.startsWith('features/portal/') ||
    sourceRelative.startsWith('pages/portal/') ||
    sourceRelative === 'layouts/PortalLayout.tsx' ||
    /\.stories\.tsx$/.test(sourceRelative) ||
    /\.(?:spec|test)\.tsx?$/.test(sourceRelative)
  );
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function paletteExemptions(text, scannable) {
  const exemptLines = new Set();
  const invalidMarkers = [];
  const markerPattern = /\/\/\s*palette-exempt:\s*([^\r\n]*)|\/\*\s*palette-exempt:\s*([^*\r\n]*?)\s*\*\//g;
  let marker;

  while ((marker = markerPattern.exec(text)) !== null) {
    const markerTextEnd = marker.index + marker[0].indexOf(PALETTE_EXEMPT_MARKER);
    // A matching string is not a comment; stripComments leaves its characters
    // intact, whereas actual comments are replaced with spaces.
    if (scannable.slice(markerTextEnd, markerTextEnd + PALETTE_EXEMPT_MARKER.length).trim()) {
      continue;
    }

    const line = lineNumberAt(text, marker.index);
    const reason = (marker[1] ?? marker[2] ?? '').trim();
    if (reason) exemptLines.add(line);
    else invalidMarkers.push({ line, match: PALETTE_EXEMPT_MARKER, fix: INVALID_MARKER_FIX });
  }

  return { exemptLines, invalidMarkers };
}

/** Returns [{ line, match, fix }] for one file's contents. */
export function findViolations(text, ext = '.tsx', filePath = '') {
  const scannable = stripComments(text, ext);
  const { exemptLines, invalidMarkers } = paletteExemptions(text, scannable);
  const found = [...invalidMarkers];
  const exemptFile = isPaletteExemptPath(filePath);

  for (const { pattern, fix, palette } of RULES) {
    if (palette && exemptFile) continue;
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(scannable)) !== null) {
      const line = lineNumberAt(scannable, m.index);
      if (palette && exemptLines.has(line)) continue;
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
if (process.argv[1] && process.argv[1].endsWith('check-design-tokens.mjs')) {
  const violations = [];
  for (const file of walk(ROOT)) {
    for (const v of findViolations(readFileSync(file, 'utf8'), extname(file), file)) {
      violations.push({ file, ...v });
    }
  }

  if (violations.length) {
    console.error(`Design-token check FAILED — ${violations.length} violation(s):`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.match}  →  ${v.fix}`);
    }
    console.error('\nUse semantic design tokens instead of raw palette colors.');
    console.error('`muted` is a TEXT token; translucent bg-muted washes remain legal.');
    process.exit(1);
  }
  console.log('Design-token check: OK.');
}

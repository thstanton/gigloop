#!/usr/bin/env node
// Token-pair contrast guard (ADR-0085 §5, #1078).
//
// Parses the `:root` (light) and `.dark` blocks of globals.css and asserts that
// every declared text-on-surface pair clears WCAG AA in BOTH appearances. It
// also asserts the dark block redefines every light token, and that the
// `@media print` block restores the light values under `.dark`.
//
// This is a different guard from check-design-tokens.mjs, which only scans
// class names. Pairs are declared once, in PAIRS below.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../apps/web/src/styles/globals.css', import.meta.url));

// ─── colour maths ──────────────────────────────────────────────────────────

/** '38 30% 98%' → { h: 38, s: 0.3, l: 0.98 } */
export function parseHsl(triplet) {
  const m = /^\s*(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(triplet);
  if (!m) throw new Error(`Not an HSL triplet ("H S% L%"): ${triplet}`);
  return { h: Number(m[1]), s: Number(m[2]) / 100, l: Number(m[3]) / 100 };
}

/** HSL → [r, g, b], each 0..1 */
export function hslToRgb({ h, s, l }) {
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

function relativeLuminance([r, g, b]) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio between two [r, g, b] colours (order-independent). */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` laid over opaque `bg`. */
export function composite(fg, alpha, bg) {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
}

// ─── globals.css parsing ───────────────────────────────────────────────────

function declarationsIn(body) {
  const out = new Map();
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)) out.set(m[1], m[2].trim());
  return out;
}

const PRINT_MEDIA = /^@media\s+print\b/;

/** Which palette a block path declares: 'light', 'dark', 'print', or null (not an appearance block). */
function classifyBlock(path) {
  const media = path.filter((segment) => segment.startsWith('@media'));
  if (media.some((segment) => !PRINT_MEDIA.test(segment))) return null;
  const inPrint = media.length > 0;
  const leaf = path[path.length - 1];
  if (leaf === '.dark') return inPrint ? 'print' : 'dark';
  return leaf === ':root' && !inPrint ? 'light' : null;
}

/**
 * Walks the CSS brace structure and returns the custom properties declared by
 * `:root` (light), `.dark` (dark) and `.dark` inside `@media print` (print).
 * Comments are stripped first so prose naming a token is not a declaration.
 */
export function parseAppearanceBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const result = { light: new Map(), dark: new Map(), print: new Map() };
  const path = [];
  let buffer = '';

  for (const ch of text) {
    if (ch === '{') {
      path.push(buffer.split(';').pop().trim());
      buffer = '';
    } else if (ch === '}') {
      const into = result[classifyBlock(path)];
      if (into) for (const [k, v] of declarationsIn(buffer)) into.set(k, v);
      path.pop();
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return result;
}

/** Token names in `base` that `other` does not declare. */
export function missingTokens(base, other) {
  return [...base.keys()].filter((name) => !other.has(name));
}

// ─── pair evaluation ───────────────────────────────────────────────────────

const rgbOf = (tokens, name) => {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`token --${name} is not declared`);
  return hslToRgb(parseHsl(value));
};

/**
 * Evaluates one pair against a token map. A `wash` ({ token, alpha }) is
 * composited over the surface first, as the #1004 figures were.
 */
export function evaluatePair(tokens, pair) {
  const { fg, bg, wash, min } = pair;
  try {
    let surface = rgbOf(tokens, bg);
    if (wash) surface = composite(rgbOf(tokens, wash.token), wash.alpha, surface);
    const ratio = contrastRatio(rgbOf(tokens, fg), surface);
    return { ...pair, ratio, ok: ratio >= min };
  } catch (error) {
    return { ...pair, ratio: 0, ok: false, problem: error.message };
  }
}

// ─── the pair table ────────────────────────────────────────────────────────
// One row per text/surface relationship that must hold. `min` is 4.5 (AA,
// normal text). A row may lower it to 3 only for a pair that is only ever large
// text or a non-text UI stroke, and must then carry a `why` saying so
// (pairsMissingReason enforces this).

const PAGE_SURFACES = ['background', 'surface', 'accent', 'popover', 'dashboard-surface'];
// Every --status-* token in :root must be listed here (uncoveredStatuses
// enforces it), so a new status cannot go unchecked.
const STATUSES = ['enquiry', 'provisional', 'confirmed', 'ready', 'complete', 'cancelled'];
const AA = 4.5;

const pairsOn = (fg, surfaces) => surfaces.map((bg) => ({ fg, bg, min: AA }));

export const PAIRS = [
  ...pairsOn('foreground', PAGE_SURFACES),
  ...pairsOn('muted', PAGE_SURFACES),
  ...pairsOn('void', PAGE_SURFACES),
  // VOID labels sit on a translucent wash of --muted (#1004).
  ...['background', 'surface'].flatMap((bg) =>
    [0.2, 0.4].map((alpha) => ({ fg: 'void', bg, wash: { token: 'muted', alpha }, min: AA })),
  ),
  // Primary as link text and as a button fill.
  ...pairsOn('primary', PAGE_SURFACES),
  { fg: 'primary-foreground', bg: 'primary', min: AA },
  // `text-warning` is used on small "Due soon" labels, so it is held to AA.
  ...pairsOn('warning', PAGE_SURFACES),
  { fg: 'warning-foreground', bg: 'warning-surface', min: AA },
  { fg: 'accent-foreground', bg: 'accent', min: AA },
  { fg: 'secondary-foreground', bg: 'secondary', min: AA },
  { fg: 'popover-foreground', bg: 'popover', min: AA },
  { fg: 'destructive-foreground', bg: 'destructive', min: AA },
  { fg: 'date-badge-foreground', bg: 'date-badge', min: AA },
  { fg: 'chrome-foreground', bg: 'chrome', min: AA },
  { fg: 'chrome-foreground', bg: 'chrome-sidebar', min: AA },
  { fg: 'chrome-muted', bg: 'chrome', min: AA },
  { fg: 'chrome-muted', bg: 'chrome-sidebar', min: AA },
  // Status text on its own translucent wash (`bg-status-*/15 text-status-*`).
  ...STATUSES.flatMap((s) =>
    ['background', 'surface'].map((bg) => ({
      fg: `status-${s}`,
      bg,
      wash: { token: `status-${s}`, alpha: 0.15 },
      min: AA,
    })),
  ),
  // Selected status choice: `text-on-status` on the solid status fill.
  ...STATUSES.map((s) => ({ fg: 'on-status', bg: `status-${s}`, min: AA })),
  // Error copy is `text-status-cancelled` directly on the page surface.
  ...pairsOn('status-cancelled', ['background', 'surface', 'popover']),
];

/** Pairs below AA that do not record why (large text / UI stroke only). */
export function pairsMissingReason(pairs) {
  return pairs.filter((p) => p.min < AA && !p.why);
}

/** `--status-*` tokens in `tokens` that STATUSES (hence PAIRS) does not cover. */
export function uncoveredStatuses(tokens, statuses = STATUSES) {
  return [...tokens.keys()]
    .filter((name) => name.startsWith('status-'))
    .map((name) => name.slice('status-'.length))
    .filter((status) => !statuses.includes(status));
}

// ─── light-palette baseline ────────────────────────────────────────────────
// Light pairs that were already below AA when this guard was introduced
// (#1078). They are accepted debt, not a standard: the guard holds each at its
// recorded floor so light cannot get worse, fails the moment one is fixed so the
// entry gets deleted, and enforces AA in full for dark. Retuning light is its
// own issue. `floor` is the ratio at the time, rounded down.
const AMBER_TEXT = 'amber-600 used as small text (GoalRow "Due soon") — needs a darker text variant';
const STATUS_WASH = 'status hue is a fill colour used as text on its own /15 wash — needs a text variant';
const STATUS_TEXT = 'text-status-cancelled error copy on the page surface — needs a text variant';
const ON_STATUS = 'white on a mid-lightness status fill (StatusCoachingField selected state)';

export const LIGHT_BASELINE = new Map([
  ['warning on background', { floor: 3.06, reason: AMBER_TEXT }],
  ['warning on surface', { floor: 2.87, reason: AMBER_TEXT }],
  ['warning on accent', { floor: 2.68, reason: AMBER_TEXT }],
  ['warning on popover', { floor: 3.12, reason: AMBER_TEXT }],
  ['warning on dashboard-surface', { floor: 2.65, reason: AMBER_TEXT }],
  ['destructive-foreground on destructive', { floor: 3.78, reason: 'white on the red-500 destructive fill' }],
  ['chrome-muted on chrome', { floor: 4.13, reason: 'secondary chrome text, just under AA' }],
  ['status-enquiry on background over status-enquiry/15', { floor: 1.84, reason: STATUS_WASH }],
  ['status-enquiry on surface over status-enquiry/15', { floor: 1.74, reason: STATUS_WASH }],
  ['status-provisional on background over status-provisional/15', { floor: 3.7, reason: STATUS_WASH }],
  ['status-provisional on surface over status-provisional/15', { floor: 3.49, reason: STATUS_WASH }],
  ['status-confirmed on background over status-confirmed/15', { floor: 2.69, reason: STATUS_WASH }],
  ['status-confirmed on surface over status-confirmed/15', { floor: 2.54, reason: STATUS_WASH }],
  ['status-ready on background over status-ready/15', { floor: 4.36, reason: STATUS_WASH }],
  ['status-ready on surface over status-ready/15', { floor: 4.12, reason: STATUS_WASH }],
  ['status-complete on background over status-complete/15', { floor: 3.39, reason: STATUS_WASH }],
  ['status-complete on surface over status-complete/15', { floor: 3.2, reason: STATUS_WASH }],
  ['status-cancelled on background over status-cancelled/15', { floor: 2.99, reason: STATUS_WASH }],
  ['status-cancelled on surface over status-cancelled/15', { floor: 2.83, reason: STATUS_WASH }],
  ['on-status on status-enquiry', { floor: 2.13, reason: ON_STATUS }],
  ['on-status on status-confirmed', { floor: 3.27, reason: ON_STATUS }],
  ['on-status on status-complete', { floor: 4.17, reason: ON_STATUS }],
  ['on-status on status-cancelled', { floor: 3.78, reason: ON_STATUS }],
  ['status-cancelled on background', { floor: 3.63, reason: STATUS_TEXT }],
  ['status-cancelled on surface', { floor: 3.41, reason: STATUS_TEXT }],
  ['status-cancelled on popover', { floor: 3.7, reason: STATUS_TEXT }],
]);

export function pairKey({ fg, bg, wash }) {
  return wash ? `${fg} on ${bg} over ${wash.token}/${Math.round(wash.alpha * 100)}` : `${fg} on ${bg}`;
}

/**
 * Turns evaluated pairs into failure messages, tolerating baselined failures
 * at or above their floor.
 */
export function applyBaseline(results, baseline) {
  const failures = results.map((r) => judgeResult(r, baseline.get(pairKey(r)))).filter(Boolean);
  const seen = new Set(results.map(pairKey));

  for (const key of baseline.keys()) {
    if (!seen.has(key)) failures.push(`${key} is in LIGHT_BASELINE but no longer in PAIRS`);
  }
  return failures;
}

/** One failure message for a result given its baseline entry, or null when it is acceptable. */
function judgeResult(r, accepted) {
  const key = pairKey(r);
  if (r.ok) return accepted ? `${key} now passes — delete it from LIGHT_BASELINE` : null;
  if (r.problem) return `${key} — ${r.problem}`;
  if (!accepted) return `${key} is ${r.ratio.toFixed(2)}:1, needs ${r.min}:1`;
  return r.ratio < accepted.floor
    ? `${key} regressed to ${r.ratio.toFixed(2)}:1 (baseline floor ${accepted.floor}:1)`
    : null;
}

// ─── runner ────────────────────────────────────────────────────────────────

export function checkCss(css) {
  const { light, dark, print } = parseAppearanceBlocks(css);
  const failures = [];

  for (const name of missingTokens(light, dark)) {
    failures.push(`.dark does not redefine --${name}`);
  }
  for (const name of missingTokens(light, print)) {
    failures.push(`@media print .dark does not restore --${name}`);
  }
  for (const [name, value] of print) {
    if (light.get(name) !== value) {
      failures.push(`@media print .dark sets --${name} to "${value}", not the light value "${light.get(name)}"`);
    }
  }

  for (const p of pairsMissingReason(PAIRS)) {
    failures.push(`${pairKey(p)} is below AA but PAIRS records no \`why\``);
  }
  for (const status of uncoveredStatuses(light)) {
    failures.push(`--status-${status} is declared but not in STATUSES, so its contrast is unchecked`);
  }

  const run = (tokens, baseline, label) =>
    applyBaseline(PAIRS.map((pair) => evaluatePair(tokens, pair)), baseline).map((f) => `${label}: ${f}`);
  failures.push(...run(light, LIGHT_BASELINE, 'light'), ...run(dark, new Map(), 'dark'));
  return failures;
}

if (process.argv[1] && process.argv[1].endsWith('check-token-contrast.mjs')) {
  const failures = checkCss(readFileSync(CSS_PATH, 'utf8'));
  if (failures.length) {
    console.error(`Token contrast check FAILED — ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('Token contrast check: OK.');
}

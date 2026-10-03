import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHsl,
  hslToRgb,
  contrastRatio,
  composite,
  parseAppearanceBlocks,
  missingTokens,
  evaluatePair,
  pairKey,
  applyBaseline,
  pairsMissingReason,
  uncoveredStatuses,
  checkCss,
} from './check-token-contrast.mjs';
import { readFileSync } from 'node:fs';

const close = (actual, expected, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('parseHsl reads a space-separated triplet with fractional parts', () => {
  assert.deepEqual(parseHsl('38 30% 98%'), { h: 38, s: 0.3, l: 0.98 });
  const warning = parseHsl('32.132701 94.618834% 43.725490%');
  close(warning.h, 32.132701, 1e-6);
  close(warning.l, 0.4372549, 1e-6);
});

test('parseHsl rejects anything that is not an HSL triplet', () => {
  assert.throws(() => parseHsl('#fff'), /HSL/);
});

test('hslToRgb maps the primaries and the greys', () => {
  assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 1 }), [1, 1, 1]);
  assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 0 }), [0, 0, 0]);
  const [r, g, b] = hslToRgb({ h: 0, s: 1, l: 0.5 });
  assert.equal(r, 1);
  assert.equal(g, 0);
  assert.equal(b, 0);
});

test('contrastRatio matches WCAG reference ratios', () => {
  close(contrastRatio([1, 1, 1], [0, 0, 0]), 21, 0.001);
  close(contrastRatio([1, 1, 1], [1, 1, 1]), 1, 0.001);
  // #767676 on white is the canonical 4.54:1 AA-passing grey.
  close(contrastRatio([0x76 / 255, 0x76 / 255, 0x76 / 255], [1, 1, 1]), 4.54, 0.01);
  // Order does not matter.
  assert.equal(contrastRatio([0, 0, 0], [1, 1, 1]), contrastRatio([1, 1, 1], [0, 0, 0]));
});

test('composite blends a translucent colour over a surface', () => {
  assert.deepEqual(composite([1, 1, 1], 0.5, [0, 0, 0]), [0.5, 0.5, 0.5]);
  assert.deepEqual(composite([1, 0, 0], 1, [0, 0, 1]), [1, 0, 0]);
  assert.deepEqual(composite([1, 0, 0], 0, [0, 0, 1]), [0, 0, 1]);
});

const CSS = `
@layer base {
  :root {
    /* a comment with --fake: 1 2% 3%; inside */
    --background: 38 30% 98%;
    --foreground: 25 25% 11%;
  }
  .dark {
    --background: 25 12% 10%;
    --foreground: 38 20% 92%;
  }
}
@layer utilities { .bg-chrome { background-color: hsl(var(--chrome)); } }
@media print {
  .dark {
    --background: 38 30% 98%;
  }
}
`;

test('parseAppearanceBlocks separates :root, .dark and the print restore', () => {
  const { light, dark, print } = parseAppearanceBlocks(CSS);
  assert.deepEqual([...light.keys()], ['background', 'foreground']);
  assert.equal(light.get('background'), '38 30% 98%');
  assert.equal(dark.get('background'), '25 12% 10%');
  assert.equal(dark.get('foreground'), '38 20% 92%');
  assert.equal(print.get('background'), '38 30% 98%');
});

test('parseAppearanceBlocks ignores tokens named only inside comments', () => {
  const { light } = parseAppearanceBlocks(CSS);
  assert.equal(light.has('fake'), false);
});

test('parseAppearanceBlocks returns empty maps when a block is absent', () => {
  const { dark, print } = parseAppearanceBlocks(':root { --a: 0 0% 0%; }');
  assert.equal(dark.size, 0);
  assert.equal(print.size, 0);
});

test('missingTokens lists tokens present in the base but absent from the other', () => {
  const base = new Map([['a', '0 0% 0%'], ['b', '0 0% 0%'], ['c', '0 0% 0%']]);
  const other = new Map([['b', '0 0% 100%']]);
  assert.deepEqual(missingTokens(base, other), ['a', 'c']);
});

const tokens = new Map([
  ['background', '0 0% 100%'],
  ['foreground', '0 0% 0%'],
  ['muted', '0 0% 60%'],
  ['wash', '0 0% 0%'],
]);

test('evaluatePair passes a high-contrast pair and fails a low one', () => {
  const pass = evaluatePair(tokens, { fg: 'foreground', bg: 'background', min: 4.5 });
  assert.equal(pass.ok, true);
  close(pass.ratio, 21, 0.001);
  const fail = evaluatePair(tokens, { fg: 'muted', bg: 'background', min: 4.5 });
  assert.equal(fail.ok, false);
});

test('evaluatePair composites a translucent wash over the surface before measuring', () => {
  // 50% black wash over white is mid grey (#808080-ish); black text on it is ~5.3:1.
  const result = evaluatePair(tokens, {
    fg: 'foreground',
    bg: 'background',
    wash: { token: 'wash', alpha: 0.5 },
    min: 4.5,
  });
  assert.equal(result.ok, true);
  assert.ok(result.ratio < 21 && result.ratio > 5, `unexpected ratio ${result.ratio}`);
});

test('evaluatePair reports a missing token rather than throwing', () => {
  const result = evaluatePair(tokens, { fg: 'nope', bg: 'background', min: 4.5 });
  assert.equal(result.ok, false);
  assert.match(result.problem, /nope/);
});

test('pairKey names a pair, including its wash', () => {
  assert.equal(pairKey({ fg: 'a', bg: 'b' }), 'a on b');
  assert.equal(pairKey({ fg: 'a', bg: 'b', wash: { token: 'c', alpha: 0.15 } }), 'a on b over c/15');
});

const failing = { fg: 'a', bg: 'b', min: 4.5, ratio: 3, ok: false };
const passing = { fg: 'x', bg: 'y', min: 4.5, ratio: 7, ok: true };

test('applyBaseline accepts a recorded failure at or above its floor', () => {
  const baseline = new Map([['a on b', { floor: 2.9, reason: 'known' }]]);
  assert.deepEqual(applyBaseline([failing, passing], baseline), []);
});

test('applyBaseline flags a recorded failure that has regressed below its floor', () => {
  const baseline = new Map([['a on b', { floor: 3.5, reason: 'known' }]]);
  const [problem] = applyBaseline([failing, passing], baseline);
  assert.match(problem, /a on b.*regressed/);
});

test('applyBaseline flags an unrecorded failure', () => {
  const [problem] = applyBaseline([failing], new Map());
  assert.match(problem, /a on b is 3\.00:1, needs 4\.5:1/);
});

test('applyBaseline flags a stale baseline entry that now passes', () => {
  const baseline = new Map([['x on y', { floor: 3, reason: 'known' }]]);
  const [problem] = applyBaseline([passing], baseline);
  assert.match(problem, /x on y.*now passes/);
});

test('applyBaseline flags a baseline entry for a pair that no longer exists', () => {
  const baseline = new Map([['gone on b', { floor: 3, reason: 'known' }]]);
  const [problem] = applyBaseline([passing], baseline);
  assert.match(problem, /gone on b.*no longer in PAIRS/);
});

test('parseAppearanceBlocks keeps a final declaration that has no trailing semicolon', () => {
  const { light } = parseAppearanceBlocks(':root { --a: 0 0% 0%; --b: 0 0% 100% }');
  assert.equal(light.get('b'), '0 0% 100%');
});

test('pairsMissingReason flags a sub-AA pair with no why, and accepts one with a why', () => {
  assert.equal(pairsMissingReason([{ fg: 'a', bg: 'b', min: 4.5 }]).length, 0);
  assert.equal(pairsMissingReason([{ fg: 'a', bg: 'b', min: 3 }]).length, 1);
  assert.equal(pairsMissingReason([{ fg: 'a', bg: 'b', min: 3, why: 'icon only' }]).length, 0);
});

test('uncoveredStatuses lists status tokens the pair table does not know about', () => {
  const tokens = new Map([['status-enquiry', 'x'], ['status-newcomer', 'x'], ['muted', 'x']]);
  assert.deepEqual(uncoveredStatuses(tokens, ['enquiry']), ['newcomer']);
});

test('checkCss reports a dark block that omits a light token', () => {
  const failures = checkCss(':root { --a: 0 0% 0%; } .dark { } @media print { .dark { --a: 0 0% 0%; } }');
  assert.ok(failures.includes('.dark does not redefine --a'));
});

test('checkCss reports a print block that drifts from the light value', () => {
  const failures = checkCss(
    ':root { --a: 0 0% 0%; } .dark { --a: 0 0% 100%; } @media print { .dark { --a: 0 0% 50%; } }',
  );
  assert.ok(failures.some((f) => f.startsWith('@media print .dark sets --a')));
});

test('the real globals.css passes the contrast check', () => {
  const css = readFileSync(new URL('../apps/web/src/styles/globals.css', import.meta.url), 'utf8');
  assert.deepEqual(checkCss(css), []);
});

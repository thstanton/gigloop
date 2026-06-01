#!/usr/bin/env node
// Story-presence backstop (ADR-0030 / ADR-0024).
// Fails if a story-required file lacks a sibling `.stories.tsx`.
// Initial scope (low false-positive): components/common, components/ui, and pages/**/*Page.tsx.
// Feature presentational components are covered by explicit story tasks in their issues.
import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/web/src';
const BASELINE_FILE = 'scripts/story-presence-baseline.txt';

const baseline = existsSync(BASELINE_FILE)
  ? new Set(
      readFileSync(BASELINE_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    )
  : new Set();

const TARGETS = [
  { dir: `${ROOT}/components/common`, match: (f) => f.endsWith('.tsx') },
  { dir: `${ROOT}/components/ui`, match: (f) => f.endsWith('.tsx') },
  { dir: `${ROOT}/pages`, match: (f) => f.endsWith('Page.tsx') },
];

const isExcluded = (f) =>
  f.endsWith('.stories.tsx') || f.endsWith('.test.tsx') || f === 'index.tsx';

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const missing = [];
let baselinedCount = 0;
for (const { dir, match } of TARGETS) {
  for (const file of walk(dir)) {
    const name = file.split('/').pop();
    if (!match(name) || isExcluded(name)) continue;
    const story = file.replace(/\.tsx$/, '.stories.tsx');
    if (existsSync(story)) continue;
    if (baseline.has(file)) {
      baselinedCount += 1;
      continue;
    }
    missing.push(file);
  }
}

if (missing.length) {
  console.error(`Story-presence check FAILED — ${missing.length} new file(s) missing a sibling .stories.tsx:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error('\nEvery new component/page must ship with a story. Do not add it to the baseline.');
  process.exit(1);
}
console.log(`Story-presence check: OK (${baselinedCount} known gap(s) in baseline, paid down opportunistically).`);

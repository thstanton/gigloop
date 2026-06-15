#!/usr/bin/env node
// ralph-stream.mjs — formatter for `claude --output-format stream-json --verbose`.
// (ADR-0040 observability addition.)
//
// Pure core (`initialState` / `step` / `metricsLines` / `feedFor`) is exported and
// unit-tested; the CLI wrapper at the bottom does the stdin/file/feed I/O. Reading the
// stream-json events, it:
//   • prints a human-readable LIVE FEED to stderr, so a cold iteration is no longer a
//     black box — watch the terminal, or `watch cat ralph.current`;
//   • appends the raw JSONL to <jsonlPath> for post-hoc inspection;
//   • writes per-iteration metrics (turns / tokens / cost / duration) to <metricsPath>
//     as shell-greppable KEY=VALUE lines, for ralph.sh's heartbeat;
//   • rewrites <currentPath> (ralph.current) after every event as a live snapshot;
//   • prints ONLY the agent's final text on STDOUT, so ralph.sh's <selected>/<promise>
//     greps downstream are unchanged (this is the loop's decision channel).
//
// Robustness: a malformed line or event never throws — the stream keeps flowing. A
// crashed claude (no result event) still yields a metrics file with RESULT_SEEN=false.
//
// Usage: node ralph-stream.mjs <jsonlPath> <metricsPath> <currentPath>

import fs from 'node:fs';
import readline from 'node:readline';

const trunc = (s, n = 200) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

export function initialState() {
  return { turns: 0, model: '?', lastUsage: null, lastAction: 'starting…', finalText: '', metrics: null };
}

// Fold one parsed stream-json event into the running state. Pure: mutates and returns
// `state`, touches no I/O. `result` is the authoritative source of final metrics and
// the agent's final text; assistant events drive the live turn/token counters.
export function step(state, o) {
  if (!o || typeof o !== 'object') return state;
  switch (o.type) {
    case 'system':
      if (o.subtype === 'init') {
        state.model = o.model || state.model;
        state.lastAction = `init (model=${state.model}, ${(o.tools || []).length} tools)`;
      }
      break;
    case 'assistant': {
      state.turns += 1;
      const msg = o.message || {};
      if (msg.usage) state.lastUsage = msg.usage;
      state.model = msg.model || state.model;
      for (const block of msg.content || []) {
        if (block.type === 'text' && block.text && block.text.trim()) {
          state.lastAction = `say: ${trunc(block.text, 80)}`;
        } else if (block.type === 'tool_use') {
          state.lastAction = `tool: ${block.name}`;
        }
      }
      break;
    }
    case 'result': {
      const u = o.usage || {};
      state.metrics = {
        durationS: Math.round((o.duration_ms ?? 0) / 1000),
        numTurns: o.num_turns,
        in: u.input_tokens,
        out: u.output_tokens,
        cacheR: u.cache_read_input_tokens,
        cacheW: u.cache_creation_input_tokens,
        cost: typeof o.total_cost_usd === 'number' ? o.total_cost_usd.toFixed(4) : o.total_cost_usd,
        subtype: o.subtype,
        isError: o.is_error,
      };
      if (typeof o.result === 'string') state.finalText = o.result;
      state.lastAction = `result: ${o.subtype}`;
      break;
    }
    default:
      break;
  }
  return state;
}

// Shell-greppable KEY=VALUE metric lines for ralph.sh's heartbeat. Falls back to live
// counters (turns) and a supplied duration when no result event arrived (crash / kill),
// and flags that with RESULT_SEEN=false so a wasted iteration is visible in ralph.log.
export function metricsLines(state, { durationFallback = '' } = {}) {
  const m = state.metrics || {};
  const seen = state.metrics != null;
  return [
    `DURATION_S=${m.durationS ?? durationFallback}`,
    `NUM_TURNS=${m.numTurns ?? state.turns}`,
    `TOKENS_IN=${m.in ?? ''}`,
    `TOKENS_OUT=${m.out ?? ''}`,
    `CACHE_READ=${m.cacheR ?? ''}`,
    `CACHE_WRITE=${m.cacheW ?? ''}`,
    `COST_USD=${m.cost ?? ''}`,
    `RESULT_SUBTYPE=${m.subtype ?? 'none'}`,
    `RESULT_IS_ERROR=${seen ? m.isError : 'true'}`,
    `RESULT_SEEN=${seen ? 'true' : 'false'}`,
  ];
}

// Human-readable live-feed lines for one event (cosmetic; stderr only).
export function feedFor(o, state) {
  const out = [];
  if (!o || typeof o !== 'object') return out;
  if (o.type === 'system' && o.subtype === 'init') {
    out.push(`init (model=${o.model || state.model}, ${(o.tools || []).length} tools)`);
  } else if (o.type === 'assistant') {
    for (const block of (o.message || {}).content || []) {
      if (block.type === 'text' && block.text && block.text.trim()) out.push(`💬 ${trunc(block.text)}`);
      else if (block.type === 'tool_use') out.push(`⚙ ${block.name} ${trunc(JSON.stringify(block.input ?? {}), 120)}`);
    }
  } else if (o.type === 'result') {
    const m = state.metrics || {};
    out.push(`✔ ${o.subtype} — ${m.numTurns} turns, ${m.durationS}s, $${m.cost}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI wrapper — stdin → live feed / raw dump / metrics / status / final text.
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , jsonlPath, metricsPath, currentPath] = process.argv;
  const start = Date.now();
  const state = initialState();
  const safe = (fn) => { try { fn(); } catch { /* best-effort: never break the stream */ } };
  const elapsed = () => Math.round((Date.now() - start) / 1000);

  const writeCurrent = () => {
    if (!currentPath) return;
    const u = state.lastUsage || {};
    const snap =
      `ralph.current — ${new Date().toISOString()}\n` +
      `elapsed   ${elapsed()}s\n` +
      `turns     ${state.turns}\n` +
      `model     ${state.model}\n` +
      `last      ${state.lastAction}\n` +
      `tokens    in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'} ` +
      `cacheR=${u.cache_read_input_tokens ?? '?'} cacheW=${u.cache_creation_input_tokens ?? '?'}\n` +
      (state.metrics ? `cost      $${state.metrics.cost}\nresult    ${state.metrics.subtype}\n` : '');
    safe(() => fs.writeFileSync(currentPath, snap));
  };

  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (jsonlPath) safe(() => fs.appendFileSync(jsonlPath, line + '\n'));
    let o;
    try { o = JSON.parse(line); } catch { return; } // skip non-JSON / partial lines
    safe(() => step(state, o));                      // fold first: result-feed reads state.metrics
    safe(() => { for (const f of feedFor(o, state)) process.stderr.write(`  ⟫ ${f}\n`); });
    writeCurrent();
  });
  rl.on('close', () => {
    if (metricsPath) safe(() => fs.writeFileSync(metricsPath, metricsLines(state, { durationFallback: elapsed() }).join('\n') + '\n'));
    writeCurrent();
    // The ONLY thing on stdout: the agent's final text, so the <selected>/<promise>
    // greps in ralph.sh behave exactly as they did with plain `claude -p`.
    if (state.finalText) process.stdout.write(state.finalText);
  });
}

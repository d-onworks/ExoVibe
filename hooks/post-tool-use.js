#!/usr/bin/env node
// PostToolUse hook — fingerprints stderr, counts occurrences, and signals
// `/exovibe-ingest` when the same error has repeated (effort-dependent threshold).

const fs = require('fs');
const path = require('path');
const {
  EXOVIBE_ROOT,
  ensureDirs,
  readInput,
  errorHash,
  emitHookOutput,
  appendLog,
  loadConfig,
} = require('./lib/common');

const ERROR_LOOP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Transient network errors get a higher threshold to avoid noise.
const TRANSIENT_PATTERNS = [/ECONNREFUSED/i, /ETIMEDOUT/i, /ENOTFOUND/i, /ECONNRESET/i];

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const stderr =
      input?.tool_response?.stderr ||
      input?.tool_response?.error ||
      input?.tool_response?.errorMessage ||
      '';

    if (!stderr) {
      emitHookOutput({ continue: true });
      return;
    }

    const hash = errorHash(stderr);
    if (!hash) {
      emitHookOutput({ continue: true });
      return;
    }

    const counterFile = path.join(EXOVIBE_ROOT, 'state', 'error_counter.json');
    let counter = {};
    try {
      counter = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
    } catch {
      counter = {};
    }

    const now = Date.now();
    const entry = counter[hash] || {
      count: 0,
      first_seen: now,
      sessions: [],
      sample: String(stderr).slice(0, 200),
      ingested: false,
    };
    entry.count += 1;
    entry.last_seen = now;
    if (!entry.sessions.includes(input.session_id)) {
      entry.sessions.push(input.session_id);
    }
    counter[hash] = entry;
    fs.writeFileSync(counterFile, JSON.stringify(counter, null, 2));

    // Threshold depends on effort level; transient errors get a higher bar.
    const { effort, budget } = loadConfig();
    const baseThreshold = budget.error_loop_threshold;
    const isTransient = TRANSIENT_PATTERNS.some((p) => p.test(stderr));
    const threshold = isTransient ? baseThreshold + 7 : baseThreshold;
    const withinWindow = now - entry.first_seen <= ERROR_LOOP_WINDOW_MS;

    // Low effort: count but never signal.
    if (!budget.auto_ingest) {
      emitHookOutput({ continue: true });
      return;
    }

    if (entry.count >= threshold && withinWindow && !entry.ingested) {
      entry.ingested = true;
      counter[hash] = entry;
      fs.writeFileSync(counterFile, JSON.stringify(counter, null, 2));
      appendLog(`TRIGGER error-loop hash=${hash} count=${entry.count}`);

      emitHookOutput({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext:
            `[ExoVibe] Error loop detected (same error ${entry.count} times across ` +
            `${entry.sessions.length} session(s), hash=${hash}). Pattern sample: ` +
            `"${entry.sample.slice(0, 120)}". ` +
            `After resolving the immediate issue, invoke /exovibe-ingest to extract ` +
            `the lesson and prevent the 4th occurrence.`,
        },
      });
      return;
    }

    emitHookOutput({ continue: true });
  } catch (e) {
    process.stderr.write(`[exovibe:post-tool-use] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

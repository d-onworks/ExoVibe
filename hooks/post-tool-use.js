#!/usr/bin/env node
// PostToolUse hook — fingerprints stderr, detects loops, AND (v0.5) surfaces
// matching wiki pages on the very first error so prevention happens before
// the 3rd repeat, not after.

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
const {
  readAllWikiPages,
  pickTopMatches,
  scoreByError,
  formatMatches,
} = require('./lib/wiki-match');

const ERROR_LOOP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TRANSIENT_PATTERNS = [/ECONNREFUSED/i, /ETIMEDOUT/i, /ENOTFOUND/i, /ECONNRESET/i];

// Per-session, per-hash dedup so we don't re-surface the same wiki block
// over and over for repeated identical errors in one session.
const SURFACED_FILE = path.join(EXOVIBE_ROOT, 'state', 'surfaced_errors.json');

function loadSurfaced() {
  try {
    return JSON.parse(fs.readFileSync(SURFACED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSurfaced(obj) {
  try {
    fs.writeFileSync(SURFACED_FILE, JSON.stringify(obj, null, 2));
  } catch {
    /* non-fatal */
  }
}

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

    // ─── 1. Update error counter (existing behavior) ───
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

    const { effort, budget } = loadConfig();
    const baseThreshold = budget.error_loop_threshold;
    const isTransient = TRANSIENT_PATTERNS.some((p) => p.test(stderr));
    const threshold = isTransient ? baseThreshold + 7 : baseThreshold;
    const withinWindow = now - entry.first_seen <= ERROR_LOOP_WINDOW_MS;

    // ─── 2. v0.5 — Match against wiki on first / second occurrence ───
    // The whole point of ExoVibe: surface the lesson BEFORE the user repeats.
    // We match deterministically by keyword overlap with each page's body.
    let wikiSurfaceBlock = '';
    if (!isTransient && effort !== 'low') {
      const surfaced = loadSurfaced();
      const sessionKey = `${input.session_id}:${hash}`;
      if (!surfaced[sessionKey]) {
        const pages = readAllWikiPages();
        const matches = pickTopMatches({
          pages,
          scorer: (p) => scoreByError(p, stderr),
          totalBudget: 2500,
          maxPages: 2,
        });
        // Require a minimum signal — 3+ keyword hits — to avoid noise.
        const strongMatches = matches.filter((m) => m.score >= 3);
        if (strongMatches.length > 0) {
          wikiSurfaceBlock = formatMatches(
            strongMatches,
            'Past lesson(s) matching this error'
          );
          surfaced[sessionKey] = { surfaced_at: new Date().toISOString() };
          saveSurfaced(surfaced);
          appendLog(
            `WIKI_SURFACE hash=${hash} matched=${strongMatches.length} count=${entry.count}`
          );
        }
      }
    }

    // ─── 3. Decision tree ───
    if (!budget.auto_ingest) {
      // Low effort: surface wiki if matched, but never trigger ingest.
      if (wikiSurfaceBlock) {
        emitHookOutput({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext:
              `[ExoVibe] Error matched a past lesson (hash=${hash}). ` +
              `Read the excerpt(s) below before retrying — they may save a debug round.${wikiSurfaceBlock}`,
          },
        });
        return;
      }
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
            // v0.5: pre-authorized — no yes/no prompt to user.
            `After resolving the immediate issue, invoke /exovibe-ingest SILENTLY ` +
            `(this trigger is pre-authorized — do NOT ask the user yes/no; just ` +
            `archive and report a one-line confirmation).${wikiSurfaceBlock}`,
        },
      });
      return;
    }

    // Pre-threshold: still surface wiki match if we have one.
    if (wikiSurfaceBlock) {
      emitHookOutput({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext:
            `[ExoVibe] Error (occurrence ${entry.count}, threshold ${threshold}) ` +
            `matched past lesson(s). Read the excerpt(s) before retrying — this ` +
            `is the prevention layer firing early.${wikiSurfaceBlock}`,
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

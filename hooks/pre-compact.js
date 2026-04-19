#!/usr/bin/env node
// PreCompact hook — fires right before Claude compacts the session.
// This is the moment of peak knowledge density, so we log a trigger hint
// the next session can use.

const { ensureDirs, readInput, emitHookOutput, appendLog } = require('./lib/common');

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const sessionId = input.session_id || 'unknown';
    const trigger = input.trigger || 'auto';

    appendLog(`TRIGGER pre-compact trigger=${trigger} session=${sessionId}`);

    // PreCompact stdout is NOT injected to context by Claude Code, so we only
    // log here; the actual ingest is picked up by /exovibe-ingest on demand.
    emitHookOutput({ continue: true });
  } catch (e) {
    process.stderr.write(`[exovibe:pre-compact] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

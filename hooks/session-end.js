#!/usr/bin/env node
// SessionEnd hook — logs session termination and queues the session for
// later ingest by the /exovibe-ingest skill.

const fs = require('fs');
const path = require('path');
const { EXOVIBE_ROOT, ensureDirs, readInput, appendLog } = require('./lib/common');

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const sessionId = input.session_id || 'unknown';
    const reason = input.reason || 'unknown';

    appendLog(`SESSION_END reason=${reason} session=${sessionId}`);

    // Queue this session for later ingest. The next SessionStart can drain
    // the queue, or the user can call /exovibe-ingest manually.
    const pendingFile = path.join(EXOVIBE_ROOT, 'state', 'pending_ingest.json');
    let pending = [];
    try {
      pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    } catch {
      pending = [];
    }
    if (!pending.includes(sessionId)) {
      pending.push(sessionId);
      // Keep only the most recent 20 entries.
      if (pending.length > 20) pending = pending.slice(-20);
      fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
    }

    // SessionEnd stdout is not injected to context — no output needed.
  } catch (e) {
    process.stderr.write(`[exovibe:session-end] ${e.message}\n`);
  }
})();

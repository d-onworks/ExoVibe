#!/usr/bin/env node
// SessionStart hook — reads index.md and injects it into Claude's context.
// The stdout JSON's additionalContext becomes the session's opening context
// (subject to Claude Code's 10K cap).

const fs = require('fs');
const path = require('path');
const {
  EXOVIBE_ROOT,
  ensureDirs,
  readInput,
  emitHookOutput,
  appendLog,
  loadConfig,
} = require('./lib/common');

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const sessionId = input.session_id || 'unknown';
    const source = input.source || 'unknown';
    const { effort, budget } = loadConfig();

    appendLog(
      `SESSION_START source=${source} session=${sessionId} effort=${effort}`
    );

    const indexPath = path.join(EXOVIBE_ROOT, 'index.md');

    // First run — no index yet.
    if (!fs.existsSync(indexPath)) {
      emitHookOutput({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext:
            `[ExoVibe effort=${effort}] Knowledge base is empty on this machine. ` +
            'Type `#wiki` in any prompt to archive a lesson. ' +
            'Error loops (same error ×3) are auto-captured. ' +
            'Run `/exovibe-config effort high` if you want beginner-friendly auto-detection.',
        },
      });
      return;
    }

    const index = fs.readFileSync(indexPath, 'utf8');
    const cap = budget.max_context_chars;
    const payload =
      index.length > cap
        ? index.slice(0, cap) + '\n\n[...truncated — run /exovibe-query for full]'
        : index;

    emitHookOutput({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          `[ExoVibe effort=${effort}] Knowledge index loaded (budget=${cap} chars). ` +
          "Before answering the user's first prompt, scan for entries relevant to the " +
          `current working directory (${input.cwd || 'unknown'}) or likely task. ` +
          "If any entry looks relevant, Read the full page from `~/.claude/exovibe/wiki/`.\n\n" +
          '=== ExoVibe Index ===\n' +
          payload,
      },
    });
  } catch (e) {
    // Fail-safe: a hook error must never block the session.
    process.stderr.write(`[exovibe:session-start] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

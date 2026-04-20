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

// Build the insight-cue instruction for High-effort sessions.
// Returns '' when insight cue should not be active (effort != high,
// user_language not set, or explicitly disabled via overrides).
function buildInsightCueInstruction(effort, user_language, overrides) {
  const isHigh = effort === 'high';
  const midOptIn =
    effort === 'mid' &&
    Array.isArray(overrides?.enable_checks) &&
    overrides.enable_checks.includes('check_insight_cue');
  if (!isHigh && !midOptIn) return '';
  if (!user_language) return ''; // null user_language — wait for first ingest to set it.
  if (
    Array.isArray(overrides?.disable_checks) &&
    overrides.disable_checks.includes('check_insight_cue')
  ) {
    return '';
  }
  return (
    `\n\n[ExoVibe insight-cue watch] The user writes in language "${user_language}". ` +
    'When you notice they express a realization, "aha" moment, or lesson ' +
    'conclusion in that language (e.g. a clear "so that\'s why...", "the real ' +
    'cause is...", "next time do X", or the equivalent phrase in their native ' +
    'language), proactively suggest invoking /exovibe-ingest to archive it. ' +
    'Only nudge when the insight is genuinely durable — not for trivial ' +
    'realizations. One nudge per session is enough; do not nag.'
  );
}

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const sessionId = input.session_id || 'unknown';
    const source = input.source || 'unknown';
    const { effort, budget, user_language, raw } = loadConfig();

    appendLog(
      `SESSION_START source=${source} session=${sessionId} effort=${effort}`
    );

    const insightCueInstruction = buildInsightCueInstruction(
      effort,
      user_language,
      raw?.overrides
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
            'Run `/exovibe-config effort high` if you want beginner-friendly auto-detection.' +
            insightCueInstruction,
        },
      });
      return;
    }

    const index = fs.readFileSync(indexPath, 'utf8');
    const cap = budget.max_context_chars;
    // Reserve room for the insight-cue instruction so it never gets truncated.
    const reserved = insightCueInstruction.length;
    const indexCap = Math.max(200, cap - reserved);
    const payload =
      index.length > indexCap
        ? index.slice(0, indexCap) + '\n\n[...truncated — run /exovibe-query for full]'
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
          payload +
          insightCueInstruction,
      },
    });
  } catch (e) {
    // Fail-safe: a hook error must never block the session.
    process.stderr.write(`[exovibe:session-start] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

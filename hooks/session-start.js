#!/usr/bin/env node
// SessionStart hook — injects relevance-filtered context, not just the index.
//
// v0.5: stack-aware injection (cwd → wiki frontmatter stack tag match) +
// lint-recommendation reminder + insight-cue (unchanged).

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
const {
  detectCwdStack,
  readAllWikiPages,
  pickTopMatches,
  scoreByStack,
  formatMatches,
  evalLintRecommendation,
} = require('./lib/wiki-match');

// Insight-cue instruction (unchanged from v0.4).
function buildInsightCueInstruction(effort, user_language, overrides) {
  const isHigh = effort === 'high';
  const midOptIn =
    effort === 'mid' &&
    Array.isArray(overrides?.enable_checks) &&
    overrides.enable_checks.includes('check_insight_cue');
  if (!isHigh && !midOptIn) return '';
  if (!user_language) return '';
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

// Lint recommendation reminder — non-nag, only when thresholds crossed.
function buildLintReminder() {
  const r = evalLintRecommendation();
  if (!r.shouldRecommend) return '';

  const reasonText = {
    never_linted: `${r.pageCount} wiki pages and never linted`,
    many_ingests: `${r.ingestsSinceLint} ingests since last lint`,
    time_threshold: `last lint ${r.daysSinceLint}d ago, ${r.pageCount} pages`,
  }[r.reason] || '';

  return (
    `\n\n[ExoVibe maintenance] ${reasonText}. ` +
    'Suggest the user run `/exovibe-lint` ONLY when they hit a natural break ' +
    '(end of task, before a commit, or when explicitly asking about wiki health). ' +
    'Do NOT interrupt active work. One mention per session is enough.'
  );
}

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const sessionId = input.session_id || 'unknown';
    const source = input.source || 'unknown';
    const cwd = input.cwd || process.cwd();
    const { effort, budget, user_language, raw } = loadConfig();

    appendLog(
      `SESSION_START source=${source} session=${sessionId} effort=${effort}`
    );

    const insightCueInstruction = buildInsightCueInstruction(
      effort,
      user_language,
      raw?.overrides
    );
    const lintReminder = buildLintReminder();

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

    const cap = budget.max_context_chars;
    const reservedTail = insightCueInstruction.length + lintReminder.length;

    // Stack-aware injection: detect cwd stack, find matching pages, embed top excerpts.
    const cwdStack = detectCwdStack(cwd);
    let stackBlock = '';
    let stackBudget = 0;

    if (effort !== 'low' && cwdStack.length > 0) {
      // Allocate ~50% of remaining budget to stack matches; index gets the rest.
      stackBudget = Math.floor((cap - reservedTail) * 0.5);
      const pages = readAllWikiPages();
      const maxPages = effort === 'high' ? 3 : 2;
      const matches = pickTopMatches({
        pages,
        scorer: (p) => scoreByStack(p, cwdStack),
        totalBudget: stackBudget,
        maxPages,
      });
      if (matches.length > 0) {
        stackBlock = formatMatches(
          matches,
          `Stack-relevant lessons for [${cwdStack.join(', ')}]`
        );
        appendLog(
          `STACK_MATCH cwd_stack=[${cwdStack.join(',')}] matched=${matches.length}`
        );
      }
    }

    // Index — fits whatever is left after stack block + reservations.
    const index = fs.readFileSync(indexPath, 'utf8');
    const indexCap = Math.max(200, cap - reservedTail - stackBlock.length);
    const indexPayload =
      index.length > indexCap
        ? index.slice(0, indexCap) + '\n\n[...truncated — run /exovibe-query for full]'
        : index;

    const stackHint =
      cwdStack.length > 0
        ? `Detected stack: [${cwdStack.join(', ')}]. `
        : '';

    emitHookOutput({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          `[ExoVibe effort=${effort}] Knowledge index loaded (budget=${cap} chars). ` +
          stackHint +
          "Before answering the user's first prompt, scan for entries relevant to the " +
          `current working directory (${cwd}) or likely task. ` +
          "If an index entry looks relevant but its body is not auto-loaded below, " +
          "Read the full page from `~/.claude/exovibe/wiki/`.\n\n" +
          '=== ExoVibe Index ===\n' +
          indexPayload +
          stackBlock +
          lintReminder +
          insightCueInstruction,
      },
    });
  } catch (e) {
    process.stderr.write(`[exovibe:session-start] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

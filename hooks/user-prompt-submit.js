#!/usr/bin/env node
// UserPromptSubmit hook — records every prompt, detects manual #wiki tags,
// negative feedback, AND (v0.5) risky-keyword combinations that historically
// match archived antipatterns. Surfaces wiki excerpts BEFORE the LLM commits
// to a course of action.

const fs = require('fs');
const path = require('path');
const {
  EXOVIBE_ROOT,
  ensureDirs,
  readInput,
  monthDir,
  redactSecrets,
  emitHookOutput,
  appendLog,
  loadConfig,
} = require('./lib/common');
const {
  detectCwdStack,
  readAllWikiPages,
  pickTopMatches,
  scoreByKeywords,
  scoreByStack,
  formatMatches,
  detectRiskyKeywords,
} = require('./lib/wiki-match');

// Manual archive trigger tags.
const WIKI_TAG_REGEX = /(?:^|\s)(#wiki|!save|!archive)(?:\s|$|[:.,])/i;

// Negative feedback patterns (bilingual: Korean + English).
const NEGATIVE_FEEDBACK_REGEX =
  /(아니|안\s*돼|안\s*됨|작동\s*안|이전\s*코드가\s*나|롤백|되돌려|왜\s*이런|또\s*그러|no\s+it|doesn'?t\s+work|still\s+broken|revert\s+that|go\s+back|why\s+did\s+you)/i;

// Combined-scorer factory: prefer pages that match BOTH risky keywords AND
// the cwd stack. Stack-only or keyword-only matches still count but at half.
function combinedScorer(riskyKeywords, cwdStack) {
  return (page) => {
    const kw = scoreByKeywords(page, riskyKeywords);
    const st = scoreByStack(page, cwdStack);
    return kw * 2 + st;
  };
}

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const prompt = input.prompt || '';
    const sessionId = input.session_id || 'unknown';
    const cwd = input.cwd || process.cwd();

    // Append prompt to raw/ with secret redaction (unchanged).
    const rawDir = path.join(EXOVIBE_ROOT, 'raw', monthDir());
    fs.mkdirSync(rawDir, { recursive: true });
    const rawFile = path.join(rawDir, `session-${sessionId}.jsonl`);
    const record = {
      t: new Date().toISOString(),
      type: 'prompt',
      cwd: input.cwd,
      prompt: redactSecrets(prompt),
    };
    fs.appendFileSync(rawFile, JSON.stringify(record) + '\n');

    const { effort, budget } = loadConfig();

    // ─── 1. Manual #wiki / !save / !archive tag — pre-authorized ingest ───
    if (WIKI_TAG_REGEX.test(prompt)) {
      appendLog(`TRIGGER manual-tag session=${sessionId}`);
      emitHookOutput({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            "[ExoVibe] The user included a `#wiki` / `!save` / `!archive` tag — " +
            "this is an explicit pre-authorized archive request. " +
            "After fully answering their actual question, invoke `/exovibe-ingest` " +
            "SILENTLY: do NOT ask the user yes/no, do NOT confirm the slug or " +
            "category, just archive and emit one line of confirmation. " +
            `Session ID: ${sessionId}`,
        },
      });
      return;
    }

    // ─── 2. Negative feedback — both ingest signal AND query signal ───
    if (NEGATIVE_FEEDBACK_REGEX.test(prompt) && budget.check_negative_feedback) {
      appendLog(`SIGNAL negative-feedback session=${sessionId} effort=${effort}`);

      if (budget.check_negative_feedback === 'trigger') {
        emitHookOutput({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext:
              '[ExoVibe effort=high] User expressed negative feedback. ' +
              'TWO actions: (a) FIRST invoke /exovibe-query with the failed approach ' +
              'as the search term — there may already be a wiki entry warning ' +
              'against this exact mistake. ' +
              '(b) AFTER resolving the user\'s issue, invoke /exovibe-ingest SILENTLY ' +
              '(pre-authorized — do NOT ask yes/no) to archive the failure mode.',
          },
        });
        return;
      }
      // Mid: log only. Low: skip.
    }

    // ─── 3. v0.5 — Risky keyword + stack match → preventive wiki surface ───
    // This is the "warns you before you repeat the mistake" implementation.
    const riskyKeywords = detectRiskyKeywords(prompt);
    if (riskyKeywords.length > 0 && effort !== 'low') {
      const cwdStack = detectCwdStack(cwd);
      const pages = readAllWikiPages();
      const matches = pickTopMatches({
        pages,
        scorer: combinedScorer(riskyKeywords, cwdStack),
        totalBudget: 2500,
        maxPages: 2,
      });
      const strongMatches = matches.filter((m) => m.score >= 3);

      if (strongMatches.length > 0) {
        const surfaceBlock = formatMatches(
          strongMatches,
          `Risky keyword(s) ${JSON.stringify(riskyKeywords)} matched past lessons`
        );
        appendLog(
          `RISKY_KW kws=[${riskyKeywords.join(',')}] matched=${strongMatches.length}`
        );
        emitHookOutput({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext:
              `[ExoVibe prevention] The prompt mentions risky terms: ` +
              `${JSON.stringify(riskyKeywords)}. Past lesson(s) below matched. ` +
              `Read them BEFORE writing code. If the lesson conflicts with your ` +
              `instinct, prefer the lesson — that's the whole point of this ` +
              `system.${surfaceBlock}`,
          },
        });
        return;
      }
    }

    emitHookOutput({ continue: true });
  } catch (e) {
    process.stderr.write(`[exovibe:user-prompt-submit] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

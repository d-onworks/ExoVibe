#!/usr/bin/env node
// UserPromptSubmit hook — records every prompt to raw/ and detects `#wiki` tags.

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

// Manual archive trigger tags.
const WIKI_TAG_REGEX = /(?:^|\s)(#wiki|!save|!archive)(?:\s|$|[:.,])/i;

// Negative feedback patterns (bilingual: Korean + English).
const NEGATIVE_FEEDBACK_REGEX =
  /(아니|안\s*돼|안\s*됨|작동\s*안|이전\s*코드가\s*나|롤백|되돌려|no\s+it|doesn'?t\s+work|still\s+broken|revert\s+that|go\s+back)/i;

(async () => {
  try {
    ensureDirs();
    const input = await readInput();
    const prompt = input.prompt || '';
    const sessionId = input.session_id || 'unknown';

    // Append prompt to raw/ with secret redaction.
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

    // Manual tag detected → signal Claude to archive.
    if (WIKI_TAG_REGEX.test(prompt)) {
      appendLog(`TRIGGER manual-tag session=${sessionId}`);
      emitHookOutput({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            "[ExoVibe] The user included a `#wiki` / `!save` / `!archive` tag. " +
            "After fully answering their actual question, invoke the `/exovibe-ingest` skill " +
            "to archive this exchange as a permanent lesson in ~/.claude/exovibe/wiki/. " +
            `Session ID: ${sessionId}`,
        },
      });
      return;
    }

    // Negative feedback — behavior depends on effort level.
    const { effort, budget } = loadConfig();
    if (NEGATIVE_FEEDBACK_REGEX.test(prompt) && budget.check_negative_feedback) {
      appendLog(`SIGNAL negative-feedback session=${sessionId} effort=${effort}`);

      // High effort: trigger immediate ingest.
      if (budget.check_negative_feedback === 'trigger') {
        emitHookOutput({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext:
              '[ExoVibe effort=high] User expressed negative feedback. ' +
              'The previous approach likely failed. After answering, invoke /exovibe-ingest ' +
              'to archive the failure mode before it repeats.',
          },
        });
        return;
      }
      // Mid: log only. Low: skip (budget.check_negative_feedback === false).
    }

    emitHookOutput({ continue: true });
  } catch (e) {
    process.stderr.write(`[exovibe:user-prompt-submit] ${e.message}\n`);
    emitHookOutput({ continue: true });
  }
})();

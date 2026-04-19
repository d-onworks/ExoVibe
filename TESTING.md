# ExoVibe — Testing Guide

Verify ExoVibe's hooks and shared library with **zero external dependencies**.

## Quick Start

```bash
node tests/run-tests.js
```

Expected output:
```
Results: 21 passed, 0 failed (total 21)
✓ All tests passed.
```

## Test Layout

```
tests/
├── run-tests.js           # Single runner (Node stdlib assert only)
├── fixtures/
│   ├── sample-index.md
│   └── sample-antipattern.md
└── tmp/                   # Created during tests, removed on success
```

## Isolation Strategy

Every test overrides `EXOVIBE_ROOT` to `tests/tmp/exovibe` so the real
home directory is never touched. `hooks/lib/common.js` supports this
environment variable:

```javascript
const EXOVIBE_ROOT = process.env.EXOVIBE_ROOT || path.join(os.homedir(), '.claude', 'exovibe');
```

## Coverage (21 tests)

### common.js unit (5)
- `loadConfig` creates default Mid config on first run
- `errorHash` produces the same hash for semantically identical errors
- `errorHash` distinguishes semantically different errors
- `redactSecrets` masks API keys
- `redactSecrets` masks AWS and GitHub tokens

### session-start hook (3)
- Empty index emits a first-run onboarding message
- Populated index injects within Mid budget (4500)
- Low effort compresses injection below 2000 chars

### user-prompt-submit hook (5)
- `#wiki` tag triggers an ingest signal
- Plain prompts append to raw/ silently
- API keys are redacted before raw/ write
- Negative feedback + High effort triggers immediate ingest
- Negative feedback + Low effort is ignored

### post-tool-use hook — error loop E2E (3)
- Same error repeats 3 times → 3rd emits auto-ingest signal
- Low effort only counts, never signals
- Missing stderr passes through silently

### pre-compact / session-end (2)
- pre-compact appends a TRIGGER line to `log.md`
- session-end updates the `state/pending_ingest.json` queue

### Plugin co-existence (3)
- Every `additionalContext` starts with `[ExoVibe`
- All file writes stay inside `EXOVIBE_ROOT` (namespace respect)
- SessionStart injection respects Mid budget (4500 chars)

## Manual Integration Tests (Optional)

Install the plugin locally inside Claude Code:

```bash
# Inside a Claude Code session
/plugin marketplace add /c/src/ExoVibe
/plugin install exovibe
```

Checkpoints:
1. First SessionStart prints `[ExoVibe]` notice
2. Typing a `#wiki note` prompt causes Claude to offer `/exovibe-ingest`
3. `/exovibe-config show` displays the current effort level
4. `/exovibe-config effort high` updates `~/.claude/exovibe/config.json`

## Co-existence Verification

```bash
/plugin install superpowers   # or gstack, GSD
/plugin install exovibe
```

Checklist:
- [ ] Each plugin's `additionalContext` is identifiable by its prefix
- [ ] Combined SessionStart injection stays under 10,000 chars
- [ ] `~/.claude/superpowers/` and `~/.claude/exovibe/` are disjoint
- [ ] `/plugin list` shows both plugins without errors

## CI Integration (Future)

GitHub Actions example:

```yaml
- name: Run ExoVibe tests
  run: node tests/run-tests.js
```

Zero dependencies — no `npm install` needed.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tests write into real home | `EXOVIBE_ROOT` not honored | Check `hooks/lib/common.js` export |
| Error-loop test fails | `auto_ingest` logic regression | Verify `config.json` effort level |
| `#wiki` test fails | Tag regex drift | Inspect `WIKI_TAG_REGEX` in user-prompt-submit.js |

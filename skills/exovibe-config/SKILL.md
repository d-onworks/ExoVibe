---
name: exovibe-config
description: View or change ExoVibe's parsing effort level (low / mid / high) or the user's wiki-writing language. Use when the user asks to adjust how aggressively ExoVibe detects patterns, reports too much/too little noise, or wants to change the language their wiki content is written in. Writes ~/.claude/exovibe/config.json.
context: fork
agent: general-purpose
allowed-tools: Read Write Edit Bash(node *)
argument-hint: "effort <level> | language <code> | enable <check> | disable <check> | show"
---

# ExoVibe Config Skill

You manage the ExoVibe configuration file at `~/.claude/exovibe/config.json`.

## Output Language Rule

Read `user_language` from `config.json` at the start. Render all user-facing
labels, table headers, confirmation messages, and check-matrix descriptions in
that language. Keep config keys (`effort`, `user_language`, `overrides`, check
identifiers like `check_insight_cue`) in English — they are structured tokens
the system parses.

## Commands

### `show` (or no arguments)
Read and display current config:

```
Current ExoVibe Config:
  Effort:         mid
  Language:       ko (한국어) — applied to wiki content
  Last changed:   2026-04-20T00:00:00Z
  Overrides:      (none)

Effort level details (Mid = default):
  Max context chars:     4500
  Error loop threshold:  3
  Auto-ingest:           enabled
  Rollback detection:    enabled
  Package validation:    enabled
  Beginner safety rails: disabled
```

### `effort <level>`
Set the effort level. Valid levels:
- `low` — Minimalist, for pros. Only manual `#wiki` + error counting (no auto-ingest).
- `mid` — Default, sensible middle ground.
- `high` — Beginner-friendly, includes structure/library/hardcode detection.

Steps:
1. Validate `<level>` is one of `low | mid | high`
2. Read current `~/.claude/exovibe/config.json` (create with defaults if missing)
3. Update `effort` field + set `last_changed_at` to current ISO-8601
4. Write back
5. Append to `~/.claude/exovibe/log.md`: `<ISO> CONFIG effort=<old>→<new>`
6. Confirm to user with what will change

### `language <code>`
Set or change the language used for wiki content (Context / Root Cause /
Resolution / Avoid sections, `title:` value, index summaries). Does NOT
affect slugs, categories, tags, file paths, or any code — those always
stay in English for portability.

Valid codes:
- Any BCP-47 code: `en`, `ko`, `ja`, `zh`, `es`, `fr`, `de`, `pt`, `ru`,
  `vi`, `id`, `it`, `nl`, `pl`, `tr`, `ar`, `hi`, `th`, etc.
- `auto` — infer language from the user's recent prompts at each ingest.

Steps:
1. Validate `<code>` matches `^[a-zA-Z]{2,3}(-[A-Za-z0-9]+)*$` or is `auto`.
2. Read `~/.claude/exovibe/config.json` (create with defaults if missing).
3. Update `user_language` field + set `last_changed_at` to current ISO-8601.
4. Write back.
5. Append to `~/.claude/exovibe/log.md`: `<ISO> CONFIG language=<old>→<new>`.
6. Confirm to user:
   ```
   Wiki language set: <old> → <new>.
   Existing wiki pages are unchanged. New lessons you archive from now on
   will be written in this language.
   ```

Note: changing language does NOT retroactively translate existing pages.
If the user wants translation, they should say so explicitly — do not
assume.

### Example: setting to high
```
ExoVibe effort updated: mid → high

What's different now:
  + Error loop auto-ingest (same as before)
  + Rollback detection (same as before)
  + Package hallucination check (same as before)
  + NEW: 500-line file warning
  + NEW: Library mixing detection (axios+fetch, moment+dayjs)
  + NEW: Hardcoded secret detection
  + NEW: Error-swallowing catch block detection
  + NEW: console.log leftover warning
  + NEW: Commented-out code block detection
  + NEW: Unused import warning
  + NEW: Negative feedback triggers immediate ingest (was log-only)

Your next session will use these settings.
Revert anytime with `/exovibe-config effort mid`.
```

## Config File Schema

```json
{
  "effort": "low | mid | high",
  "user_language": "BCP-47 code | auto | null",
  "created_at": "ISO-8601",
  "last_changed_at": "ISO-8601 | null",
  "overrides": {
    "max_context_chars": null,
    "disable_checks": [],
    "error_loop_threshold": null
  }
}
```

`user_language` is `null` until the first ingest or sync setup prompts the
user to choose. After that, it holds a BCP-47 code (`en`, `ko`, `ja`, ...)
or the string `"auto"` (infer from recent prompts at each ingest).

## Advanced: Per-check override

Two override arrays live in `config.json`:
- `overrides.disable_checks` — turns OFF a check that the current effort level
  would otherwise enable
- `overrides.enable_checks` — turns ON a check that the current effort level
  does not enable by default (Mid users opting into a High-only check)

### `disable <check>`
```
/exovibe-config disable check_negative_feedback
```
Append `<check>` to `overrides.disable_checks`. Remove from
`overrides.enable_checks` if present (mutually exclusive).

### `enable <check>`
```
/exovibe-config enable check_insight_cue
```
Append `<check>` to `overrides.enable_checks`. Remove from
`overrides.disable_checks` if present. Useful for: Mid users who want
High-only features like `check_insight_cue` (proactive insight capture)
without switching their whole effort level.

After update, confirm to the user **in user_language** with a before/after
diff showing what changes in their sessions.

## Rules

1. **Never silently change effort** — always confirm with before/after summary
2. **Validate inputs** — reject unknown levels with a list of valid options
3. **Preserve unknown fields** — if user hand-edited config, don't strip extra keys
4. **Show clearly what changes** — diff the check matrix, not just the level string

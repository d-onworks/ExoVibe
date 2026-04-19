---
name: exovibe-config
description: View or change ExoVibe's parsing effort level (low / mid / high). Use when the user asks to adjust how aggressively ExoVibe detects patterns, or reports too much/too little noise from ExoVibe notifications. Writes ~/.claude/exovibe/config.json.
context: fork
agent: general-purpose
allowed-tools: Read Write Edit Bash(node *)
argument-hint: [effort low|mid|high] OR [show]
---

# ExoVibe Config Skill

You manage the ExoVibe configuration file at `~/.claude/exovibe/config.json`.

## Commands

### `show` (or no arguments)
Read and display current config:

```
Current ExoVibe Config:
  Effort:         mid
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
  "created_at": "ISO-8601",
  "last_changed_at": "ISO-8601 | null",
  "overrides": {
    "max_context_chars": null,
    "disable_checks": [],
    "error_loop_threshold": null
  }
}
```

## Advanced: Per-check override

If the user wants to keep Mid but disable a specific check:
```
/exovibe-config disable check_negative_feedback
```
Append `check_negative_feedback` to `overrides.disable_checks` array.

## Rules

1. **Never silently change effort** — always confirm with before/after summary
2. **Validate inputs** — reject unknown levels with a list of valid options
3. **Preserve unknown fields** — if user hand-edited config, don't strip extra keys
4. **Show clearly what changes** — diff the check matrix, not just the level string

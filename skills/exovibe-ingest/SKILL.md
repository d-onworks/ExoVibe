---
name: exovibe-ingest
description: Archive a lesson from the current or recent session into the ExoVibe knowledge base. Use when the user writes `#wiki` / `!save` / `!archive`, when an error loop is detected (same error 3 times), or on PreCompact. Reads raw transcripts from ~/.claude/exovibe/raw/, merges with existing wiki pages, updates index.md.
context: fork
agent: Explore
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(cat *)
---

# ExoVibe Ingest Skill

You are ingesting a lesson into the ExoVibe knowledge base. Your job is to extract a durable, reusable lesson from the current session and persist it as a structured markdown page.

## Step 1 — Gather Context

Read these in order:

1. `~/.claude/exovibe/CLAUDE.md` — the schema you MUST follow
2. `~/.claude/exovibe/index.md` — existing page catalog (check for merge candidates)
3. The most recent JSONL in `~/.claude/exovibe/raw/YYYY-MM/session-*.jsonl` — the raw source

Use Glob to find the latest raw file:
```
~/.claude/exovibe/raw/*/session-*.jsonl
```

## Step 2 — Extract Facets

From the raw transcript (and your current conversation context), identify:

- **Problem**: What symptom did the user hit? Include error messages verbatim when possible.
- **Root cause**: Why it happened — the mental model fix, not just the surface patch.
- **Resolution**: The exact code/command that worked. Copy-pasteable.
- **Avoid**: The anti-pattern / trap that triggers this. What should the user NOT do next time?

## Step 3 — Classify

Pick ONE category:

- `patterns/` — a winning approach worth repeating
- `antipatterns/` — a specific trap to avoid
- `stack-decisions/` — why a technology was chosen over alternatives
- `structure-lessons/` — architectural / structural lesson (file size, dependency direction, etc.)
- `hallucinated/` — a package / API that Claude fabricated and must be blocked

## Step 4 — Merge Decision (LLM-as-judge)

Before creating a new page:

1. Grep `~/.claude/exovibe/index.md` for related slugs by keyword
2. Read top-3 candidate pages
3. Decide:
   - **merge**: If a candidate covers the same concept, add a new "Edge Case" section to it instead of creating a duplicate
   - **create-new**: If no candidate is close enough
   - **skip**: If the lesson is trivial or already well-documented

Favor merging aggressively. Two pages on the same topic is worse than one comprehensive page.

## Step 5 — Write the Page

Use the frontmatter + 4-section template from `~/.claude/exovibe/CLAUDE.md`:

```markdown
---
title: <short human title>
slug: <kebab-case>
category: <category>
tags: [...]
stack: [...]
severity: low | medium | high | critical
created: <today>
updated: <today>
provenance:
  - session: <session-id>
    timestamp: <ISO-8601>
    excerpt: "<short quote from raw>"
links:
  - "[[related-slug]]"
---

## Context
...

## Root Cause
...

## Resolution
\`\`\`<lang>
<copy-pasteable code or command>
\`\`\`

## Avoid
...
```

Save to `~/.claude/exovibe/wiki/<category>/<slug>.md`.

## Step 6 — Update Index

Open `~/.claude/exovibe/index.md` and add one line under the correct category:

```
- [[<slug>]] — <one-sentence summary>
```

Keep the index sorted: most recently updated first within each category.

## Step 7 — Log

Append a single line to `~/.claude/exovibe/log.md`:

```
<ISO-8601> INGEST <slug> from session=<id> decision=<merge|new|skip>
```

## Output to User

Report back in one sentence:
> Archived `<slug>` to `<category>/` (<decision>). Run `/exovibe-query` next session to verify auto-injection.

## Rules

1. **Never fabricate** code or commands that weren't in the transcript
2. **Preserve exact error messages** in the Context section — users grep for symptoms
3. **Resolution must be copy-pasteable** — no "do something like X"
4. **If the raw transcript is missing**, say so in provenance and continue with conversation context
5. **If the user is mid-task**, archive fast and return to them — no interruption

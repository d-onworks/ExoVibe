---
name: exovibe-ingest
description: Archive a lesson from the current or recent session into the ExoVibe knowledge base. Use when the user writes `#wiki` / `!save` / `!archive`, when an error loop is detected (same error 3 times), or on PreCompact. Reads raw transcripts from ~/.claude/exovibe/raw/, merges with existing wiki pages, updates index.md.
context: fork
agent: general-purpose
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(cat *)
---

# ExoVibe Ingest Skill

You are ingesting a lesson into the ExoVibe knowledge base. Your job is to extract a durable, reusable lesson from the current session and persist it as a structured markdown page.

## Step 1 — Gather Context

Read these in order:

1. `~/.claude/exovibe/config.json` — check `user_language` (see Step 1a below)
2. `~/.claude/exovibe/CLAUDE.md` — the schema you MUST follow
3. `~/.claude/exovibe/index.md` — existing page catalog (check for merge candidates)
4. The most recent JSONL in `~/.claude/exovibe/raw/YYYY-MM/session-*.jsonl` — the raw source

Use Glob to find the latest raw file:
```
~/.claude/exovibe/raw/*/session-*.jsonl
```

## Step 1a — Resolve User's Writing Language (first-run only)

Read `user_language` from `~/.claude/exovibe/config.json`.

- **If set** (e.g. `"ko"`, `"en"`, `"ja"`, `"auto"`): use it for all prose
  generated in Steps 5 and 6. Skip the rest of Step 1a.
- **If `null` or missing** (first-run): prompt the user ONCE, save the answer,
  then continue. Use this prompt verbatim (multilingual greeting, so every
  user recognizes their own language):
  ```
  Before I write your first wiki page — what language should your
  personal lessons be written in?
  (어떤 언어로 작성할까요? / どの言語で? / ¿En qué idioma? / Quelle langue ?)

  Reply with a language code:
    en  English        ko  한국어         ja  日本語
    zh  中文           es  Español        fr  Français
    de  Deutsch        pt  Português      ru  Русский
    vi  Tiếng Việt     id  Bahasa Indonesia
    ... or any other BCP-47 code (it, nl, pl, tr, ar, hi, th, ...)
    auto  — detect from my recent prompts

  This only affects wiki content (Context / Root Cause / Resolution / Avoid
  sections and index summaries). Slugs, tags, categories, and file paths
  stay in English for portability.
  ```
- After the user replies, write the answer to `config.json`:
  ```json
  { ..., "user_language": "<code>", "last_changed_at": "<ISO-now>" }
  ```
- **`auto` handling**: If the user chose `auto`, scan the most recent 3–5
  user prompts in the raw transcript and infer the dominant language. Use
  that BCP-47 code for this ingest. Do NOT overwrite `"auto"` in config —
  re-detect each ingest so the content follows the user's current language.

## Step 1b — Language Application Rules

Once `user_language` is resolved (either from config or as `auto` detection):

- **Write in user_language**: section bodies (`## Context`, `## Root Cause`,
  `## Resolution`, `## Avoid`), the `title:` frontmatter value, and the
  one-sentence summary appended to `index.md`.
- **Keep in English**: `slug`, `category`, `tags:`, `stack:`, folder names
  (`patterns/`, `antipatterns/`, etc.), file names, frontmatter keys, code
  blocks, error messages quoted verbatim from logs, commit messages.
- **Code examples**: keep identifiers and code in English. Surrounding prose
  that explains the code goes in user_language.
- **If the user_language is unsupported by you** (very rare): fall back to
  English and append one line to `log.md`: `<ISO> LANG_FALLBACK from=<code> to=en`.

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

## Step 8 — One-Time Sync Onboarding Hint

After emitting the main output (Step 7), decide whether to show a gentle
one-line nudge about cross-machine sync. This runs at most once per
machine — never nag the user.

Decision flow:

1. Read `~/.claude/exovibe/state/onboarded.json` if it exists.
   - If the file exists AND contains `"sync_hint_shown": true`, **skip** this
     step entirely. Do not print anything.
2. Otherwise, check whether cross-machine sync is already configured:
   - If `~/.claude/exovibe/.git/` exists AND `git -C ~/.claude/exovibe remote`
     lists `origin`, sync is already set up. **Do not print the hint**, but
     DO write the state file so we never re-check.
   - If no `.git/` OR no `origin` remote, sync is not configured. Print
     the hint below.
3. Print the hint as a single appended line (only if step 2 determined
   sync is not yet configured):
   ```
   💡 Want these lessons on your other computers too? Run /exovibe-sync setup — it creates a private GitHub repo for you in one command.
   ```
4. Regardless of whether the hint was printed, write the state file so
   this logic never runs again on this machine:
   ```json
   {
     "sync_hint_shown": true,
     "sync_hint_shown_at": "<ISO-8601 now>",
     "sync_configured_at_time_of_check": <true|false>
   }
   ```
   Save to `~/.claude/exovibe/state/onboarded.json`. Create the `state/`
   directory if it does not exist.

Rules for this step:
- **Exactly one hint per machine, ever.** If a user nukes their state
  folder, the hint may reappear once — acceptable.
- **Never block the user.** This is a passive nudge, not a prompt. Do not
  ask questions here.
- **If Step 8 fails** (state dir unwritable, etc.), silently swallow the
  error — an unshown hint is better than a crashed ingest.

## Rules

1. **Never fabricate** code or commands that weren't in the transcript
2. **Preserve exact error messages** in the Context section — users grep for symptoms
3. **Resolution must be copy-pasteable** — no "do something like X"
4. **If the raw transcript is missing**, say so in provenance and continue with conversation context
5. **If the user is mid-task**, archive fast and return to them — no interruption

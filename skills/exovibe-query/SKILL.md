---
name: exovibe-query
description: Search the ExoVibe knowledge base for lessons relevant to the current task or question. Use when the user asks about something that might have been archived before, or when you want to verify an approach against past decisions. Reads index.md and loads the most relevant pages.
context: fork
agent: Explore
allowed-tools: Read Glob Grep Bash(rg *)
argument-hint: [optional keyword]
---

# ExoVibe Query Skill

You are searching the user's personal knowledge base for relevant past lessons.

## Step 1 — Understand the Query

The user's query arrives via `$ARGUMENTS` OR via the current conversation context:

- If `$ARGUMENTS` is provided, treat it as the explicit search query
- Otherwise, infer the query from recent conversation (what is the user trying to do?)

## Step 2 — Search Index First

Read `~/.claude/exovibe/index.md`. Scan every entry (it's designed to be cheap).

Match by:
- Keyword overlap in title
- Stack tags (if current project uses React, prioritize `stack: [react, ...]` entries)
- Category (patterns for "how do I", antipatterns for "why isn't this working")

Pick the top 3–5 candidate slugs.

## Step 3 — Load Pages

For each candidate, Read the full page from `~/.claude/exovibe/wiki/<category>/<slug>.md`.

Budget: **10,000 characters total**. If you exceed, prefer more pages with shorter excerpts over fewer complete pages.

## Step 4 — Synthesize

Present to the user:

```
## Relevant Lessons from Your ExoVibe

### [title] (category, updated YYYY-MM-DD)
<1-2 sentence synthesis of what this page says>
See: ~/.claude/exovibe/wiki/<path>

### [title] (...)
...

---
Apply any of these to the current task? If a lesson here conflicts with your instinct, check the Root Cause section before deciding.
```

## Step 5 — If Nothing Found

Respond:
> No ExoVibe entries matched "<query>". Consider adding `#wiki` to your next prompt so this pattern gets archived for future you.

## Step 6 — Log (optional)

If any page was returned, append to `~/.claude/exovibe/log.md`:
```
<ISO-8601> QUERY "<query>" returned=<slug1,slug2,...>
```

This helps the lint step detect which pages are actually being used vs orphaned.

## Rules

1. **Don't paraphrase away the copy-pasteable code** — if the lesson has a Resolution block with code, surface the code verbatim
2. **Respect provenance** — if a page has `severity: critical`, surface that badge in the synthesis
3. **Cross-references win** — if a page has `links: [[other-slug]]`, consider loading that too
4. **Budget discipline** — never exceed 10K chars in output; users have limited context too

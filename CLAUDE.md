# ExoVibe Wiki Schema

This document is the **single source of truth** for how ExoVibe organizes its knowledge base.
The LLM (you, reading this) uses this schema when performing `ingest` / `query` / `lint` operations.

---

## Directory Layout

```
~/.claude/exovibe/
├── raw/YYYY-MM/session-<id>.jsonl    # immutable source transcripts
├── wiki/
│   ├── patterns/<slug>.md             # successful patterns
│   ├── antipatterns/<slug>.md         # repeated mistakes
│   ├── stack-decisions/<slug>.md      # tech choice rationales
│   ├── structure-lessons/<slug>.md    # architecture lessons
│   └── hallucinated/<pkg-name>.md     # verified fake packages
├── state/
│   ├── error_counter.json             # error-hash → count + metadata
│   └── last_ingest.json               # last ingest timestamp per session
├── index.md                            # you maintain this
├── log.md                              # append-only, you append here
└── CLAUDE.md                           # this file
```

---

## Page Template

Every wiki page MUST have frontmatter + 4 sections.

```markdown
---
title: <short human title>
slug: <kebab-case-slug>
category: pattern | antipattern | stack-decision | structure-lesson | hallucinated
tags: [react, state-management]
stack: [nextjs, supabase]
severity: low | medium | high | critical
created: YYYY-MM-DD
updated: YYYY-MM-DD
provenance:
  - session: <session-id>
    timestamp: <ISO-8601>
    excerpt: "quote from raw transcript"
links:
  - "[[related-page-slug]]"
---

## Context
<when this comes up — minimum viable reproduction>

## Root Cause
<why it happens — the mental model fix>

## Resolution
<what to do instead — paste the actual winning code or command>

## Avoid
<specific triggers that cause the anti-pattern / the trap>
```

---

## Operations

### 1. Ingest
Trigger: `SessionEnd`, `PreCompact`, `#wiki` tag, or error-loop (count ≥ 3).

Steps:
1. Read the raw transcript from `raw/YYYY-MM/session-<id>.jsonl`
2. Extract facets: problem, cause, resolution, avoid
3. Use LLM-as-judge to find merge candidates in `index.md` (top-10 by title similarity)
4. Decide: `merge` | `create-new` | `skip` (if duplicate or trivial)
5. Write/update the MD file + Wikilinks
6. Update `index.md` (add entry or update entry's updated date)
7. Append to `log.md`: `YYYY-MM-DDTHH:MM:SSZ INGEST <slug> from <session-id>`

### 2. Query
Trigger: `SessionStart`.

Steps:
1. Read `index.md`
2. Given current cwd and recent files in context, pick 3–5 most relevant page slugs
3. Load those pages (full body, budget ≤ 10,000 chars total)
4. Inject into Claude context via hook stdout

### 3. Lint (weekly)
Trigger: manual `/exovibe-lint` or scheduled.

Checks:
- **Orphan pages**: MD files not listed in `index.md`
- **Dead links**: Wikilinks pointing to non-existent slugs
- **Contradictions**: two pages with opposite claims about same technology
- **Stale**: `updated > 90 days ago` AND no confirmation in recent sessions
- **Index drift**: pages that exist on disk but not in `index.md`

Output: `log.md` entry + HTML report to `~/.claude/exovibe/dashboard.html`.

### 4. Validate (on package install)
Trigger: `PostToolUse(Bash(npm install *))` etc.

Steps:
1. Extract package name from the bash command
2. Check `hallucinated/<pkg>.md` — if exists, BLOCK via exit code 2
3. Otherwise run `npm info <pkg>` or `pip show <pkg>`
4. If not found, create `hallucinated/<pkg>.md` and block install

---

## Index.md Format

```markdown
# ExoVibe Index

Last updated: 2026-04-20

## Patterns
- [[react-server-component-boundary]] — Server/client split rules for Next.js App Router
- [[zustand-persist-middleware]] — Persisting state without hydration mismatch

## Antipatterns
- [[react-useeffect-infinite-loop]] — useEffect deps that include new object each render
- [[axios-fetch-mixed]] — Never mix axios and fetch in same codebase

## Stack Decisions
- [[zustand-over-redux]] — Why we stopped reaching for Redux
- [[nextjs-over-remix]] — App Router was enough for our case

## Structure Lessons
- [[500-line-component-split]] — Extract-by-feature beats extract-by-type

## Hallucinated Packages (Verified Dead)
- [[supabase-auth-helpers-v2]] — Claude hallucinated v2; real is v1
```

---

## Log.md Format

Append-only. Each line:
```
YYYY-MM-DDTHH:MM:SSZ <OP> <slug-or-target> <context>
```

Example:
```
2026-04-19T10:22:00Z INGEST react-useeffect-infinite-loop from session-abc123
2026-04-19T10:22:01Z MERGE react-useeffect-infinite-loop (added edge case from session-abc123)
2026-04-19T15:40:00Z TRIGGER error-loop count=3 hash=abc123def456
2026-04-20T09:00:00Z LINT orphans=0 dead-links=2 stale=5
```

---

## Rules for the LLM

1. **Never fabricate provenance**. If you can't find the source session, say so in the `provenance` field.
2. **Merge aggressively**. Two pages covering the same concept is worse than one comprehensive page.
3. **Lead with Context section**. Users grep for symptoms, not solutions.
4. **Resolution must be copy-pasteable code or commands**. No hand-waving.
5. **Tag with stack**. Queries are filtered by stack first, category second.
6. **When in doubt, append to `log.md` and move on**. Perfect is the enemy of shipped.

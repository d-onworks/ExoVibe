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

## Output Language Rule

Read `user_language` from `~/.claude/exovibe/config.json` at the start. Emit all
user-facing text (headings, labels, synthesis prose, "nothing found" message)
in that language. Keep slugs, file paths, category names, and frontmatter keys
in English.

## Step 1 — Understand the Query

The user's query arrives via `$ARGUMENTS` OR via the current conversation context:

- If `$ARGUMENTS` is provided, treat it as the explicit search query
- Otherwise, infer the query from recent conversation (what is the user trying to do?)

## Step 2 — Search Index First

Read `~/.claude/exovibe/index.md`. Scan every entry (it's designed to be cheap).

Match by, in this order:
1. **Cwd stack auto-filter** — read the current working directory's
   `package.json` / `Cargo.toml` / `go.mod` / `requirements.txt` / `pubspec.yaml`
   and extract framework/library tags (e.g. `nextjs`, `supabase`, `drizzle`).
   Pages whose `stack:` frontmatter overlaps with cwd-detected tags are
   prioritized 2× over generic matches. If cwd has no manifest, skip this step.
2. **Triggers field** — pages with a `triggers:` frontmatter field whose
   tokens appear in the user query (case-insensitive substring) get a strong
   boost.
3. **Keyword overlap in title** — basic string match.
4. **Category hint** — `patterns/` for "how do I", `antipatterns/` for "why
   isn't this working", `stack-decisions/` for "should I use X or Y".

Pick the top 3–5 candidate slugs.

## Step 3 — Load Pages

For each candidate, Read the full page from `~/.claude/exovibe/wiki/<category>/<slug>.md`.

Budget: **10,000 characters total**. If you exceed, prefer more pages with shorter excerpts over fewer complete pages.

## Step 4 — Synthesize

Present to the user, **in user_language**. Example skeleton (translate every
label and prose to user_language; keep slugs/paths/category tokens in English):

```
(en)
## Relevant Lessons from Your ExoVibe

### [title] (category, updated YYYY-MM-DD)
<1-2 sentence synthesis of what this page says>
See: ~/.claude/exovibe/wiki/<path>

---
Apply any of these to the current task? If a lesson here conflicts with your instinct, check the Root Cause section before deciding.
```

```
(ko)
## ExoVibe에서 찾은 관련 레슨

### [title] (category, 업데이트 YYYY-MM-DD)
<1-2 문장 요약>
위치: ~/.claude/exovibe/wiki/<path>

---
지금 작업에 적용해볼까요? 감(感)과 충돌한다면 Root Cause 섹션을 먼저 확인하세요.
```

## Step 5 — If Nothing Found

Respond **in user_language**. Examples:
- en: `No ExoVibe entries matched "<query>". Consider adding #wiki to your next prompt so this pattern gets archived for future you.`
- ko: `"<query>"에 매칭되는 ExoVibe 엔트리 없음. 다음 프롬프트에 #wiki 태그를 붙이면 이 패턴이 미래의 자신을 위해 아카이브됩니다.`

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

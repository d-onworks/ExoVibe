---
name: exovibe-lint
description: Health-check the ExoVibe knowledge base. Detects orphan pages, dead Wikilinks, contradictory claims, stale entries, and index drift. Produces an HTML dashboard. Run manually or weekly.
context: fork
agent: general-purpose
allowed-tools: Read Write Glob Grep Bash(rg *) Bash(ls *) Bash(date *) Bash(node *)
---

# ExoVibe Lint Skill

You are performing a health check on the user's ExoVibe knowledge base.

## Step 1 — Inventory

Glob all wiki pages:
```
~/.claude/exovibe/wiki/**/*.md
```

Read `~/.claude/exovibe/index.md`.

## Step 2 — Run Five Checks

### Check A: Orphan Pages
Pages that exist on disk but NOT referenced in index.md.

### Check B: Dead Wikilinks
Grep all pages for `[[slug]]` patterns. Verify each target slug exists as a file.

### Check C: Contradictions
Group pages by stack tags. Within each group, scan for opposing claims (e.g., one page says "use Zustand", another says "Zustand has hydration issues, avoid").

Flag pairs for human review — don't auto-resolve.

### Check D: Stale Entries
Pages with `updated` frontmatter older than 90 days AND no mention in recent log.md queries.

### Check E: Index Drift
Index entries pointing to non-existent slugs.

## Step 3 — Write Report

Append to `~/.claude/exovibe/log.md`:
```
<ISO-8601> LINT orphans=N dead-links=N contradictions=N stale=N index-drift=N
```

Write a detailed report to `~/.claude/exovibe/lint-report.md` with each flagged item.

## Step 4 — Generate Dashboard HTML

대시보드는 **LLM이 아닌 독립 Node 스크립트**가 생성한다 (결정론적, 빠름, 토큰 소모 0):

```bash
node scripts/generate-dashboard.js
```

결과: `~/.claude/exovibe/dashboard.html` 단일 HTML 파일.
- 의존성 0 (Node 표준 라이브러리만, CDN 없음)
- 인라인 force layout 그래프 (~60줄 vanilla JS)
- 다크 테마, 카테고리별 색상
- 오프라인 동작

Lint 스킬은 이 커맨드만 실행하면 되고, HTML 직접 작성은 하지 않는다.

## Step 5 — Suggest Actions

Output to user:
```
## ExoVibe Health Report

- Orphan pages: N (review: ~/.claude/exovibe/lint-report.md)
- Dead links: N
- Contradictions: N (needs human decision)
- Stale entries: N (consider archiving or re-validating)
- Index drift: N (index.md needs regeneration)

Dashboard: ~/.claude/exovibe/dashboard.html
```

## Rules

1. **Never delete pages automatically** — orphans/stale are flagged, not removed
2. **Contradictions need human judgment** — surface them, don't pick a side
3. **Dashboard must work offline** — inline all CSS and data; D3.js via CDN is OK but have a text fallback
4. **Be fast** — lint should finish in under a minute even with 1,000 pages

#!/usr/bin/env node
/**
 * 데모 Vault 시드
 *
 * docs/demo-vault/ 디렉터리에 현실적인 레슨 10여개를 생성한다.
 * README 스크린샷 / 데모 영상용이며, 사용자의 실제 vault (~/.claude/exovibe/) 는 건드리지 않는다.
 *
 * 사용: node scripts/seed-demo-vault.js
 * 이후: node scripts/generate-dashboard.js --root docs/demo-vault
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'docs', 'demo-vault');

const LESSONS = [
  // patterns
  { category: 'patterns', slug: 'react-server-component-boundary', title: 'Server/Client Component 경계 규칙',
    tags: ['react', 'nextjs'], links: ['nextjs-app-router-over-pages'] },
  { category: 'patterns', slug: 'zustand-persist-middleware', title: 'Zustand persist 미들웨어 — hydration mismatch 없이',
    tags: ['state-management', 'react'], links: ['zustand-over-redux'] },
  { category: 'patterns', slug: 'postgres-partial-index-soft-delete', title: 'soft-delete 테이블에는 partial index 필수',
    tags: ['postgres', 'performance'], links: [] },

  // antipatterns
  { category: 'antipatterns', slug: 'react-useeffect-infinite-loop', title: 'useEffect deps에 새 객체 넣으면 무한 루프',
    tags: ['react', 'hooks'], links: ['react-server-component-boundary'] },
  { category: 'antipatterns', slug: 'axios-fetch-mixed', title: '같은 코드베이스에서 axios + fetch 혼용 금지',
    tags: ['http', 'consistency'], links: [] },
  { category: 'antipatterns', slug: 'catch-and-return-default', title: 'catch(e){ return 기본값 } — 에러 삼키기',
    tags: ['error-handling'], links: [] },
  { category: 'antipatterns', slug: 'mass-assignment-req-body', title: 'req.body 통째로 DB 전달 금지',
    tags: ['security', 'backend'], links: ['postgres-partial-index-soft-delete'] },

  // stack-decisions
  { category: 'stack-decisions', slug: 'zustand-over-redux', title: 'Zustand를 Redux 대신 선택한 이유',
    tags: ['state-management'], links: ['zustand-persist-middleware'] },
  { category: 'stack-decisions', slug: 'nextjs-app-router-over-pages', title: 'Next.js App Router 선택',
    tags: ['nextjs'], links: ['react-server-component-boundary'] },

  // structure-lessons
  { category: 'structure-lessons', slug: '500-line-component-split', title: '500줄 초과 컴포넌트는 feature별로 분리',
    tags: ['architecture', 'refactoring'], links: ['react-server-component-boundary'] },

  // hallucinated
  { category: 'hallucinated', slug: 'supabase-auth-helpers-v2', title: 'Claude가 환각한 @supabase/auth-helpers v2',
    tags: ['supabase', 'hallucinated'], links: [] },
  { category: 'hallucinated', slug: 'react-query-sync', title: 'react-query-sync 패키지 존재하지 않음',
    tags: ['react', 'hallucinated'], links: [] },
];

const BODY_TEMPLATES = {
  patterns: (l) => `## Context
${l.title} — 반복 사용 가능한 성공 패턴.

## Root Cause
실제 서비스에서 검증된 접근법.

## Resolution
코드/커맨드 예시 (생략 — 데모용).

## Avoid
잘못된 구현 예시 (생략 — 데모용).
`,
  antipatterns: (l) => `## Context
${l.title}.

## Root Cause
같은 실수를 반복하게 되는 구조적 원인.

## Resolution
올바른 대안.

## Avoid
이 패턴을 유발하는 트리거.
`,
  'stack-decisions': (l) => `## Context
기술 선택 시점의 요구사항.

## Root Cause
비교 대상들의 tradeoff.

## Resolution
${l.title}.

## Avoid
이 선택이 맞지 않는 케이스.
`,
  'structure-lessons': (l) => `## Context
구조적 결함이 드러난 상황.

## Root Cause
설계 초기의 단순화 선택이 시간이 지나 비용화.

## Resolution
리팩토링 방향.

## Avoid
같은 함정에 다시 빠지지 않는 규칙.
`,
  hallucinated: (l) => `## Context
${l.title}

## Root Cause
LLM이 존재하지 않는 패키지를 추천.

## Resolution
실제 존재하는 대안 사용.

## Avoid
\`npm info <pkg>\` 로 반드시 실존 확인 후 설치.
`,
};

function renderPage(l) {
  const today = '2026-04-20';
  const fm = `---
title: ${l.title}
slug: ${l.slug}
category: ${l.category.replace(/s$/, '').replace('-lesson', '-lesson')}
tags: [${l.tags.join(', ')}]
stack: []
severity: medium
created: ${today}
updated: ${today}
provenance:
  - session: demo-seed
    timestamp: ${today}T00:00:00Z
    excerpt: "(demo seed data)"
links:
${l.links.map(s => `  - "[[${s}]]"`).join('\n') || '  []'}
---

`;
  const body = BODY_TEMPLATES[l.category](l);
  const wikilinks = l.links.length ? `\n\n## Related\n${l.links.map(s => `- [[${s}]]`).join('\n')}\n` : '';
  return fm + body + wikilinks;
}

function main() {
  // 디렉터리 생성
  for (const cat of ['patterns', 'antipatterns', 'stack-decisions', 'structure-lessons', 'hallucinated']) {
    fs.mkdirSync(path.join(ROOT, 'wiki', cat), { recursive: true });
  }
  fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });

  // 각 레슨 파일 쓰기
  for (const l of LESSONS) {
    const filePath = path.join(ROOT, 'wiki', l.category, `${l.slug}.md`);
    fs.writeFileSync(filePath, renderPage(l), 'utf8');
  }

  // index.md
  const byCategory = {};
  for (const l of LESSONS) {
    (byCategory[l.category] = byCategory[l.category] || []).push(l);
  }
  const indexMd = `# ExoVibe Index

Last updated: 2026-04-20

## Patterns
${(byCategory.patterns || []).map(l => `- [[${l.slug}]] — ${l.title}`).join('\n')}

## Antipatterns
${(byCategory.antipatterns || []).map(l => `- [[${l.slug}]] — ${l.title}`).join('\n')}

## Stack Decisions
${(byCategory['stack-decisions'] || []).map(l => `- [[${l.slug}]] — ${l.title}`).join('\n')}

## Structure Lessons
${(byCategory['structure-lessons'] || []).map(l => `- [[${l.slug}]] — ${l.title}`).join('\n')}

## Hallucinated Packages (Verified Dead)
${(byCategory.hallucinated || []).map(l => `- [[${l.slug}]] — ${l.title}`).join('\n')}
`;
  fs.writeFileSync(path.join(ROOT, 'index.md'), indexMd, 'utf8');

  // log.md — 최근 활동 샘플
  const logLines = [
    '2026-04-14T09:12:03Z INGEST react-useeffect-infinite-loop from session-abc111',
    '2026-04-14T10:40:22Z TRIGGER error-loop count=3 hash=f2a1b3c4d5e6',
    '2026-04-15T14:05:11Z INGEST zustand-over-redux from session-abc112 decision=new',
    '2026-04-16T11:22:00Z INGEST axios-fetch-mixed from session-abc113',
    '2026-04-17T08:00:00Z LINT orphans=0 dead-links=0 stale=0 index-drift=0',
    '2026-04-17T16:45:50Z INGEST supabase-auth-helpers-v2 from session-abc114 decision=new',
    '2026-04-18T09:18:33Z VALIDATE react-query-sync blocked=hallucinated',
    '2026-04-18T12:44:09Z INGEST 500-line-component-split from session-abc115',
    '2026-04-19T10:02:17Z INGEST postgres-partial-index-soft-delete from session-abc116',
    '2026-04-19T15:27:40Z INGEST mass-assignment-req-body from session-abc117',
    '2026-04-20T08:15:22Z SESSION_START source=startup session=demo cwd=C:\\src\\my-app effort=mid',
    '2026-04-20T09:01:55Z INGEST catch-and-return-default from session-abc118',
  ];
  fs.writeFileSync(path.join(ROOT, 'log.md'), logLines.join('\n') + '\n', 'utf8');

  // config.json
  fs.writeFileSync(path.join(ROOT, 'config.json'),
    JSON.stringify({ effort: 'mid', created_at: '2026-04-20T00:00:00Z' }, null, 2), 'utf8');

  // state/error_counter.json — 3회 이상 반복된 에러 샘플
  const counter = {
    'f2a1b3c4d5e6': {
      count: 3,
      first_seen: Date.parse('2026-04-14T09:00:00Z'),
      last_seen: Date.parse('2026-04-14T10:40:22Z'),
      sessions: ['session-abc111', 'session-abc111', 'session-abc111'],
      sample: "TypeError: Cannot read property 'map' of undefined",
      ingested: true,
    },
    'a1b2c3d4e5f6': {
      count: 2,
      first_seen: Date.parse('2026-04-18T08:00:00Z'),
      last_seen: Date.parse('2026-04-18T09:00:00Z'),
      sessions: ['session-abc114', 'session-abc114'],
      sample: "npm ERR! 404 Not Found - react-query-sync",
      ingested: false,
    },
  };
  fs.writeFileSync(path.join(ROOT, 'state', 'error_counter.json'),
    JSON.stringify(counter, null, 2), 'utf8');

  console.log(`[ExoVibe] demo vault seeded → ${ROOT}`);
  console.log(`[ExoVibe] lessons=${LESSONS.length}`);
}

main();

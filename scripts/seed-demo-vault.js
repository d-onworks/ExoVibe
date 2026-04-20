#!/usr/bin/env node
/**
 * Demo Vault Seeder
 *
 * Generates a realistic set of ~10 lessons under docs/demo-vault/.
 * Used for README screenshots and demo videos; never touches the user's
 * real vault at ~/.claude/exovibe/.
 *
 * Usage: node scripts/seed-demo-vault.js
 * After: node scripts/generate-dashboard.js --root docs/demo-vault
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'docs', 'demo-vault');

const LESSONS = [
  // patterns
  { category: 'patterns', slug: 'react-server-component-boundary', title: 'Server/Client Component boundary rules',
    tags: ['react', 'nextjs'], links: ['nextjs-app-router-over-pages'] },
  { category: 'patterns', slug: 'zustand-persist-middleware', title: 'Zustand persist middleware without hydration mismatch',
    tags: ['state-management', 'react'], links: ['zustand-over-redux'] },
  { category: 'patterns', slug: 'postgres-partial-index-soft-delete', title: 'Partial index is mandatory on soft-delete tables',
    tags: ['postgres', 'performance'], links: [] },

  // antipatterns
  { category: 'antipatterns', slug: 'react-useeffect-infinite-loop', title: 'New object in useEffect deps causes an infinite loop',
    tags: ['react', 'hooks'], links: ['react-server-component-boundary'] },
  { category: 'antipatterns', slug: 'axios-fetch-mixed', title: 'Never mix axios and fetch in the same codebase',
    tags: ['http', 'consistency'], links: [] },
  { category: 'antipatterns', slug: 'catch-and-return-default', title: 'catch(e){ return default } swallows errors',
    tags: ['error-handling'], links: [] },
  { category: 'antipatterns', slug: 'mass-assignment-req-body', title: 'Never pass req.body straight into the DB',
    tags: ['security', 'backend'], links: ['postgres-partial-index-soft-delete'] },

  // stack-decisions
  { category: 'stack-decisions', slug: 'zustand-over-redux', title: 'Why we chose Zustand instead of Redux',
    tags: ['state-management'], links: ['zustand-persist-middleware'] },
  { category: 'stack-decisions', slug: 'nextjs-app-router-over-pages', title: 'Choosing Next.js App Router',
    tags: ['nextjs'], links: ['react-server-component-boundary'] },

  // structure-lessons
  { category: 'structure-lessons', slug: '500-line-component-split', title: 'Split components over 500 lines by feature',
    tags: ['architecture', 'refactoring'], links: ['react-server-component-boundary'] },

  // hallucinated
  { category: 'hallucinated', slug: 'supabase-auth-helpers-v2', title: 'Claude hallucinated @supabase/auth-helpers v2',
    tags: ['supabase', 'hallucinated'], links: [] },
  { category: 'hallucinated', slug: 'react-query-sync', title: 'react-query-sync package does not exist',
    tags: ['react', 'hallucinated'], links: [] },
];

const BODY_TEMPLATES = {
  patterns: (l) => `## Context
${l.title} — a reusable success pattern.

## Root Cause
An approach validated in production.

## Resolution
Code / command example (omitted — demo data).

## Avoid
Incorrect implementation example (omitted — demo data).
`,
  antipatterns: (l) => `## Context
${l.title}.

## Root Cause
The structural reason this mistake keeps recurring.

## Resolution
The correct alternative.

## Avoid
Triggers that lead you back into this pattern.
`,
  'stack-decisions': (l) => `## Context
Requirements at the time of the tech choice.

## Root Cause
Tradeoffs between the alternatives considered.

## Resolution
${l.title}.

## Avoid
Cases where this choice is a poor fit.
`,
  'structure-lessons': (l) => `## Context
A structural weakness surfaced as the component grew.

## Root Cause
Early simplifications compounded into costly coupling over time.

## Resolution
Refactor by feature boundary, not by file type.

## Avoid
Rules that keep you from falling into the same trap again.
`,
  hallucinated: (l) => `## Context
${l.title}

## Root Cause
The LLM recommended a package that was never published.

## Resolution
Use a real alternative that actually exists on the registry.

## Avoid
Always verify with \`npm info <pkg>\` before installing.
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
  // Create directories
  for (const cat of ['patterns', 'antipatterns', 'stack-decisions', 'structure-lessons', 'hallucinated']) {
    fs.mkdirSync(path.join(ROOT, 'wiki', cat), { recursive: true });
  }
  fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });

  // Write each lesson file
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

  // log.md — sample of recent activity
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
    '2026-04-20T08:15:22Z SESSION_START source=startup session=demo effort=mid',
    '2026-04-20T09:01:55Z INGEST catch-and-return-default from session-abc118',
  ];
  fs.writeFileSync(path.join(ROOT, 'log.md'), logLines.join('\n') + '\n', 'utf8');

  // config.json
  fs.writeFileSync(path.join(ROOT, 'config.json'),
    JSON.stringify({ effort: 'mid', created_at: '2026-04-20T00:00:00Z' }, null, 2), 'utf8');

  // state/error_counter.json — sample errors repeated 3+ times
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

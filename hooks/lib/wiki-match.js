// Wiki matching utilities — shared by SessionStart / PostToolUse / UserPromptSubmit.
// Goal: lift relevance filtering from "LLM eyeballs the index" to deterministic
// stack/error/keyword matching at hook time.
//
// Zero npm dependencies (Node stdlib only).

const fs = require('fs');
const path = require('path');
const { EXOVIBE_ROOT } = require('./common');

// Common stack package signals → normalized stack tag.
// Matched against package.json deps + lockfile names + manifest filenames.
const STACK_SIGNALS = [
  // JS / TS frameworks
  { tag: 'nextjs', match: /^next$/i, kind: 'dep' },
  { tag: 'react', match: /^react$/i, kind: 'dep' },
  { tag: 'vue', match: /^vue$/i, kind: 'dep' },
  { tag: 'svelte', match: /^svelte$/i, kind: 'dep' },
  { tag: 'remix', match: /^@remix-run\//i, kind: 'dep' },
  { tag: 'nuxt', match: /^nuxt$/i, kind: 'dep' },
  // Backend / DB
  { tag: 'supabase', match: /^@supabase\//i, kind: 'dep' },
  { tag: 'drizzle', match: /^drizzle-orm$/i, kind: 'dep' },
  { tag: 'prisma', match: /^@?prisma/i, kind: 'dep' },
  { tag: 'postgres', match: /^(pg|postgres|postgresql)$/i, kind: 'dep' },
  { tag: 'mongodb', match: /^mongodb$/i, kind: 'dep' },
  { tag: 'redis', match: /^(redis|ioredis)$/i, kind: 'dep' },
  // Auth / 3rd party
  { tag: 'clerk', match: /^@clerk\//i, kind: 'dep' },
  { tag: 'auth0', match: /^@auth0\//i, kind: 'dep' },
  { tag: 'stripe', match: /^stripe$/i, kind: 'dep' },
  // Build / runtime
  { tag: 'vite', match: /^vite$/i, kind: 'dep' },
  { tag: 'webpack', match: /^webpack$/i, kind: 'dep' },
  { tag: 'tailwind', match: /^tailwindcss$/i, kind: 'dep' },
  { tag: 'shadcn', match: /^@shadcn\//i, kind: 'dep' },
  { tag: 'radix', match: /^@radix-ui\//i, kind: 'dep' },
  // Testing
  { tag: 'vitest', match: /^vitest$/i, kind: 'dep' },
  { tag: 'jest', match: /^jest$/i, kind: 'dep' },
  { tag: 'playwright', match: /^@playwright\//i, kind: 'dep' },
  // Mobile
  { tag: 'flutter', match: /pubspec\.yaml/i, kind: 'file' },
  { tag: 'expo', match: /^expo$/i, kind: 'dep' },
  // Vercel / Cloudflare
  { tag: 'vercel', match: /^@vercel\//i, kind: 'dep' },
  { tag: 'cloudflare', match: /^@cloudflare\//i, kind: 'dep' },
];

// Detect stack tags from cwd by reading manifest files.
// Returns array of tag strings, e.g. ['nextjs', 'supabase', 'drizzle'].
function detectCwdStack(cwd) {
  if (!cwd) return [];
  const tags = new Set();

  const tryRead = (file) => {
    try {
      return fs.readFileSync(path.join(cwd, file), 'utf8');
    } catch {
      return null;
    }
  };

  // package.json — Node ecosystems
  const pkgRaw = tryRead('package.json');
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      const deps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {}),
      };
      for (const depName of Object.keys(deps)) {
        for (const sig of STACK_SIGNALS) {
          if (sig.kind === 'dep' && sig.match.test(depName)) tags.add(sig.tag);
        }
      }
    } catch {
      // malformed package.json — skip
    }
  }

  // Cargo.toml — Rust
  if (tryRead('Cargo.toml')) tags.add('rust');
  // go.mod — Go
  if (tryRead('go.mod')) tags.add('go');
  // requirements.txt / pyproject.toml — Python
  if (tryRead('requirements.txt') || tryRead('pyproject.toml')) tags.add('python');
  // pubspec.yaml — Flutter
  if (tryRead('pubspec.yaml')) tags.add('flutter');
  // Gemfile — Ruby
  if (tryRead('Gemfile')) tags.add('ruby');

  return Array.from(tags);
}

// Lightweight YAML frontmatter parser. Extracts the keys we care about:
// title, slug, category, tags, stack, severity, env-scope, triggers.
// Does NOT handle nested objects (provenance) — those are skipped.
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { frontmatter: {}, body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: content };
  const yamlBlock = content.slice(3, end).trim();
  const body = content.slice(end + 4).replace(/^\n/, '');

  const fm = {};
  const lines = yamlBlock.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const val = m[2].trim();

    // Inline array: tags: [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      i++;
      continue;
    }

    // Block array: tags:\n  - a\n  - b
    if (val === '') {
      const arr = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        arr.push(lines[j].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, '').trim());
        j++;
      }
      if (arr.length > 0) {
        fm[key] = arr;
        i = j;
        continue;
      }
      // Empty value with no array — skip (probably nested object like provenance:)
      i = j;
      continue;
    }

    // Scalar
    fm[key] = val.replace(/^['"]|['"]$/g, '');
    i++;
  }

  return { frontmatter: fm, body };
}

// Walk wiki/ and return parsed pages. Cached per-process.
let _pagesCache = null;
let _pagesCacheTime = 0;
const PAGES_CACHE_TTL = 30_000; // 30s — hooks are short-lived but tests may reuse.

function readAllWikiPages() {
  const now = Date.now();
  if (_pagesCache && now - _pagesCacheTime < PAGES_CACHE_TTL) return _pagesCache;

  const wikiDir = path.join(EXOVIBE_ROOT, 'wiki');
  const pages = [];
  if (!fs.existsSync(wikiDir)) {
    _pagesCache = pages;
    _pagesCacheTime = now;
    return pages;
  }

  for (const category of fs.readdirSync(wikiDir)) {
    const catDir = path.join(wikiDir, category);
    let stat;
    try {
      stat = fs.statSync(catDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(catDir, file);
      let raw;
      try {
        raw = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      const { frontmatter, body } = parseFrontmatter(raw);
      pages.push({
        path: fullPath,
        category,
        slug: frontmatter.slug || file.replace(/\.md$/, ''),
        title: frontmatter.title || frontmatter.slug || file,
        stack: Array.isArray(frontmatter.stack) ? frontmatter.stack : [],
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        severity: frontmatter.severity || 'medium',
        envScope: frontmatter['env-scope'] || frontmatter.env_scope || 'both',
        triggers: Array.isArray(frontmatter.triggers) ? frontmatter.triggers : [],
        updated: frontmatter.updated || frontmatter.created || '1970-01-01',
        body,
      });
    }
  }

  _pagesCache = pages;
  _pagesCacheTime = now;
  return pages;
}

// Score a page against current cwd stack.
// Returns 0 if no overlap. Higher = better match.
function scoreByStack(page, cwdStack) {
  if (!cwdStack.length || !page.stack.length) return 0;
  let score = 0;
  for (const tag of page.stack) {
    if (cwdStack.includes(tag)) score += 1;
  }
  return score;
}

// Score by error message — simple substring match against Context section
// keywords. Cheap, deterministic, surprisingly effective.
function scoreByError(page, errorMessage) {
  if (!errorMessage) return 0;
  const haystack = page.body.toLowerCase();
  const errTokens = String(errorMessage)
    .toLowerCase()
    .split(/[\s,.()<>"'`\[\]{}]+/)
    .filter((t) => t.length >= 4 && !/^[0-9]+$/.test(t))
    .slice(0, 20);

  let hits = 0;
  for (const tok of errTokens) {
    if (haystack.includes(tok)) hits++;
  }
  return hits;
}

// Score by keyword set (used for prompt-keyword matching + ingest triggers).
function scoreByKeywords(page, keywords) {
  if (!keywords || !keywords.length) return 0;
  const haystack = (page.body + ' ' + page.title + ' ' + page.triggers.join(' '))
    .toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (haystack.includes(String(kw).toLowerCase())) hits++;
  }
  return hits;
}

// Severity multiplier — critical/high pages float to the top.
function severityWeight(severity) {
  return { critical: 2.0, high: 1.5, medium: 1.0, low: 0.7 }[severity] || 1.0;
}

// Pick top-N matching pages within a character budget.
// Each selected page is excerpted (first ~budgetPerPage chars of body).
function pickTopMatches({ pages, scorer, totalBudget, maxPages = 3 }) {
  const scored = pages
    .map((p) => ({ page: p, score: scorer(p) * severityWeight(p.severity) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.page.updated || '').localeCompare(a.page.updated || ''))
    .slice(0, maxPages);

  if (!scored.length) return [];

  const budgetPerPage = Math.floor(totalBudget / scored.length);
  return scored.map(({ page, score }) => ({
    page,
    score,
    excerpt: excerptBody(page.body, budgetPerPage),
  }));
}

// Take the head of body, prefer cutting at a section boundary.
function excerptBody(body, maxChars) {
  if (body.length <= maxChars) return body;
  const slice = body.slice(0, maxChars);
  // Prefer cutting before a `## ` heading or paragraph break.
  const lastBreak = Math.max(
    slice.lastIndexOf('\n\n## '),
    slice.lastIndexOf('\n\n')
  );
  if (lastBreak > maxChars * 0.5) return slice.slice(0, lastBreak) + '\n\n[...truncated]';
  return slice + '...[truncated]';
}

// Format selected matches as a single context block.
function formatMatches(matches, headerLabel = 'Stack-relevant lessons') {
  if (!matches.length) return '';
  const blocks = matches.map(({ page, excerpt }) => {
    const meta = [
      page.category,
      page.severity ? `severity:${page.severity}` : '',
      page.envScope && page.envScope !== 'both' ? `env:${page.envScope}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return `### [[${page.slug}]] (${meta})\n${excerpt}`;
  });
  return `\n\n=== ${headerLabel} (auto-loaded) ===\n${blocks.join('\n\n')}`;
}

// Detect when the user is at risk of repeating a known mistake.
// Risky keyword dictionary — words that historically mark env-sensitive or
// destructive operations. Combined with stack tags for precision.
const RISKY_KEYWORDS = [
  'max:', 'pool', 'connection',
  'migration', 'migrate',
  'production', 'prod ', 'deploy', 'release',
  'drop ', 'delete from', 'truncate',
  'force', '--force', '-f ',
  'reset --hard', 'rebase',
  'rm -rf',
  'session token', 'secret', 'api key',
];

function detectRiskyKeywords(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  return RISKY_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

// Lint recommendation logic — used by SessionStart.
// Returns { shouldRecommend, pageCount, lastLintISO, ingestsSinceLint }.
function evalLintRecommendation() {
  const pages = readAllWikiPages();
  const pageCount = pages.length;

  const logPath = path.join(EXOVIBE_ROOT, 'log.md');
  let logContent = '';
  try {
    logContent = fs.readFileSync(logPath, 'utf8');
  } catch {
    return {
      shouldRecommend: pageCount >= 30,
      pageCount,
      lastLintISO: null,
      ingestsSinceLint: pageCount,
      reason: 'never_linted',
    };
  }

  const lintLines = logContent.split('\n').filter((l) => / LINT /.test(l));
  const lastLintLine = lintLines[lintLines.length - 1];
  const lastLintISO = lastLintLine ? lastLintLine.match(/^([\d\-T:.Z]+)/)?.[1] || null : null;

  let daysSinceLint = Infinity;
  let ingestsSinceLint = 0;
  if (lastLintISO) {
    daysSinceLint = (Date.now() - new Date(lastLintISO).getTime()) / (1000 * 60 * 60 * 24);
    const allLines = logContent.split('\n');
    let afterLint = false;
    for (const line of allLines) {
      if (line.startsWith(lastLintISO)) {
        afterLint = true;
        continue;
      }
      if (afterLint && / INGEST /.test(line)) ingestsSinceLint++;
    }
  } else {
    ingestsSinceLint = (logContent.match(/ INGEST /g) || []).length;
    daysSinceLint = Infinity;
  }

  let shouldRecommend = false;
  let reason = '';
  if (!lastLintISO && pageCount >= 30) {
    shouldRecommend = true;
    reason = 'never_linted';
  } else if (ingestsSinceLint >= 10) {
    shouldRecommend = true;
    reason = 'many_ingests';
  } else if (daysSinceLint >= 14 && pageCount >= 20) {
    shouldRecommend = true;
    reason = 'time_threshold';
  }

  return {
    shouldRecommend,
    pageCount,
    lastLintISO,
    daysSinceLint: Number.isFinite(daysSinceLint) ? Math.floor(daysSinceLint) : null,
    ingestsSinceLint,
    reason,
  };
}

module.exports = {
  detectCwdStack,
  parseFrontmatter,
  readAllWikiPages,
  scoreByStack,
  scoreByError,
  scoreByKeywords,
  pickTopMatches,
  formatMatches,
  RISKY_KEYWORDS,
  detectRiskyKeywords,
  evalLintRecommendation,
};

#!/usr/bin/env node
/**
 * ExoVibe 대시보드 생성기
 *
 * ~/.claude/exovibe/ 의 현재 상태를 읽어서
 * 단일 HTML 파일 (dashboard.html) 로 렌더한다.
 *
 * - 의존성 0 (Node 표준 라이브러리만)
 * - 오프라인 동작 (D3.js CDN 포함하되 실패 시 목록 폴백)
 * - 결정론적 (동일 입력 → 동일 출력)
 *
 * 사용: node scripts/generate-dashboard.js [--root <path>]
 * 기본 root: ~/.claude/exovibe
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// --- 설정 ---------------------------------------------------------------

const ARGS = process.argv.slice(2);
const rootArgIdx = ARGS.indexOf('--root');
const ROOT = rootArgIdx >= 0
  ? ARGS[rootArgIdx + 1]
  : path.join(os.homedir(), '.claude', 'exovibe');

const WIKI_DIR = path.join(ROOT, 'wiki');
const INDEX_PATH = path.join(ROOT, 'index.md');
const LOG_PATH = path.join(ROOT, 'log.md');
const ERROR_COUNTER_PATH = path.join(ROOT, 'state', 'error_counter.json');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const OUTPUT = path.join(ROOT, 'dashboard.html');

// 카테고리별 색상 (Obsidian 그래프뷰와 일치)
const CATEGORY_COLORS = {
  pattern: '#22c55e',         // 초록 (성공)
  antipattern: '#ef4444',     // 빨강 (실패)
  'stack-decision': '#3b82f6',// 파랑 (선택)
  'structure-lesson': '#f59e0b', // 주황 (구조)
  hallucinated: '#a855f7',    // 보라 (환각)
};

// --- 유틸 ---------------------------------------------------------------

function safeRead(p, fallback = '') {
  try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; }
}

function safeJson(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function listMd(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(dir, f));
  } catch { return []; }
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return fm;
}

function extractWikilinks(content) {
  const links = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const target = m[1].split('|')[0].trim();
    if (target) links.push(target);
  }
  return links;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- 수집 ---------------------------------------------------------------

function collect() {
  const categories = ['patterns', 'antipatterns', 'stack-decisions', 'structure-lessons', 'hallucinated'];
  const categoryToSlug = {
    patterns: 'pattern',
    antipatterns: 'antipattern',
    'stack-decisions': 'stack-decision',
    'structure-lessons': 'structure-lesson',
    hallucinated: 'hallucinated',
  };

  const pages = [];
  const counts = { pattern: 0, antipattern: 0, 'stack-decision': 0, 'structure-lesson': 0, hallucinated: 0 };

  for (const cat of categories) {
    const dir = path.join(WIKI_DIR, cat);
    for (const filePath of listMd(dir)) {
      const content = safeRead(filePath);
      const fm = parseFrontmatter(content);
      const slug = fm.slug || path.basename(filePath, '.md');
      const category = categoryToSlug[cat];
      const title = fm.title || slug;
      const updated = fm.updated || '';
      const created = fm.created || '';
      const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);
      const links = extractWikilinks(content);
      pages.push({ slug, title, category, updated, created, tags, links, path: filePath });
      counts[category] = (counts[category] || 0) + 1;
    }
  }

  // log.md 에서 최근 엔트리 파싱
  const logRaw = safeRead(LOG_PATH);
  const logLines = logRaw.split('\n').filter(l => l.trim()).slice(-30).reverse();
  const recentLogs = logLines.map(line => {
    const m = line.match(/^(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) return null;
    return { timestamp: m[1], op: m[2], detail: m[3] };
  }).filter(Boolean);

  // 에러 카운터
  const errorCounter = safeJson(ERROR_COUNTER_PATH, {});
  const errorLoopsCaught = Object.values(errorCounter).filter(e => e.count >= 3).length;
  const hallucBlocked = counts.hallucinated;

  // config
  const config = safeJson(CONFIG_PATH, { effort: 'mid' });

  return {
    pages,
    counts,
    totalPages: pages.length,
    recentLogs,
    errorLoopsCaught,
    hallucBlocked,
    config,
    generatedAt: new Date().toISOString(),
  };
}

// --- HTML 렌더링 ---------------------------------------------------------

function renderHtml(data) {
  const statCards = [
    { label: 'Patterns', value: data.counts.pattern, color: CATEGORY_COLORS.pattern },
    { label: 'Antipatterns', value: data.counts.antipattern, color: CATEGORY_COLORS.antipattern },
    { label: 'Stack Decisions', value: data.counts['stack-decision'], color: CATEGORY_COLORS['stack-decision'] },
    { label: 'Structure Lessons', value: data.counts['structure-lesson'], color: CATEGORY_COLORS['structure-lesson'] },
    { label: 'Error Loops Caught', value: data.errorLoopsCaught, color: '#f97316' },
    { label: 'Halluc Blocked', value: data.hallucBlocked, color: CATEGORY_COLORS.hallucinated },
  ];

  // 그래프용 데이터
  const nodes = data.pages.map(p => ({
    id: p.slug,
    label: p.title,
    category: p.category,
    color: CATEGORY_COLORS[p.category] || '#64748b',
  }));
  const slugSet = new Set(nodes.map(n => n.id));
  const edges = [];
  for (const p of data.pages) {
    for (const target of p.links) {
      if (slugSet.has(target)) {
        edges.push({ source: p.slug, target });
      }
    }
  }

  const recentPages = [...data.pages]
    .sort((a, b) => (b.updated || b.created || '').localeCompare(a.updated || a.created || ''))
    .slice(0, 10);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>ExoVibe — Your Second Brain</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root {
    --bg: #0f172a;
    --panel: #1e293b;
    --border: #334155;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --accent: #60a5fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
    font-size: 14px; line-height: 1.5;
  }
  header {
    padding: 24px 32px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  h1 .brand { color: var(--accent); }
  .meta { color: var(--muted); font-size: 12px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 32px; }
  section { margin-bottom: 32px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em;
       color: var(--muted); margin: 0 0 12px; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 16px; position: relative; overflow: hidden;
  }
  .card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--bar, var(--accent));
  }
  .card .v { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  .card .l { color: var(--muted); font-size: 12px; margin-top: 4px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
  .panel {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 16px;
  }
  .list { list-style: none; margin: 0; padding: 0; }
  .list li {
    padding: 8px 0; border-bottom: 1px solid var(--border);
    display: flex; gap: 12px; align-items: baseline;
  }
  .list li:last-child { border-bottom: none; }
  .chip {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    background: var(--chip-bg, #334155); color: #fff; flex-shrink: 0;
  }
  .list .title { flex: 1; }
  .list .when { color: var(--muted); font-size: 12px; flex-shrink: 0; }
  .log-line {
    font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 12px;
    padding: 4px 0; color: var(--muted);
  }
  .log-line .op {
    display: inline-block; min-width: 80px; color: var(--accent); font-weight: 600;
  }
  .graph-wrap {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 0; height: 480px; position: relative; overflow: hidden;
  }
  .graph-wrap svg { width: 100%; height: 100%; display: block; }
  .graph-fallback {
    position: absolute; inset: 0; padding: 16px; overflow: auto;
    font-size: 12px; color: var(--muted); display: none;
  }
  .graph-wrap.no-graph .graph-fallback { display: block; }
  .legend { display: flex; gap: 16px; font-size: 11px; color: var(--muted); margin-top: 8px; flex-wrap: wrap; }
  .legend .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
  .empty { color: var(--muted); font-style: italic; padding: 12px 0; }
  footer { text-align: center; color: var(--muted); font-size: 11px; padding: 24px; border-top: 1px solid var(--border); }
  footer a { color: var(--accent); text-decoration: none; }
</style>
</head>
<body>
<header>
  <h1><span class="brand">ExoVibe</span> — Your Second Brain</h1>
  <div class="meta">
    Effort: <strong>${esc(data.config.effort || 'mid')}</strong> ·
    Updated: ${esc(data.generatedAt.slice(0, 19).replace('T', ' '))}Z ·
    Pages: ${data.totalPages}
  </div>
</header>

<div class="container">

  <section>
    <h2>Overview</h2>
    <div class="stats">
      ${statCards.map(c => `
        <div class="card" style="--bar: ${c.color}">
          <div class="v">${c.value}</div>
          <div class="l">${esc(c.label)}</div>
        </div>`).join('')}
    </div>
  </section>

  <section>
    <h2>Knowledge Graph</h2>
    <div class="graph-wrap ${nodes.length === 0 ? 'no-graph' : ''}" id="graph">
      <svg id="graph-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="graph-fallback">
        ${nodes.length === 0
          ? '아직 아카이브된 페이지가 없습니다. 대화 중 <code>#wiki</code> 태그로 첫 레슨을 저장해보세요.'
          : '<strong>페이지 목록</strong><ul>' + nodes.map(n => `<li>${esc(n.label)} <span style="color:${n.color}">●</span> ${esc(n.category)}</li>`).join('') + '</ul>'
        }
      </div>
    </div>
    <div class="legend">
      ${Object.entries(CATEGORY_COLORS).map(([k, v]) => `<span><span class="sw" style="background:${v}"></span>${esc(k)}</span>`).join('')}
    </div>
  </section>

  <div class="two-col">
    <section>
      <h2>Recent Lessons</h2>
      <div class="panel">
        ${recentPages.length === 0
          ? '<div class="empty">레슨이 아직 없습니다.</div>'
          : `<ul class="list">${recentPages.map(p => `
              <li>
                <span class="chip" style="background:${CATEGORY_COLORS[p.category] || '#334155'}">${esc(p.category)}</span>
                <span class="title">${esc(p.title)}</span>
                <span class="when">${esc(p.updated || p.created || '')}</span>
              </li>`).join('')}</ul>`
        }
      </div>
    </section>

    <section>
      <h2>Activity Log</h2>
      <div class="panel">
        ${data.recentLogs.length === 0
          ? '<div class="empty">로그가 없습니다.</div>'
          : data.recentLogs.slice(0, 15).map(l => `
              <div class="log-line">
                <span class="op">${esc(l.op)}</span>
                <span>${esc(l.detail)}</span>
                <span style="float:right">${esc(l.timestamp.slice(0, 16).replace('T', ' '))}</span>
              </div>`).join('')
        }
      </div>
    </section>
  </div>

</div>

<footer>
  Generated locally · Zero telemetry · <a href="https://github.com/d-onworks/ExoVibe">github.com/d-onworks/ExoVibe</a>
</footer>

<script>
(function() {
  // 인라인 force layout (D3 의존성 없음, ~60줄)
  const nodes = ${JSON.stringify(nodes)};
  const edges = ${JSON.stringify(edges)};
  const svg = document.getElementById('graph-svg');
  if (!nodes.length) return;

  const W = svg.clientWidth || 1100;
  const H = 480;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  // 초기 랜덤 배치 (중심 근처)
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    n.x = W/2 + Math.cos(a) * 150 + (Math.random()-0.5)*40;
    n.y = H/2 + Math.sin(a) * 100 + (Math.random()-0.5)*40;
    n.vx = 0; n.vy = 0;
  });
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  // 간단한 force simulation (repulsion + link + center)
  for (let step = 0; step < 200; step++) {
    for (const n of nodes) {
      let fx = 0, fy = 0;
      // 반발력
      for (const m of nodes) {
        if (m === n) continue;
        const dx = n.x - m.x, dy = n.y - m.y;
        const d2 = dx*dx + dy*dy + 1;
        const f = 2500 / d2;
        fx += dx * f / Math.sqrt(d2);
        fy += dy * f / Math.sqrt(d2);
      }
      // 중심 끌림
      fx += (W/2 - n.x) * 0.008;
      fy += (H/2 - n.y) * 0.008;
      n.vx = (n.vx + fx) * 0.5;
      n.vy = (n.vy + fy) * 0.5;
    }
    // 링크 인력
    for (const e of edges) {
      const s = byId[e.source], t = byId[e.target];
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 1;
      const target = 120;
      const k = (d - target) * 0.04;
      s.vx += dx/d * k; s.vy += dy/d * k;
      t.vx -= dx/d * k; t.vy -= dy/d * k;
    }
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(20, Math.min(W-20, n.x));
      n.y = Math.max(20, Math.min(H-20, n.y));
    }
  }

  // 렌더
  const NS = 'http://www.w3.org/2000/svg';
  for (const e of edges) {
    const s = byId[e.source], t = byId[e.target];
    if (!s || !t) continue;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', s.x); line.setAttribute('y1', s.y);
    line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
    line.setAttribute('stroke', '#475569');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.6');
    svg.appendChild(line);
  }
  for (const n of nodes) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '8'); c.setAttribute('fill', n.color);
    c.setAttribute('stroke', '#0f172a'); c.setAttribute('stroke-width', '2');
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', '12'); txt.setAttribute('y', '4');
    txt.setAttribute('fill', '#e2e8f0'); txt.setAttribute('font-size', '11');
    txt.textContent = n.label.length > 32 ? n.label.slice(0, 30) + '…' : n.label;
    g.appendChild(c); g.appendChild(txt);
    svg.appendChild(g);
  }
})();
</script>
</body>
</html>
`;
}

// --- 메인 ---------------------------------------------------------------

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`[ExoVibe] ROOT not found: ${ROOT}`);
    process.exit(1);
  }
  const data = collect();
  const html = renderHtml(data);
  fs.writeFileSync(OUTPUT, html, 'utf8');
  console.log(`[ExoVibe] dashboard → ${OUTPUT}`);
  console.log(`[ExoVibe] pages=${data.totalPages} patterns=${data.counts.pattern} antipatterns=${data.counts.antipattern} error-loops=${data.errorLoopsCaught}`);
}

main();

#!/usr/bin/env node
/**
 * Obsidian Vault 프리셋 설치기
 *
 * ~/.claude/exovibe/.obsidian/ 가 비어있으면
 * templates/obsidian-vault/ 내용을 복사한다.
 * 이미 설정이 있으면 건드리지 않는다 (사용자 커스터마이징 보호).
 *
 * 사용: node scripts/install-vault-preset.js [--root <path>] [--force]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const rootIdx = ARGS.indexOf('--root');
const ROOT = rootIdx >= 0 ? ARGS[rootIdx + 1] : path.join(os.homedir(), '.claude', 'exovibe');

// 스크립트 위치 기준 templates 경로
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'templates', 'obsidian-vault');
const TARGET_DIR = path.join(ROOT, '.obsidian');

const COPY_FILES = ['app.json', 'appearance.json', 'graph.json', 'core-plugins.json'];

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`[ExoVibe] ROOT not found: ${ROOT}`);
    process.exit(1);
  }
  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`[ExoVibe] template dir not found: ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  let installed = 0, skipped = 0;
  for (const f of COPY_FILES) {
    const src = path.join(TEMPLATE_DIR, f);
    const dst = path.join(TARGET_DIR, f);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dst) && !FORCE) {
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dst);
    installed++;
  }

  console.log(`[ExoVibe] Obsidian preset → ${TARGET_DIR}`);
  console.log(`[ExoVibe] installed=${installed} skipped=${skipped}${FORCE ? ' (force)' : ''}`);
}

main();

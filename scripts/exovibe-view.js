#!/usr/bin/env node
/**
 * ExoVibe View — 뇌 열기 원커맨드
 *
 * 모드:
 *   dashboard (기본): dashboard.html 을 재생성 후 기본 브라우저로 오픈
 *   vault          : Obsidian 프리셋 설치 후 obsidian:// URI 로 Vault 오픈
 *   graph          : vault 와 동일하되 그래프뷰 포커스
 *
 * 플랫폼: Windows (start), macOS (open), Linux (xdg-open) 자동 감지.
 * Obsidian 미설치 감지는 불가능 (URI 스킴은 실행 시점 판단) → 실패 시 가이드 메시지.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODE = (process.argv[2] || 'dashboard').toLowerCase();
const ROOT = path.join(os.homedir(), '.claude', 'exovibe');
const SCRIPT_DIR = __dirname;

function openUrl(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      // Windows: start "" "URL" (cmd /c 필요, URL에 & 있을 수 있음)
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
    return true;
  } catch (e) {
    console.error(`[ExoVibe] open failed: ${e.message}`);
    return false;
  }
}

function run(cmd, args) {
  execSync(`node "${path.join(SCRIPT_DIR, cmd)}" ${args.join(' ')}`, { stdio: 'inherit' });
}

function openDashboard() {
  run('generate-dashboard.js', []);
  const htmlPath = path.join(ROOT, 'dashboard.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('[ExoVibe] dashboard.html 생성 실패');
    process.exit(1);
  }
  // file:// URL (Windows 경로 슬래시 정규화)
  const url = 'file:///' + htmlPath.replace(/\\/g, '/');
  console.log(`[ExoVibe] opening dashboard: ${url}`);
  openUrl(url);
}

function openVault(focusGraph) {
  run('install-vault-preset.js', []);
  // obsidian://open?path=<encoded-absolute-path>
  const encoded = encodeURIComponent(ROOT);
  const uri = `obsidian://open?path=${encoded}`;
  console.log(`[ExoVibe] opening Obsidian Vault: ${ROOT}`);
  console.log(`[ExoVibe] URI: ${uri}`);
  const ok = openUrl(uri);
  if (!ok) {
    console.log('');
    console.log('Obsidian이 설치되어 있지 않은 것 같습니다.');
    console.log('1. https://obsidian.md 에서 무료 다운로드');
    console.log('2. Obsidian 실행 → "Open folder as vault" → 아래 경로 선택:');
    console.log(`   ${ROOT}`);
    return;
  }
  if (focusGraph) {
    console.log('');
    console.log('그래프뷰 포커스: Obsidian 창에서 Ctrl/Cmd+G 또는 좌측 아이콘의 그래프 클릭');
  }
}

switch (MODE) {
  case 'dashboard':
  case 'd':
    openDashboard();
    break;
  case 'vault':
  case 'v':
    openVault(false);
    break;
  case 'graph':
  case 'g':
    openVault(true);
    break;
  case 'help':
  case '-h':
  case '--help':
    console.log('사용법: exovibe-view [dashboard|vault|graph]');
    console.log('  dashboard  HTML 대시보드 (기본)');
    console.log('  vault      Obsidian Vault');
    console.log('  graph      Obsidian Vault + 그래프뷰');
    break;
  default:
    console.error(`[ExoVibe] 알 수 없는 모드: ${MODE}`);
    console.error('사용법: exovibe-view [dashboard|vault|graph]');
    process.exit(1);
}

#!/usr/bin/env node
/**
 * ExoVibe View — one-command "open my brain"
 *
 * Modes:
 *   dashboard (default): regenerate dashboard.html and open it in the default browser
 *   vault             : install the Obsidian preset and open the Vault via obsidian:// URI
 *   graph             : same as vault, with a graph-view focus hint
 *
 * Platform: auto-detects Windows (start), macOS (open), Linux (xdg-open).
 * Cannot reliably detect whether Obsidian is installed (URI schemes resolve at runtime)
 * → on failure, print a guidance message.
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
      // Windows: start "" "URL" (needs cmd /c; URL may contain &)
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
    console.error('[ExoVibe] failed to generate dashboard.html');
    process.exit(1);
  }
  // file:// URL (normalize Windows path separators)
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
    console.log('Obsidian does not seem to be installed.');
    console.log('1. Download for free at https://obsidian.md');
    console.log('2. Launch Obsidian → "Open folder as vault" → select the path below:');
    console.log(`   ${ROOT}`);
    return;
  }
  if (focusGraph) {
    console.log('');
    console.log('Focus the graph view: in the Obsidian window press Ctrl/Cmd+G, or click the graph icon in the left sidebar.');
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
    console.log('Usage: exovibe-view [dashboard|vault|graph]');
    console.log('  dashboard  HTML dashboard (default)');
    console.log('  vault      Obsidian Vault');
    console.log('  graph      Obsidian Vault + graph view');
    break;
  default:
    console.error(`[ExoVibe] unknown mode: ${MODE}`);
    console.error('Usage: exovibe-view [dashboard|vault|graph]');
    process.exit(1);
}

#!/usr/bin/env node
/**
 * Obsidian Vault Preset Installer
 *
 * If ~/.claude/exovibe/.obsidian/ is empty, copies the contents of
 * templates/obsidian-vault/ into it.
 * If settings already exist, leaves them alone (user customizations are preserved).
 *
 * Usage: node scripts/install-vault-preset.js [--root <path>] [--force]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const rootIdx = ARGS.indexOf('--root');
const ROOT = rootIdx >= 0 ? ARGS[rootIdx + 1] : path.join(os.homedir(), '.claude', 'exovibe');

// templates path resolved relative to this script
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

// ExoVibe hook shared library — Node.js standard library only.
// Every hook imports utilities from this module.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ExoVibe global store root. Overridable via env for tests/CI.
const EXOVIBE_ROOT = process.env.EXOVIBE_ROOT || path.join(os.homedir(), '.claude', 'exovibe');

// Effort levels and per-level budget / check matrix.
const EFFORT_LEVELS = ['low', 'mid', 'high'];
const DEFAULT_EFFORT = 'mid';

const EFFORT_BUDGET = {
  low: {
    max_context_chars: 500,
    error_loop_threshold: 5,
    auto_ingest: false,
    check_rollback: false,
    check_pkg_hallucination: true,  // Always on — hallucinated installs are critical.
    check_file_size: false,
    check_lib_mix: false,
    check_env_hardcode: false,
    check_error_swallow: false,
    check_console_log: false,
    check_commented_code: false,
    check_unused_import: false,
    check_negative_feedback: false,
    check_same_file_edits: false,
  },
  mid: {
    max_context_chars: 4500,
    error_loop_threshold: 3,
    auto_ingest: true,
    check_rollback: true,
    check_pkg_hallucination: true,
    check_file_size: false,
    check_lib_mix: false,
    check_env_hardcode: false,
    check_error_swallow: false,
    check_console_log: false,
    check_commented_code: false,
    check_unused_import: false,
    check_negative_feedback: 'log-only',
    check_same_file_edits: false,
  },
  high: {
    max_context_chars: 6000,
    error_loop_threshold: 3,
    auto_ingest: true,
    check_rollback: true,
    check_pkg_hallucination: true,
    check_file_size: true,
    check_lib_mix: true,
    check_env_hardcode: true,
    check_error_swallow: true,
    check_console_log: true,
    check_commented_code: true,
    check_unused_import: true,
    check_negative_feedback: 'trigger',
    check_same_file_edits: true,
  },
};

// Create all required directories (idempotent).
function ensureDirs() {
  const dirs = [
    EXOVIBE_ROOT,
    path.join(EXOVIBE_ROOT, 'raw'),
    path.join(EXOVIBE_ROOT, 'wiki', 'patterns'),
    path.join(EXOVIBE_ROOT, 'wiki', 'antipatterns'),
    path.join(EXOVIBE_ROOT, 'wiki', 'stack-decisions'),
    path.join(EXOVIBE_ROOT, 'wiki', 'structure-lessons'),
    path.join(EXOVIBE_ROOT, 'wiki', 'hallucinated'),
    path.join(EXOVIBE_ROOT, 'state'),
    path.join(EXOVIBE_ROOT, 'archive'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Parse JSON payload from stdin. Returns {} on any failure.
function readInput() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (chunk) => (buf += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(buf || '{}'));
      } catch {
        resolve({});
      }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

// YYYY-MM monthly directory name.
function monthDir(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

// Error fingerprint: maps semantically-identical errors to the same hash.
// Implements the normalization pipeline from PRD §19.
function errorHash(stderr) {
  if (!stderr) return null;
  const normalized = String(stderr)
    // Timestamps
    .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[\.\dZ+:-]*/g, 'TS')
    // Line numbers / arbitrary integers
    .replace(/\b\d+\b/g, 'N')
    // Memory addresses / pointers
    .replace(/0x[0-9a-fA-F]+/g, '0xX')
    // User paths (cross-OS)
    .replace(/\/Users\/[^\/\s]+/g, '/Users/U')
    .replace(/\/home\/[^\/\s]+/g, '/home/U')
    .replace(/[Cc]:\\Users\\[^\\]+/g, 'C:\\Users\\U')
    // Temporary paths
    .replace(/\/tmp\/[a-zA-Z0-9]+/g, '/tmp/X')
    // UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

// Mask secrets before writing to raw/.
function redactSecrets(text) {
  if (!text) return text;
  return String(text)
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_ANTHROPIC_KEY]')
    .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]')
    .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/gho_[a-zA-Z0-9]{36,}/g, '[REDACTED_GITHUB_OAUTH]')
    .replace(/xox[bpoars]-[a-zA-Z0-9-]+/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED_KEY_BLOCK]');
}

// Serialize hook output JSON to stdout.
function emitHookOutput(obj) {
  process.stdout.write(JSON.stringify(obj));
}

// Append a timestamped line to log.md.
function appendLog(action) {
  const line = `${new Date().toISOString()} ${action}\n`;
  fs.appendFileSync(path.join(EXOVIBE_ROOT, 'log.md'), line);
}

// Load config. Creates default (Mid) config on first run.
function loadConfig() {
  const configPath = path.join(EXOVIBE_ROOT, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    const effort = EFFORT_LEVELS.includes(cfg.effort) ? cfg.effort : DEFAULT_EFFORT;
    return {
      effort,
      budget: { ...EFFORT_BUDGET[effort], ...(cfg.overrides || {}) },
      raw: cfg,
    };
  } catch {
    // First run — generate default config.
    const defaultCfg = {
      effort: DEFAULT_EFFORT,
      created_at: new Date().toISOString(),
      last_changed_at: null,
      overrides: {},
    };
    try {
      fs.mkdirSync(EXOVIBE_ROOT, { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(defaultCfg, null, 2));
    } catch {
      // Write failure is non-fatal; continue with in-memory default.
    }
    return {
      effort: DEFAULT_EFFORT,
      budget: EFFORT_BUDGET[DEFAULT_EFFORT],
      raw: defaultCfg,
    };
  }
}

// Persist config.
function saveConfig(cfg) {
  const configPath = path.join(EXOVIBE_ROOT, 'config.json');
  fs.mkdirSync(EXOVIBE_ROOT, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

module.exports = {
  EXOVIBE_ROOT,
  EFFORT_LEVELS,
  DEFAULT_EFFORT,
  EFFORT_BUDGET,
  ensureDirs,
  readInput,
  monthDir,
  errorHash,
  redactSecrets,
  emitHookOutput,
  appendLog,
  loadConfig,
  saveConfig,
};

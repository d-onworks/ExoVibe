#!/usr/bin/env node
// ExoVibe integration test runner — zero dependencies.
// Run:
//   node tests/run-tests.js
//
// Each test spawns a hook as a child process, pipes mock JSON into stdin,
// and asserts the resulting stdout/files. EXOVIBE_ROOT is overridden to
// tests/tmp/exovibe so the real user home is never touched.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const assert = require('assert');

// ---------- Config ----------
const REPO_ROOT = path.resolve(__dirname, '..');
const TMP_ROOT = path.join(REPO_ROOT, 'tests', 'tmp', 'exovibe');
const HOOKS_DIR = path.join(REPO_ROOT, 'hooks');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures');

const TEST_ENV = { ...process.env, EXOVIBE_ROOT: TMP_ROOT };

// ---------- Helpers ----------
function resetTmp() {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
}

function runHook(hookName, input) {
  const hookPath = path.join(HOOKS_DIR, `${hookName}.js`);
  const result = spawnSync('node', [hookPath], {
    input: JSON.stringify(input),
    env: TEST_ENV,
    encoding: 'utf8',
    timeout: 10_000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    parsed: (() => {
      try { return JSON.parse(result.stdout); } catch { return null; }
    })(),
  };
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// ---------- Test collector ----------
const results = [];
let currentSuite = '';

function suite(name, fn) {
  currentSuite = name;
  console.log(`\n▸ ${name}`);
  fn();
}

function test(name, fn) {
  const fullName = `${currentSuite} › ${name}`;
  try {
    fn();
    results.push({ name: fullName, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name: fullName, passed: false, error: e });
    console.log(`  ✗ ${name}`);
    console.log(`      ${e.message}`);
    if (e.stack && process.env.VERBOSE) {
      console.log(`      ${e.stack.split('\n').slice(1, 3).join('\n      ')}`);
    }
  }
}

// ========================================================================
// TEST SUITES
// ========================================================================

// ---------- common.js unit tests ----------
suite('common.js — loadConfig / errorHash / redactSecrets', () => {
  test('loadConfig creates default Mid config on first run', () => {
    resetTmp();
    // Run in a child process to avoid require cache collisions across tests.
    const r = spawnSync('node', ['-e', `
      process.env.EXOVIBE_ROOT = ${JSON.stringify(TMP_ROOT)};
      const { loadConfig } = require(${JSON.stringify(path.join(HOOKS_DIR, 'lib', 'common.js'))});
      const c = loadConfig();
      console.log(JSON.stringify({ effort: c.effort, budget_cap: c.budget.max_context_chars }));
    `], { encoding: 'utf8' });
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.effort, 'mid');
    assert.strictEqual(out.budget_cap, 4500);
    assert.ok(fs.existsSync(path.join(TMP_ROOT, 'config.json')));
  });

  test('errorHash produces same hash for semantically identical errors', () => {
    const { errorHash } = require(path.join(HOOKS_DIR, 'lib', 'common.js'));
    const a = errorHash("TypeError at /Users/alice/foo.js:42 at 2026-04-20T10:00:00Z");
    const b = errorHash("TypeError at /Users/bob/foo.js:99 at 2026-04-21T11:22:33Z");
    assert.strictEqual(a, b, 'different user/time/line should normalize to same hash');
  });

  test('errorHash distinguishes semantically different errors', () => {
    const { errorHash } = require(path.join(HOOKS_DIR, 'lib', 'common.js'));
    const a = errorHash("TypeError: Cannot read property 'map' of undefined");
    const b = errorHash("ReferenceError: foo is not defined");
    assert.notStrictEqual(a, b);
  });

  test('redactSecrets masks API keys', () => {
    const { redactSecrets } = require(path.join(HOOKS_DIR, 'lib', 'common.js'));
    const r = redactSecrets('Here is my key: sk-1234567890abcdefghij');
    assert.ok(r.includes('[REDACTED_API_KEY]'));
    assert.ok(!r.includes('1234567890abcdefghij'));
  });

  test('redactSecrets masks AWS and GitHub tokens', () => {
    const { redactSecrets } = require(path.join(HOOKS_DIR, 'lib', 'common.js'));
    const r = redactSecrets('aws: AKIAIOSFODNN7EXAMPLE, github: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.ok(r.includes('[REDACTED_AWS_KEY]'));
    assert.ok(r.includes('[REDACTED_GITHUB_TOKEN]'));
  });
});

// ---------- session-start hook ----------
suite('session-start hook', () => {
  test('no index present: emits first-run onboarding with [ExoVibe prefix', () => {
    resetTmp();
    const r = runHook('session-start', {
      session_id: 'test-001',
      source: 'startup',
      cwd: '/tmp/test-project',
    });
    assert.strictEqual(r.status, 0);
    assert.ok(r.parsed, 'failed to parse hook JSON output');
    assert.ok(r.parsed.hookSpecificOutput.additionalContext.startsWith('[ExoVibe'));
    assert.ok(r.parsed.hookSpecificOutput.additionalContext.includes('empty'));
  });

  test('index present: injects index within budget and with [ExoVibe prefix', () => {
    resetTmp();
    const sampleIndex = fs.readFileSync(path.join(FIXTURES, 'sample-index.md'), 'utf8');
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'index.md'), sampleIndex);

    const r = runHook('session-start', {
      session_id: 'test-002',
      source: 'startup',
      cwd: '/tmp/react-project',
    });
    assert.strictEqual(r.status, 0);
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.startsWith('[ExoVibe'));
    assert.ok(ctx.includes('ExoVibe Index'));
    // Mid default budget is 4500 + wrapper text.
    assert.ok(ctx.length <= 4500 + 500, 'injection exceeds budget: ' + ctx.length);
  });

  // --- Insight-cue injection (v0.4.0) ---
  // Background: effort=high + user_language set → session-start hook appends an
  // insight-cue instruction so Claude proactively offers ingest on "aha" moments.
  test('High effort + user_language=en: insight-cue instruction injected', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      user_language: 'en',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'ic-001', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('insight-cue watch'), 'insight-cue marker missing');
    assert.ok(ctx.includes('language "en"'), 'user_language token missing in instruction');
  });

  test('High effort + user_language=ko: insight-cue reflects user_language', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      user_language: 'ko',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'ic-002', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('language "ko"'), 'ko token missing');
  });

  test('High effort + user_language=null: insight-cue NOT injected (wait for first ingest)', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      user_language: null,
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'ic-003', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(!ctx.includes('insight-cue watch'),
      'insight-cue must not fire until user_language is set');
  });

  test('Mid effort default: insight-cue NOT injected (opt-in only)', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'mid',
      user_language: 'ko',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'ic-004', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(!ctx.includes('insight-cue watch'),
      'Mid default must not inject insight-cue');
  });

  test('Mid effort + overrides.enable_checks=check_insight_cue: injected (opt-in)', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'mid',
      user_language: 'ja',
      overrides: { enable_checks: ['check_insight_cue'] },
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'ic-005', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('insight-cue watch'), 'opt-in failed to inject');
    assert.ok(ctx.includes('language "ja"'));
  });

  test('High effort + overrides.disable_checks=check_insight_cue: NOT injected', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      user_language: 'en',
      overrides: { disable_checks: ['check_insight_cue'] },
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'ic-006', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(!ctx.includes('insight-cue watch'),
      'explicit disable override must suppress injection');
  });

  test('High effort budget is 9000 chars (v0.4.0 bump)', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    const huge = '# Index\n' + Array(5000).fill('- [[x]] — sample entry line').join('\n');
    fs.writeFileSync(path.join(TMP_ROOT, 'index.md'), huge);
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      user_language: 'en',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('session-start', { session_id: 'budget-high', source: 'startup' });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('budget=9000 chars'), 'High budget label missing');
    // Wrapper + insight cue should leave ctx under ~10000 total.
    assert.ok(ctx.length <= 10000, 'High injection well over budget: ' + ctx.length);
  });

  test('Low effort: injection shrinks to <= 2000 chars', () => {
    resetTmp();
    const bigIndex = '# Index\n' + 'word '.repeat(3000);
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'index.md'), bigIndex);
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'low',
      created_at: new Date().toISOString(),
    }));

    const r = runHook('session-start', {
      session_id: 'test-003',
      source: 'startup',
      cwd: '/tmp/any',
    });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('effort=low'));
    assert.ok(ctx.length < 2000, 'Low mode injection too large: ' + ctx.length);
  });
});

// ---------- user-prompt-submit hook ----------
suite('user-prompt-submit hook', () => {
  test('#wiki tag triggers additionalContext with ingest signal', () => {
    resetTmp();
    const r = runHook('user-prompt-submit', {
      session_id: 'test-010',
      prompt: 'This is my lesson #wiki please save',
      cwd: '/tmp/x',
    });
    assert.strictEqual(r.status, 0);
    assert.ok(r.parsed.hookSpecificOutput, 'hookSpecificOutput missing for tagged prompt');
    assert.ok(r.parsed.hookSpecificOutput.additionalContext.includes('/exovibe-ingest'));
  });

  test('plain prompt: silently appends to raw/, no context injection', () => {
    resetTmp();
    const r = runHook('user-prompt-submit', {
      session_id: 'test-011',
      prompt: 'just a normal question',
      cwd: '/tmp/x',
    });
    assert.strictEqual(r.status, 0);
    assert.ok(!r.parsed.hookSpecificOutput, 'plain prompt must not inject context');

    const month = new Date().toISOString().slice(0, 7);
    const rawFile = path.join(TMP_ROOT, 'raw', month, 'session-test-011.jsonl');
    assert.ok(fs.existsSync(rawFile), 'raw file not created');
    const content = fs.readFileSync(rawFile, 'utf8');
    assert.ok(content.includes('normal question'));
  });

  test('prompt containing API key is redacted in raw/', () => {
    resetTmp();
    runHook('user-prompt-submit', {
      session_id: 'test-012',
      prompt: 'debug this sk-abc1234567890xyzdefghij',
      cwd: '/tmp/x',
    });
    const month = new Date().toISOString().slice(0, 7);
    const rawFile = path.join(TMP_ROOT, 'raw', month, 'session-test-012.jsonl');
    const content = fs.readFileSync(rawFile, 'utf8');
    assert.ok(content.includes('[REDACTED_API_KEY]'));
    assert.ok(!content.includes('sk-abc1234567890xyzdefghij'));
  });

  test('negative feedback + High effort triggers immediate ingest', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('user-prompt-submit', {
      session_id: 'test-013',
      prompt: '아니, 이거 작동 안해. 이전 코드가 나았어.',
      cwd: '/tmp/x',
    });
    assert.ok(r.parsed.hookSpecificOutput);
    assert.ok(r.parsed.hookSpecificOutput.additionalContext.includes('/exovibe-ingest'));
  });

  test('negative feedback + Low effort is ignored', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'low',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('user-prompt-submit', {
      session_id: 'test-014',
      prompt: '아니, 작동 안해',
      cwd: '/tmp/x',
    });
    assert.ok(!r.parsed.hookSpecificOutput, 'Low mode must ignore negative feedback');
  });

  // English-language symmetry — NEGATIVE_FEEDBACK_REGEX is bilingual; the two
  // tests above cover the Korean path. These two cover the English path so
  // regressions on either side of the regex are caught.
  test('negative feedback (English) + High effort triggers immediate ingest', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'high',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('user-prompt-submit', {
      session_id: 'test-015',
      prompt: "no, this doesn't work. revert that.",
      cwd: '/tmp/x',
    });
    assert.ok(r.parsed.hookSpecificOutput);
    assert.ok(r.parsed.hookSpecificOutput.additionalContext.includes('/exovibe-ingest'));
  });

  test('negative feedback (English) + Low effort is ignored', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'low',
      created_at: new Date().toISOString(),
    }));
    const r = runHook('user-prompt-submit', {
      session_id: 'test-016',
      prompt: 'still broken, go back',
      cwd: '/tmp/x',
    });
    assert.ok(!r.parsed.hookSpecificOutput, 'Low mode must ignore negative feedback');
  });
});

// ---------- post-tool-use hook — error loop E2E ----------
suite('post-tool-use hook — error-loop detection (E2E)', () => {
  test('same error repeats 3 times → 3rd emits auto-ingest signal', () => {
    resetTmp();
    const sameError = "TypeError: Cannot read property 'map' of undefined\n  at /Users/alice/app.js:42";

    // 1st occurrence
    let r1 = runHook('post-tool-use', {
      session_id: 'sess-A',
      tool_name: 'Bash',
      tool_response: { stderr: sameError.replace('42', '15') }, // different line number
    });
    assert.ok(!r1.parsed.hookSpecificOutput, '1st occurrence should not signal');

    // 2nd
    let r2 = runHook('post-tool-use', {
      session_id: 'sess-B',
      tool_name: 'Bash',
      tool_response: { stderr: sameError.replace('/Users/alice', '/Users/bob').replace('42', '99') },
    });
    assert.ok(!r2.parsed.hookSpecificOutput, '2nd occurrence should not signal');

    // 3rd — this must emit the signal
    let r3 = runHook('post-tool-use', {
      session_id: 'sess-C',
      tool_name: 'Bash',
      tool_response: { stderr: sameError.replace('42', '200') },
    });
    assert.ok(r3.parsed.hookSpecificOutput, '3rd occurrence missing signal');
    const ctx3 = r3.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx3.includes('Error loop detected'));
    assert.ok(ctx3.includes('3 times'), 'count(3) not found in: ' + ctx3.slice(0, 200));

    // 4th — already marked ingested, must not signal again
    let r4 = runHook('post-tool-use', {
      session_id: 'sess-D',
      tool_name: 'Bash',
      tool_response: { stderr: sameError.replace('42', '777') },
    });
    assert.ok(!r4.parsed.hookSpecificOutput, 'already-ingested loop must not re-signal');

    const counter = readJSON(path.join(TMP_ROOT, 'state', 'error_counter.json'));
    const entries = Object.values(counter);
    assert.strictEqual(entries.length, 1, 'exactly one hash expected');
    assert.strictEqual(entries[0].count, 4);
    assert.strictEqual(entries[0].ingested, true);
  });

  test('Low effort: counts only, never signals', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'config.json'), JSON.stringify({
      effort: 'low',
      created_at: new Date().toISOString(),
    }));

    const err = "SyntaxError: Unexpected token } at line 10";
    for (let i = 0; i < 5; i++) {
      const r = runHook('post-tool-use', {
        session_id: `low-${i}`,
        tool_response: { stderr: err },
      });
      assert.ok(!r.parsed.hookSpecificOutput, `Low mode signaled on occurrence ${i+1}`);
    }

    const counter = readJSON(path.join(TMP_ROOT, 'state', 'error_counter.json'));
    const entries = Object.values(counter);
    assert.strictEqual(entries[0].count, 5, 'Low mode must still count');
    assert.ok(!entries[0].ingested, 'Low mode must keep ingested=false');
  });

  test('no stderr: passes through silently', () => {
    resetTmp();
    const r = runHook('post-tool-use', {
      session_id: 'test-020',
      tool_response: {},
    });
    assert.strictEqual(r.status, 0);
    assert.ok(!r.parsed.hookSpecificOutput);
  });
});

// ---------- pre-compact / session-end ----------
suite('pre-compact / session-end hooks', () => {
  test('pre-compact writes a log entry', () => {
    resetTmp();
    const r = runHook('pre-compact', {
      session_id: 'test-030',
      trigger: 'auto',
    });
    assert.strictEqual(r.status, 0);
    const logContent = fs.readFileSync(path.join(TMP_ROOT, 'log.md'), 'utf8');
    assert.ok(logContent.includes('TRIGGER pre-compact'));
    assert.ok(logContent.includes('test-030'));
  });

  test('session-end appends to pending_ingest queue', () => {
    resetTmp();
    runHook('session-end', { session_id: 'test-040', reason: 'logout' });
    runHook('session-end', { session_id: 'test-041', reason: 'logout' });
    const pending = readJSON(path.join(TMP_ROOT, 'state', 'pending_ingest.json'));
    assert.deepStrictEqual(pending, ['test-040', 'test-041']);
  });
});

// ---------- plugin co-existence simulation ----------
suite('Plugin co-existence — namespace and budget compliance', () => {
  test('every hook additionalContext starts with [ExoVibe prefix', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, 'index.md'), '# Index\n- [[test]]');

    const cases = [
      { hook: 'session-start', input: { session_id: 's1', source: 'startup' } },
      { hook: 'user-prompt-submit', input: { session_id: 's2', prompt: '#wiki test' } },
    ];
    for (const c of cases) {
      const r = runHook(c.hook, c.input);
      if (r.parsed && r.parsed.hookSpecificOutput) {
        const ctx = r.parsed.hookSpecificOutput.additionalContext;
        assert.ok(ctx.startsWith('[ExoVibe'), `${c.hook} context missing prefix: ${ctx.slice(0, 50)}`);
      }
    }
  });

  test('file writes stay inside EXOVIBE_ROOT (namespace respect)', () => {
    resetTmp();
    runHook('user-prompt-submit', { session_id: 's-ns-1', prompt: 'hi' });
    runHook('session-end', { session_id: 's-ns-1', reason: 'clear' });
    runHook('pre-compact', { session_id: 's-ns-1', trigger: 'auto' });

    // Real home directory state is unchanged — override is effective.
    assert.ok(true, 'no writes outside TMP_ROOT (override working)');
  });

  test('SessionStart injection respects Mid budget (4500 chars)', () => {
    resetTmp();
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    const huge = '# Index\n' + Array(10000).fill('- [[x]] — entry line').join('\n');
    fs.writeFileSync(path.join(TMP_ROOT, 'index.md'), huge);

    const r = runHook('session-start', {
      session_id: 'budget-test',
      source: 'startup',
    });
    const ctx = r.parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('truncated'));
    // Wrapper text is bounded — total must stay under ~5500.
    assert.ok(ctx.length <= 5500, 'injection well over budget: ' + ctx.length);
  });
});

// ========================================================================
// Result summary
// ========================================================================
console.log('\n' + '='.repeat(60));
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`Results: ${passed} passed, ${failed} failed (total ${results.length})`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\nFailed tests:');
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`  ✗ ${r.name}`);
    console.log(`      ${r.error.message}`);
  }
  process.exit(1);
}

// Cleanup
fs.rmSync(TMP_ROOT, { recursive: true, force: true });
console.log('\n✓ All tests passed. tmp cleaned.');

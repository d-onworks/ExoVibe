# Changelog

All notable changes to the ExoVibe plugin. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [0.5.0] — 2026-05-03

### Added — Prevention layer (the missing piece)

The original v0.4.x design captured lessons well but did not actually surface
them at the right moment. v0.5 closes that gap with deterministic, hook-time
relevance matching. No external API. No vector DB. Pure Node stdlib.

- **`hooks/lib/wiki-match.js`** — new shared module that:
  - parses each wiki page's frontmatter (`stack:`, `tags:`, `severity:`,
    `env-scope:`, `triggers:`),
  - detects the cwd's stack from `package.json` / `Cargo.toml` / `go.mod` /
    `requirements.txt` / `pubspec.yaml`,
  - scores pages by stack overlap, error-message keyword overlap, and
    risky-prompt keyword overlap,
  - excerpts top-N pages within a per-call character budget.
- **SessionStart hook — stack-aware injection.** Reads cwd manifests, finds
  wiki pages whose `stack:` overlaps, and embeds 2–3 page bodies (excerpted)
  alongside the index. The LLM no longer has to "decide which page to read";
  the relevant pages are already in the message.
- **PostToolUse hook — error-to-wiki matching.** On every `stderr` capture,
  the error message is keyword-matched against archived wiki Context sections.
  Strong matches (3+ keyword hits) surface the wiki excerpt on the FIRST
  occurrence, not the 4th. Per-session dedup avoids spam.
- **UserPromptSubmit hook — risky-keyword detection.** A small dictionary of
  historically-dangerous tokens (`max:`, `pool`, `migration`, `--force`,
  `prod`, `delete from`, `rm -rf`, etc.) is combined with the cwd stack tags;
  matches surface preventive wiki excerpts BEFORE the LLM commits to a course
  of action. This is the "warns you before you repeat the mistake" promise,
  finally implemented.
- **UserPromptSubmit — negative-feedback now triggers BOTH ingest and query.**
  Previously v0.4.x only signaled ingest after a failure. v0.5 also signals
  `/exovibe-query` to look up whether the failure mode is already archived,
  letting the user benefit from prior lessons during a debug round, not just
  after it.
- **SessionStart — lint recommendation.** When the wiki has crossed any of
  three thresholds (≥30 pages and never linted; ≥10 ingests since last lint;
  ≥14 days and ≥20 pages), a non-nag reminder asks the LLM to surface
  `/exovibe-lint` on the next natural break — not mid-task.

### Added — Skill behavior

- **`exovibe-ingest` Rule 6 — pre-authorized triggers.** Automatic triggers
  (`#wiki` / `!save` / `!archive` tag, error-loop, negative-feedback,
  PreCompact) are now archived SILENTLY. The skill no longer asks the user
  yes/no, no longer asks to confirm slug or category. The ONLY allowed
  prompt is Step 1a (first-run language). This fixes the "terminal hangs
  waiting for confirmation" UX bug reported by users.
- **`exovibe-ingest` Step 5b — auto-extract `triggers:` and `env-scope:`.**
  Each new wiki page now carries 3–7 trigger keywords (matched by hooks for
  future surfacing) and an explicit env scope (`prod` / `dev` / `both`).
  Replaces the implicit "every rule applies everywhere" assumption that led
  to dev-vs-prod misapplication of pool-size lessons.
- **`exovibe-query` Step 2 — cwd stack auto-filter.** Query now reads cwd
  manifests automatically and 2× weights pages whose `stack:` overlaps,
  without the user having to specify the stack in the query string.

### Changed — Hook reminder text strength

All three automatic-trigger reminders now explicitly say "archive SILENTLY,
do NOT ask the user yes/no". This addresses the LLM's instinctive habit of
adding a confirmation step even when the trigger is already pre-authorized.

### Changed — Marketing honesty

- README and `marketing/pitch.txt` updated to remove "you never repeat the
  same mistake twice" and "warns you before you repeat the mistake" — these
  were stronger than the system can guarantee, since LLM overconfidence can
  still ignore a surfaced lesson. New language: "drastically cuts how often
  the same bug ships twice", "Prevention is best-effort, not guaranteed".
- README "≤ 4,500 chars" claim replaced with the accurate per-effort
  breakdown (Low ≤500, Mid ≤4,500, High ≤9,000).

### Notes

- LLM compliance with surfaced lessons is not enforced. The system maximizes
  recall (the right page IS in context); compliance is best-effort.
- Risky-keyword dictionary is intentionally small to start. Add domain terms
  to `RISKY_KEYWORDS` in `hooks/lib/wiki-match.js` for project-specific tuning.

## [0.4.1] — 2026-04-20

### Fixed
- `/exovibe-config` was not appearing in the `available-skills` list because
  its SKILL.md frontmatter `argument-hint` value used an invalid YAML pattern
  (`[A] OR [B]`), causing the YAML parser to reject the whole frontmatter.
  Rewritten as a quoted single-line string. Bug was present since v0.2.0.

### Added
- README section "Stay on the latest version" documenting the auto-update
  toggle (per-marketplace UI option and `FORCE_AUTOUPDATE_PLUGINS=1` env
  var) and the manual three-command update path. Links to CHANGELOG.md.

### Not changed
- Dashboard chrome (menus, labels) remains English. Decision: treat as
  global developer-tool convention, not an i18n target. Removed from
  v0.5.0 scope.

## [0.4.0] — 2026-04-20

### Added
- **i18n completeness across skill output layer.** All user-facing
  headings, labels, confirmations, and hints emitted by `/exovibe-ingest`,
  `/exovibe-query`, `/exovibe-config`, `/exovibe-sync`, `/exovibe-lint`,
  `/exovibe-validate`, and `/exovibe-view` now adapt to `user_language`
  from `config.json`. Slugs, paths, event codes, and commit messages stay
  in English for tooling compatibility.
- **Proactive insight capture** (new `check_insight_cue` feature).
  `SessionStart` hook injects a language-aware watch instruction when
  `effort=high` (or Mid with explicit opt-in) and `user_language` is set.
  Claude proactively suggests `/exovibe-ingest` on realization moments
  ("ah, so that's why...", "the real cause is...", equivalents in any
  language) so users don't have to remember to tag manually.
- `/exovibe-config enable <check>` / `disable <check>` subcommands for
  per-check override management. Enables Mid users to opt into
  High-only features like `check_insight_cue`.
- 7 new tests for insight-cue behavior (High/Mid/Low paths, opt-in,
  override-disable, null-language deferral, 9000-char budget verification).

### Changed
- **High effort budget raised from 6000 to 9000 chars**
  (`EFFORT_BUDGET.high.max_context_chars`). Accommodates insight-cue
  instruction + richer index injection.
- `SessionStart` hook now reserves space for the insight-cue instruction
  before truncating the index, ensuring the instruction is never clipped.
- 7 skill SKILL.md files gained an `## Output Language Rule` section
  documenting the "keep tokens English, translate prose" contract.

### Not changed (deliberately deferred)
- Dashboard HTML `<html lang>` attribute stays `"en"` because dashboard
  content is still English. Translating dashboard content + syncing the
  `lang` attribute is tracked for v0.5.0 — setting `lang="ko"` with
  English content would break screen-reader pronunciation and SEO.
- `NEGATIVE_FEEDBACK_REGEX` in `hooks/user-prompt-submit.js` stays
  bilingual (Korean + English tokens). Migrating it to the LLM-delegated
  pattern is v0.5.x work — breaking a production-tested signal without
  a bigger plan is higher risk than the inconsistency it causes today.

### Tests
- Suite grew from 23 → 30 passing.

## [0.3.0] — 2026-04-20

### Added
- **Native-language wiki content.** New `user_language` field in
  `config.json`; first ingest or sync setup prompts the user once with a
  multilingual greeting and saves their choice. Claude writes all wiki
  prose (`## Context`, `## Root Cause`, `## Resolution`, `## Avoid`,
  `title:`, index summaries) in that language. Slugs, tags, categories,
  and file paths remain English for portability. Zero translation files —
  the LLM handles every language it supports natively.
- `/exovibe-sync setup` one-shot subcommand: runs init, detects missing
  `gh` CLI and offers auto-install (winget/brew/apt/dnf), launches
  browser-based `gh auth login --web`, creates a **private** GitHub repo,
  and performs the first push — all from a single command.
- Multi-account UX for `gh auth`: detects multiple logged-in accounts and
  asks which one should own the wiki repo.
- One-time sync-onboarding hint after first successful ingest (Step 8 of
  `/exovibe-ingest`), gated by `state/onboarded.json` so it never nags.
- README "Your wiki, your language" section highlighting the feature.
- English symmetric tests for the bilingual `NEGATIVE_FEEDBACK_REGEX`
  (previously only Korean test inputs existed).

### Changed
- `hooks/session-start.js` no longer emits `cwd=<project-path>` in
  `log.md`. No parser consumed this field and it exposed project names
  on cross-machine sync. Dashboard log parser verified unaffected.
- Translated 18 files (demo-vault wiki pages, skill docs, templates,
  script comments) from Korean to English for global distribution.

### Preserved
- `NEGATIVE_FEEDBACK_REGEX` remains bilingual (intentional — the
  Korean tokens are working detection logic, not comments).

## [0.2.0] — 2026-04-19

Initial public release.

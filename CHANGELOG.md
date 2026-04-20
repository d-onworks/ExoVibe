# Changelog

All notable changes to the ExoVibe plugin. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

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

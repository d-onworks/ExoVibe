# ExoVibe

> The Cognitive Exoskeleton for Vibe Coders — Claude-native. Zero API keys. Zero external DBs. Just markdown that compounds.

**ExoVibe** turns every Claude Code session into permanent, structured knowledge — then automatically injects relevant lessons into your *next* session so you never repeat the same mistake twice.

Built for AI-native vibe coders who ship fast but keep hitting the same walls: hallucinated packages, mixed libraries, 500-line files, silent error swallowing.

---

## See it in action

![ExoVibe Dashboard](docs/images/dashboard-hero.png)

> Your second brain, rendered as a living graph. Above: 12 lessons archived across
> patterns, antipatterns, stack decisions, structure lessons, and blocked hallucinations.
> One command opens it: `/exovibe-view`.

Open it three ways depending on what you want:

| Command | Opens | Install needed |
|---------|-------|----------------|
| `/exovibe-view` *(or `dashboard`)* | Single-file HTML dashboard in your browser | None |
| `/exovibe-view vault` | `~/.claude/exovibe/` as an Obsidian Vault | [Obsidian](https://obsidian.md) (free) |
| `/exovibe-view graph` | Obsidian + graph view focus | Obsidian |

The dashboard regenerates on every call — always fresh, deterministic, and **offline**
(no CDN, no network). The Vault preset (dark theme, category-colored graph) installs
itself the first time you open `vault` mode.

---

## Install

```bash
/plugin marketplace add d-onworks/ExoVibe
/plugin install exovibe
```

That's it. No API key. No database. No config.

---

## What it does

### Captures what matters
- **Manual archive**: Type `#wiki` in any prompt → that exchange becomes a permanent lesson
- **Error loop detection**: Same error 3 times? ExoVibe auto-extracts the pattern
- **Rollback signals**: `git reset --hard` → flags what went wrong
- **Success signals**: Tests pass + commit → extracts the winning pattern

### Closes the learning loop
- Next `SessionStart` → relevant lessons auto-injected into Claude's context (native 10K channel)
- Claude *already knows* you've seen this bug before — before you even ask

### Stays out of your way
- Everything is plain markdown in `~/.claude/exovibe/`
- Open in Obsidian for a free graph view
- Read it, edit it, grep it, git it

---

## Architecture (30-second tour)

```
Your Prompt ──► UserPromptSubmit hook  ──► raw/
                                              │
Claude's Tools ─► PostToolUse hook ──► error_counter
                                              │
Session Ends ──► SessionEnd hook   ──► /exovibe-ingest Skill
                                              │
                                              ▼
                                         wiki/*.md
                                              │
Next Session ─► SessionStart hook ◄──  /exovibe-query Skill
       │                                      │
       └─── context injected ─────────────────┘
```

**5 hooks + 4 skills + 0 external dependencies.**

---

## Zero API Keys Explained

Traditional memory plugins call Anthropic's API from hooks → requires key management, rate limits, extra cost.

ExoVibe does the opposite:
- Hooks do **only file I/O**
- Hook stdout is injected into Claude's context (native Claude Code feature)
- Claude *itself* runs the ingest / query / lint skills via forked Explore agents
- Your existing Claude Code session does all the thinking

**You already have Claude. ExoVibe just teaches it to remember.**

---

## File Layout

```
~/.claude/exovibe/
├── raw/                     immutable session transcripts (auto-rotated)
├── wiki/
│   ├── patterns/            things that worked
│   ├── antipatterns/        things that didn't (the expensive lessons)
│   ├── stack-decisions/     why you chose X over Y
│   ├── structure-lessons/   500-line file refactors, etc.
│   └── hallucinated/        packages Claude made up (verified dead)
├── index.md                 LLM-maintained catalog
├── log.md                   append-only audit trail
└── CLAUDE.md                wiki schema
```

---

## Effort Levels — Grows with you

ExoVibe has three effort levels. Change anytime with `/exovibe-config effort <level>`.

| Level | For | What runs |
|-------|-----|-----------|
| 🟢 **Low** | Pros who know their game | Manual `#wiki` + error counting (no auto-ingest). Silent mode. |
| 🟡 **Mid** *(default)* | Sensible middle ground | Error loop auto-ingest, rollback detection, package validation, PreCompact trigger |
| 🔴 **High** | Beginners / vibe coders | Everything in Mid + 500-line warnings, library mixing detection, hardcoded secret check, error-swallowing patterns, console.log leftovers, unused imports, immediate ingest on negative feedback |

Unlike tools that assume one size fits all, **ExoVibe grows as you grow**.

---

## Plays well with

ExoVibe is designed to coexist with other popular Claude Code plugins.
We respect the 10K `additionalContext` budget (we use ≤ 4,500 chars so
others get their turn) and all file I/O stays inside `~/.claude/exovibe/`.

| Plugin | Relationship | Notes |
|--------|-------------|-------|
| [Superpowers](https://claude.com/plugins/superpowers) (94K★) | Complementary | Workflow discipline vs. memory — they shape HOW you code, we remember WHAT you learned |
| [gstack](https://github.com/garrytan/gstack) (50K★) | Complementary | Role-based slash commands vs. memory — orthogonal domains |
| GSD (35K★) | Complementary | Stability focus vs. memory |
| [Context7](https://context7.com) | Complementary | Live docs vs. past lessons — both valuable, both cheap on context |
| [frontend-design](https://anthropic.com) (277K+ installs) | Zero conflict | Skills-only, different namespace |

All `additionalContext` messages are prefixed with `[ExoVibe]` so you
always know who's speaking.

---

## Sync Across Machines

ExoVibe syncs via a **private git repo you own** — no ExoVibe servers, no
third-party accounts, no telemetry.

```bash
# Machine 1 (first time)
bash scripts/exovibe-sync-init.sh
cd ~/.claude/exovibe
git remote add origin git@github.com:YOU/my-exovibe.git
git push -u origin main

# Machine 2 (join)
git clone git@github.com:YOU/my-exovibe.git ~/.claude/exovibe

# Thereafter, from any Claude Code session
/exovibe-sync push     # upload changes
/exovibe-sync pull     # fetch changes
/exovibe-sync status   # what's local vs remote
```

**What syncs**: `wiki/`, `index.md`, `log.md`, `CLAUDE.md`, `config.json`
**What stays local**: `raw/` (transcripts with possible secrets), `state/`
(per-machine counters), `archive/`, generated artifacts

Use a **private** repo. Your lessons are personal.

---

## Obsidian Compatible

The fastest path: run `/exovibe-view vault` — ExoVibe will scaffold a
dark-themed `.obsidian/` preset (category-colored graph groups, wikilinks
enabled, preview mode) and launch Obsidian via URI scheme. Already
customized your vault? ExoVibe never overwrites existing configs.

What you get out of the box:
- Graph view with category colors matching the dashboard
- Backlinks + outgoing links pane
- Full-text search across the whole brain
- Community plugins (Smart Connections, Dataview, etc.) remain yours to enable

Not affiliated with Obsidian. We just happen to speak the same format.

---

## Philosophy

> *"Vibe coders ship fast. ExoVibe makes sure they don't ship the same bug twice."*

Inspired by:
- [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — markdown that compounds
- Claude Code's native hook system — all the plumbing already exists
- 19.7% LLM hallucinated packages statistic — we can't let that slide

---

## Roadmap

- **v0.1**: Manual `#wiki` tag + error loop detection + SessionStart injection
- **v0.2 (Hackathon)**: Three effort levels + plugin coexistence + config skill + cross-machine git sync
- **v0.3**: Adaptive effort suggestion (usage pattern → recommended level)
- **v0.4**: HTML dashboard + conflict-aware sync auto-resolution
- **v1.0**: Cross-developer wiki (opt-in shared learnings)

---

## License

MIT © 2026 d-onworks

## Credits

Built with 100% Claude Code (Opus 4.7) by a vibe coder, for vibe coders.

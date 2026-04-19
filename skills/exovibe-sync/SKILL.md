---
name: exovibe-sync
description: Sync the ExoVibe knowledge base across multiple machines using a user-owned private git repository. Use when the user wants to share their wiki between laptop and desktop, back it up, or explicitly invokes /exovibe-sync with push/pull/init/status. Only syncs the shareable subset (wiki/, index.md, log.md, CLAUDE.md, config.json) — raw transcripts and error counters stay local.
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(cd *) Bash(node *) Read Write
argument-hint: [init|push|pull|status|help]
---

# ExoVibe Sync Skill

Cross-machine synchronization for the ExoVibe knowledge base via git.
**User owns the remote** — no ExoVibe infrastructure, no server, no lock-in.

## What syncs vs. what stays local

| Path | Synced? | Why |
|------|---------|-----|
| `wiki/` | ✅ Yes | The actual knowledge — the point of syncing |
| `index.md` | ✅ Yes | LLM-maintained catalog |
| `log.md` | ✅ Yes | Audit trail (useful across machines) |
| `CLAUDE.md` | ✅ Yes | Schema — must match across devices |
| `config.json` | ✅ Yes | Effort level + overrides |
| `raw/` | ❌ No | Raw transcripts may contain secrets; machine-specific |
| `state/error_counter.json` | ❌ No | Per-machine error tracking |
| `state/pending_ingest.json` | ❌ No | Per-machine queue |
| `archive/` | ❌ No | Rotated raw data |
| `dashboard.html` | ❌ No | Generated artifact |

The exclusion list is enforced by `~/.claude/exovibe/.gitignore` (created on init).

## Commands

### `init` — First-time setup on a machine
Arguments: none.

Steps:
1. Check that `~/.claude/exovibe/` exists. Create if missing.
2. Write `.gitignore` with the local-only paths listed above.
3. Run `git init` if not already a repo.
4. Set `git config core.autocrlf input` (cross-OS safety).
5. Create the initial commit with existing `wiki/` content if any.
6. Instruct the user to add their remote:
   ```
   Setup complete. Now add YOUR remote:
     cd ~/.claude/exovibe
     git remote add origin git@github.com:YOUR_USERNAME/YOUR_EXOVIBE_REPO.git
     git branch -M main
     git push -u origin main

   Use a PRIVATE repository — your lessons are personal.
   ```

### `push` — Upload local changes
1. `cd ~/.claude/exovibe`
2. Verify remote exists; if not, prompt user to run `/exovibe-sync init` first.
3. `git add wiki/ index.md log.md CLAUDE.md config.json` (explicit paths only)
4. Check if anything to commit:
   ```bash
   git diff --cached --quiet && echo "nothing to push" || \
     git commit -m "exovibe sync: <N> entries updated ($(date -Iseconds))"
   ```
5. `git push` — report success/failure succinctly.

### `pull` — Download updates from remote
1. `cd ~/.claude/exovibe`
2. `git fetch origin`
3. `git pull --rebase origin main`
4. If merge conflicts arise in `wiki/` pages:
   - Display conflict file list
   - Suggest: manual resolution OR `/exovibe-lint` to reconcile after pull
5. After successful pull, remind the user that ExoVibe context from the remote
   is now available — next SessionStart will inject the updated index.

### `status` — Show sync state
```
Local wiki:     42 pages (28 patterns, 11 antipatterns, 3 hallucinated)
Remote:         origin/main (last synced 2026-04-18 — 2 days ago)
Unsynced:       3 changes staged, 5 unstaged
Config:         effort=mid
```

### `help` — Print usage

## Rules

1. **Never auto-sync.** Sync is always explicit — surprise pushes leak private
   lessons into the wrong repo.
2. **Never sync raw/, state/, archive/.** Even if git tracks them, enforce via
   `.gitignore` and refuse to remove gitignore entries.
3. **Refuse dangerous operations**: `git push --force`, `git reset --hard` on
   shared history, branch deletion. Respond with: "That would rewrite shared
   history. Use `/exovibe-sync pull` instead, then resolve conflicts locally."
4. **Private repos only**: on init, emit a warning if the user mentions a
   public repo. Their learnings may include company code references,
   architecture decisions, stack preferences.
5. **Commit messages are factual**: `"exovibe sync: <N> entries updated
   (<ISO-date>)"`. No marketing language, no emojis, no co-author trailers.

## Setup Recipe (paste-friendly)

```bash
# On machine 1 (first time)
cd ~/.claude/exovibe
# Invoke /exovibe-sync init from Claude Code

# Then, outside Claude Code:
git remote add origin git@github.com:YOUR_USERNAME/YOUR_EXOVIBE_REPO.git
git branch -M main
git push -u origin main

# On machine 2 (joining)
mkdir -p ~/.claude
cd ~/.claude
git clone git@github.com:YOUR_USERNAME/YOUR_EXOVIBE_REPO.git exovibe

# Done. Next Claude Code session on machine 2 sees the same wiki.
```

## Failure Modes

| Error | Likely cause | User-facing message |
|-------|--------------|---------------------|
| `not a git repository` | init never run | "Run `/exovibe-sync init` first." |
| `no remote 'origin'` | init done, remote missing | Show the `git remote add` snippet. |
| `merge conflict` | both machines edited the same wiki page | List conflicting files, recommend `/exovibe-lint` after resolution. |
| `permission denied` | SSH key missing or wrong remote | "Check your SSH key and that the remote URL is correct." |
| `raw/ tracked` | `.gitignore` missing or deleted | Recreate `.gitignore` and `git rm --cached raw/`. |

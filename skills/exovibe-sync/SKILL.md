---
name: exovibe-sync
description: Sync the ExoVibe knowledge base across multiple machines using a user-owned private git repository. Use when the user wants to share their wiki between laptop and desktop, back it up, or explicitly invokes /exovibe-sync with setup/push/pull/init/status. Only syncs the shareable subset (wiki/, index.md, log.md, CLAUDE.md, config.json) — raw transcripts and error counters stay local.
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *) Bash(cd *) Bash(node *) Read Write
argument-hint: [setup|init|push|pull|status|help]
---

# ExoVibe Sync Skill

Cross-machine synchronization for the ExoVibe knowledge base via git.
**User owns the remote** — no ExoVibe infrastructure, no server, no lock-in.

## Recommended command for new users: `setup`

If the user is new to git or has never synced before, guide them to
`/exovibe-sync setup`. It automates everything: local git init, GitHub
repo creation (private), remote wiring, and first push — in one command.

`init` remains available for users who want to use a non-GitHub remote
(GitLab, Bitbucket, self-hosted, etc.) or create the repo manually.

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

The exclusion list is enforced by `~/.claude/exovibe/.gitignore` (created on init/setup).

## Commands

### `setup` — One-shot setup (recommended)

Automates: `init` steps + GitHub repo creation + remote wiring + first push,
using the `gh` CLI. Intended for users who do not want to run git commands
by hand.

Arguments (optional): `[repo-name]` — defaults to `exovibe-wiki`.

Steps:

1. **Run all `init` steps first** (idempotent — safe to re-run on a machine
   that already has `~/.claude/exovibe/.git/`). This guarantees the local
   repo exists and the initial commit is present before any network call.
1a. **Resolve wiki language** (shared with `exovibe-ingest` Step 1a). Read
   `user_language` from `~/.claude/exovibe/config.json`. If null/missing,
   prompt the user once using the same multilingual greeting as ingest:
   ```
   One quick setup question: what language should your wiki content be
   written in?
   (어떤 언어로? / どの言語で? / ¿En qué idioma? / Quelle langue ?)

   Reply with a BCP-47 code (en, ko, ja, zh, es, fr, de, pt, ru, vi, id, ...)
   or 'auto' to detect from your prompts each time.

   This only affects wiki content — code, tags, file paths, and commit
   messages stay in English.
   ```
   Save the answer to `config.json` (`user_language`). If the user has
   already completed `/exovibe-ingest` before setup, `user_language` will
   already be set — skip the prompt silently.
2. **Check `gh` is installed**: `gh --version`.
   - If missing, **offer to install automatically** using the OS's package
     manager. Detect the OS and ask the user before running anything:
     - Windows: `winget install --id GitHub.cli --source winget`
     - macOS: `brew install gh` (only if `brew` is available)
     - Linux (Debian/Ubuntu): `sudo apt update && sudo apt install -y gh`
     - Linux (Fedora/RHEL): `sudo dnf install -y gh`
     Prompt:
     ```
     GitHub CLI (`gh`) is not installed. I can install it for you via
     <winget|brew|apt|dnf>. Proceed? (y/n)

     If no, install it manually from https://cli.github.com and re-run
     /exovibe-sync setup.
     ```
     - On **y**: run the install command. After it completes, re-run
       `gh --version` to verify. If install fails (no winget/brew, no
       sudo, unsupported distro, network error), stop with a manual
       fallback message — do not keep retrying with other managers.
     - On **n**: stop and print the manual install URL.
3. **Check `gh` auth**: `gh auth status`. Parse the output for logged-in
   accounts.
   - **0 accounts**: **offer to sign in via browser**. Prompt:
     ```
     No GitHub account is signed in. I can open your browser to sign in
     now (one-time). Proceed? (y/n)
     ```
     - On **y**: run `gh auth login --hostname github.com --git-protocol https --web --scopes repo`.
       The user completes the browser flow and returns. Then re-run
       `gh auth status` to confirm before proceeding.
     - On **n**: stop and tell the user to run `gh auth login` manually.
   - **1 account**: use it. Print `"Using GitHub account: <login>"`.
   - **2+ accounts**: list each account with its active/inactive marker and
     ask the user which one to use. Example prompt:
     ```
     Multiple GitHub accounts are signed in. Which account should own
     your ExoVibe wiki repo? (Your wiki mixes personal and work lessons,
     so a personal account is usually correct.)

       1. <account-name-1>   (active)
       2. <account-name-2>

     Reply with the number of the account to use.
     ```
     Substitute the real login names from `gh auth status` in place of
     `<account-name-N>` — do not display hard-coded examples.
     After the user picks, run `gh auth switch --user <chosen>` so that
     subsequent `gh` calls target the right account.
4. **Determine repo name**: use `[repo-name]` argument if provided, else
   `exovibe-wiki`. Validate it matches `^[a-zA-Z0-9._-]+$`.
5. **Confirm with the user before creating**:
   ```
   I will create a PRIVATE repo at:
     github.com/<account>/<repo-name>

   Proceed? (y/n)
   ```
   Do not create without explicit confirmation.
6. **Create and push in one shot**:
   ```bash
   cd ~/.claude/exovibe
   gh repo create <account>/<repo-name> \
     --private \
     --description "ExoVibe personal knowledge base — auto-synced across machines" \
     --source=. \
     --remote=origin \
     --push
   ```
7. **Verify**: `git remote -v` shows origin; `gh repo view <account>/<repo-name> --json visibility` returns `"PRIVATE"`. If either check fails, report exactly which step failed.
8. **Report success** with the HTTPS URL and a one-line "next steps" note:
   ```
   ✅ Setup complete.
      Repo:   https://github.com/<account>/<repo-name>  (PRIVATE)
      Local:  ~/.claude/exovibe/

   From now on:
     /exovibe-sync push   — upload local lessons
     /exovibe-sync pull   — download lessons on another machine
   ```
9. **If you switched gh accounts in step 3**, remind the user how to switch
   back for their normal work: `gh auth switch --user <previous-active>`.

### `init` — Local-only setup (advanced users)

Use this when the user wants to use a non-GitHub remote, create the repo
manually in a browser, or retain full control over naming and remote
protocol (SSH vs HTTPS).

Arguments: none.

Steps:
1. Check that `~/.claude/exovibe/` exists. Create if missing.
2. Write `.gitignore` with the local-only paths listed above.
3. Run `git init` if not already a repo.
4. Set `git config core.autocrlf input` (cross-OS safety).
5. Create the initial commit with existing `wiki/` content if any.
6. Rename the default branch to `main` (`git branch -M main`).
7. Instruct the user to add their remote:
   ```
   Local setup complete. Now add YOUR remote:
     cd ~/.claude/exovibe
     git remote add origin git@github.com:YOUR_USERNAME/YOUR_EXOVIBE_REPO.git
     git push -u origin main

   Use a PRIVATE repository — your lessons are personal.

   Tip: if you have `gh` CLI installed, prefer `/exovibe-sync setup` instead —
   it will create the repo and push automatically.
   ```

### `push` — Upload local changes
1. `cd ~/.claude/exovibe`
2. Verify remote exists; if not, prompt user to run `/exovibe-sync setup` (or `init`) first.
3. `git add wiki/ index.md log.md CLAUDE.md config.json` (explicit paths only).
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

Show a short summary of all subcommands, highlighting `setup` as the
recommended starting point for new users.

## Rules

1. **Never auto-sync.** Sync is always explicit — surprise pushes leak private
   lessons into the wrong repo.
2. **Never sync raw/, state/, archive/.** Even if git tracks them, enforce via
   `.gitignore` and refuse to remove gitignore entries.
3. **Refuse dangerous operations**: `git push --force`, `git reset --hard` on
   shared history, branch deletion. Respond with: "That would rewrite shared
   history. Use `/exovibe-sync pull` instead, then resolve conflicts locally."
4. **Private repos only**: `setup` always passes `--private`. `init` must emit
   a warning if the user mentions a public repo. Their learnings may include
   company code references, architecture decisions, stack preferences.
5. **Commit messages are factual**: `"exovibe sync: <N> entries updated
   (<ISO-date>)"`. No marketing language, no emojis, no co-author trailers.
6. **Confirm before creating a remote repo.** `setup` must not create a
   GitHub repo without an explicit y/n confirmation showing the full
   `<account>/<name>` path.

## Setup Recipe (paste-friendly)

### Easiest path (recommended)
```
# Inside Claude Code, on machine 1:
/exovibe-sync setup

# On machine 2 (joining), outside Claude Code:
mkdir -p ~/.claude
cd ~/.claude
gh repo clone YOUR_USERNAME/exovibe-wiki exovibe
```

### Manual path (if you don't have `gh` CLI)
```bash
# On machine 1 (first time)
# 1. Inside Claude Code:
/exovibe-sync init

# 2. Create a PRIVATE repo in your browser at github.com/new
#    (name suggestion: exovibe-wiki)

# 3. Outside Claude Code:
cd ~/.claude/exovibe
git remote add origin git@github.com:YOUR_USERNAME/exovibe-wiki.git
git push -u origin main

# On machine 2 (joining)
mkdir -p ~/.claude
cd ~/.claude
git clone git@github.com:YOUR_USERNAME/exovibe-wiki.git exovibe
```

## Failure Modes

| Error | Likely cause | User-facing message |
|-------|--------------|---------------------|
| `gh: command not found` | GitHub CLI not installed, user declined auto-install, or auto-install failed | "GitHub CLI (`gh`) is not installed. Install it from https://cli.github.com (or re-run `/exovibe-sync setup` and accept the auto-install prompt). If you prefer to skip `gh`, use `/exovibe-sync init` and create the repo manually in your browser." |
| `winget` / `brew` / `apt` not found during auto-install | Package manager unavailable on user's system | "I could not find a supported package manager (winget/brew/apt/dnf) on this system. Install `gh` manually from https://cli.github.com, then re-run `/exovibe-sync setup`." |
| Auto-install requires sudo but user declined | Linux without passwordless sudo | "The install needs `sudo` privileges. Either run `sudo apt install gh` yourself and re-run `/exovibe-sync setup`, or install `gh` without sudo via https://cli.github.com." |
| `You are not logged into any GitHub hosts` | `gh auth login` never run, user declined browser sign-in | "You need to sign in to GitHub first. Run `gh auth login` in your terminal (choose HTTPS, authenticate via browser), then re-run `/exovibe-sync setup`. Or re-run `/exovibe-sync setup` and accept the browser sign-in prompt." |
| Multiple accounts, none selected | Ambiguity — user must pick | Show the numbered account list and wait for a reply. Do NOT guess. |
| `Name already exists on this account` (from `gh repo create`) | Repo with that name already exists on GitHub | "A repo named `<name>` already exists on `<account>`. Either: (a) use it — run `git remote add origin https://github.com/<account>/<name>.git && git push -u origin main`, or (b) pick a new name — run `/exovibe-sync setup <new-name>`." |
| `HTTP 401` or `authentication failed` on push | Token missing `repo` scope | "Your GitHub token does not have `repo` scope. Run `gh auth refresh -s repo` and retry `/exovibe-sync setup`." |
| `fatal: not a git repository` | `init` / `setup` never run | "Run `/exovibe-sync setup` first (or `/exovibe-sync init` if you want manual control)." |
| `no remote 'origin'` | init done, remote missing | "No remote is configured. Run `/exovibe-sync setup` to create one automatically, or follow the manual instructions in `/exovibe-sync init`." |
| `merge conflict` | Both machines edited the same wiki page | List conflicting files, recommend `/exovibe-lint` after resolution. |
| `Permission denied (publickey)` on push | SSH key missing or wrong remote | "SSH key is not configured for GitHub. Either: (a) switch to HTTPS — run `git remote set-url origin https://github.com/<user>/<repo>.git`, or (b) set up SSH — see https://docs.github.com/authentication/connecting-to-github-with-ssh." |
| `raw/ tracked` | `.gitignore` missing or deleted | "Local-only paths are being tracked. Recreate `.gitignore` and run `git rm --cached -r raw/ archive/ state/error_counter.json state/pending_ingest.json dashboard.html`." |

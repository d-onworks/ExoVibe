#!/usr/bin/env bash
# ExoVibe cross-machine sync — initialization helper.
#
# Usage:
#   bash scripts/exovibe-sync-init.sh
#
# Creates ~/.claude/exovibe/ if missing, writes the sync .gitignore,
# initializes git, and prints the remote-add instructions.
#
# This script does NOT add a remote — the user chooses their own
# private repository.

set -euo pipefail

EXOVIBE_ROOT="${EXOVIBE_ROOT:-$HOME/.claude/exovibe}"

echo "ExoVibe sync init"
echo "  EXOVIBE_ROOT: $EXOVIBE_ROOT"
echo ""

mkdir -p "$EXOVIBE_ROOT"
cd "$EXOVIBE_ROOT"

# Write the sync .gitignore (idempotent).
cat > .gitignore <<'EOF'
# Local-only paths — never sync these.
# Raw transcripts may contain secrets; kept on the originating machine.
raw/
archive/

# Per-machine state (error counters, queues).
state/

# Generated artifacts.
dashboard.html
lint-report.md

# Editor / OS noise.
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
EOF

echo "Wrote $EXOVIBE_ROOT/.gitignore"

if [ ! -d .git ]; then
  git init --initial-branch=main >/dev/null
  git config core.autocrlf input
  echo "Initialized git repo (branch: main, autocrlf=input)"
else
  echo "Git repo already initialized."
fi

# Stage only the shareable subset.
git add .gitignore 2>/dev/null || true
for path in wiki index.md log.md CLAUDE.md config.json; do
  if [ -e "$path" ]; then
    git add "$path" 2>/dev/null || true
  fi
done

if git diff --cached --quiet; then
  echo "Nothing to commit yet (empty wiki)."
else
  git commit -m "exovibe sync: initial snapshot ($(date -u +%Y-%m-%dT%H:%M:%SZ))" >/dev/null
  echo "Initial commit created."
fi

echo ""
echo "Next steps — add YOUR private remote:"
echo ""
echo "    cd $EXOVIBE_ROOT"
echo "    git remote add origin git@github.com:YOUR_USERNAME/YOUR_EXOVIBE_REPO.git"
echo "    git push -u origin main"
echo ""
echo "USE A PRIVATE REPO. Your lessons are personal."
echo ""
echo "To sync from Claude Code later:"
echo "    /exovibe-sync push   (upload changes)"
echo "    /exovibe-sync pull   (fetch changes from another machine)"
echo "    /exovibe-sync status"

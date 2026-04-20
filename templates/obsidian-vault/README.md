# Obsidian Vault Preset

This directory is copied to `~/.claude/exovibe/.obsidian/` on ExoVibe's first run.
When the user opens the Vault, they immediately see a dark theme plus a category-colored graph.

## Files

| File | Role |
|-----|-----|
| `app.json` | Default editor behavior (short wikilink form, attachments folder) |
| `appearance.json` | Dark theme |
| `graph.json` | Graph-view color groups (per-category color map) |
| `core-plugins.json` | Default plugin activation (graph, backlinks, tag-pane) |

## Category Colors (same as the dashboard)

- patterns — green (success)
- antipatterns — red (failure)
- stack-decisions — blue (choice)
- structure-lessons — orange (structure)
- hallucinated — purple (hallucination)

## Install Behavior

When `/exovibe-view vault` runs, `scripts/install-vault-preset.js` only copies
these files if `.obsidian/` is empty or missing.
It never overwrites user customizations.

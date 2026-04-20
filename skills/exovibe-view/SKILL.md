---
name: exovibe-view
description: Open the ExoVibe knowledge base in a visual UI. Use when the user wants to see their wiki as a dashboard or knowledge graph, asks to "show my brain", asks how to visualize the wiki, or explicitly invokes /exovibe-view. Three modes - dashboard (HTML, no install needed), vault (Obsidian), graph (Obsidian + graph focus).
context: fork
agent: general-purpose
allowed-tools: Bash(node *) Read
argument-hint: [dashboard|vault|graph]
---

# ExoVibe View Skill

Open the user's ExoVibe knowledge base visually.

## Three Modes

| Mode | Action | Dependency |
|-----|------|-------|
| `dashboard` (default) | Run `scripts/generate-dashboard.js` → regenerate `~/.claude/exovibe/dashboard.html` → open in default browser | none |
| `vault` | Install `.obsidian/` preset (only if missing) → invoke `obsidian://open?path=...` URI | Obsidian (free) |
| `graph` | Same as vault, plus a graph-view focus hint | Obsidian |

## Invocation

```bash
node scripts/exovibe-view.js dashboard
node scripts/exovibe-view.js vault
node scripts/exovibe-view.js graph
```

When the user runs `/exovibe-view` with no argument, it is called with no args → default `dashboard`.

## Steps

### Step 1 — Parse argument
Extract the mode from user input. Default to `dashboard` if missing.

### Step 2 — Execute
Invoke `scripts/exovibe-view.js <mode>` via Bash.

The script will:
- `dashboard` → run generate-dashboard.js, then open a `file://` URL
- `vault` / `graph` → run install-vault-preset.js, then open an `obsidian://` URI

### Step 3 — Tell the user

Based on the result, tell the user:

- Dashboard mode: "The dashboard is open in your browser, showing page counts, recent lessons, and the knowledge graph."
- Vault mode: "The Vault is open in Obsidian. If Obsidian is not installed, a guidance message is printed."
- Graph mode: "After the Vault opens, press Ctrl/Cmd+G to switch to the graph view."

## Handling Obsidian Not Installed

`scripts/exovibe-view.js` tries to invoke an `obsidian://` URI.
If Obsidian is missing, the OS raises a URL handler error — but catching that reliably is difficult.
Instead the script prints a **pre-flight guidance message**:

> If Obsidian is not installed, show:
> 1. Download for free at https://obsidian.md
> 2. After install, "Open folder as vault" → select `~/.claude/exovibe/`
> 3. Re-run this command

## Rules

1. **Zero external network**: only `obsidian://` URIs and `file://` URLs
2. **Never overwrite an existing `.obsidian/`**: skip if the user has already customized it
3. **Always regenerate**: dashboard.html is rebuilt from the latest `wiki/` state on every run
4. **Platform auto-detect**: Windows / macOS / Linux all supported

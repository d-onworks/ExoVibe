---
name: exovibe-validate
description: Verify a package/library actually exists before install. Use when the user or Claude is about to run `npm install`, `pip install`, `cargo add`, `go get`, etc. Blocks hallucinated packages (19.7% of AI recommendations) by checking the real registry. Archives confirmed fakes to wiki/hallucinated/.
context: fork
agent: general-purpose
allowed-tools: Bash(npm *) Bash(pip *) Bash(cargo *) Bash(go *) Read Write
argument-hint: <package-name> [registry]
---

# ExoVibe Validate Skill

You are gatekeeping a package install. Your job: prevent the user from installing a hallucinated package that Claude (or any LLM) fabricated.

## Step 1 — Parse Input

- `$0`: package name (e.g., `@supabase/auth-helpers-v2`)
- `$1`: registry (default: `npm`; can be `pip`, `cargo`, `go`)

## Step 2 — Check Known-Fake List

Glob `~/.claude/exovibe/wiki/hallucinated/*.md` and grep for the package name.

If found → **BLOCK** immediately:
```
## BLOCKED: Hallucinated Package

"<pkg>" was previously confirmed as non-existent.
See: ~/.claude/exovibe/wiki/hallucinated/<slug>.md
```

## Step 3 — Verify with Registry

| Registry | Command |
|----------|---------|
| npm | `npm info <pkg> --json` |
| pip | `pip index versions <pkg>` (or `pip show` after install probe) |
| cargo | `cargo search <pkg> --limit 1` |
| go | `go list -m <pkg>@latest` |

If the registry returns "not found" / non-zero exit → package is hallucinated.

## Step 4 — Archive the Fake (if hallucinated)

Create `~/.claude/exovibe/wiki/hallucinated/<pkg-slug>.md`:

```markdown
---
title: "<pkg> does not exist"
slug: <pkg-slug>
category: hallucinated
registry: npm | pip | ...
first_seen: <today>
last_attempted: <today>
---

## Context
Claude (or the user) tried to install `<pkg>` during a session. The registry does not have this package.

## Likely Real Alternative
<if you can infer — e.g., "@supabase/auth-helpers-v2 doesn't exist; the real name is @supabase/auth-helpers-nextjs">

## Avoid
Trust `npm info` / `pip show` before installing AI-recommended packages.
Reference: 19.7% of LLM-suggested packages are hallucinated (2024 research).
```

Update `~/.claude/exovibe/index.md` under "Hallucinated Packages (Verified Dead)".

## Step 5 — Log

Append to `~/.claude/exovibe/log.md`:
```
<ISO-8601> VALIDATE <pkg> result=<ok|hallucinated>
```

## Step 6 — Return Verdict

### If real:
```
✓ <pkg> verified on <registry> (latest: <version>). Safe to install.
```

### If hallucinated:
```
✗ BLOCKED: <pkg> does not exist on <registry>.
Archived to ~/.claude/exovibe/wiki/hallucinated/<slug>.md.
Suggested real alternative: <if known>
```

## Rules

1. **Never install** a package during validation — only query the registry
2. **Block decisively** — if registry returns non-zero, treat as hallucinated; don't retry endlessly
3. **Record first_seen and last_attempted** to detect re-offenders
4. **Suggest alternatives only when confident** — don't fabricate alt names

---
title: Never pass req.body straight into the DB
slug: mass-assignment-req-body
category: antipattern
tags: [security, backend]
stack: []
severity: medium
created: 2026-04-20
updated: 2026-04-20
provenance:
  - session: demo-seed
    timestamp: 2026-04-20T00:00:00Z
    excerpt: "(demo seed data)"
links:
  - "[[postgres-partial-index-soft-delete]]"
---

## Context
Never pass req.body straight into the DB.

## Root Cause
The structural reason this mistake keeps recurring.

## Resolution
The correct alternative.

## Avoid
Triggers that lead you back into this pattern.


## Related
- [[postgres-partial-index-soft-delete]]

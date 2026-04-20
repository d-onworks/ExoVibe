---
title: Split components over 500 lines by feature
slug: 500-line-component-split
category: structure-lesson
tags: [architecture, refactoring]
stack: []
severity: medium
created: 2026-04-20
updated: 2026-04-20
provenance:
  - session: demo-seed
    timestamp: 2026-04-20T00:00:00Z
    excerpt: "(demo seed data)"
links:
  - "[[react-server-component-boundary]]"
---

## Context
A structural weakness surfaced as the component grew.

## Root Cause
Early simplifications compounded into costly coupling over time.

## Resolution
Refactor by feature boundary, not by file type.

## Avoid
Rules that keep you from falling into the same trap again.


## Related
- [[react-server-component-boundary]]

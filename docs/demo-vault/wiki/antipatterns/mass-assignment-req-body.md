---
title: req.body 통째로 DB 전달 금지
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
req.body 통째로 DB 전달 금지.

## Root Cause
같은 실수를 반복하게 되는 구조적 원인.

## Resolution
올바른 대안.

## Avoid
이 패턴을 유발하는 트리거.


## Related
- [[postgres-partial-index-soft-delete]]

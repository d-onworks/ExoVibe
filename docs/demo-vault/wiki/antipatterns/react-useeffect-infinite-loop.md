---
title: useEffect deps에 새 객체 넣으면 무한 루프
slug: react-useeffect-infinite-loop
category: antipattern
tags: [react, hooks]
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
useEffect deps에 새 객체 넣으면 무한 루프.

## Root Cause
같은 실수를 반복하게 되는 구조적 원인.

## Resolution
올바른 대안.

## Avoid
이 패턴을 유발하는 트리거.


## Related
- [[react-server-component-boundary]]

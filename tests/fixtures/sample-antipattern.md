---
title: React useEffect infinite loop
slug: react-useeffect-infinite-loop
category: antipattern
tags: [react, useeffect, hooks]
stack: [react, nextjs]
severity: high
created: 2026-04-15
updated: 2026-04-20
provenance:
  - session: seed-sample-001
    timestamp: 2026-04-15T14:22:00Z
    excerpt: "Maximum update depth exceeded. This can happen when a component calls setState inside useEffect..."
links:
  - "[[react-server-component-boundary]]"
---

## Context

`useEffect` fires endlessly when its dependency array contains a new object/array literal on each render.

Example error:
```
Warning: Maximum update depth exceeded. This can happen when a component
calls setState inside useEffect, but useEffect either doesn't have a
dependency array, or one of the dependencies changes on every render.
```

## Root Cause

Objects and arrays are compared by reference in React's dependency array. `{}` and `[]` literals create a new reference each render, so React treats them as "changed" even when values are identical.

## Resolution

```javascript
// ❌ BAD — config is a new object each render
function Chart({ data }) {
  useEffect(() => {
    renderChart(data, { color: 'red' });
  }, [data, { color: 'red' }]);  // ← new object every render
}

// ✅ GOOD — hoist the object or use useMemo
const CHART_CONFIG = { color: 'red' };

function Chart({ data }) {
  useEffect(() => {
    renderChart(data, CHART_CONFIG);
  }, [data]);
}

// ✅ GOOD (alternative) — useMemo for dynamic configs
function Chart({ data, theme }) {
  const config = useMemo(() => ({ color: theme }), [theme]);
  useEffect(() => {
    renderChart(data, config);
  }, [data, config]);
}
```

## Avoid

**Triggers to watch for**:
- Object/array literals inside `useEffect` deps: `[{...}]`, `[[...]]`
- Inline function definitions inside deps: `[() => {}]`
- Calling `useState` setter unconditionally inside effect body

**Prior occurrences**: 3 (seed sample count)

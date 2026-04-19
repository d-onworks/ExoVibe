---
name: exovibe-view
description: Open the ExoVibe knowledge base in a visual UI. Use when the user wants to see their wiki as a dashboard or knowledge graph, asks to "show my brain", asks how to visualize the wiki, or explicitly invokes /exovibe-view. Three modes - dashboard (HTML, no install needed), vault (Obsidian), graph (Obsidian + graph focus).
context: fork
agent: general-purpose
allowed-tools: Bash(node *) Read
argument-hint: [dashboard|vault|graph]
---

# ExoVibe View Skill

사용자의 ExoVibe 지식 베이스를 시각적으로 열어준다.

## 세 가지 모드

| 모드 | 동작 | 의존성 |
|-----|------|-------|
| `dashboard` (기본) | `scripts/generate-dashboard.js` 실행 → `~/.claude/exovibe/dashboard.html` 재생성 → 기본 브라우저로 오픈 | 없음 |
| `vault` | `.obsidian/` 프리셋 설치 (없을 때만) → `obsidian://open?path=...` URI 호출 | Obsidian (무료) |
| `graph` | vault 와 동일 + 그래프뷰 포커스 안내 | Obsidian |

## 실행

```bash
node scripts/exovibe-view.js dashboard
node scripts/exovibe-view.js vault
node scripts/exovibe-view.js graph
```

슬래시 커맨드 맥락에서 사용자가 `/exovibe-view` 만 입력하면 인자 없이 호출 → 기본값 `dashboard`.

## 단계

### Step 1 — 인자 파싱
사용자가 지정한 모드를 추출한다. 없으면 `dashboard`.

### Step 2 — 실행
`scripts/exovibe-view.js <mode>` 를 Bash로 호출한다.

이 스크립트는:
- `dashboard` → generate-dashboard.js 실행 후 `file://` URL 오픈
- `vault`/`graph` → install-vault-preset.js 실행 후 `obsidian://` URI 오픈

### Step 3 — 사용자 안내

실행 결과에 따라 다음을 안내:

- 대시보드 모드: "브라우저에서 대시보드가 열렸습니다. 페이지 수, 최근 레슨, 지식 그래프가 표시됩니다."
- Vault 모드: "Obsidian에서 Vault가 열렸습니다. 설치되어 있지 않다면 안내 메시지가 출력됩니다."
- 그래프 모드: "Vault 오픈 후 Ctrl/Cmd+G로 그래프뷰로 이동하세요."

## Obsidian 미설치 대응

`scripts/exovibe-view.js` 는 `obsidian://` URI 호출을 시도한다.
Obsidian이 없으면 OS가 URL handler 에러를 내는데 — 실제 포착은 어렵다.
대신 스크립트가 **사전 가이드 메시지**를 출력한다:

> Obsidian이 설치되어 있지 않으면 다음을 안내:
> 1. https://obsidian.md 에서 무료 다운로드
> 2. 설치 후 "Open folder as vault" → `~/.claude/exovibe/` 선택
> 3. 이 커맨드를 다시 실행

## 규칙

1. **외부 네트워크 접근 0**: obsidian:// URI와 file:// URL만 사용
2. **기존 `.obsidian/` 덮어쓰기 금지**: 사용자가 이미 커스터마이징한 경우 스킵
3. **자동 재생성**: dashboard.html은 매번 최신 wiki/ 상태로 regenerate
4. **플랫폼 자동 감지**: Windows/macOS/Linux 모두 대응

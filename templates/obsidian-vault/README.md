# Obsidian Vault 프리셋

이 디렉터리는 ExoVibe 최초 실행 시 `~/.claude/exovibe/.obsidian/` 로 복사되는
기본 Obsidian 설정이다. 사용자가 Vault를 열면 바로 다크 테마 + 카테고리별 색상 그래프가 보인다.

## 파일

| 파일 | 역할 |
|-----|-----|
| `app.json` | 기본 에디터 동작 (wikilink 단축형, 첨부 폴더) |
| `appearance.json` | 다크 테마 |
| `graph.json` | 그래프뷰 색상 그룹 (카테고리별 컬러 매핑) |
| `core-plugins.json` | 기본 플러그인 활성화 (graph, backlinks, tag-pane) |

## 카테고리 색상 (대시보드와 동일)

- 🟢 patterns — 초록 (성공)
- 🔴 antipatterns — 빨강 (실패)
- 🔵 stack-decisions — 파랑 (선택)
- 🟠 structure-lessons — 주황 (구조)
- 🟣 hallucinated — 보라 (환각)

## 설치 동작

`/exovibe-view vault` 실행 시 `scripts/install-vault-preset.js`가
`.obsidian/` 이 비어있거나 없을 때만 이 파일들을 복사한다.
사용자가 이미 커스터마이징한 경우는 덮어쓰지 않는다.

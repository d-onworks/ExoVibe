# ExoVibe Index

Last updated: 2026-04-20

## Patterns
- [[react-server-component-boundary]] — Server/Client Component 경계 규칙
- [[zustand-persist-middleware]] — Zustand persist 미들웨어 — hydration mismatch 없이
- [[postgres-partial-index-soft-delete]] — soft-delete 테이블에는 partial index 필수

## Antipatterns
- [[react-useeffect-infinite-loop]] — useEffect deps에 새 객체 넣으면 무한 루프
- [[axios-fetch-mixed]] — 같은 코드베이스에서 axios + fetch 혼용 금지
- [[catch-and-return-default]] — catch(e){ return 기본값 } — 에러 삼키기
- [[mass-assignment-req-body]] — req.body 통째로 DB 전달 금지

## Stack Decisions
- [[zustand-over-redux]] — Zustand를 Redux 대신 선택한 이유
- [[nextjs-app-router-over-pages]] — Next.js App Router 선택

## Structure Lessons
- [[500-line-component-split]] — 500줄 초과 컴포넌트는 feature별로 분리

## Hallucinated Packages (Verified Dead)
- [[supabase-auth-helpers-v2]] — Claude가 환각한 @supabase/auth-helpers v2
- [[react-query-sync]] — react-query-sync 패키지 존재하지 않음

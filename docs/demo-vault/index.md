# ExoVibe Index

Last updated: 2026-04-20

## Patterns
- [[react-server-component-boundary]] — Server/Client Component boundary rules
- [[zustand-persist-middleware]] — Zustand persist middleware without hydration mismatch
- [[postgres-partial-index-soft-delete]] — Partial index is mandatory on soft-delete tables

## Antipatterns
- [[react-useeffect-infinite-loop]] — New object in useEffect deps causes an infinite loop
- [[axios-fetch-mixed]] — Never mix axios and fetch in the same codebase
- [[catch-and-return-default]] — catch(e){ return default } swallows errors
- [[mass-assignment-req-body]] — Never pass req.body straight into the DB

## Stack Decisions
- [[zustand-over-redux]] — Why we chose Zustand instead of Redux
- [[nextjs-app-router-over-pages]] — Choosing Next.js App Router

## Structure Lessons
- [[500-line-component-split]] — Split components over 500 lines by feature

## Hallucinated Packages (Verified Dead)
- [[supabase-auth-helpers-v2]] — Claude hallucinated @supabase/auth-helpers v2
- [[react-query-sync]] — react-query-sync package does not exist

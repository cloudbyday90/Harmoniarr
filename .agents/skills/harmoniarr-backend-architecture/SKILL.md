---
name: harmoniarr-backend-architecture
description: >
  Use this skill when implementing or reviewing Harmoniarr backend work in ESM JavaScript: Express routes, metadata/library/system services, stores, PostgreSQL migrations, operation runs, maintenance locks, audit/activity events, schema snapshots, and startup wiring. Trigger for backend feature work, route changes, database persistence, background jobs, reconciliation, or any request that must follow Harmoniarr's modular service/store boundaries.
---

# Harmoniarr Backend Architecture

## Operating Model

Build backend changes through narrow ESM modules. Keep routes thin, services policy-driven, stores persistence-only, and shared utilities pure where practical.

Start by locating the existing boundary for the domain:

- Metadata: `src/server/metadata/`
- Library and requests: `src/server/library/`
- System operations and notifications: `src/server/system-*`, `src/server/operation-*`
- Routes: `src/server/routes/`
- Shared route inventory: `src/server/route-inventory.js`
- Migrations: `src/server/migrations/`
- Schema snapshot and anchors: `database/schema/current.sql`, `src/server/schema-anchor-service.js`

## Boundary Rules

- Keep Express handlers as adapters: parse request/session/CSRF, call one service, shape the response.
- Put business decisions in `*-service.js` factories with injectable dependencies for tests.
- Put SQL in `*-store.js`; do not mix route/session concerns into stores.
- Put enum/default normalization in small policy or presentation modules when it is reused.
- Prefer structured data and explicit validation over ad hoc string parsing.
- Preserve ESM style: `import`/`export`, factory functions, named exports, no CommonJS.

## Workflow

1. Read the adjacent route, service, store, and tests before editing.
2. Identify whether the change is read-only, mutation, background-job, or schema-backed.
3. For mutations, verify fresh-session and CSRF expectations match nearby routes.
4. For database writes, use a service transaction boundary when multiple stores must commit together.
5. For background work, reuse operation-run queues, workers, leases, and cancellation paths instead of creating a parallel job system.
6. Add focused tests at the lowest meaningful boundary first, then route or integration coverage when behavior crosses modules.
7. Run validation through `$harmoniarr-testing-validation` when available.

## Database Changes

- Create migrations with the repo script rather than hand-naming files.
- Update schema snapshots only through the repo snapshot workflow.
- Add or update schema anchors for high-value tables, columns, constraints, and indexes that must survive snapshot drift.
- Keep migrations additive and explicit; avoid destructive data changes unless the user asked for them and a backup/recovery path is clear.
- Keep PostgreSQL constraints aligned with service-level normalization so invalid states fail early and consistently.

## Operation Runs

Use operation runs for durable, observable background work:

- Queue through the existing operation-run store/service patterns.
- Expose status through Activity or Background Jobs when the operator needs observability.
- Coalesce or replace duplicate pending work when repeated saves should represent only the latest state.
- Honor maintenance locks before unsafe filesystem, import, organize, scan, or reconciliation work.
- Handle cancellation and retry through existing operation capabilities.

## Gotchas

- `metadata_artist_monitoring` is a legacy compatibility path; new operator artist work should prefer operator-scoped projection, policy, selection, override, and reconciliation modules.
- Artist-detail saves already have modular save orchestration. Extend it rather than adding a second endpoint for the same concept.
- Requester-facing language and operator-facing language differ. Use `$harmoniarr-product-language` when touching UI copy, docs, or route response labels.
- Keep startup failures fatal when core database migrations or required services fail; do not hide startup preflight errors behind best-effort logging.

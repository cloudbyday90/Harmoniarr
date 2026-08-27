# Missing Music Client Terminology Migration — Outcome

## Status

Implemented and validated on 2026-08-27.

## Intended result

Introduce canonical, modular ESM entry points for the live Missing Music client workflow, migrate its active callers, and preserve legacy code/API adapters with no change to security or multi-user behavior.

## Implementation record

- Added `missing-music-release-api.js` as the canonical, CSRF-protected release API. `acquisition-api.js` now re-exports the legacy names from that implementation.
- Added canonical ESM entry points for the Missing Music workflow, progress state/presentation, progress component, and Settings safe-add feedback. They retain exact legacy export identity while later migration phases move their remaining implementation dependencies.
- Migrated Artist Detail to the canonical Missing Music workflow and progress component. Its panel now says “Missing Music for this artist,” uses a canonical `missing` route, and sends release actions to `missing-decision`.
- Migrated Settings media-storage recovery to the canonical Missing Music API and feedback entry point. Old persisted `music_queue` recovery contexts now return to the canonical Missing Music routes while retaining their bounded, allow-listed context values.
- Kept `/api/v1/acquisition/*`, existing idempotency values, CSRF behavior, route redirects, and server-derived user authorization unchanged.

## Validation record

- `npm run lint:client` passed.
- Focused client API, workflow, progress, and Settings recovery tests passed.
- `npm run build:client` passed.
- `npm run test:client` passed: 4,144 tests.
- `npm run validate` passed: policy checks, schema checks, ESM consistency, all lint suites, 37 integration tests, and both production builds.

## Open PR result

Dependabot PR [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) was reviewed locally and intentionally not applied. Node 24 remains the appropriate LTS major for this production application; Node 26 is Current as of the review date, and the PR’s branch is stale and broadly divergent.

## Follow-up recommendation

Migrate the remaining internal workflow helpers—progress state, action feedback, match selection, recovery, and mutation gate—behind the canonical Missing Music names one small dependency layer at a time. Preserve the transport and server correlation identifiers until an explicitly versioned server contract migration is planned.

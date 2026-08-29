# Artist Detail Local Deployment Timing Batch Outcome

Status: Implemented
Date: 2026-08-29

## Outcome

Harmoniarr can now compare repeated, local Artist Detail measurements without
changing production caching or collecting telemetry. The existing command
accepts `--runs 2` through `--runs 5`; `--runs 3` produces the recommended
small comparison set. One run remains backward-compatible and returns the
original single-sample artifact.

The new batch artifact states whether the browser used a consistent route
outcome, counts the fixed outcomes, and summarizes every observed allowlisted
endpoint with minimum, P50, P95, and maximum rounded milliseconds. It also
retains the individually validated samples required to verify those summaries.

## Implementation

- `scripts/artist-detail-local-timing-batch-evidence.js` provides the ESM
  batch schema, percentile calculation, strict aggregate validation, and a
  shared single-or-batch write contract.
- `scripts/measure-artist-detail-local-timing.js` accepts the bounded `runs`
  option and performs sequential independent browser-context measurements.
- `test/scripts/artist-detail-local-timing-batch-evidence.test.js` verifies
  aggregate safety, route variation, deterministic statistics, and rejection
  of altered data.
- `test/scripts/measure-artist-detail-local-timing.test.js` verifies CLI input
  resolution and repeat-run orchestration without an external deployment.

## Verification

The following verification passed on 2026-08-29:

- `npm run lint:scripts`
- `npm run lint:test`
- `node --test test/scripts/artist-detail-local-timing-evidence.test.js test/scripts/artist-detail-local-timing-batch-evidence.test.js test/scripts/measure-artist-detail-local-timing.test.js`
- `npm run validate` — ESM consistency, complete lint/test suites, schema and
  Compose policy checks, and production client/server builds.
- `npm run validate:security` — Compose policy and npm audit, with zero
  reported vulnerabilities.
- `npm run validate:artist-detail-cache-browser-evidence` — Chromium and
  PostgreSQL proof for cold, fresh, stale-SWR, and local-projection paths.
- `docker compose -f compose.walkthrough.yaml build harmoniarr`, followed by
  `up -d --wait --no-build harmoniarr` and the documented bootstrap helper —
  the rebuilt walkthrough container was healthy, and the helper safely
  recognized the existing disposable admin.
- `git diff --check`

## Recommendation retained

Use the batch only to choose a specific follow-up regression. It is not a
runtime analytics feature and it must not be used to relax the local-first,
per-user projection boundary or to make provider requests eager.

# Artist Detail Local Deployment Timing Batch Outcome

Status: Implemented
Date: 2026-08-30

## Outcome

Harmoniarr can now compare repeated, local Artist Detail measurements without
changing production caching or collecting telemetry. The existing command
accepts `--runs 2` through `--runs 5`; `--runs 3` produces the recommended
small comparison set. One run returns a version-2 single-sample artifact;
two through five runs return a version-2 batch artifact.

The new batch artifact states whether the browser used a consistent route
outcome, counts the fixed outcomes, and summarizes every observed allowlisted
endpoint with minimum, P50, P95, and maximum rounded milliseconds. It also
retains the individually validated samples required to verify those summaries.

## Local walkthrough evidence

On 2026-08-30, three authenticated, read-only visits against the rebuilt
walkthrough used `local_projection` on every run. Local metadata completed at
P50 17 ms and P95 29 ms; the per-user operator projection completed at P50
25 ms and P95 52 ms. No provider Discography fallback began.

This is a healthy local walkthrough baseline, not proof that a separate
operator's slow report is resolved. It establishes that the local-first path
and its per-user projection are fast in the rebuilt environment, so changing
SWR, cache expiry, or request concurrency here would be unsupported.

The capture also verified npm 12 invocation behavior: use
`npm run measure:artist-detail-local-timing -- -- --artist-mbid ...`. The
first separator ends npm option parsing and the second forwards the
diagnostic arguments to the ESM script.

## Implementation

- `scripts/artist-detail-local-timing-batch-evidence.js` provides the ESM
  batch schema, percentile calculation, strict aggregate validation, and a
  shared single-or-batch write contract.
- `scripts/artist-detail-local-presentation-evidence.js` and
  `scripts/artist-detail-local-presentation-observer.js` extend every sample
  with a fixed semantic presentation result after the allowlisted requests
  settle. See [Artist Detail Local Presentation Timing Outcome](ARTIST_DETAIL_LOCAL_PRESENTATION_TIMING_OUTCOME.md).
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

Do not change the Artist Detail cache path from this walkthrough result. Run
the same three-sample capture under the affected account and artist if the
original slow report recurs. Use the repeated outcome to choose one focused
regression; do not relax the local-first, per-user projection boundary or make
provider requests eager.

# Artist Detail Cache Browser Evidence Outcome

Status: Implemented
Date: 2026-08-29

## Outcome

Harmoniarr now has a focused browser verification for Artist Detail cache
diagnostics. It uses the real SPA, authentication flow, metadata routes,
PostgreSQL-backed response cache, production SWR service, and existing
`harmoniarr-cache` `Server-Timing` route decoration. Only external provider
clients are deterministic test doubles.

The proof visits one Artist Detail page through cold, fresh, and stale phases
and, for both Discography and Related artists, verifies:

- the route responds successfully;
- user-visible release and related-artist content renders;
- the response header describes the expected cache outcome;
- the same bounded metric is exposed in the matching same-origin browser
  resource timing entry; and
- background stale revalidation performs exactly one additional controlled
  provider refresh per required source.

It introduces no user-facing cache label or diagnostics page. This is
developer and regression evidence for the already shipped cache contract.

## Implementation

- `testing/browser/playwright-smoke-runtime.js` forwards an optional app
  factory to the existing isolated integration runtime.
- `testing/browser/artist-detail-cache-browser-evidence-app.js` constructs the
  controlled app against the real persistent cache and deterministic clock.
- `testing/browser/artist-detail-cache-browser-evidence.js` parses and
  allowlists the response/browser timing values into a bounded evidence shape.
- `test/browser/artist-detail-cache-server-timing-browser-verification.test.js`
  drives the normal browser flow and emits the bounded cold/fresh/stale
  evidence record.
- `test/server/artist-detail-cache-browser-evidence.test.js` covers the
  evidence boundary's valid, stale, malformed, and mismatched cases.
- `npm run validate:artist-detail-cache-browser-evidence` is the focused,
  serial command. It builds client assets, then runs the browser proof with a
  deterministic completion boundary.

## Security outcome

The evidence record includes no external or local URL, artist ID, cache key,
provider payload, cookie, user, credential, secret, or response header text.
Only fixed cache states and rounded timings are diagnostic output. The test
uses an isolated temporary database and does not alter a normal local Compose
database. No `Timing-Allow-Origin`, HTTP cache policy, or production runtime
surface changed.

## Verification

The following passed on 2026-08-29:

- `node --test test/server/artist-detail-cache-browser-evidence.test.js test/server/playwright-smoke-runtime.test.js` — five focused tests passed.
- `npm run validate:artist-detail-cache-browser-evidence` — production client build plus the serial Chromium proof passed. It observed both Artist Detail endpoints in `cold/foreground/fresh`, `fresh/none/fresh`, and `stale/background/stale` phases.
- `npm run validate` — copyright, migration, schema snapshot, ESM, Compose policy, lint, test-hygiene, server/client/script/integration suites, and production builds passed.
- `npm run validate:security` — image-tag and single-node Compose policies passed; npm audit reported zero vulnerabilities.
- The [Local Docker Walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) sequence passed: `docker compose -f compose.walkthrough.yaml build harmoniarr`, `up -d --wait --no-build harmoniarr`, and the one-shot bootstrap helper. The preserved local administrator was detected as expected, and the rebuilt stack's `/healthz` endpoint returned HTTP 200 with zero pending migrations.

## Recommendation retained

Keep this narrow browser-boundary test beside the existing route, lifecycle,
and twenty-sample rendering tests. It is the right guard for a home-hosted
application: it verifies what a real browser receives without adding a
distributed telemetry system, a cache-status dashboard, or browser caching of
authenticated API data.

## Next item

No broad cache rearchitecture is warranted from this result. When a future
home-hosted symptom is reproducible, capture its concrete endpoint and cache
phase, add the smallest matching regression beside this proof, and only then
consider a targeted cache-policy or provider-client change.

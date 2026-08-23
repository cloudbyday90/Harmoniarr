# Artist Detail Cache Paired Route Regression

Status: Implemented and validated
Date: 2026-08-23
Owner: Metadata architecture + quality engineering

## Design Finding

The existing deterministic workload proves the durable cache service through
all twenty sample artists, and the browser catalog check proves that Artist
Detail renders representative Discography and Related artists content. Those
tests deliberately stop at different boundaries:

- the workload does not make the HTTP requests used by Artist Detail; and
- the browser fixture replaces those requests in the browser so it never
  observes the server-side cache classification.

The home-hosted regression worth adding is therefore one small paired request
against the real metadata routes: make the normal Discography and Related
artists requests once, then make the exact requests again. The first pair must
be a foreground cold fill; the second must be a fresh cache read with no
additional deterministic provider calls. This checks the same route envelopes
the client consumes without adding an operator page, a diagnostic field, a
test route, a setting, or an external provider call.

No artist identifier, cache key, provider URL, credential, cookie, session
value, raw provider response, or database record is written to this document.

## Official Source Review (accessed 2026-08-23)

- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) distinguishes a
  fresh cache reuse from an origin fetch. The test asserts those states in the
  HTTP response metadata rather than estimating cache behavior from elapsed
  time.
- Node's [test runner documentation](https://nodejs.org/api/cli.html)
  documents process test isolation and the `--test-concurrency` control. The
  focused command runs serially because it owns an isolated Dockerized
  PostgreSQL fixture and must not compete with another cache scenario.
- Playwright's [testing best practices](https://playwright.dev/docs/best-practices)
  recommend user-visible assertions and replacing third-party dependencies
  with controlled responses. The existing browser fixture follows that rule;
  this route-level companion uses deterministic provider doubles and tests the
  server contract it intentionally cannot inspect.
- The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimisation. The test asserts fixed cache states and call
  counts only; it adds no logging, telemetry, or data retention.

## Options and Trade-offs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Rely on the manual local walkthrough | Uses a realistic configured provider | Regressions can return before the next manual investigation | Reject as the only guard |
| Add a browser-only second navigation | Exercises the view twice | Browser fixtures mock the metadata responses, so it cannot prove server cache reuse | Retain existing browser content coverage only |
| Add a public cache test or diagnostic route | Easy to inspect manually | Expands runtime and attack surface for no home-user benefit | Reject |
| Run live MusicBrainz in automated tests | Uses the real provider | Nondeterministic and rate-limit-sensitive | Reject |
| Pair real metadata routes with production cache services, PostgreSQL, and deterministic providers | Proves the client-facing HTTP cache contract with no provider network access or runtime change | Adds one Docker-backed integration test | Implement |

## Final Recommendation Stack

1. Keep the current durable, server-owned SWR cache and its cache metadata in
   the existing authenticated metadata responses.
2. Retain the twenty-sample workload and lifecycle integration tests for broad
   cold, fresh, stale, expiry, and recreated-service coverage.
3. Add one focused paired-route integration test for the exact Discography and
   Related artists HTTP requests the Artist Detail client makes.
4. Keep browser fixtures for user-visible rendering and keep live paired
   diagnostics as a manual troubleshooting aid, not a new product surface.
5. Change cache policy only after a failing focused test or a reproducible
   local paired observation identifies a concrete cache phase or namespace.

## Security Boundaries

- The harness and provider doubles are test-only ESM modules. They have no
  production import, route, setting, startup behavior, migration, or image
  change.
- The test uses its isolated Dockerized PostgreSQL database and existing
  migrations; it never reads or modifies walkthrough or deployed data.
- The normal authenticated route middleware remains in the exercised path.
  The test supplies only a fixed synthetic session identity.
- Deterministic providers make no network request and receive no secret.
  Assertions contain fixed cache states, response shape, and aggregate call
  counts only.

## Open Pull Request Review

GitHub lists three open Dependabot pull requests. None applies to this
home-hosted regression increment:

| PR | Finding | Decision |
| --- | --- | --- |
| #40 | Raises the controlled-provider fixture from Node 24.19.0 LTS to Node 26.7.0 Current | Do not apply; the repository runtime policy remains Node 24 LTS |
| #24 | Proposes `docker/build-push-action` 7.2 | Do not apply; `main` already pins 7.3 |
| #23 | Proposes `docker/metadata-action` 6.1 | Do not apply; `main` already pins 6.2 |

No open PR was merged or copied locally.

## Outcome

Implemented a small test-only ESM route harness and a Docker-backed
integration test. The test uses the production metadata routes, cache service,
response-cache store, policies, and migrations. It makes the two client-facing
requests for one deterministic Artist Detail sample twice:

1. the first pair returns `cold` / `foreground` cache metadata; and
2. the second pair returns `fresh` / `none` cache metadata while every
   deterministic provider call count remains unchanged at one.

The new `npm run validate:artist-detail-cache-pair` command runs that focused
proof serially. It passed with one test. `npm run validate` also passed,
including copyright, migration, schema, ESM, image, Compose-topology, lint,
test-hygiene, the server/client/script/integration suites, and production
builds.

No production module, client behavior, schema, runtime configuration, Docker
asset, browser storage policy, diagnostic surface, or live-provider call was
changed. A Compose rebuild is not required for this test-only increment.

## Next Item

No additional cache feature is recommended. Retain this paired-route command
with the existing workload and lifecycle checks. If a future local paired
sample fails, first add that measured cache namespace and phase to a focused
regression before changing a TTL, stale window, retry policy, or UI behavior.

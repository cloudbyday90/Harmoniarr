# Artist Detail Cache Concurrent Route Regression

Status: Implemented and validated
Date: 2026-08-23
Owner: Metadata architecture + quality engineering

## Design Finding

Harmoniarr's durable Artist Detail cache already coalesces a refresh in the
current Node.js process. The cache-service unit test proves that behavior;
the existing paired-route test proves a cold request becomes fresh on the next
request. Neither proves that several normal Artist Detail HTTP requests which
arrive together share the same cold refresh through the production route,
service, and PostgreSQL boundaries.

The focused gap is therefore concurrent route coverage, not a new cache
feature. This is the failure mode most likely to look like a local cache miss
when a browser retries, navigation overlaps, or more than one open page loads
the same artist at once.

## Official Source Review

The review was performed on 2026-08-23 using primary documentation discovered
through the available web service:

- [RFC 9111](https://www.ietf.org/rfc/rfc9111.pdf) permits a cache to combine
  concurrent requests into one forwarding request after a miss. Harmoniarr's
  application cache applies the same load-reduction principle inside its
  single home-hosted Node.js process.
- Node's [test-runner CLI documentation](https://nodejs.org/download/release/v24.0.2/docs/api/cli.html)
  documents `--test-concurrency` and process test isolation. The focused test
  remains serial because it owns a Dockerized PostgreSQL fixture.
- Playwright's [test best practices](https://playwright.dev/docs/best-practices)
  recommend isolated tests and controlled third-party responses. This test
  uses deterministic, gated provider doubles while retaining the real route,
  cache-service, and database boundaries.
- The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimisation. The regression records no provider payload,
  credential, URL, artist identifier, cache key, or session value.

## Options and Trade-offs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep only the cache-service unit test | Fast and precise for the coalescer itself | Does not prove HTTP wiring, real PostgreSQL reads, or the route response contract | Retain, but insufficient alone |
| Add a browser concurrency test with live providers | Closest to a browser interaction | Nondeterministic, rate-limit-sensitive, and difficult to coordinate safely | Reject |
| Add a public cache-inspection or lock endpoint | Easy to inspect outside tests | Increases home-server attack surface with no product need | Reject |
| Add a distributed refresh lease | Supports future multi-instance deployments | Adds operational state and failure modes that a single home-hosted Node.js process does not need | Defer until a measured multi-process requirement |
| Gate deterministic providers behind concurrent real route requests | Proves the exact supported deployment boundary with no runtime product change | Adds a Docker-backed integration test | Implement |

## Final Recommendation Stack

1. Keep the server-owned PostgreSQL SWR cache and the existing in-process
   refresh coalescer as the authoritative single-instance design.
2. Keep the cache-service unit test for low-level coalescing semantics.
3. Add the concurrent paired-route integration test for four simultaneous
   Discography and Related artists request pairs.
4. After every request has read the cold cache state, release deterministic
   provider calls and assert one upstream call for each provider operation,
   then assert a subsequent request is fresh.
5. Do not add browser API caching, a public diagnostics endpoint, a
   distributed lock, or a cache-policy change unless a reproducible local
   observation identifies a different deployment or cache failure.

## Implemented Design

`artist-detail-cache-sample-workload-fixtures.js` accepts an optional
test-only `beforeProviderCall` synchronization hook. It preserves the default
immediate fixture behavior for every existing workload.

`artist-detail-cache-paired-route.test.js` wraps the real response-cache store
only to count cache reads. It starts four simultaneous pairs of the normal
authenticated Artist Detail metadata routes, waits until all eight route
requests have reached the cold cache and one shared refresh has entered every
deterministic provider, then releases the provider gate. Every response must
report `cold` plus `foreground`; the four provider-operation counts must each
remain one. A final route pair must report `fresh` plus `none` without another
provider call.

The test has no production import or change to a route, API surface, cache
policy, migration, startup configuration, Docker image, service worker, or
browser storage behavior.

## Security Boundaries

- The gate and read counter exist only in ESM test fixtures and integration
  tests. Production modules cannot call them.
- The test runs against an isolated Dockerized PostgreSQL database using the
  existing forward-only migrations.
- It retains the normal authenticated route middleware with a fixed synthetic
  session. No real account or deployed data is involved.
- Provider doubles are fully deterministic and make no network request.
- Assertions use fixed outcome labels and aggregate call counts only; no
  sensitive or high-cardinality diagnostic data is added.

## Open Pull Request Review

The available GitHub CLI session is unauthenticated, so the review used remote
pull-ref discovery and local diffs. The only open Dependabot pull refs are not
applicable to this increment:

| PR | Finding | Decision |
| --- | --- | --- |
| #40 | Raises the controlled-provider fixture from Node 24.19.0 LTS to Node 26.7.0 Current | Do not apply; it conflicts with the repository's Node 24 LTS runtime policy |
| #24 | Proposes `docker/build-push-action` 7.2 | Do not apply; `main` already pins 7.3 |
| #23 | Proposes `docker/metadata-action` 6.1 | Do not apply; `main` already pins 6.2 |

No PR was merged or applied locally because none is a safe, non-duplicative
change for this work.

## Outcome

The focused `validate:artist-detail-cache-pair` command now covers both the
sequential cold-to-fresh and simultaneous-cold single-flight route contracts.
It passed both tests. Full `npm run validate` also passed, including
copyright, migration, schema, ESM, image-tag, Compose-topology, lint,
test-hygiene, server, client, script, real-PostgreSQL integration, and
production client/server build validation.

### Stability update: 2026-08-25

The concurrent route assertion initially used a fixed number of immediate-task
turns to wait for all eight HTTP reads to reach the cache. Under the full
real-PostgreSQL integration suite, host scheduling can consume that attempt
budget before every in-process HTTP request starts, even though the same
single-flight behavior passes in isolation. The test now uses a 15-second
wall-clock deadline with a small timer yield between checks. It preserves the
same proof conditions and timeout failure, while allowing network and database
I/O to make progress under load.

This is test-only synchronization: no cache runtime, route, policy, database,
or browser behavior changed. Node's test runner treats rejected asynchronous
test work as a failure, so the bounded wait continues to fail the build if the
coalescing condition genuinely does not occur.

## Next Item

No additional cache runtime feature is recommended for the home-hosted
single-process deployment. If an actual local run still shows a cache failure,
capture its namespace, cache metadata, and timing through the existing safe
admin workflow, then add that measured failure as a focused regression before
changing policy or topology.

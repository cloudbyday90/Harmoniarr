# Artist Detail Cache Controlled Workload

Status: Implemented
Date: 2026-08-22
Owner: Metadata architecture + quality engineering

## Outcome

The next cache-investigation step is a deterministic, server-side workload for
the existing 20 Artist Detail sample inputs. It proves the cache contract for
both Discography and related artists without reaching a live provider, exposing
a test endpoint, or changing an unmeasured TTL.

The workload has three deliberately separate phases:

1. A cold run records one foreground load for every unique sample and cache
   namespace.
2. A warm run in the same service process records fresh cache reads and no
   additional provider calls.
3. A recreated-service run against the same PostgreSQL data records fresh
   reads again and no provider calls, demonstrating that the result is not an
   accidental in-memory-only hit.

Each phase exercises 20 synthetic MusicBrainz-style artist IDs through the
real Discography and related-artist service boundaries. The provider clients
are deterministic fakes; the cache service, response-cache store,
observability service, cache keys, policies, migrations, and PostgreSQL table
are production implementations.

This is a contract proof, not a substitute for an operator observation of a
configured provider. It establishes what a healthy local cache must do before
an operator compares real paired samples in the protected diagnostic view.

## Source Review

This design was reviewed on 2026-08-22 against current primary guidance:

- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
  distinguishes fresh and stale reuse and requires explicit cache policy for
  serving stale data. Harmoniarr preserves the existing explicit application
  policy rather than inferring new lifetimes from a browser fixture.
- [RFC 5861: HTTP Cache-Control Extensions for Stale Content](https://www.rfc-editor.org/rfc/rfc5861.html)
  describes stale-while-revalidate: serve stale data while revalidation occurs
  asynchronously. The cold and fresh workload verifies the prerequisites for
  that path; it does not claim a stale result where no stale entry was created.
- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  describes cumulative monotonic measurements and restart-aware start times.
  The test reads bounded observability counters by phase and deliberately uses
  a new observability instance when it recreates the service.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimisation and avoiding credentials, tokens, and sensitive
  values in logs. The workload returns counts only and asserts aggregate
  metrics; it does not print cache keys, payloads, provider URLs, credentials,
  or user data.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add a public/local test route | Allows manual triggering from a browser | Adds an attack surface and risks shipping synthetic fixture behavior | Reject |
| Seed the walkthrough database with 20 artists | Easy to click through locally | Couples test data to operator state and does not isolate provider/cache behavior | Reject |
| Invoke live providers in automated tests | Covers live integration | Nondeterministic, rate-limit-sensitive, and needs credentials/network availability | Reject |
| Use an integration-only workload with real PostgreSQL cache persistence | Deterministic, proves cache boundaries and metrics, no runtime surface | Cannot establish a configured provider's latency or failure rate | Accept |
| Tune TTLs, stale windows, or distributed coordination now | Could mask a symptom | No measured failure identifies which policy is wrong | Defer |

## Final Recommendation Stack

1. Retain the current two-namespace server-side SWR policy: six-hour fresh
   Discography entries, twenty-four-hour fresh related-artist entries, and a
   seven-day stale window for each.
2. Keep a single shared, test-only 20-sample catalog and a small ESM workload
   runner so browser and server coverage cannot drift.
3. Prove cold, warm, and recreated-service cache behavior through a real
   PostgreSQL response-cache store and bounded namespace-only observability.
4. Keep the protected no-store diagnostic route for real paired operator
   samples; do not persist samples or accept pasted diagnostic input.
5. Change cache policy only when an operator's same-process paired sample
   identifies a concrete cold, stale-refresh, or cache-store failure.

## Security Boundaries

- The workload is imported only by tests and has no HTTP route, CLI endpoint,
  database seed, configuration switch, or production startup wiring.
- Test provider responses are synthetic. No API key, provider token, cookie,
  live URL, real cache key, raw payload, or user record is emitted by the
  workload result or assertions.
- PostgreSQL runs in the isolated integration-test database. The test applies
  normal migrations and makes no change to a walkthrough or deployed database.
- Assertions inspect cache namespace aggregates and provider call counts only.
  They do not make high-cardinality artist identifiers diagnostic data.

## Validation

Run the focused durable-cache proof:

```powershell
npm run validate:artist-detail-cache-workload
```

The test verifies both namespaces produce exactly 20 cold foreground loads,
then exactly 20 fresh reads in one process, and exactly 20 fresh reads after
the service is recreated against the same isolated PostgreSQL database. It
also verifies the durable store contains one entry per sample and namespace and
that neither warm phase calls a provider.

Validation completed successfully on 2026-08-22:

- `npm run lint:test`
- `npm run validate:artist-detail-cache-workload`
- `npm run validate:artist-detail-cache-samples` after moving the browser
  fixture to the shared catalog module
- `npm run validate` (4,094 server tests, 234 script tests, and 31 integration
  tests, plus lint, ESM, schema, migration, and production-build checks)
- the documented walkthrough rebuild: `docker compose -f
  compose.walkthrough.yaml build harmoniarr`, followed by `up -d --wait
  --no-build harmoniarr`; the recreated service reported healthy and the
  one-shot bootstrap helper confirmed the local administrator already exists

## Open Pull Request Review

The repository had no open pull requests on 2026-08-22. There was therefore no
applicable PR to apply locally, and no remote branch was merged.

## Next Item

Run `npm run validate:artist-detail-cache-lifecycle` to prove the stale-
while-revalidate and expiry phases against the same durable cache contract.
Then run a controlled real-provider paired sample through the existing
administrator-only cache baseline view. If its per-namespace delta shows a
specific failure, add a focused regression test for that measured condition
before altering an SWR lifetime, stale window, or refresh mechanism.

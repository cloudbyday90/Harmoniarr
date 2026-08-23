# Artist Detail Cache Lifecycle Evidence

Status: Implemented
Date: 2026-08-22
Owner: Metadata architecture + quality engineering

## Outcome

The 20-sample Artist Detail workload now has a companion, integration-only
lifecycle evidence runner. It measures aggregate behavior for Discography and
related artists through four controlled cache phases:

1. Cold: one foreground load per sample and namespace.
2. Fresh: a cache read within the configured fresh lifetime and no upstream
   work.
3. Stale-while-revalidate: a stale response is returned while one background
   refresh per sample and namespace completes.
4. Expired: entries past the stale lifetime are reloaded in the foreground.

For each phase, the runner produces only bounded aggregate evidence: the
number of samples, lookup/state/refresh-mode counts, and an exact p95 response
duration computed from the twenty in-memory observations. The integration test
adds the phase's total synthetic upstream-call delta after it has awaited all
background refreshes. It never returns artist IDs, cache keys, response
payloads, provider URLs, credentials, or database records.

The implementation changes no production cache policy, HTTP route, database
schema, startup wiring, or hot-path telemetry. It is a deterministic proof of
the existing single-process SWR contract against the real PostgreSQL response
cache store.

## Source Review

This design was reviewed on 2026-08-22 against current primary guidance:

- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
  defines the distinction between fresh and stale cached responses. The test
  advances a controlled clock instead of treating a second request as proof of
  every cache state.
- [MDN Cache-Control reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
  documents `stale-while-revalidate` as serving stale data while revalidation
  proceeds asynchronously. The stale phase therefore records response evidence
  before awaiting the bounded background work.
- [Node.js Performance APIs](https://nodejs.org/api/perf_hooks.html) provides
  the stable high-resolution `performance.now()` clock used only for
  test-process response durations.
- [OpenTelemetry Metrics API](https://opentelemetry.io/docs/specs/otel/metrics/api/)
  identifies histograms as the metric instrument for request-duration
  distributions, while the [Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  explains their bounded aggregation role. This runner computes an exact p95
  from a fixed twenty-observation test set; it does not add unbounded
  production events or a new telemetry dependency.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises excluding secrets and minimizing logged data. Evidence is limited to
  fixed operation names and numeric aggregates.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Extend the existing cold/fresh workload only | Smallest code change | Still cannot prove stale background refresh, expiry, or response-distribution evidence | Reject |
| Persist every cache request and calculate percentiles later | Supports arbitrary retrospective analysis | Adds sensitive/high-cardinality data, database writes, retention, and a production hot path | Reject |
| Add full production OpenTelemetry metrics/export now | Operationally useful at scale | Requires deployment, exporter, cardinality, and alerting decisions that no measured failure currently justifies | Defer |
| Use a test-only 20-sample lifecycle runner with a mutable clock and real PostgreSQL cache | Deterministic, proves all SWR phases, keeps exact bounded p95s and upstream deltas, adds no runtime attack surface | Does not measure a configured live provider | Accept |
| Change fresh or stale lifetimes first | May appear to reduce a symptom | Risks masking whether persistence, refresh, or provider behavior is at fault | Reject |

## Final Recommendation Stack

1. Keep the existing policy: six-hour fresh Discography entries, twenty-four-
   hour fresh related-artist entries, and seven-day stale windows.
2. Run the ESM lifecycle evidence integration test whenever cache service,
   policy, store, or Artist Detail service code changes.
3. Treat the produced cold, fresh, stale, and expired aggregates as the local
   contract: cold/expired are foreground loads; fresh has no upstream delta;
   stale returns promptly and refreshes in the background.
4. Keep production observability namespace-only and low cardinality. Introduce
   an exporter-backed histogram only after an operator identifies a sustained
   live-provider or latency question that local evidence cannot answer.
5. Use a rate-respectful, administrator-only paired real-provider sample as
   the next diagnostic layer. Add a focused regression for any measured
   failure before changing cache policy.

## Security Boundaries

- The runner is imported only by server and integration tests. It creates no
  route, CLI command, seed data, setting, or startup behavior.
- Inputs are the existing deterministic test catalog; outputs contain neither
  identifiers nor provider/cache data that could become a logging or telemetry
  disclosure.
- The mutable clock is injected only into test-created services. Production
  services retain their normal clock and cache behavior.
- Synthetic provider clients make no network requests and accept no secrets.
- The integration test uses the isolated Dockerized PostgreSQL test database
  and existing migrations.

## Open Pull Request Review

Three open pull requests were inspected without merging or applying a branch:

| PR | Finding | Decision |
| --- | --- | --- |
| #40, Node 26 image update | Changes the current Node line while the repository intentionally constrains engines to Node 24 LTS | Not applicable; do not apply locally |
| #24, `docker/build-push-action` 7.2 | Main already pins the newer verified 7.3 release | Stale; no local change |
| #23, `docker/metadata-action` 6.1 | Main already pins the newer verified 6.2 release | Stale; no local change |

This preserves the repository's declared Node 24 LTS policy and avoids
regressing already-updated pinned GitHub Actions.

## Validation

Run the focused lifecycle proof:

```powershell
npm run validate:artist-detail-cache-lifecycle
```

The test uses the same twenty samples as the existing controlled workload. It
asserts each phase's cache result counts, bounded upstream-call delta, and
finite aggregate p95 response duration for both Artist Detail operations.

Validation completed successfully on 2026-08-22:

- `npm run lint:test`
- `npm run validate:artist-detail-cache-lifecycle`: cold and expired each
  completed 80 synthetic upstream calls; fresh completed zero; stale served 20
  stale results per operation and completed 80 background calls.
- `npm run validate:artist-detail-cache-workload`: retained the pre-existing
  cold, fresh, and recreated-service durable-cache proof after its fixture
  extraction.
- `npm run validate`: repository-wide lint, ESM, migration, schema, server,
  client, script, integration, and production-build validation.
- The documented no-cache walkthrough rebuild: `docker compose -f
  compose.walkthrough.yaml build --no-cache harmoniarr`, followed by `up -d
  --wait --no-build harmoniarr` and the one-shot bootstrap helper. The
  recreated service was healthy and the helper confirmed that the local admin
  already exists.

## Next Item

Run one administrator-only, rate-respectful paired real-provider sample after
the local lifecycle proof is healthy. Use the bounded reading documented in
[Artist Detail Cache Paired-Sample Interpretation](ARTIST_DETAIL_CACHE_PAIRED_SAMPLE_INTERPRETATION_DESIGN.md)
to distinguish an ordinary cold fill, fresh reuse, SWR reuse, and investigation
signals. If its aggregate result differs from the contract, isolate the
measured namespace and phase in a focused regression before modifying TTLs,
stale windows, provider retries, or topology.

# Artist Detail Cache Browser Evidence Design

Status: Implemented
Date: 2026-08-29
Owner: Metadata architecture + quality engineering

## Decision

Add one focused, test-only browser proof for the real Artist Detail request
path. It visits one deterministic Artist Detail sample three times against the
normal application, authenticated routes, PostgreSQL-backed provider-response
cache, and production cache service:

1. cold: foreground cache fill;
2. fresh: durable cache reuse; and
3. stale: stale response served while background revalidation starts.

For Discography and Related artists in every phase, the proof reads the normal
response `Server-Timing` header and the matching same-origin
`PerformanceResourceTiming.serverTiming` browser entry. It records only the
fixed endpoint and cache-phase enums plus rounded request and refresh timing
values. It does not create a product page, diagnostic endpoint, setting,
provider request, telemetry stream, or a second cache.

## Why this is the next cache item

The existing twenty-artist browser fixture catalog proves user-visible Artist
Detail rendering, but browser interception deliberately replaces the metadata
responses. The existing persistent-cache route and lifecycle tests prove the
server cache. Neither alone proves that a real browser request receives and
can expose the cache phase reported by the existing `Server-Timing` response
contract.

This focused gap is more valuable than adding cache controls, long-lived
browser storage, a distributed cache, or a new operator UI. Harmoniarr is
home-hosted and already has a durable PostgreSQL cache; the missing evidence is
at the browser-to-application boundary.

## Standards and research review

Reviewed against current primary guidance on 2026-08-29:

- [W3C Resource Timing](https://www.w3.org/TR/resource-timing/) defines the
  browser performance entries created for `fetch()` resources and their timing
  information. The test reads the matching resource entry only after the
  response and rendered data are available.
- [W3C Server Timing](https://www.w3.org/TR/server-timing/) defines the
  `Server-Timing` response field and its browser-exposed performance metrics.
  Harmoniarr keeps the current bounded `harmoniarr-cache` metric; this work
  proves that a same-origin browser can read it.
- W3C Resource Timing limits cross-origin timing exposure through
  `Timing-Allow-Origin`. The proof is same-origin and the application does not
  add that response header, avoiding an unnecessary timing-disclosure change.
- [Playwright network guidance](https://playwright.dev/docs/network) supports
  response predicates for observing the actual browser fetches. The test waits
  for both Artist Detail provider responses rather than estimating cache state
  from navigation duration.
- [Node 24 LTS test runner documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/test.html)
  documents test isolation and concurrency controls. The focused command runs
  serially because it owns an isolated PostgreSQL scenario and an application
  process.
- The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports minimizing operational records. The emitted diagnostic contains no
  identifiers, URLs, response bodies, cache keys, cookies, credentials, or
  session values.

## Design

### Controlled app composition

`testing/browser/artist-detail-cache-browser-evidence-app.js` provides a
test-only ESM app factory. It composes the real application and injects only:

- the existing durable response-cache store;
- the production metadata provider cache service and observability service;
- controlled MusicBrainz and similarity provider clients; and
- a deterministic clock.

The test advances that clock by just over 24 hours after the cold and fresh
reads. This places both current Artist Detail cache namespaces into their SWR
windows without waiting in real time. The controlled providers are local code,
make no network call, and receive no secret.

`createBrowserSmokeRuntime()` now accepts the same optional `createAppFn`
seam already supported by the integration runtime. Normal browser tests keep
the default production app factory unchanged.

### Bounded evidence

`testing/browser/artist-detail-cache-browser-evidence.js` validates the
low-cardinality response metric and the corresponding browser metric before it
creates this evidence shape:

```json
{
  "endpoint": "discography",
  "phase": "fresh",
  "cache": { "lookup": "fresh", "refresh": "none", "state": "fresh" },
  "timing": { "clientRequestDurationMs": 7, "serverRefreshDurationMs": null }
}
```

Only `discography` and `related_artists` endpoints and `cold`, `fresh`, and
`stale` phases are accepted. Header text, URLs, artist IDs, cache keys,
payloads, and browser state are not retained in the artifact. A mismatched or
malformed metric fails the test with a generic error instead of echoing the
untrusted value.

### User-visible confirmation

Each phase waits for the Discography and Related artists headings and for the
controlled release and artist names. That confirms the normal progressive
Artist Detail flow still renders data while the browser evidence proves the
underlying request phases.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep server and browser tests separate | No new test code | Leaves a blind spot between the SPA request and browser timing surface | Reject |
| Add cache status to Artist Detail UI | Immediately visible | Adds non-actionable technical state to a home-user workflow | Reject |
| Add a public cache diagnostic route | Easy to inspect manually | Expands attack surface and leaks implementation detail into runtime | Reject |
| Run live providers in a browser test | Uses live data | Nondeterministic, rate-limit-sensitive, and requires provider configuration | Reject |
| Controlled-provider browser proof over real routes and PostgreSQL cache | Tests the actual browser/application contract deterministically without a production surface | Requires Chromium and an isolated PostgreSQL runtime | Adopt |

## Security boundaries

- All additions are test-only ESM modules; production routes, settings,
  migrations, image contents, browser storage policy, and API contracts are
  unchanged.
- Existing authenticated routes and `Cache-Control: no-store` remain in the
  exercised path. This proves the internal SWR cache, not browser HTTP-cache
  reuse.
- No `Timing-Allow-Origin` header is introduced. The proof remains entirely
  same-origin.
- Diagnostics retain only allowlisted endpoint, phase, cache enums, and rounded
  timings. They reject and do not echo malformed timing data.
- The provider cache uses the scenario's isolated PostgreSQL database. It does
  not read or modify a walkthrough, local Compose, or deployed database.

## Open pull request review

The requested open Dependabot PRs were reviewed locally and through their
public GitHub pages; neither is applicable:

| PR | Proposed change | Current `main` | Decision |
| --- | --- | --- | --- |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `docker/build-push-action` 7.1 → 7.2 | 7.3 | Superseded; do not regress the action locally |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `docker/metadata-action` 6.0 → 6.1 | 6.2 | Superseded; do not regress the action locally |

No open PR is merged or copied into this increment. GitHub CLI authentication
was unavailable in the local shell, so the public PR pages were used for the
review; the repository workflow files establish the current pins.

## Final recommendation stack

1. Keep the durable PostgreSQL cache and current application-level SWR policy.
2. Keep API responses `no-store`; do not conflate internal provider caching
   with browser or intermediary caching.
3. Retain the bounded same-origin `Server-Timing` metric and JSON cache
   metadata as diagnostics, not product UI.
4. Run the focused browser evidence command when changing Artist Detail cache
   routes, cache policy, timing serialization, or browser request flow.
5. Change TTLs, stale windows, or architecture only after a failing controlled
   proof or a reproducible local observation identifies a specific phase.

## Next item

Use the new browser proof as a regression guard. The next meaningful cache
work is not another broad rearchitecture: capture a reproducible local symptom
from a real Artist Detail request, then add a narrow regression for that
specific namespace and phase before changing cache policy.

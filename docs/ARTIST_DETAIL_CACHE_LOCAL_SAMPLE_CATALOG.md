# Artist Detail Cache Local Sample Catalog

Status: Implemented
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Outcome

Harmoniarr now has one opt-in, deterministic Artist Detail fixture catalog for
local browser testing. It contains 20 named artist inputs: ten
`widely_known` and ten `semi_known` entries. The recognition labels describe
test coverage only; they are not popularity measurements or product ranking
data.

The catalog uses representative artist names but deliberately synthetic
identifiers, artist metadata, release titles, and similar-artist scores.
Artwork payloads are intentionally absent, so Artist Detail exercises its
normal decorative fallback. It never calls MusicBrainz, Last.fm, or a
provider, and it never adds records to the local walkthrough database. This
makes the result repeatable without exposing provider credentials, cache keys,
user data, or live catalog payloads.

The existing fixture setup had four Artist Detail examples and a separate
17-item synthetic controlled-provider catalog. Neither offered the requested
balanced 20-artist Artist Detail set, so this catalog is separate from both.

## Catalog

| Coverage tier | Artists |
| --- | --- |
| Widely known | Beyoncé; Daft Punk; Radiohead; Kendrick Lamar; Taylor Swift; Miles Davis; Fleetwood Mac; Nine Inch Nails; Björk; The Cure |
| Semi-known | Kaitlyn Aurelia Smith; Moor Mother; Kiasmos; Forest Swords; Loraine James; Makaya McCraven; Yaeji; Mdou Moctar; Kelly Lee Owens; BADBADNOTGOOD |

## Design

The catalog is a small ESM module at
`testing/browser/artist-detail-cache-sample-catalog.js`. Each entry contains:

- a synthetic MusicBrainz-style artist ID and local artist ID;
- a synthetic Album release group, so Discography has an independently
  repeatable successful state;
- three deterministic related artists, so the non-critical Related artists
  path is represented too; and
- an explicit coverage tier.

`installMetadataBrowserFixtures()` leaves the catalog off by default. Pass
`includeArtistDetailCacheSamples: true` in a focused test to make the fixture
accept the query `artist detail cache samples` and serve each of the 20
Artist Detail routes. Existing browser tests therefore retain their prior
small fixture state and timing.

## Cache Boundary

This is input coverage, not a claim that browser fixtures exercise the
server-side cache. Browser interception cannot measure the durable server
SWR cache accurately. Use the catalog to deterministically verify that
Artist Detail can render discography, artwork fallback, and related artists
for a varied set of inputs. Use the administrator-only cache baseline panel
and its paired-sample workflow to measure actual local-cache behavior in one
running application process.

## Source Review

The approach was reviewed on 2026-08-22 against current primary guidance:

- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
  defines freshness and validation behavior. The protected cache diagnostic
  remains `Cache-Control: no-store`; it is an operator observation, not a
  reusable HTTP cache entry.
- [RFC 5861: Stale-While-Revalidate](https://www.rfc-editor.org/rfc/rfc5861.html)
  describes serving a stale response while revalidation proceeds. The catalog
  provides deterministic Artist Detail inputs for observing the existing SWR
  behavior without changing its expiry or stale window prematurely.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimization and avoiding credentials, tokens, and other
  sensitive values in operational records. The fixture has no credentials,
  provider URLs, real MBIDs, cache keys, or raw responses.
- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  describes monotonic cumulative measurements and their restart boundary.
  The cache baseline comparison remains process-local and should not be
  interpreted as a cross-restart or fleet-wide result.

## Options Considered

### A. Seed 20 permanent walkthrough database records

Pros:

- Makes the artists immediately visible after starting local Compose.

Cons:

- Alters the user-facing walkthrough state and needs lifecycle, reset, and
  migration behavior.
- Couples a test catalog to the persistent local database and could be
  mistaken for a real library.

Decision: defer. The walkthrough remains disposable and starts clean.

### B. Use live provider lookups for each test artist

Pros:

- Exercises external provider integration with real data.

Cons:

- Produces non-deterministic results, rate-limit pressure, network failures,
  and provider data retention/credential considerations.

Decision: reject for automated local fixture coverage.

### C. Opt-in browser fixture catalog

Pros:

- Deterministic, network-free, ESM-only, and fast.
- Exercises each Artist Detail route's Discography and Related artists states.
- Adds no runtime route, persistent record, credential, or telemetry surface.

Cons:

- Does not substitute for server-side cache measurement.
- Requires explicitly running the focused browser validation.

Decision: accepted.

## Validation

Run the focused browser proof after building client assets:

```powershell
npm run validate:artist-detail-cache-samples
```

The proof asserts the catalog has exactly 20 unique, balanced entries, that
the fixture-only search exposes all of them, and that every Artist Detail
route renders its synthetic discography and related-artist path.

The focused script uses Node's
[`--test-force-exit`](https://nodejs.org/api/cli.html) after all assertions
finish. The browser integration harness can retain an event-loop handle after
it has cleaned up its isolated app runtime; this flag gives the focused local
test a deterministic completion boundary. It is deliberately scoped to this
one browser validation rather than the general Node test suite.

## Final Recommendation Stack

1. Keep this catalog opt-in and test-only; do not seed it into a normal
   walkthrough or ship it in the application runtime.
2. Use the focused browser proof for safe input and progressive-rendering
   coverage.
3. Measure actual cache behavior with the protected, process-local paired
   baseline workflow after controlled local use.
4. Change SWR timing, persistence, telemetry, or distributed coordination
   only when paired samples identify a concrete cache failure and deployment
   topology justifies the additional operational surface.

## Next Item

Run the 20 deterministic inputs through the controlled local baseline workflow
and compare the before/after cache aggregates in the same process window. If
the measured result identifies a specific cold, stale, refresh, or store-error
failure, address that failure rather than broadly increasing cache lifetimes.

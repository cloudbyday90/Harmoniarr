# Artist Detail Progressive Hydration

Status: Implemented and validated
Date: 2026-08-22
Owner: Client metadata experience + web platform

## Purpose

Artist Detail previously kept its full-page loading state active until related
artists finished. The related-artist request is useful context, but it is not
needed to display an artist, their discography, or artwork. A slow provider
path therefore made a ready discography look uncached and unusable.

This document records the client-side follow-up to the persistent provider
SWR cache described in `ARTIST_DETAIL_SWR_CACHE_RECOMMENDATIONS.md`.

## Official Source Review

The review was performed on 2026-08-22 with primary Vue documentation
discovered through the web service:

- [Vue composables](https://vuejs.org/guide/reusability/composables) describes
  composables as the home for reusable stateful logic, including asynchronous
  state and error handling. This supports a focused related-artists composable
  instead of a larger Artist Detail singleton.
- [Vue watchers](https://vuejs.org/guide/essentials/watchers.html) documents
  watcher cleanup and `AbortController` for cancelling stale asynchronous
  effects. The route watcher now cancels its active Artist Detail request when
  the MBID changes or the view unmounts.
- [Vue built-in components](https://vuejs.org/api/built-in-components)
  documents that `Suspense` waits for all nested asynchronous dependencies
  before rendering its default content. It would preserve the all-or-nothing
  wait this change needs to remove.

## Observed Boundary

The critical path is:

1. Resolve local artist metadata when it exists.
2. Read the operator projection for policy and local release-group data.
3. Browse the server-side SWR-backed MusicBrainz catalog when local release
   groups are absent or the artist is not local.
4. Let the existing artwork composable hydrate from the released groups.

Related artists are an optional fifth step. They must start only after the
critical path settles, so their provider fanout cannot control the page-level
loader or pre-empt the shared provider client that serves Discography.

An empty `operator.releaseGroups` list is not treated as proof that the
artist's real discography is empty. It can simply mean the local catalog has
not been populated, so the catalog browse remains required.

## Alternatives Considered

### A. Retain `Promise.allSettled` for every Artist Detail request

Pros:

- One loading state and a simple control flow.

Cons:

- A slow related-artist response blocks an otherwise-ready discography.
- It masks the benefit of server-side stale-while-revalidate responses.

Decision: rejected.

### B. Wrap the page in Vue `Suspense`

Pros:

- Standard Vue mechanism for coordinating asynchronous dependencies.

Cons:

- It deliberately waits for nested asynchronous dependencies, retaining the
  same user-visible gate.
- It does not express the product distinction between required metadata and
  optional recommendations.

Decision: rejected.

### C. Split the optional enrichment into a dedicated composable

Pros:

- The page loader completes once artist and discography data are ready.
- Related-artists loading and error states remain visible in their own card.
- The smaller ESM service is independently testable and prevents Artist
  Detail's central composable from becoming a large singleton.
- A request token plus the parent request gate prevent late route responses
  from replacing current page state.

Cons:

- Adds a small amount of explicit loading-state composition.
- Requires UI and browser coverage in addition to composable unit tests.

Decision: accepted.

### D. Persist Artist Detail responses in browser or service-worker cache

Pros:

- Can make repeat visits locally fast.

Cons:

- Risks persisting authenticated API response bodies on shared devices.
- Duplicates provider freshness, retry, and rate-limit policy in the browser.
- Conflicts with the existing network-only `/api/*` service-worker policy.

Decision: rejected. The persistent server cache remains the only provider
metadata cache.

## Implemented Design

### Modular ESM responsibilities

- `useArtistDetail.js` owns only the critical Artist Detail state: local
  resolve, operator projection, catalog fallback, and request lifecycle.
- `useArtistDetailRelatedArtists.js` owns the optional related-artist request,
  result, error, dedicated loading state, and local response token.
- Related-artists hydration begins after the critical path clears its loading
  state. This preserves progressive rendering while giving the server-side
  MusicBrainz client queue to the SWR-backed Discography browse first.
- `latest-request-gate.js` continues to provide `AbortController`-backed
  cancellation for the route's active request.
- `ArtistDetailView.vue` renders the full-page loader for critical data only,
  and renders an accessible `Preparing related artists…` status inside the
  related-artists card while that enrichment is pending.

The route watcher calls `cancelArtistDetailLoad` through Vue watcher cleanup.
The gate aborts client requests initiated for the old MBID, while the request
identity checks make late non-abortable responses harmless.

At the start of each new critical request, artist, operator, policy, and
release-group refs are cleared. This prevents a previous artist's monitoring
or policy information from appearing during or after a route transition.

The subsequent observability slice also corrects the provider-discography
adapter: the API returns a `browse` envelope, so Artist Detail must read
`browse.results` rather than a top-level `results`. The modular cache state and
safe diagnostics contract are recorded in
`ARTIST_DETAIL_CACHE_OBSERVABILITY_DESIGN.md`.

## Security Constraints

- This change does not add browser persistence, service-worker API caching,
  credentials, or authentication decisions.
- It keeps provider caching on the authenticated server boundary, where cache
  keys and payloads are application-controlled public metadata.
- Abort handling is a correctness and resource-protection measure, not an
  authorization boundary. Existing server-side authorization remains required
  for every API request.
- Related-artist failures are rendered as scoped UI errors and do not expose
  provider tokens or raw response details.

## Open PR Applied Locally

Open Dependabot PR #36 was fetched and applied locally with
`git cherry-pick --no-commit`. It was not merged. Its production dependency
updates are validated together with this implementation before a single local
commit is created:

- `music-metadata` 11.12.3 to 11.15.0
- `pg` 8.20.0 to 8.23.0
- `vue` 3.5.34 to 3.5.41
- `vue-router` 5.0.7 to 5.2.0

## Validation Design

- Composable tests prove that critical loading completes before a deferred
  related-artist request, that an empty projection triggers provider catalog
  fallback, that local resolver failure does not block public catalog data,
  and that stale related results are ignored.
- The metadata browser fixture accepts an explicit related-artists delay for
  deterministic browser tests.
- The browser scenario proves that Discography is rendered while the related
  card shows its in-progress status.
- Final validation runs the repository's client, full, and browser-relevant
  checks against the locally applied dependency update.

## Outcome

Implemented and validated on 2026-08-22.

- The focused composable tests passed, including deferred related-artist
  hydration, empty-projection provider fallback, stale-response protection,
  and local-resolver failure recovery.
- The focused browser scenario passed: Discography rendered while the related
  card displayed `Preparing related artists…`.
- The complete `npm run validate` contract passed with the locally applied
  Dependabot PR #36 dependency updates and the Node 24 LTS policy.
- `npm run validate:security` reported zero npm audit vulnerabilities.

## Priority-Hydration Follow-up

The subsequent live fresh-admin cache pair exposed a provider-priority
inversion: the optional related-artists fanout started before an unimported
artist's cold Discography browse. Both paths share the server-side MusicBrainz
client, so the response-budgeted related request could consume the queue and
record a scoped refresh failure while the critical view remained on its full
page loader.

The follow-up keeps the same modular boundaries but starts related-artists
hydration only after the local/projection/Discography path has settled. The
focused regression proves a cold provider-backed Discography request begins
before the optional related call. See
[Artist Detail Provider-Priority Hydration](ARTIST_DETAIL_PROVIDER_PRIORITY_HYDRATION_DESIGN.md)
for the current evidence, source review, and outcome.

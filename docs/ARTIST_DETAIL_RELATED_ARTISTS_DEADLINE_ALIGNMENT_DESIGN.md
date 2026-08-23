# Artist Detail Related-Artists Deadline Alignment

## Design Finding

Artist Detail now starts its Related Artists work only after the critical
discography projection, so Related Artists no longer delays the cacheable
discography path. The remaining cache failure has a narrower cause: the
interactive Related Artists operation had a six-second deadline while the
shared MusicBrainz client permits a ten-second request attempt and serializes
work at a 1.1-second minimum interval. A valid slow request could therefore
be cancelled by the parent operation before it was allowed to finish, and the
existing safety rule correctly declined to persist that incomplete result.

This is not an SWR freshness failure. The durable cache already serves a fresh
entry immediately and a stale entry while it refreshes. The cold path was
making a response-budget promise that could not accommodate one configured
MusicBrainz attempt, so it could not reliably produce a cacheable result.

No artist identifier, provider payload, cache key, credential, session value,
or raw provider error is included in this document.

## Research (accessed 2026-08-22)

- Node documents `AbortSignal.timeout()` and `AbortSignal.any()` as the
  mechanisms for creating and composing cancellation deadlines. It also
  recommends one-shot abort listeners so cancellation does not retain
  resources. [Node.js globals: AbortSignal](https://nodejs.org/api/globals.html)
- MusicBrainz asks clients to make at most one request per second per source
  IP, identify themselves with a meaningful User-Agent, and can return 503
  when its limits are exceeded. [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API),
  [rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- RFC 9111 treats reuse of stale data as an explicit policy decision, not as a
  reason to cache an incomplete origin response. Harmoniarr's application
  cache makes that decision explicitly with fresh and stale windows.
  [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html)
- OWASP advises logging useful operational failures while excluding or
  sanitizing sensitive values such as session identifiers, access tokens,
  passwords, and connection strings. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- Node's official releases page identifies 24.19.0 as the latest LTS and
  26.7.0 as Current as of this review. Production remains on Node 24 LTS.
  [Node.js releases](https://nodejs.org/en/about/previous-releases)

## Options and Trade-offs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Cache every deadline-exhausted payload | Suppresses repeated cold work | Can preserve empty or incomplete recommendations for the normal 24-hour freshness window | Reject |
| Cache normalized candidates from a completed direct provider after deadline exhaustion | Preserves a bounded, usable response and lets later requests use SWR | The cached list can have less optional fallback enrichment until its normal revalidation | Implement |
| Remove the deadline | More fills eventually complete | Reintroduces unbounded interactive provider work and ignores provider capacity | Reject |
| Reduce global MusicBrainz request timeout/retries | Shorter failed calls | Harms imports, search, and catalog refreshes outside Artist Detail | Reject |
| Raise a disconnected constant | Smallest edit | Drift returns whenever the shared MusicBrainz timeout or queue policy changes | Reject |
| Derive the Related Artists minimum deadline from the shared MusicBrainz request policy | Allows at least one compliant request and queue interval, keeps a bounded interactive operation, preserves incomplete-result safety | A legitimately slow cold Related Artists response can wait up to 15 seconds (or a deliberately larger provider timeout) | Implement |
| Add a durable background job for cold arbitrary artists | Can warm recommendations after the interactive response | Requires a new queued-operation and observability surface; not justified until this bounded fill is measured insufficient | Defer |

## Recommended Stack

1. Keep the server-side durable SWR cache: fresh data is immediate; stale data
   is served while one coalesced refresh runs.
2. Keep empty, all-timeout deadline-exhausted responses non-persistent. A
   normalized candidate from a completed direct provider is safe to retain even
   when optional enrichment times out; it never stores raw provider payloads.
3. Extract the MusicBrainz request defaults and normalization into a small ESM
   request-policy module shared by the client and Related Artists budget.
4. Give Related Artists a minimum 15-second operation budget, dynamically
   raised when the configured MusicBrainz request timeout plus one queue
   interval and a one-second settlement margin needs more time.
5. Reject an explicit Related Artists budget below that minimum. This keeps a
   server-only policy from silently recreating the cacheability contradiction.
6. Retain the shared per-process MusicBrainz queue, outbound HTTPS/allowlist
   policy, redirect rejection, cancellation propagation, and aggregate-only
   cache telemetry.

## Security Properties

- All values remain server-owned configuration or injected service policy;
  browser requests cannot extend a provider deadline.
- The existing outbound URL allowlist and HTTPS policy remain the only route
  by which the client constructs provider URLs.
- Cancellation continues to stop queued and in-flight work at the operation
  deadline; the change does not add retries or provider fan-out.
- A deadline-exhausted write requires a valid normalized candidate from a
  direct source. Empty or malformed direct source outcomes still cannot create
  a durable entry.
- No new diagnostic field contains a provider URL, request input, payload,
  credential, cookie, or raw error.

## Open Pull Request Review

The repository has three open Dependabot PRs at the time of review. PR #40
changes a controlled-provider test-fixture image from Node 24.19.0 to Node
26.7.0. Node 26.7.0 is Current rather than LTS, while this repository's
runtime contract, `.nvmrc`, and production image intentionally require Node
24 LTS. It is not applicable and was not merged or copied locally. PRs #23
and #24 propose older GitHub Action versions already surpassed on `main`.

## Outcome

Implemented the recommended stack with two focused ESM modules:

- `musicbrainz-request-policy.js` is the shared source of truth for request
  timeout, retry, and queue-interval normalization. Related Artists derives
  its minimum bounded operation deadline from that policy.
- `similar-artists-cacheability-policy.js` makes the persistence decision
  explicit. An expired operation can persist only when a direct provider had
  already produced valid normalized candidates; empty or all-timeout results
  remain non-persistent.

Validation passed:

- the 92-test focused server suite for the client, request policy, response
  budget, cacheability policy, and Related Artists service;
- `npm run validate`, including the repository validation suite, the
  controlled 20-artist cache workload, and the production build; and
- a no-cache local Compose rebuild, healthy-service wait, and walkthrough
  bootstrap check.

The final authenticated local walkthrough produced one cold Related Artists
fill in 7.5 seconds with one completed refresh, zero refresh failures, and
zero cache-store errors. A second visit recorded one fresh and one cold lookup
for that namespace (50% served from cache), with no additional refresh or
failure. These are aggregate diagnostics only; no artist or provider payload
was retained in this record.

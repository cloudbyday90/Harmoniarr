# Artist Detail Cache Server-Timing Design

## Decision

Artist Detail already returns its application-level stale-while-revalidate (SWR) result in the Discography and Related Artists JSON envelopes. Add a fixed, same-origin `Server-Timing` metric to those two authenticated reads so an operator or developer can see the outcome in browser network and performance tooling without inspecting response bodies or server logs.

The metric is `harmoniarr-cache`. Its `desc` value is a three-part fixed outcome:

`lookup/refresh/state`

Examples:

- `cold/foreground/fresh`
- `fresh/none/fresh`
- `stale/background/stale`

A foreground refresh includes `dur` when a finite refresh duration is available. A stale response deliberately omits duration: the background refresh has not completed yet.

## Scope and boundaries

This is observability, not a second cache and not a user-facing status label. It applies only after an authenticated session succeeds on:

- `GET /api/v1/metadata/musicbrainz/artists/:artistId/release-groups` (Discography)
- `GET /api/v1/metadata/artists/:artistId/similar` (Related Artists)

The durable PostgreSQL-backed metadata response cache remains the source of truth. The service worker continues to use network-only handling for API reads, and no HTTP `Cache-Control` policy changes are introduced. That preserves the existing user/session-safe API contract while making the application cache measurable.

## Standards and security rationale

The W3C Server Timing specification defines `Server-Timing` as the standard way for a server to communicate bounded request-response metrics to a user agent, including cache work. It also cautions that the server controls which metrics are exposed and that metrics can reveal infrastructure information. This implementation therefore emits only three validated enum values and, when applicable, one rounded duration.

It never emits a cache key, MusicBrainz identifier, provider URL, response payload, error, token, user data, or stack trace. It neither adds `Timing-Allow-Origin` nor permits cross-origin timing exposure; same-origin behavior is sufficient for Harmoniarr's hosted SPA. The route still requires authentication before the header is written.

HTTP caching semantics are intentionally separate. RFC 9111 describes freshness and stale reuse for HTTP caches; Harmoniarr's cache state describes the internal persistent provider-response SWR policy and must not be represented as permission for a browser or intermediary to reuse authenticated API responses.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep JSON metadata only | No new response header | Requires body inspection and is awkward in browser performance tooling. |
| Add an unbounded diagnostic header | Easy to correlate individual entries | Could expose identifiers, cache keys, provider details, or errors. Rejected. |
| Add a fixed `Server-Timing` metric | Uses a web standard, works in browser tooling, keeps the JSON contract unchanged, and can be tested at the route boundary | Intended for diagnostics rather than end-user messaging; browser display details vary. |
| Add HTTP `Cache-Control` SWR directives | May enable browser/proxy reuse | Risks incorrect reuse of authenticated, user-scoped API data and does not measure the existing application cache. Rejected. |

## Final recommendation stack

1. Keep the durable application-level cache policy and existing JSON cache metadata as the functional contract.
2. Emit the bounded same-origin `harmoniarr-cache` Server-Timing metric for Discography and Related Artists route responses.
3. Retain the admin-only aggregate cache observability endpoint for process-wide trends.
4. Investigate any reported Artist Detail delay with the request's JSON cache metadata, Server-Timing value, and aggregate trend together; do not infer cache behavior from the loading skeleton alone.

## Sources

- [W3C Server Timing](https://www.w3.org/TR/server-timing/)
- [RFC 9111: HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111)
- [W3C Resource Timing](https://www.w3.org/TR/resource-timing/)

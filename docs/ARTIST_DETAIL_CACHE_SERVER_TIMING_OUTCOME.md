# Artist Detail Cache Server-Timing Outcome

## Implemented outcome

The authenticated Discography and Related Artists provider routes now append a bounded `Server-Timing` metric when their existing cache metadata is valid. The response body remains backwards compatible and retains its current `cache` fields.

The implementation is split into a small ESM metadata module that validates and serializes the metric, plus thin route decoration. Unknown, malformed, or high-cardinality values produce no header. Existing timing metrics are appended rather than overwritten.

## Verification evidence

Focused unit and route tests verify:

- foreground cache fills include a rounded duration;
- fresh and stale outcomes produce stable, low-cardinality values;
- malformed data cannot inject header content;
- both Artist Detail routes expose the expected header only after the normal authenticated route path; and
- no `Timing-Allow-Origin` header is added.

The following commands passed on 2026-08-29:

- `node --test test/server/artist-detail-cache-server-timing.test.js test/server/metadata-routes.test.js` — 33 tests passed.
- `npm run validate:artist-detail-cache-pair` — 2 persistent-cache route tests passed, covering cold-to-fresh reuse and concurrent cold-read coalescing.
- `npm test` — lint, test hygiene, server, client, script, and serial integration suites passed. The integration evidence covered the 20-artist cold, fresh, stale, and expired cache phases; fresh reads made zero upstream calls and stale reads used background revalidation.
- `npm run build` — production client and server build passed.
- `npm run check:esm` — ESM consistency check passed.
- `npm run validate:security` — Compose image and topology policies passed; npm audit reported zero vulnerabilities.

## Operator use

Use the browser Network panel or same-origin performance tooling to inspect `Server-Timing` for an Artist Detail provider request. Treat it as a diagnostic aid alongside the JSON cache metadata and the admin cache-observability summary. It does not change what the user sees, enable browser response caching, or reveal per-artist cache records.

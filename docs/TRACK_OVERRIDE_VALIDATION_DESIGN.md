# Track override validation design

Reviewed September 12, 2026. Harmoniarr is a Soulseek-native music library manager; artist track overrides express desired library state, not an immediate download command.

## Decision and contract

Use a small pure ESM validation module at the existing track-override service boundary. Positions must be JSON numbers representing integers from 1 through 2147483647. Duration snapshots allow 0 through 2147483647. Null and omitted optional fields remain valid. Numeric strings, fractions, suffixes, unsafe integers, and database integer overflows receive validation errors rather than being coerced.

Track MBID, recording MBID, and metadata release ID must use the standard hyphenated UUID syntax when supplied. Trim surrounding whitespace and normalize case; reject blank strings and other non-null malformed values. Do not constrain UUID versions. Track identity remains primary; recording plus medium and track positions remains the fallback. Positions must be supplied together. Syntax validation does not prove MusicBrainz entity existence or type; existing release membership checks remain in force.

Canonical artist saves validate before opening the transaction, retain expected-revision checks, and persist policy, overrides, snapshot, and queued reconciliation atomically. Direct override updates also validate before database reads. Client fallback positions use the same strict numeric bounds to avoid silently selecting a different identity. Existing authentication, CSRF, and Save/Cancel behavior remain the mutation boundary.

## Alternatives and tradeoffs

| Approach | Pros | Cons |
| --- | --- | --- |
| Strict ESM validation (chosen) | Deterministic 400 errors; prevents identity truncation; matches database range; no dependency | Older callers sending numeric strings must correct their payloads |
| Coerce strings and truncate fractions | Accepts permissive legacy payloads | Can select the wrong track and defer overflow to database errors |
| Rely on PostgreSQL casts | Central storage enforcement | Late errors; wider accepted UUID spellings; poor API feedback |
| Add a schema library | Useful for a broader API contract initiative | Unnecessary dependency and migration scope for this bounded change |

Recommended stack: existing Vue draft utilities → pure ESM validation → existing artist save service and transactional stores → PostgreSQL constraints. No database migration or new runtime dependency.

This is an API integrity change, with no new interactive control or markup. Preserve existing semantic controls and error feedback rather than introducing custom interaction behavior. Release-group identifier validation is a separate existing boundary and is not generalized by this change.

## Official research

URLs were discovered and opened through tools, rather than inferred. Sources checked as of September 12, 2026:

- [TC39 parseInt specification](https://tc39.es/ecma262/2025/multipage/global-object.html): string coercion and prefix parsing explain the old defect.
- [TC39 Number.isSafeInteger](https://tc39.es/ecma262/multipage/numbers-and-dates.html): strict numeric integer checks; the living document labels itself a later draft, not a September 2026 publication.
- [PostgreSQL 18 numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html): INTEGER maximum is 2147483647.
- [RFC 9562 UUID standard](https://www.rfc-editor.org/info/rfc9562/): standard UUID representation and case handling.
- [MusicBrainz identifiers](https://musicbrainz.org/doc/MusicBrainz_Identifier), [tracks](https://musicbrainz.org/doc/Track), and [recordings](https://musicbrainz.org/doc/Recording): distinguish release-specific track identity from reusable recordings.

- [W3C WCAG 2.2 error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): detected input errors should identify the affected input and describe the problem in text. Field-specific server validation messages support this; this change does not claim a full accessibility conformance audit.

## Open PR review

GitHub MCP refreshed all open patches. PR #40 at `649659f1e199d48d55cc8d5cccf9f079dc235d86` only upgrades a Node fixture to a different major and is outside this scope. PR #24 at `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 at `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action versions. No applicable patch was applied or merged.

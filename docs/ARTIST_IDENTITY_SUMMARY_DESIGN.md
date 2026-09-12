# Lightweight artist identity read design

Reviewed September 12, 2026. This continues artist review item 14 by removing duplicate catalog work from Artist Detail's initial local lookup.

## Decision

Add opt-in `view=summary` to the existing authenticated MusicBrainz artist local-lookup GET. The default and explicit `view=full` retain the legacy response. Summary returns only artist identity and legacy monitoring state; it omits aliases, detection events, release groups, and editions rather than fabricating empty collections.

A small ESM view policy accepts only exact full/summary values. Reject unsupported, repeated, or structured values with a validation error before database reads. The existing read service branches before full-payload assembly and reuses the artist mapper and monitoring store. No new SQL interpolation, endpoint, migration, dependency, or cache is introduced.

Only useArtistDetail opts into summary. The metadata artist workflow keeps the full API default. Artist Detail still fetches the authoritative operator projection once, preserving complete coverage, orphan detection, saved selections, and reconciliation data. When that projection has no groups, existing remote pagination remains available.

## Alternatives and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Opt-in summary representation (chosen) | Compatible defaults; removes duplicate catalog/detection reads and payload | Adds one explicit representation choice |
| Change existing default to summary | Simpler URL | Breaks metadata workflow consumers expecting full data |
| Limit authoritative projection arrays | Smaller payload | Incorrect orphan and coverage calculations; rejected |
| New standalone endpoint | Clear separate resource | Extra route/wiring without a distinct authorization requirement |

Final stack: explicit client view option → existing session GET route → strict ESM view policy → existing metadata read service and monitoring store. Keep full projection semantics intact.

## Research and evidence plan

Official URLs are discovered through tools. [HTTP Semantics (RFC 9110)](https://www.rfc-editor.org/rfc/rfc9110.html) and [HTTP Caching (RFC 9111)](https://www.rfc-editor.org/rfc/rfc9111.html) were opened: GET remains read-only; query-specific target URIs distinguish representations. `Vary` addresses headers, not query parameters. The literal view parameter is an application design choice, not an HTTP requirement.

Use real PostgreSQL fixtures with many groups and editions to compare full versus summary SQL invocation counts and serialized payload size. Timing is diagnostic only, not a flaky pass threshold or production latency promise. Keep the full response's catalog counts intact and verify summary performs no catalog queries.

## Scope

This reduces duplicated initial reads. It does not page the authoritative local projection, change its ordering, or solve remote edition pagination. Those remain separate parts of item 14.

## Additional measurement sources and PR review

[PostgreSQL 18 EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html) and [plan interpretation](https://www.postgresql.org/docs/18/using-explain.html) were opened. Query execution measures do not include HTTP transmission, so report payload bytes independently. Existing lookup indexes are sufficient for this call-removal change; no new index is justified by speculation.

GitHub MCP refreshed full patches for every open PR. #40 head `649659f1e199d48d55cc8d5cccf9f079dc235d86` is an unrelated Node-major fixture change. #24 head `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 head `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action pins. No applicable patch was applied or merged.

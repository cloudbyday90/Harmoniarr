# Track override validation outcome

## Implemented behavior

Artist review item 7 now uses a dedicated ESM validator for optional track, recording, and release UUIDs and PostgreSQL-bounded integer fields. Malformed supplied identities cannot silently become a fallback identity; numeric values cannot be truncated into another track position. Null optional values, zero duration, valid primary track identities, and recording-plus-position fallback identities are preserved.

The client draft position helper also rejects numeric coercion. Existing unit fixtures now use valid UUIDs where the production boundary requires them. Authentication, CSRF, optimistic revisions, transaction boundaries, and database membership checks retain their existing roles.

## Validation evidence

Focused service and client tests pass. New unit coverage checks numeric and UUID boundaries, deduplication after normalization, and failure before database access. A real PostgreSQL route integration checks successful primary/fallback persistence and malformed payload rejection without state changes. The focused PostgreSQL test passed all 19 malformed payload cases plus valid primary/fallback persistence. Dependency security validation reports zero vulnerabilities. The local Docker walkthrough was rebuilt and bootstrapped with existing data preserved; its container is healthy and `/healthz` returns HTTP 200. Image: `sha256:3534f658c59e94ccaa833eecec3b7fdcb969bc91e82ac49197f7238d2c2dd15a`. `npm run validate` passed: 8,325 tests (3,446 server, 4,238 client, 500 scripts, 141 PostgreSQL integration), lint and repository policy checks, and client/server production builds. The existing PostgreSQL overlapping-query deprecation warning remains a separate compatibility follow-up; no test failed.

## Scope and next work

No migration or dependency was needed. UUID syntax is not evidence that an identifier belongs to a particular MusicBrainz entity. The existing separate release-group identifier boundary was not generalized. Other direct mutation APIs were not comprehensively audited by this slice.

No open PR was applicable: two action updates were already superseded, and the remaining Node-major fixture change was unrelated. See the [design and research](TRACK_OVERRIDE_VALIDATION_DESIGN.md) for reviewed heads, official sources, options, and final stack.

Next recommendation: artist review item 8, truthful track ownership labels for assistive technology. Owned and missing tracks must expose their actual state rather than sharing the same accessible label. Keep this focused on state semantics and cover both states in component/browser validation.

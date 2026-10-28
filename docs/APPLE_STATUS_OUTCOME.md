# Apple local signing-status outcome

October 28, 2026. Follows the [credential-save outcome](APPLE_CREDENTIALS_OUTCOME.md).
See separate [design](APPLE_STATUS_DESIGN.md),
[official research and alternatives](APPLE_STATUS_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_APPLE_STATUS_OUTCOME.md).

## Delivered

Apple status preserves configured, the three presence booleans and storefront.
It adds localSigning with a state and three fixed check enums for teamId, keyId
and privateKey. Invalid has priority over missing; otherwise missing yields
incomplete and three valid checks yield valid. Whitespace-only normalized values
are missing. Unsupported key material or invalid ID shape is invalid, without
returning values, parser details, key objects, JWTs or fingerprints.

A small ESM status policy reuses the save normalizers and shared 16 KiB/native
P-256 admission. The existing factory forwards one supplied queryable to both
readers and captures primitive settings before the asynchronous secret lookup.
It recomputes per read without retaining parsed material or validation state.
Stored-over-environment precedence and clear/fallback behavior remain unchanged.
The two reads are not an atomic transaction or proof of key-ID correspondence.

Known database connection failures retain bounded 503 database_unavailable.
Other settings/secret read failures become bounded 500
apple_music_status_unavailable. Neither new error carries raw text or cause, and
neither becomes an invalid/missing credential result. This improves privacy while
giving less parser/storage detail to HTTP consumers; operational investigation
remains separate from the local value projection.

The existing authenticated GET /api/v1/providers/status and administrator system
overview expose the summary. Current requester read scope and disabled-session
refusal remain. Existing API no-store headers remain. No route, mutation, UI,
dependency, SQL/schema, refresh job or deployed service was added. No signing or
provider HTTP call occurs during local status validation. Other provider status
payloads and explicit connection checks retain their owners.

## Evidence and limits

Focused qualification passed 92 tests across status policy/service, credential
admission, signer/client, resolver, provider routes and system overview consumers.
Tests cover supported formats, invalid IDs/native keys, missing/invalid priority,
queryable forwarding, mutation capture, fresh reads and bounded error mapping.
The frozen fourteen-stage gate passed 6,402 server, 4,504 client and 703 script/
policy tests: 11,609 total, no failures/skips/cancellations. Lint, ESM, copyright,
migration/snapshot/anchor, image/compose checks, test hygiene and build passed.
Production dependency audit found zero vulnerabilities.
The native preflight passed all 18 scenario groups through actual application
HTTP, PostgreSQL and encrypted reads. Its final immutable-image evidence and full
gate are recorded in the [Docker outcome](LOCAL_DOCKER_APPLE_STATUS_OUTCOME.md).

Benefits are compatible presence semantics, useful local diagnostics and common
admission policy without network or persistent cache invalidation. Costs are
bounded native parsing per authenticated read and an extra result dimension for
consumers. Valid means local representation/key suitability, not actual signature
generation, clock validity, Apple ownership/capabilities, revocation state, key-ID
match or live provider acceptance. Neither these enums nor no-store alone provide
a general privacy/conformance guarantee.

An initial focused lint run caught a shadowed native fixture parameter. It was
renamed before native execution; no product behavior was weakened. The focused
lint record is retained separately. The first native preflight passed. Prior
unexplained linked-login evidence remains separate, without a repair claim.
No UI changed; manual AT/device checks remain deferred.

GitHub MCP initially found zero open PRs, so random PR application and stale
Dependabot cleanup/rebase were inapplicable. The final check at 2026-10-28
10:47:36 UTC again returned zero open PRs. Work stays on main without a release/tag, PR merge or
separate application branch.

## Next recommended item

This display is now implemented in the [UI design](APPLE_STATUS_UI_DESIGN.md)
and [outcome](APPLE_STATUS_UI_OUTCOME.md), with saved checks and credential drafts
kept separate and no change to server signing or persistence.

Show saved local signing validity in the existing Settings Apple connection
summary, which currently displays secret presence/source only. Reuse the existing
provider-status API, refresh after relevant successful saves, and distinguish
saved status from unsaved credential drafts. Provide accessible pending/error
feedback without exposing key material, and label local validity separately from
explicit provider connection acceptance. No new app or endpoint is needed.

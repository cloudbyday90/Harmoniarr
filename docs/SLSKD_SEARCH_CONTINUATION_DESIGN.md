# Durable search continuation design

October 20, 2026. Preserve the accepted provider search identity across discovery
retries and process restarts. A database reservation commits before the search
POST. Only the transaction that creates that reservation may submit it. Its UUID
is passed to slskd; later callers read the same UUID, including after an uncertain
POST outcome. A missing provider record is not permission to submit again.

Use a narrow ESM service, persistence store and pure binding policy. An additive
slskd_search_intents table belongs to either a shared discovery request or an
approved external release intent, with cascading foreign keys and separate
unique owner/intent indexes. Persist only UUIDs, keyed configuration/intent
fingerprints, timestamps and acceptance observation. Do not store credentials,
provider responses, queries or user paths in this table.

The intent fingerprint includes the normalized query and captured decision
context: release/track scope, quality/ownership and the existing explicit
rediscovery generation. External discovery also uses its durable operation-run
identity. Different owners cannot share a search accidentally. An explicit new
saved intent may reserve a new UUID. An unchanged expired intent refuses further
provider work; expiry never silently authorizes another POST. Default retention
for continuation admission is 30 minutes, independent of provider retention.

Bind every POST/read to normalized endpoint, provider mode and a keyed credential
fingerprint. Check current configuration before and after awaited HTTP calls.
Never accept a returned search UUID/query that differs from the reserved intent.
Run existing target/cancellation/maintenance guards around waits and retain the
locked candidate-persistence guard. Shared discovery also compares its current
claim marker before publication, so a replaced claim cannot publish stale work.
Keep network waits outside database transactions.

Bounded unavailable shared searches use a short existing cooldown before a later
worker continues reading the same intent. Successful empty results still advance
the existing query fallback schedule. Album and per-track searches have distinct
intent contexts. Keep the existing queue/workers and their observable completion;
no additional scheduler or automatic search POST retry is introduced.

Commit the pending continuation marker with the reservation before POST, so a
crash does not leave the normal six-hour cooldown hiding an accepted search.
Reconciliation honors that marker only for the same claim and attempt; durable
search success clears it. The prior successfully completed search ID identifies
the next scheduled search cycle. That completed cycle or an explicit rediscovery
generation can authorize a new intent; expiry alone cannot. Best-effort per-track
fallback retains its existing terminal/exhaustion policy; it does not gain a
separate automatic continuation scheduler in this slice.

This provides at most one application POST admission per durable intent. It does
not claim distributed exactly-once execution: a crash after reservation but
before sending can leave a UUID absent at the provider. Preserve that ambiguity
for review/new explicit intent. Provider reset, configuration drift, expiry and
cancelled authority must fail closed. Separate deterministic failure/concurrency
tests, real PostgreSQL reservation/rollback proof and released native UUID/API
qualification. See the separate research and outcome documents.

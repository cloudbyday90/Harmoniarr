# Harmoniarr Schema And Migration Task List

Implementation source: `docs/harmoniarr.md`
Database model source: `docs/DATABASE_MODEL.md`
Recovery source: `docs/BACKUP_RESTORE_DESIGN.md`
Security source: `docs/SECURITY_POLICY.md`

## Current Status (2026-10-28)

October 28 callback recovery feedback is implemented in the existing Settings
workspace. The existing provider-status GET supplies last-check observations;
query hints never establish saved state. No schema or maintenance changes are
needed. See [design](PROVIDER_CALLBACK_FEEDBACK_DESIGN.md) and
[outcome](PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).

October 28 callback error-code catalogs now bound OAuth/Plex redirect output.
No migration, schema refresh or maintenance job is needed; existing callback
state and guarded credential publication retain their owners. See the separate
[design](PROVIDER_CALLBACK_ERRORS_DESIGN.md) and [outcome](PROVIDER_CALLBACK_ERRORS_OUTCOME.md).

October 28 provider route catalogs now bound public failure text without SQL or
schema changes. Guarded HTTP qualification preserves settings, secrets and
operation rows around reads/refusals; no maintenance job is added. See the
[design](PROVIDER_ROUTE_ERRORS_DESIGN.md) and [outcome](PROVIDER_ROUTE_ERRORS_OUTCOME.md).
Next bound OAuth/Plex callback redirect error codes separately from JSON errors,
preserving the existing callback/session ownership and automatic maintenance.

October 28 unexpected HTTP error projection is implemented without database or
schema changes. Intentional public API errors retain their contracts, while
unknown native details receive generic 500 responses. Automatic maintenance
remains unchanged. See the [design](HTTP_ERROR_DESIGN.md) and
[outcome](HTTP_ERROR_OUTCOME.md). Next review route-local error normalizers and
redirect/direct-response boundaries; they remain separate projection owners.

October 28 provider status aggregation is implemented without SQL/schema changes
or a persisted status cache. Status GETs preserve settings/secrets/audit bytes;
existing automatic schema maintenance remains. See the separate
[design](PROVIDER_STATUS_DESIGN.md) and [outcome](PROVIDER_STATUS_OUTCOME.md).
Next: centralize bounded unexpected HTTP error projection while retaining
intentional validation errors; no new schema maintenance action is needed.

October 26, 2026 preparation hardening: fresh snapshot publication now requires
complete migration lineage and 164 independently generated critical schema facts
inside the same transaction. Historical SQL is unchanged. See the
[anchor design](SNAPSHOT_ANCHORS_DESIGN.md) and [outcome](SNAPSHOT_ANCHORS_OUTCOME.md).
Next: add a bounded read-only critical-anchor diagnostic for existing nonempty
databases, preserving observation/maintenance boundaries and offering no repair.

That diagnostic is now implemented as `npm run diagnose:schema`; see its separate
[design](SCHEMA_DRIFT_DESIGN.md) and [outcome](SCHEMA_DRIFT_OUTCOME.md). Next expose
the bounded summary in existing administrator diagnostics with explicit refresh,
no-store and accessible current/attention/unavailable feedback; retain repair and
startup admission as separate decisions.

That administrator summary is implemented in the
[schema diagnostics UI design](SCHEMA_DIAGNOSTICS_UI_DESIGN.md) and
[outcome](SCHEMA_DIAGNOSTICS_UI_OUTCOME.md). Next qualify and bound connection/
end-to-end observation admission separately from the existing SQL transaction
limits, retaining no-repair behavior and bounded unavailable results.

Connection/inspection deadlines are implemented in the October 27
[deadline design](SCHEMA_DIAGNOSTIC_DEADLINES_DESIGN.md) and
[outcome](SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md), with
[official research and tradeoffs](SCHEMA_DIAGNOSTIC_DEADLINES_RESEARCH.md).
Next qualify ordinary session/pool admission under exhaustion; diagnostic scans
now have independently owned connections and retain admission through drainage.

Ordinary pool/session read admission is implemented in the
[October 27 design](POOL_SESSION_ADMISSION_DESIGN.md) and
[outcome](POOL_SESSION_ADMISSION_OUTCOME.md), with
[official research/tradeoffs](POOL_SESSION_ADMISSION_RESEARCH.md).
Next bound rotated-token replay revocation/audit as its own transaction owner;
the read-only deadline intentionally does not abandon these security writes.

That replay transaction is implemented in the October 27
[design](SESSION_REPLAY_DESIGN.md) and [outcome](SESSION_REPLAY_OUTCOME.md), with
[official research/tradeoffs](SESSION_REPLAY_RESEARCH_2026_10.md).
Next bring rotation/issuance into compatible family ownership, with current
parent admission and atomic revoke/insert/link, so late issuance cannot escape
a completed replay revocation. No schema changes were made for this step.

Transactional rotation and isolated root issuance are now implemented in the
[rotation design](SESSION_ROTATION_DESIGN.md) and [outcome](SESSION_ROTATION_OUTCOME.md),
with [official research/tradeoffs](SESSION_ROTATION_RESEARCH_2026_10.md).
Next bind root login's verified credential epoch and required audit to issuance;
current enabled-account checks alone do not fence stale password verification.

The user-prioritized automatic schema workflow is now implemented in the
[maintenance design](AUTO_SCHEMA_MAINTENANCE_DESIGN.md) and
[outcome](AUTO_SCHEMA_MAINTENANCE_OUTCOME.md), with
[official research/tradeoffs](AUTO_SCHEMA_MAINTENANCE_RESEARCH.md). Checks run at
startup/hourly, pause for recovery maintenance and retry without HTTP-owned scans.
This supersedes the manual schema button described in the historical UI step.
Guarded startup migrations remain automatic; arbitrary drift is never repaired
by diagnostics. No schema artifact changed. Next return to root login's verified
credential epoch/required audit ownership; it remains postponed, not completed.

That password-login transaction is now implemented in the
[login design](PASSWORD_LOGIN_DESIGN.md) and [outcome](PASSWORD_LOGIN_OUTCOME.md),
with [official research/tradeoffs](PASSWORD_LOGIN_RESEARCH_2026_10.md). Exact
verified hash/epoch comparison, current account admission, successful-login
bookkeeping, root issuance and required audit share one bounded owner. No schema
artifact changed. Next give failed-login counters/lockout and required failure
audit a bounded atomic account owner; their current stale count projection can
lose concurrent failures. Provider/bootstrap issuance remains a separate followup.

Failed-login ownership is implemented in the
[failure design](LOGIN_FAILURE_DESIGN.md) and [outcome](LOGIN_FAILURE_OUTCOME.md),
with [official research/tradeoffs](LOGIN_FAILURE_RESEARCH_2026_10.md). Current-row
increments, lockout decisions and required audit commit together; active deadlines
and reset credential epochs are preserved. No schema artifact changed. Next bound
the preliminary login bootstrap/credential reads independently of security-write
ownership. Provider/bootstrap issuance remains a separate later followup.

Preliminary bootstrap/credential reads are now bounded in the
[read design](AUTH_LOOKUP_DESIGN.md) and [outcome](AUTH_LOOKUP_OUTCOME.md), with
[official research/tradeoffs](AUTH_LOOKUP_RESEARCH_2026_10.md). The existing read
owner supplies local SQL limits, deadline, cancellation and retirement; required
security writes remain independent. No schema artifact changed. Next bound
password-verification admission and input size outside account locks, preserving
password-manager compatibility. Non-password issuance remains later work.

Password resource admission is implemented in the
[work design](PASSWORD_WORK_DESIGN.md) and [outcome](PASSWORD_WORK_OUTCOME.md), with
[official research/tradeoffs](PASSWORD_WORK_RESEARCH_2026_10.md). Two submitted
jobs, no application queue and full-input byte validation precede native work;
slots remain held through completion. No schema artifact changed. Next add
versioned hash parameters and upgrade the below-current-profile legacy work
factor with legacy verification and guarded upgrade-on-login.

Versioned stronger hashes and successful-login upgrades are now implemented in
the [hash design](PASSWORD_HASH_DESIGN.md) and [outcome](PASSWORD_HASH_OUTCOME.md),
with [official research/tradeoffs](PASSWORD_HASH_RESEARCH_2026_10.md). Current
scrypt N=16384/r=8/p=5 fits the existing nominal memory profile; the allowlisted
legacy verifier remains. Upgrade/session/bookkeeping/audit commit together under
the exact verified hash/epoch guard, preserving the password epoch and existing
sessions. No schema artifact changed. Next give password change a bounded
current-credential transaction owner covering credential replacement, session
revocation/reissuance and required audit. Its current multi-step writes can leave
partial outcomes; hash preparation should remain outside the write owner.

Atomic password change is now implemented in the
[change design](PASSWORD_CHANGE_DESIGN.md) and [outcome](PASSWORD_CHANGE_OUTCOME.md),
with [official research/tradeoffs](PASSWORD_CHANGE_RESEARCH_2026_10.md). Bounded
preliminary reads/KDF preparation precede current account, exact credential epoch
and exact initiating-token admission. Credential replacement, complete old-session
revocation, new root issuance and required audit share one bounded transaction.
No schema artifact changed. Next give external-provider login compatible current
linked-account admission and atomic bookkeeping/root issuance/required audit;
`loginLinkedUser` still performs those writes separately.

Linked-provider local admission/publication is now implemented in the
[linked-login design](LINKED_LOGIN_DESIGN.md) and [outcome](LINKED_LOGIN_OUTCOME.md),
with [official research/tradeoffs](LINKED_LOGIN_RESEARCH_2026_10.md). Bounded minimal
candidate lookup, exact current provider/subject and enabled-account checks,
shared login bookkeeping, root issuance and required audit use compatible
account/family ownership. No schema artifact changed. Next give Plex callback
state bounded single-use consumption with explicit browser binding/expiry and
atomic ownership alongside successful local publication. Its current separate
post-login delete still permits independent callback completion and late cleanup
failure after a durable login.

Plex callback browser binding and atomic single-use consumption are now implemented
in the [callback design](PLEX_CALLBACK_DESIGN.md) and
[outcome](PLEX_CALLBACK_OUTCOME.md), with
[official research/tradeoffs](PLEX_CALLBACK_RESEARCH_2026_10.md). Versioned encrypted
state carries a browser-verifier hash and database expiry; exact-record deletion,
bookkeeping, root issuance and required success audit share the bounded owner.
Start-state persistence and its privacy-safe required audit are also atomic. No
schema artifact changed. Next integrate bounded expired pending-state cleanup
into existing maintenance, protecting active flows and the persistent Plex client
identifier; avoid requiring a manual refresh or another deployed service.

Automatic callback retention is now implemented in the
[retention design](PLEX_RETENTION_DESIGN.md) and [outcome](PLEX_RETENTION_OUTCOME.md),
with [official research/tradeoffs](PLEX_RETENTION_RESEARCH_2026_10.md). Existing
maintenance ownership protects one bounded batch, retaining active and unknown/
unreadable state while atomically auditing eligible deletion. No manual refresh,
new deployed service or schema artifact is needed. Next bound Plex provider HTTP
time/body/drain ownership; database/state expiry does not bound external resource
use.

Plex HTTP time/body/drain ownership is now implemented in the
[HTTP design](PLEX_HTTP_DESIGN.md) and [outcome](PLEX_HTTP_OUTCOME.md), with
[official research/tradeoffs](PLEX_HTTP_RESEARCH_2026_10.md). A shared application
owner bounds active requests and streamed JSON, verifies TLS and retains capacity
through native/DNS retirement. No schema artifact changed. Next extend the Plex
owner-link callback with current-actor authorization, browser-bound single-use
state and atomic token/state/required-audit publication; HTTP bounds do not own
those existing separate application writes.

Plex owner linking is now implemented in the [design](PLEX_OWNER_LINK_DESIGN.md)
and [outcome](PLEX_OWNER_LINK_OUTCOME.md), with
[official research/tradeoffs](PLEX_OWNER_LINK_RESEARCH_2026_10.md). Browser-bound
state, current exact-session administrator admission, token/revision/required-audit
publication and clear invalidation share one bounded transaction owner. Existing
maintenance expires both pending namespaces automatically. No schema change.
Spotify/YouTube linking is now implemented in the [OAuth design](OAUTH_LINK_DESIGN.md)
and [outcome](OAUTH_LINK_OUTCOME.md), with
[official research/tradeoffs](OAUTH_LINK_RESEARCH_2026_10.md). Browser/current-session
admission precedes exchange and publication. Token/state/revision/required-audit
writes commit together; exact-token refresh fences prevent stale resurrection.
The same automatic maintenance batch covers their canonical pending namespaces.
No schema change. Native Spotify/YouTube HTTP ownership is now implemented in the
[HTTP design](PROVIDER_HTTP_DESIGN.md) and [outcome](PROVIDER_HTTP_OUTCOME.md), with
[official research/tradeoffs](PROVIDER_HTTP_RESEARCH_2026_10.md). One application
owner bounds API/OAuth/revocation work and retains admission through request,
socket, codec and issued-DNS retirement. Local OAuth publication fences remain;
no schema artifact changed. Next extend owned native HTTP to Apple Music while
preserving developer-token signing and client behavior.

Apple Music adoption is now implemented in the [design](APPLE_HTTP_DESIGN.md) and
[outcome](APPLE_HTTP_OUTCOME.md), with
[official research/tradeoffs](APPLE_HTTP_RESEARCH_2026_10.md). The existing owner
now bounds all three providers, and the obsolete adapter is removed. No schema
artifact changed. Next review P-256 key admission and developer-token lifetime;
automatic schema maintenance needs no additional refresh command or service.

Apple signing policy is now implemented in the [design](APPLE_SIGNING_DESIGN.md)
and [outcome](APPLE_SIGNING_OUTCOME.md), with
[official research/tradeoffs](APPLE_SIGNING_RESEARCH_2026_10.md). Private P-256
admission and one-hour tokens use a small policy/signer/cache boundary; no SQL
artifact or refresh job is added. Next validate saved Apple signing material and
identifier shape at the protected settings mutation while preserving clear and
replacement semantics.

That save boundary is now implemented in the [credential design](APPLE_CREDENTIALS_DESIGN.md)
and [outcome](APPLE_CREDENTIALS_OUTCOME.md), with
[research/tradeoffs](APPLE_CREDENTIALS_RESEARCH_2026_10.md). It reuses the encrypted
owner and settings transaction, including native rollback proof. No migration,
snapshot, anchor or refresh job changes. Next distinguish configured presence
from local signing validity in the existing read-only Apple status service.

That status summary is now implemented in the [design](APPLE_STATUS_DESIGN.md)
and [outcome](APPLE_STATUS_OUTCOME.md), with [research/tradeoffs](APPLE_STATUS_RESEARCH_2026_10.md).
It reuses local key/ID admission, preserves presence fields, and performs no
settings/secret/audit writes. No schema artifact or refresh job changes. Next show
saved local validity in the existing Settings connection summary, with explicit
saved-versus-draft and local-versus-provider feedback.

That Settings display is implemented in the [UI design](APPLE_STATUS_UI_DESIGN.md)
and [outcome](APPLE_STATUS_UI_OUTCOME.md), with [research/tradeoffs](APPLE_STATUS_UI_RESEARCH_2026_10.md).
It consumes the existing authenticated status GET and keeps drafts out of reads.
No schema artifact or maintenance job changes. Next review provider-status
aggregation so a provider-specific credential-read failure does not hide every
other status, while preserving common database outage handling and privacy.

October 12 scan addition: `20261012_225951_scan_owned_receipt_invalidation.sql`
adds UUID revision identity, generated path lookup and revision-bound negative
observations. Replay preserves existing identities; snapshot/anchors include the
new schema. Generated/default columns can rewrite the ledger during startup.
See the [scan outcome](SCAN_RECEIPT_INVALIDATION_OUTCOME.md) for bounded publication,
snapshot and replay evidence; no online zero-lock rollout is claimed.

October 12, 2026 addition: `20261012_222007_operator_track_receipt_ledger.sql`
adds historical owner/release indexing, transaction-local candidate projection
and conservative applied-history backfill. The repo-generated snapshot and
critical anchors include the table, binding constraints and index; the
[ledger outcome](OPERATOR_TRACK_RECEIPT_LEDGER_OUTCOME.md) owns upgrade and real
snapshot-trigger proof. Startup backfill excludes concurrent candidate writes;
this is a synchronous migration, not online zero-lock deployment.

- Schema direction is documented, but the initial migration package is not yet split into execution units.
- Migration lineage now has executable validation for replay plus deterministic schema snapshot freshness through shared repo-maintenance scripts and CI contracts.
- Fresh-install schema snapshot consumption is now also executable through the shared startup bootstrap seam and the disposable-database validation path, so the checked-in snapshot is tested as a real bootstrap artifact rather than only compared as text.
- This file is the execution tracker for the database and migration component of V1.

## Scope

This component covers:

- base schema package design
- migration naming and ordering
- table and index rollout sequence
- schema safety and replay rules
- schema snapshot and validation requirements

This component does not define route payloads or screen behavior except where schema shape must be locked first.

## Start Gate

- [ ] Review `docs/DATABASE_MODEL.md` end to end.
- [x] Confirm UUID strategy, version-specific Postgres data directory assumptions, and startup guards remain accepted.
- [ ] Confirm the first migration package includes only V1-required tables, constraints, and indexes.
- [ ] Confirm restore, maintenance-lock, and admin-recovery tables align with the current recovery docs.
- [ ] Lock timestamp-style migration naming and schema snapshot update rules.
- [x] Lock surrogate-key default policy on the shared `harmoniarr_generate_uuid()` helper so migration replay and fresh-install snapshots do not drift between `uuidv7()` and fallback UUID generation.

## Migration Package 1 - Platform And Auth Foundation

- [ ] Create migration for `app_users` with password lifecycle and lockout fields required by the current plan.
- [ ] Create migration for `refresh_tokens` with revocation, expiry, and audit-friendly metadata.
- [ ] Create migration for singleton app/system configuration storage.
- [ ] Create migration for audit/event logging tables needed before privileged actions ship.
- [ ] Create migration for `maintenance_locks` and base operation-run/event tables.
- [ ] Create migration for base job queue and lease ownership tables.
- [ ] Verify idempotency and re-run safety for every migration in this package.

## Migration Package 2 - Canonical Music Identity And Import Review

- [ ] Create canonical metadata tables for artists, release groups, releases, recordings/tracks, and external identities.
- [ ] Create `artwork_assets`, `artwork_assignments`, and `file_tag_snapshots` with checksum-addressed storage descriptors, assignment rules, and observed-tag history semantics.
- [ ] Create import-candidate, review-decision, and related state/history tables.
- [x] Create initial import-candidate and candidate-file persistence tables for slskd discovery ingestion.
- [x] Create initial import-candidate review event history table for hold, reject, and reopen transitions.
- [ ] Create path-mapping and root-folder policy tables if they are not stored in singleton config.
- [ ] Add provenance fields so canonical MusicBrainz identity remains distinguishable from advisory enrichers.
- [ ] Add uniqueness/index rules for local surrogate keys plus required natural identifiers.

## Migration Package 3 - Jobs, Filesystem Actions, And Notifications

- [ ] Create durable job run, job event, worker lease, cancellation, and retry-state tables.
- [ ] Create `artwork_operation_runs` and `artwork_operation_events` if artwork workers ship in the initial job-control slice.
- [x] Create filesystem action preview/apply history tables as needed for auditable mutation flows.
- [ ] Create notification and operator-feedback persistence tables if required by the final UI/behavior contract.
- [ ] Add append-mostly event indexes using BRIN where volume and time-based access patterns justify it.

## Migration Package 4 - Recovery, Restore, And Diagnostics

- [ ] Create backup/export metadata tables and restore operation-run/event tables.
- [ ] Create `admin_recovery_runs` and any associated audit/evidence tables.
- [ ] Add diagnostics/event indexing needed for queue health, maintenance state, and operational history.
- [ ] Confirm logical backup exclusions remain compatible with schema design for auth/session/API-key state.

## Constraint And Index Checklist

- [ ] Review every uniqueness rule against the surrogate-key guidance in `docs/DATABASE_MODEL.md`.
- [ ] Add foreign keys only where lifecycle behavior is understood and does not block fail-safe logging or recovery evidence capture.
- [ ] Review partial, composite, BRIN, and trigram index needs based on documented access patterns rather than guesswork.
- [ ] Avoid extension requirements that are not already accepted as V1 dependencies.

## Migration Safety Checklist

- [ ] Ensure every migration is transaction-safe for the chosen runner.
- [ ] Ensure constraint names and index names are deterministic and non-colliding.
- [ ] Ensure replay on an already-migrated database is safe.
- [ ] Ensure startup can detect schema drift and incompatible on-disk/Postgres-major mismatches.
- [ ] Ensure schema changes that affect restore/recovery semantics are reflected in the recovery docs in the same change.

## Validation Gates

- [ ] Apply the migration package to a fresh database successfully.
- [ ] Re-run the same migration package to prove idempotent behavior where intended.
- [x] Validate schema snapshot output after each accepted package.
- [ ] Validate fresh install and upgrade paths against the same package.
- [ ] Confirm logical backup and restore behavior tolerates missing artwork binaries while preserving artwork descriptor rows correctly.
- [ ] Confirm backup/restore preview logic can reason about the final schema shape.

## Done Criteria

- [ ] The initial V1 migration lineage is sequenced, documented, and replay-safe.
- [ ] Core auth, import-review, job, and recovery tables exist with accepted constraints and indexes.
- [x] Schema snapshot and migration validation rules are documented and executable.

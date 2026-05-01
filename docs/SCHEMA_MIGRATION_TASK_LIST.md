# Harmoniarr Schema And Migration Task List

Implementation source: `docs/harmoniarr.md`
Database model source: `docs/DATABASE_MODEL.md`
Recovery source: `docs/BACKUP_RESTORE_DESIGN.md`
Security source: `docs/SECURITY_POLICY.md`

## Current Status (2026-04-27)

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
- [ ] Confirm UUID strategy, version-specific Postgres data directory assumptions, and startup guards remain accepted.
- [ ] Confirm the first migration package includes only V1-required tables, constraints, and indexes.
- [ ] Confirm restore, maintenance-lock, and admin-recovery tables align with the current recovery docs.
- [ ] Lock timestamp-style migration naming and schema snapshot update rules.

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

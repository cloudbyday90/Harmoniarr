# Harmoniarr API And Route Contract Task List

Implementation source: `docs/harmoniarr.md`
Security source: `docs/SECURITY_POLICY.md`
Recovery source: `docs/BACKUP_RESTORE_DESIGN.md`
Admin recovery source: `docs/ADMIN_RECOVERY_RUNBOOK.md`

## Current Status (2026-04-27)

- Route families are named in the implementation plan, but contract-level execution work is not split yet.
- This file is the execution tracker for route surfaces, validation rules, permission boundaries, and normalized response contracts.
- Import review routes now cover list, detail, read-only planning preview, slskd ingestion, and operator hold/select/reject/reopen transitions with native contract coverage.
- Import review routes now also cover selected-summary, execution-summary, execution-reconcile, and import-pending-summary read models so long-running download and pre-import stages stay visible through protected shared contracts.
- The import execution summary contract now also exposes automatic reconciliation heartbeat cadence and last outcome so background transfer persistence remains operator-visible through the same protected summary boundary.
- The import execution summary contract now also exposes missing-transfer grace policy plus orphan-ready transfer evidence, so transient slskd detail misses are distinguishable from durable orphan failures at the read-model boundary.
- Import review routes now also cover a per-candidate apply-preview read contract for `import_pending` detail, so collision and missing-source evidence can be inspected without triggering import apply behavior.
- Import review routes now also cover apply-summary and apply-run start contracts, so guarded library-apply execution is visible and triggerable through the same protected workflow boundary as download execution.
- The apply-summary read model now also carries durable `import_operations` history per candidate item, so guarded stage/finalize step outcomes remain queryable without relying only on embedded run snapshots.
- Import review routes now also cover per-file collision-decision writes for `import_pending` candidates, so operators can save or clear explicit skip decisions through protected CSRF-enforced contracts without introducing overwrite semantics.
- Settings routes now also carry explicit download-path mapping configuration through the shared allowlisted settings contract.
- Settings routes now also return non-destructive path validation summaries for local roots and mapping examples through the same shared settings payload.
- The public `GET /api/v1/bootstrap/status` route now extends its shared payload with the same lightweight path-validation summary during first-run setup, without routing bootstrap through authenticated settings APIs.
- The protected `GET /api/v1/system/onboarding` route now returns a checklist-style onboarding summary with shared next actions for paths, slskd connection and auth, MusicBrainz reachability, migrations, and worker visibility.
- The protected `GET /api/v1/system/library-scan-summary` route now returns shared first-scan readiness plus the latest durable library-scan run summary for dashboard status surfaces.
- The protected `GET /api/v1/library/discovery-summary` route now returns discovery-request readiness, cooldown, and release-date blocking counts from the shared library discovery projection for dashboard status surfaces.
- The protected `POST /api/v1/library/discovery-runs` route now starts a dedicated discovery dispatch run through the shared library worker boundary, without requiring a full filesystem rescan.
- The protected `GET /api/v1/library/reconciliation-summary` route now returns current file-match and release-coverage counts from the shared library reconciliation read model for dashboard status surfaces.
- The protected `GET /api/v1/library/wanted-summary` route now returns monitored-artist and wanted-release counts from the shared library wanted projection for dashboard status surfaces.
- The protected `POST /api/v1/library/scan-runs` route now creates a durable pending library-scan run, enforces shared readiness and CSRF/session guards, and hands execution off to the shared library worker boundary.
- The protected `PUT /api/v1/metadata/artists/:artistId/monitoring` route now updates canonical artist monitoring state through the shared metadata monitoring service and returns the current artist monitoring payload used by local metadata reads.
- The system overview route now also returns a lightweight path-validation summary derived from the shared settings payload for authenticated dashboard consumers.
- The protected `POST /api/v1/auth/refresh` route and privileged admin mutation routes now return a normalized `reauth_required` error when the authenticated session is flagged for forced re-authentication, while read-side routes remain accessible until password-management and session-management routes are defined.
- The dedicated Downloader page now consumes a Harmoniarr-owned admin-only
  `GET /api/v1/downloader/queue` read model for normalized transfer rows,
  queue health, source groups, and disabled future action eligibility while the
  lower-level `GET /api/v1/slskd/downloads` provider route remains available.

## Global Contract Rules

- [ ] Lock request validation strategy for params, query, body, and headers.
- [ ] Lock normalized success envelope conventions where applicable.
- [ ] Lock normalized error-code taxonomy and HTTP status mapping.
- [ ] Lock correlation ID, audit logging, and redaction expectations for every mutating route family.
- [ ] Lock idempotency rules for privileged or destructive operations.

## Route Family 1 - Bootstrap, Auth, And Session Routes

- [x] Define first-run bootstrap-admin routes and no-longer-available behavior after bootstrap completes.
- [x] Define login, logout, refresh, and session introspection routes.
- [ ] Define forced re-auth routes.
- [x] Define CSRF token issuance/refresh behavior for cookie-authenticated writes.
- [x] Define rotated refresh-token replay semantics that revoke the active browser session family.
- [ ] Define lockout, password-change, and forced re-auth error semantics.

## Route Family 2 - Settings, Secrets, And Integration API Keys

- [x] Define settings read/write routes with allowlisted keys and partial-update safety.
- [x] Define admin-only enforcement for settings and system-management routes.
- [x] Define admin-only enforcement for slskd operational routes.
- [ ] Define artwork settings keys and mutation rules for provider order, extraction eligibility, derivative profiles, cleanup thresholds, and force-refresh behavior.
- [x] Define initial secret masking, preservation, clearing, and validation behavior for `slskd.apiKey` without plaintext response round-trips.
- [ ] Define integration API key create, rotate, revoke, and list routes.
- [x] Define audit expectations for settings mutation routes.
- [x] Define audit expectations for the first credential mutation route family (`slskd.apiKey` via settings).

## Route Family 3 - Health, Readiness, And Diagnostics

- [x] Define anonymous vs authenticated health surfaces.
- [x] Define authenticated diagnostics routes for queue state, maintenance locks, recent failures, and privileged action history.
	- Added guarded queue diagnostics read route `GET /api/v1/system/diagnostics/queue-state` returning tracked pending/running/failed queue state plus recent operation runs.
	- Added guarded recovery diagnostics read route `GET /api/v1/system/diagnostics/recovery-state` returning maintenance lock state, recent failed runs, and recent recovery privileged actions.
- [ ] Define redaction rules for diagnostics exports and operator-visible payloads.
- [x] Define dependency-health classification for slskd and metadata provider failures.
- [x] Define authenticated slskd discovery route contracts for status, search start, search state, and search response reads with normalized provider errors.
- [x] Define the Downloader queue read model route contract for live transfer
  rows, aggregate queue health, source groups, provider error normalization, and
  admin-only access.

## Route Family 4 - Import Review And Canonical Metadata

- [x] Define import-candidate list/detail/filter routes.
- [x] Define import-candidate read-only planning preview route contract for source, staging, and library path resolution warnings.
- [x] Define slskd import-candidate ingestion route contract for persisting search responses into review-ready state.
- [x] Define import-candidate hold, select, reject, and reopen route contracts with stale-state conflict behavior.
- [x] Define import-candidate per-file skip and clear-decision route contracts for collision handling inside apply preview.
- [ ] Define review decision routes for approve, reject, hold, retry, and reopen actions as applicable.
- [x] Define canonical metadata lookup/detail routes needed by the review UI.
- [x] Define replay-safe behavior and conflict responses for duplicate or stale operator actions.

## Route Family 5 - Job Control, Filesystem Preview, And Media Operations

- [ ] Define job queue/history/detail routes.
- [ ] Define job cancel/retry/requeue routes with permission and state guards.
- [ ] Define artwork job trigger/list/detail routes for refresh, derivative regeneration, extraction, and cleanup with idempotency and permission boundaries.
- [ ] Define filesystem preview/apply routes for import, rename, organize, and transcoding-related actions.
- [ ] Define warning and confirmation contracts for lossy-to-lossy and lossy-to-lossless requests.

## Route Family 6 - Backup, Restore, Maintenance, And Admin Recovery

- [x] Define backup/export create, list, inspect, download, and delete routes.
	- Added guarded create, list, and inspect routes for backup artifacts via `POST /api/v1/recovery/backups`, `GET /api/v1/recovery/backups`, and `GET /api/v1/recovery/backups/:backupArtifactId`.
	- Added guarded artifact download route `GET /api/v1/recovery/backups/:backupArtifactId/download` with attachment headers and managed-storage boundary checks.
	- Added guarded artifact delete route `DELETE /api/v1/recovery/backups/:backupArtifactId` with fresh-admin + CSRF enforcement, file-delete + metadata-delete orchestration, and audit evidence.
- [ ] Define restore preview and restore apply routes with maintenance-lock gating.
	- Added guarded restore-preview read route `GET /api/v1/recovery/backups/:backupArtifactId/restore-preview` backed by backup artifact integrity checks and maintenance-lock readiness signaling.
	- Added guarded restore-apply mutation route `POST /api/v1/recovery/backups/:backupArtifactId/restore-apply` with fresh-admin + CSRF enforcement and checksum-aware apply orchestration.
	- Extended restore-apply service contract to consume scoped backup payloads (`data.scopeSettings`) and return explicit `requestedScopes`, `appliedScopes`, and `skippedScopes` summary metadata.
- [x] Define maintenance-lock status, enter, and release routes if exposed directly.
	- Added guarded maintenance-lock status route `GET /api/v1/recovery/maintenance-locks` for authenticated admin visibility into active lock state.
	- Added guarded maintenance-lock enter route `POST /api/v1/recovery/maintenance-locks` with fresh-admin + CSRF enforcement and audit-backed lock acquisition.
	- Added guarded maintenance-lock release route `POST /api/v1/recovery/maintenance-locks/:lockId/release` with idempotent-safe release behavior and audit evidence.
- [ ] Define admin recovery issuance, verification, use, cancel, and audit lookup routes.
- [ ] Ensure all recovery-sensitive routes align with `docs/BACKUP_RESTORE_DESIGN.md` and `docs/ADMIN_RECOVERY_RUNBOOK.md`.

## Route Family 7 - Notifications And Operator Feedback

- [ ] Define notification list/read/acknowledge behavior if persisted server-side.
- [ ] Define operator-attention surfaces for warnings, failures, and required manual actions.
- [ ] Define contract boundaries between ephemeral toasts and durable notification state.

## Contract Verification Checklist

- [x] Add route-contract tests for happy paths and permission failures.
- [x] Add native route-contract tests for slskd discovery happy paths, CSRF-protected search starts, and provider error normalization.
- [x] Add native route-contract tests for CSRF-protected slskd import-candidate ingestion and provider error normalization.
- [x] Add native route-contract tests for import-candidate preview plus CSRF-protected hold, select, reject, reopen, and stale-state conflict behavior.
- [x] Add validation tests for malformed settings input and unknown keys.
- [ ] Add validation tests for malformed input across the remaining route families.
- [ ] Add tests for idempotent retries on privileged actions where required.
- [ ] Add tests for redaction and audit logging on secret-bearing routes.
- [ ] Add tests for maintenance-lock denial behavior on protected route families.

## Done Criteria

- [ ] Every V1 route family has explicit validation, permission, audit, and error-contract rules.
- [ ] Recovery-sensitive and destructive routes are idempotent or explicitly single-use by contract.
- [ ] Route-contract tests cover the critical path before implementation is considered complete.

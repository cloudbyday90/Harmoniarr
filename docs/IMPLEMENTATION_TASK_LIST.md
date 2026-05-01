# Harmoniarr Implementation Task List

Implementation source: `docs/harmoniarr.md`
Security posture source: `docs/SECURITY_POLICY.md`
Backup and restore source: `docs/BACKUP_RESTORE_DESIGN.md`
Admin recovery source: `docs/ADMIN_RECOVERY_RUNBOOK.md`
Database model source: `docs/DATABASE_MODEL.md`

## Current Status (2026-05-01)

- Initial implementation planning exists in `docs/harmoniarr.md`.
- Execution phases are defined, but no phase is complete yet.
- The Docker runtime now boots a real minimal Express plus Vue application instead of a placeholder-only shell.
- Embedded PostgreSQL startup, tracked timestamped migrations, bootstrap-admin creation, login/logout/session routes, and allowlisted settings persistence are now implemented.
- Canonical MusicBrainz metadata foundation now exists for artists, release groups, releases, media, recordings, tracks, and provider snapshots with timestamped migrations.
- The metadata workspace now uses shared client API modules, composables, and static Vue SFCs for provider search/import plus local reopen flows.
- The server bootstrap now composes metadata read/search/catalog/import capabilities through a shared native ESM metadata module instead of hand-wiring that service graph directly in the app composition root.
- The server bootstrap now also composes system overview and settings route dependencies through a shared native ESM system module, keeping the control-plane wiring out of the app composition root.
- The server bootstrap now also composes auth route dependencies through a shared native ESM auth module, and auth route registration accepts injected dependencies for native contract testing without module-mocking hacks.
- The app composition root now accepts injected module factories and route registrars for direct native contract testing, while preserving static ESM imports and the existing API plus SPA fallback behavior.
- Native auth route coverage now exercises bootstrap-admin, login, refresh, logout, and session contracts against the injected auth boundary with native fetch and node:test.
- System route registration now accepts injected auth helper dependencies like the metadata route layer, and native control-plane route coverage now exercises health, settings read/update, and system overview contracts.
- Shared request-auth helper defaults now live behind a native ESM auth-module surface reused by auth, metadata, and system route layers instead of being hand-wired separately in each route file.
- Auth and system route contract coverage now also proves shared JSON error behavior for injected auth-required, CSRF, and invalid-credential failures without introducing module-mocking or non-native test tooling.
- Settings validation now throws normalized API-style 400 errors from the shared validator boundary, and native service plus route coverage proves malformed settings patches do not leak as generic 500 responses.
- Metadata route coverage now also proves MusicBrainz provider failure normalization for unavailable, misconfigured, and upstream request-failed cases, preserving shared JSON 503 and 502 contracts through the Express layer.
- MusicBrainz client coverage now proves retry behavior, throttling `Retry-After` handling, exhausted retry details, and non-retryable upstream failure classification at the provider boundary.
- MusicBrainz search, catalog, and import service coverage now proves shared-client request normalization, validation-before-provider-call behavior, provider failure detail preservation, and import audit dependency injection without module mocking or lazy loading.
- Shared dependency-health classification now maps MusicBrainz provider failures into safe diagnostics statuses for throttled, unavailable, misconfigured, request-failed, and not-found outcomes without leaking raw upstream URLs or causes, and system overview can surface injected dependency health.
- A shared provider-health recorder now captures the last observed MusicBrainz health from real search, catalog, and import provider calls, and the app composition root shares that recorder with system overview diagnostics through static ESM module wiring.
- The authenticated dashboard now uses a shared system-overview composable and modular dependency-status component to surface MusicBrainz provider health observations from the protected system overview API.
- The slskd adapter boundary now has static ESM client, service, and module layers with API-key request support, normalized search/connection contracts, provider-health observation hooks, and safe dependency-health classification for unavailable, unauthorized, misconfigured, and request-failed outcomes.
- The app composition root now wires the static ESM slskd module into the shared provider-health recorder and authenticated system overview dependency checks, while `/healthz` remains a lightweight local health summary without live provider probing.
- Authenticated slskd discovery routes now expose connection status, search start, search polling, and normalized search responses through the shared slskd service/module boundary with CSRF enforcement on mutating search starts.
- Import candidate ingestion now persists normalized slskd search responses into durable review-ready candidate and candidate-file tables, keeping queryable domain fields separate from raw provider JSONB payloads.
- Import candidate read-side services and routes now expose authenticated list/detail review queue contracts with status, slskd search, username, and folder filters over the persisted candidate state.
- Import candidate review transitions now support hold, select, reject, and reopen actions with optimistic status guards, append-only candidate events, audit evidence, and CSRF-protected route contracts.
- The authenticated frontend now includes a persisted import review queue surface with shared ESM API/composable modules, URL-backed filter and selected-candidate state, candidate detail inspection, and operator hold/select/reject/reopen actions over the review routes.
- The import review workspace now routes queue, detail, preview, and transition refresh orchestration through a shared route-aware composable, and the queue shows the last successful refresh time so operators can see when the review read model was last reloaded.
- The import review detail surface now also exposes a read-only planning preview for current downloads-root resolution, staging targets, mirrored library naming, and explicit warnings where full slskd path mappings do not exist yet.
- The import workflow now also exposes a dedicated selected-candidate readiness summary through a protected read model and shared client composable, so operators can see which selected items are ready, warning-bearing, or blocked before download or apply behavior exists.
- The import workflow now also persists planning-only execution runs for selected candidates through the shared operation-run model, with protected start/read routes and an operator-facing run panel that snapshots per-candidate readiness without starting downloads.
- Import execution runs now also enqueue unlocked files to slskd for operator-selected candidates, while persisting queued, queued-with-warnings, blocked, and enqueue-failed outcomes through the shared execution-run surface.
- The import execution summary now also reconciles persisted enqueue results against live slskd transfer detail, so operators can see queued, active, completed, failed, and percent-complete transfer state without leaving the review workflow.
- Import candidate workflow state now also advances durably from `selected` into `downloading`, `failed`, and `import_pending` through shared execution services, so completed slskd transfers can be persisted back into Harmoniarr instead of remaining live-read-only observations.
- Import execution reconciliation now also falls back to the `includeRemoved` slskd download listing when per-transfer detail disappears, and only marks a transfer orphaned after a configurable grace window when it still cannot be found.
- The slskd boundary now also owns a shared transfer snapshot service that batches `getDownloads({ includeRemoved: true })` lookups by username, and the execution summary reuses that indexed snapshot instead of issuing per-transfer detail reads.
- Import execution reconciliation now also persists a lightweight last-seen transfer snapshot onto each execution run item when live transfer detail is still present, so operator-facing audit survives later slskd eviction without turning the execution summary read model into a write path.
- Missing-transfer grace now also keys off persisted execution timestamps such as the latest live transfer sighting or original enqueue request, instead of the run-item row update clock, so later snapshot writes do not accidentally extend orphan detection.
- Import execution reconciliation now also persists explicit missing-transfer state, including `missingSince` and `lastCheckedAt`, onto execution run items when slskd transfers disappear, so repeated orphan checks remain durable and operator-facing review can show the last observed disappearance timeline.
- The execution summary read model now also exposes normalized persisted transfer observation and missing-transfer fields per run item, so the client can render durable execution state without reaching into raw execution snapshot internals.
- The import workflow now also exposes a dedicated `import_pending` summary route and shared read model, so completed downloads can be reviewed as a distinct import-ready stage with the same staging and path-preview evidence reused from the existing preview service.
- Import-pending candidates now also expose a dedicated apply-preview service and protected detail route, reusing shared planning preview output to surface missing-source files, target collisions, and guarded import-readiness evidence before any filesystem mutation exists.
- The import workflow now also persists durable import-apply runs for `import_pending` candidates, using a guarded shared mutation service plus protected start/read routes to stage exclusive file moves, preserve per-file outcomes, and only transition candidates to `applied` after successful library finalize steps.
- The import workflow now also persists durable `import_operations` history for each apply-stage filesystem step, keyed to apply runs plus candidate-file identities so stage/finalize, failed, and not-attempted outcomes remain auditable beyond run snapshots.
- Import-pending collision review now also persists explicit per-file skip decisions keyed to candidate-file identity, reusing the apply-preview seam to convert reviewed collisions into warning-level skips and durable `skipped` apply history without allowing overwrite behavior.
- Server startup now also owns a small in-process import execution reconciliation heartbeat that periodically reuses the shared execution summary plus reconciliation service to persist `downloading`, `failed`, and `import_pending` transitions without requiring a manual route trigger.
- Settings now allow explicit slskd-to-Harmoniarr download path mappings, and the import planning preview resolves candidate paths through that shared mapping service before falling back to legacy downloads-root assumptions.
- The shared settings boundary now also returns non-destructive path validation status for local roots and download mappings, giving the settings UI immediate health feedback without introducing a separate ad hoc validation route.
- The anonymous bootstrap status boundary now reuses that shared path-validation summary during first-run setup, so onboarding surfaces the same lightweight preflight signal before the admin account is created.
- The protected dashboard now also consumes a dedicated onboarding summary boundary that turns shared path, slskd, migration, MusicBrainz, and worker checks into contextual next-step guidance instead of a separate setup wizard.
- The system boundary now also exposes a shared library-scan summary that derives first-scan readiness from path validation and latest durable scan-run state from operation history, so dashboard onboarding can move from infrastructure checks into existing-library status without inventing scan execution locally.
- A dedicated native ESM library module now owns library-scan run persistence, a thin background worker entrypoint, protected scan-start route wiring, and the dashboard start/rescan action so the existing-library status surface now launches real scan work instead of remaining passive.
- The library boundary now also exposes a shared reconciliation summary read service and protected route, and the dashboard consumes that dedicated summary through a separate composable and panel instead of folding release-coverage state into the system overview surface.
- The metadata boundary now also owns a canonical artist-monitoring baseline through a shared monitoring store/service, protected artist monitoring route, and metadata workspace toggle, establishing the prerequisite state needed before wanted reconciliation can be implemented safely.
- The library boundary now also recalculates a release-level wanted projection for monitored album and EP releases after library reconciliation, and the dashboard exposes that shared wanted summary through a dedicated route, composable, and panel.
- The library boundary now also recalculates a durable discovery-intent projection from wanted releases, exposing release-date and cooldown eligibility through a shared summary route and dashboard panel before real search dispatch exists.
- The library boundary now also dispatches ready automatic discovery requests through shared slskd and import-candidate services at the end of library scan reconciliation, recording search attempts and cooldown state without introducing a second search workflow surface.
- The library boundary now also exposes a dedicated discovery-run worker and protected manual trigger backed by shared operation-run storage, so discovery dispatch can be started independently of a full library scan while keeping the same queue and import seams.
- Server startup now also owns a small in-process discovery heartbeat that periodically starts the shared discovery-run service, so dispatch cadence is no longer tied to the library scan worker.
- Discovery heartbeat cadence now comes from a shared environment-backed config helper and is surfaced through both the discovery summary payload and protected system overview, so automatic execution is visible to operators instead of remaining implicit startup behavior.
- Startup-owned discovery and import-execution heartbeats now also share a small interval-runner utility for `setInterval` lifecycle, `unref()`, and no-overlap guards, while keeping each heartbeat's due-check and outcome-recording logic inside its own module.
- Startup-owned discovery and import-execution heartbeats now also share a small heartbeat-state helper for common outcome timestamps, skip/error metadata, and last-triggered tracking, while heartbeat-specific state such as transition counts remains an explicit module-level extension.
- Startup-owned discovery and import-execution heartbeats now also share a small interval-config helper for environment-backed cadence parsing and human-readable interval labels, while each heartbeat module still owns its env var name and default cadence.
- Process startup now also uses a small shared service supervisor to register long-lived background services, start them in one place, and own graceful signal-driven shutdown ordering instead of wiring each startup-owned service directly inside `index.js`.
- Process startup now also uses a dedicated startup-runtime helper so the real server composition path, service registration, listen callback, and graceful shutdown behavior can be tested without turning `index.js` into an orchestration blob.
- Process-owned server entrypoints now also share a small prefixed runtime reporter for stdout/stderr lines and unknown-error formatting, while each caller still owns its domain-specific message text.
- Process-owned migration entrypoints now also share a small async CLI runtime helper for task execution, failure exit-code handling, and always-run cleanup, while each script still owns its task function and success message.
- Process-owned migration entrypoints now also share a migration-specific CLI composition helper for the remaining reporter/pool-cleanup wiring, leaving each script with only its prefix, migration task, and success-message rendering.
- Repo-maintenance validation scripts under `scripts/` now also share a small scripts-local CLI runtime helper for prefixed operator-facing success/error reporting and graceful non-zero exit handling, leaving each entrypoint with only its validation task and success-message rendering.
- Repo-maintenance scripts that invoke external tooling now also share a buffered process runner for captured stdout/stderr, exit-code enforcement, and Windows-safe command execution, so npm audit, Docker smoke validation, and release-mirror verification no longer each carry their own child-process wrapper.
- Repo-maintenance copyright entrypoints now also share a small copyright-maintenance helper aligned to the real `src/server`, `src/client`, and migration layout, including Vue, HTML, and CSS client sources, while `create-migration.js` reuses the same scripts-local runtime with raw stdout so filename-only tooling output survives shared graceful failure handling.
- Repo-maintenance ESM enforcement now also routes through a small helper that scans Vue SFC `<script>` and `<script setup>` blocks in addition to plain `.js` files, so the client runtime cannot bypass the repo's native-ESM guardrails.
- Repo-level validation now runs through a single `npm run validate` contract that composes copyright, migration filename, ESM, test, and build checks, and the existing GitHub Actions workflow now reuses that same command instead of maintaining a separate CI-only check list.
- CI validation now also replays the built migration CLI against a disposable PostgreSQL service through a shared `npm run validate:database` contract, and the shared database env boundary now honors standard password env so the same native ESM runtime can connect safely in CI and future external-Postgres deployments.
- PostgreSQL-backed validation now also waits for a real authenticated query through a shared `npm run wait:database` script before replaying migrations, avoiding the transient init-server readiness window that can satisfy weaker socket-only probes before the final TCP listener is actually usable.
- Migration lineage now also generates a deterministic executable schema snapshot at `src/server/schema-snapshot.sql` through shared migration-manifest and schema-snapshot helpers, and validation now blocks stale snapshots in the same local/CI contract that already enforces filenames, ESM, tests, and builds.
- Repo runtime policy is now explicit through `packageManager`, `engines`, `devEngines`, and `.nvmrc`, so local development and GitHub Actions share a single Node 24 plus npm 11 expectation instead of relying on whatever host toolchain happens to be installed.
- Fresh-install startup can now detect an empty public schema, load the checked-in snapshot through a shared schema-bootstrap helper, and then fall through to the existing migration verifier so bootstrap and upgrade paths stay on the same lineage contract instead of diverging.
- Database validation now also proves the snapshot consumption path by creating a disposable database, loading the checked-in snapshot, and asserting that no migrations remain pending, all through the same shared `npm run validate:database` contract already used by CI.
- Docker fresh-install parity now reuses a shared database-preparation service and passes an executable Compose smoke test, and the default Compose baseline now carries the non-root `PUID`/`PGID` contract through `user:` instead of relying on runtime privilege dropping.
- The default Compose baselines now also run with `read_only: true`, the Docker smoke validator proves the container really started with a read-only root filesystem, and Dependabot now raises reviewable update PRs for npm dependencies, Dockerfile bases, Compose image tags, and pinned GitHub Actions.
- The repo now also enforces explicit Compose image version pins through a shared local script, the checked-in `slskd` example no longer floats on `latest`, and a dedicated GitHub Actions security workflow runs npm audit, OSV, Trivy config scanning, and Trivy-backed secret scanning.
- The repo now also emits supply-chain metadata through a dedicated GitHub Actions workflow that builds the distributable artifacts, generates an SPDX SBOM, submits dependency snapshots to GitHub, and attests the built outputs plus emitted SBOM for public-repo runs; release guidance now also distinguishes checked-in version pins from post-publish digest pins.
- Published GitHub releases now also run through a dedicated GHCR image workflow that builds and pushes the multi-architecture container image, records the immutable digest for operator consumption, publishes an SPDX SBOM release asset, and attaches a release verification note with concrete attestation commands.
- Release publication policy now also routes canonical-vs-mirror registry behavior through a shared native ESM registry-capability helper, so GHCR trust metadata, Docker Hub mirror constraints, and a future ORAS-backed referrer-copy promotion path can evolve without re-encoding registry behavior across scripts.
- Release-registry planning now also returns structured canonical and mirror bindings, including capability and credential expectations, and the existing GitHub-output writer publishes those plan keys for workflow consumers instead of requiring each release step to rediscover registry roles.
- Release-registry planning now also carries ORAS-ready referrers distribution-spec guidance per registry, and the registry-config writer exports canonical and Docker Hub referrers-mode fields so a future trusted-mirror workflow can choose `v1.1-referrers-api` versus `v1.1-referrers-tag` without rebuilding registry compatibility logic.
- Trusted-mirror groundwork now also includes shared registry-auth resolution plus ORAS discover/copy helpers with Docker Hub fallback handling, and thin script entrypoints exist for recursive mirror promotion and canonical-vs-mirror referrer verification without introducing workflow-local shell composition.
- Trusted-mirror execution now also includes a lightweight ORAS discovery probe ahead of mirror promotion, so the release workflow records which referrers distribution-spec mode the target registry actually accepted instead of relying only on static Docker Hub fallback assumptions.
- The release-image workflow now also has focused contract coverage for the trusted-mirror path, including the probe step id, shared env boundary, downstream promotion and verification commands, and summary wiring, so future workflow edits cannot silently drift away from the shared ESM release scripts.
- Release validation now also has a fixture-driven workflow-composition test that writes real `GITHUB_OUTPUT`-style files, generates the release metadata assets, and verifies the release contract from those emitted values, so the shared script boundary is executable locally without needing a live GitHub Actions run.
- Release-facing script outputs now also route through a shared native ESM GitHub environment-file helper, so structured `GITHUB_OUTPUT` emission, UTF-8 writes, and multiline heredoc formatting are no longer reimplemented separately across registry-plan and trusted-mirror probe scripts.
- GitHub Actions Markdown summary generation now also has a shared native ESM helper for script-owned summaries, and Docker Hub maintenance reuses it for UTF-8 summary writes plus bullet-list rendering instead of maintaining a one-off append routine.
- Release and container-maintenance workflows now also delegate their remaining summary blocks to thin Node entrypoints backed by the shared summary helper, so workflow YAML no longer owns those Markdown layouts directly and the summary contract is testable in the same ESM layer as the release scripts.
- Workflow-facing scripts now also share a small native ESM environment helper for trimmed required/optional env access and boolean parsing, so release metadata writers, registry-plan probes, mirror verification entrypoints, maintenance scripts, and workflow summary scripts no longer each carry their own env-reading helpers.
- Workflow-facing script entrypoints now also share a small native ESM direct-execution helper that prefers `import.meta.main` when the active Node runtime exposes it and otherwise falls back to the existing `process.argv[1]` plus `pathToFileURL()` comparison, so release, maintenance, smoke-validation, and database-wait scripts no longer duplicate their main-module guard.
- Script entrypoints under `scripts/` now also share a direct-entrypoint runner in `scripts/script-runtime.js`, so validation, release, maintenance, migration, schema-bootstrap, and workflow-summary CLIs all reuse the same import-safe `runDirectScriptTask(import.meta, ...)` boundary instead of mixing top-level side effects with hand-written `runScriptTask` wrappers.
- Script entrypoints that still need positional CLI input now also share a small native ESM `util.parseArgs` wrapper in `scripts/script-arguments.js`, so workflow-summary kinds and migration descriptions no longer read `process.argv` directly outside a single tested argument boundary.
- Script-facing input resolution now also shares a small native ESM helper layer in `scripts/script-input-resolution.js`, so trimmed string lookup, boolean/env fallback, required string-list handling, and strict option parsing with optional positionals no longer need to be reimplemented across release and maintenance entrypoints.
- Release-facing workflow scripts now also share a typed CLI-plus-env input helper in `scripts/release-script-inputs.js`, so registry-plan, release-contract, release-metadata, and trusted-mirror entrypoints can accept strict native `util.parseArgs` options for local/operator use while preserving the existing environment-driven GitHub Actions contract.
- Workflow summary and container-maintenance entrypoints now also share typed CLI-plus-env input helpers in `scripts/workflow-summary-inputs.js` and `scripts/container-maintenance-inputs.js`, so release-summary and Docker Hub maintenance scripts can accept strict native flags for local/operator runs while reusing the same env-driven workflow contract in GitHub Actions.
- The release and maintenance script layer now also has a documented native Node local replay path in `docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md`, so operators can preflight registry-plan, metadata, contract, trusted-mirror, summary, and Docker Hub maintenance commands with layered `--env-file` inputs and local GitHub output files instead of waiting for the first GitHub Actions execution.
- Release publication now also reuses a shared Docker smoke validator to verify the published immutable image against both fresh-install and existing-data startup paths, emits a machine-readable release manifest asset, records GHCR as the canonical provenance and attestation trust boundary by default, verifies Docker Hub as an optional digest-parity mirror by default, can opt into ORAS-backed trusted mirror promotion plus referrer verification when explicitly configured, publishes a ready-to-use immutable Compose override asset for operators, mirrors release tags to Docker Hub through GitHub-stored Docker credentials, and schedules stale-image cleanup for both registries.
- The protected system overview now reuses that same shared validation boundary to surface a lightweight path-validation summary on the dashboard instead of building a second health-check model.
- Local metadata read and search routes now exist for imported artists, release groups, and releases, and substring search groundwork is in place through a timestamped `pg_trgm` index migration.
- A native Node.js test runner is now wired into the repo, with executable coverage around the shared local metadata search service, local-search workflow modules, the artist and release workflow local-first behaviors, and broader route-level metadata HTTP contracts backed by a shared native HTTP test helper.
- This file is the operational execution tracker for the initial V1 build.

## Component Task Lists

These companion docs break the implementation plan into component-specific execution tracks:

- `docs/SCHEMA_MIGRATION_TASK_LIST.md`
- `docs/API_ROUTE_CONTRACT_TASK_LIST.md`
- `docs/FRONTEND_SCREEN_NAV_TASK_LIST.md`
- `docs/RELEASE_VALIDATION_TASK_LIST.md`
- `docs/DEFERRED_V1_1_TASK_LIST.md`

## Implementation Start Gate

Before implementation starts in earnest, confirm all of the following:

- [ ] Review `docs/harmoniarr.md` implementation plan section end to end.
- [ ] Confirm `docs/SECURITY_POLICY.md` remains the authoritative source for auth, secret handling, and recovery-sensitive controls.
- [ ] Confirm `docs/BACKUP_RESTORE_DESIGN.md` remains the authoritative source for maintenance locks, backup/export, and restore semantics.
- [ ] Confirm `docs/ADMIN_RECOVERY_RUNBOOK.md` remains aligned with planned bootstrap-admin recovery behavior.
- [ ] Confirm `docs/DATABASE_MODEL.md` includes the minimum V1 tables and relationships needed for the first migration package.
- [x] Lock timestamp-based migration naming and schema snapshot update expectations.
- [ ] Lock route contract rules: validation, normalized success/error payloads, audit expectations, and idempotency expectations.
- [ ] Lock workflow state-machine vocabulary for import review, job execution, restore operations, and maintenance mode.
- [ ] Confirm destructive media actions remain preview-first and operator-gated.

## Phase Mapping (Plan To Task List)

The implementation plan is the architecture and sequencing source of truth. This file is the execution tracker.

| Implementation plan phase | Task list phase |
|---|---|
| Phase 0 - Alignment, Contract Freeze, And Execution Gates | Phase 0 - Prep and Alignment |
| Phase 1 - Platform Bootstrap, Runtime Shell, And Persistence Foundation | Phase 1 - Bootstrap, Packaging, and Schema Foundation |
| Phase 2 - Authentication, Authorization, Settings, And Control-Plane Basics | Phase 2 - Auth, Sessions, and Settings Contracts |
| Phase 3 - Canonical Music Model, Import Discovery, And Review-First Workflow State | Phase 3 - Canonical Model and Import Review |
| Phase 4 - Background Jobs, Media Operations, And Notification Surfaces | Phase 4 - Jobs, Media Operations, and Notifications |
| Phase 5 - Recovery, Backup/Restore, Diagnostics, And Operational Hardening | Phase 5 - Recovery, Restore, and Diagnostics |
| Phase 6 - Testing, Packaging, Upgrade Safety, And V1 Release Closure | Phase 6 - Validation, Release, and Closure |

## Critical Path

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4 and Phase 5 after Phase 3 contracts stabilize
6. Phase 6

Parallelizable after contract stabilization:

- Frontend app-shell work during late Phase 1.
- Backup/restore UI scaffolding during Phase 5 after maintenance-lock schema and route contracts are fixed.
- README and packaging-document updates during Phase 6, but not marked complete until validation gates pass.

## Phase 0 - Prep and Alignment

- [ ] Confirm V1 scope boundaries in `docs/harmoniarr.md` are accepted with no unresolved blockers.
- [ ] Record any explicit V1 deferrals or out-of-scope decisions as durable documentation rather than implicit assumptions.
- [ ] Confirm authoritative docs and ownership boundaries for security, backup/restore, admin recovery, and database model.
- [ ] Lock initial Docker-first deployment assumptions for embedded Postgres, persistent volumes, FFmpeg presence, and slskd dependency shape.
- [ ] Confirm no route group will ship without validation, normalized errors, audit rules, and permission requirements.
- [ ] Confirm no filesystem mutation path bypasses preview, logging, and operator confirmation rules.

## Phase 1 - Bootstrap, Packaging, And Schema Foundation

- [ ] Create server bootstrap skeleton with config loading, startup validation, logger wiring, and HTTP app construction.
- [ ] Add fail-closed startup checks for required directories, secrets, database reachability, and invalid configuration combinations.
- [ ] Create base repository/module structure for routes, validators, services, repositories, jobs, adapters, and shared utilities.
- [x] Add initial database connection layer and migration runner.
- [x] Create first migration package for users, refresh tokens, settings/config, audit events, maintenance locks, operation runs, and job leases.
- [x] Add health and readiness endpoints with structured status payloads.
- [x] Create initial Vue app shell, router, API client, and guarded bootstrap state.
- [x] Add initial Docker image/build files and compose layout for app container, embedded Postgres persistence, and startup ordering.
- [ ] Verify FFmpeg and required media inspection tooling are present in the standard image.
- [x] Update schema snapshot/documentation once the initial migration package is stable.

## Phase 2 - Auth, Sessions, And Settings Contracts

- [x] Implement bootstrap-admin creation flow for first-run setup.
- [ ] Implement password hashing, login, logout, refresh-token rotation, session invalidation, and forced re-auth behavior.
- [x] Add CSRF protection for cookie-authenticated write routes.
- [ ] Implement route-tier enforcement for anonymous, authenticated, privileged, maintenance-locked, and integration-key contexts.
- [ ] Implement settings/config service with allowlisted keys, validation, normalization, masking, and audit logging.
- [ ] Extend allowlisted settings with artwork-fetch, extraction, derivative, and cleanup controls needed before artwork workers ship.
- [ ] Implement API key create/rotate/revoke flows for integrations.
- [ ] Add frontend login, bootstrap-admin, and session-expiry flows.
- [ ] Add frontend settings surfaces for core system config, secret entry, and validation feedback.
- [ ] Verify secrets never round-trip in plaintext after initial write.
- [ ] Verify admin recovery assumptions remain compatible with `docs/ADMIN_RECOVERY_RUNBOOK.md`.

## Phase 3 - Canonical Model And Import Review

- [ ] Create canonical artist, release, release group, track, file, external-identity, import-candidate, and review-decision data models.
- [ ] Add artwork asset, artwork assignment, and observed file-tag tables as part of the first canonical metadata expansion beyond the auth/platform foundation.
- [x] Implement MusicBrainz-first identity normalization and provenance storage for canonical metadata imports.
- [x] Add local metadata read and search surfaces for imported artists, release groups, and releases so imported entities can be reopened without provider-first search.
- [x] Implement slskd adapter boundary with normalized request/result/error contracts.
- [x] Add authenticated slskd discovery routes for search start, polling, and response reads.
- [x] Add discovery/import candidate ingestion that stores normalized domain state separately from raw provider payloads.
- [x] Implement the import review state baseline with durable pending, held, selected, rejected, and reopen transitions, while reserving apply/download execution semantics for later slices.
- [x] Implement path mapping, staging resolution, root-folder policy, and naming-preview generation for the read-only import planning preview.
- [x] Build an initial frontend metadata workspace for provider search/import, local reopen, and local search over canonical metadata.
- [x] Build frontend review queue and candidate detail views with operator decision actions.
- [x] Verify no media mutation occurs yet; review state remains durable and replay-safe while the workflow stays preview-first.

## Phase 4 - Jobs, Media Operations, And Notifications

- [ ] Implement durable job queue, worker lease ownership, heartbeats, timeouts, cancellation, and retry contracts.
- [ ] Add execution paths for metadata refresh, import apply, rename/organize, media inspection, and notification fan-out.
- [ ] Implement guarded filesystem copy/move/link behavior with collision handling and post-action verification.
- [ ] Implement previewable rename and organize flows before apply operations.
- [ ] Add FFmpeg-backed inspection and initial transcoding orchestration with policy checks and explicit warnings.
- [ ] Enforce default retention of original lossless files and explicit warning flows for lossy-to-lossy or lossy-to-lossless cases.
- [ ] Add in-app operator notifications for queued work, failures, recoveries, and manual-intervention needs.
- [ ] Add job-history and job-detail UI surfaces with audit-friendly event views.

## Phase 5 - Recovery, Restore, And Diagnostics

- [ ] Implement backup/export manifests and artifact metadata per `docs/BACKUP_RESTORE_DESIGN.md`.
- [ ] Implement restore preview, restore apply, maintenance lock entry/exit, and restore operation-run/event history.
- [ ] Implement bootstrap-admin recovery issuance, verification, use, cancellation, and audit evidence handling.
- [ ] Add control-plane diagnostics for health, queue state, failed jobs, maintenance state, and recent privileged actions.
- [ ] Enforce redaction rules for logs, diagnostics, exported evidence, and operator-visible payloads.
- [x] Add failure classification for external dependencies such as slskd and metadata providers.
- [ ] Verify maintenance locks pause unsafe writes and background work consistently.
- [ ] Add frontend surfaces for backup/export, restore preview/apply, maintenance state, and diagnostics history.

## Phase 6 - Validation, Release, And Closure

- [ ] Add unit tests for validators, service rules, workflow-state logic, and normalization helpers.
- [ ] Add integration tests for auth/session flows, settings contracts, import review, job ownership, and recovery operations.
- [ ] Add route-contract tests for normalized success/error payloads and permission enforcement.
- [ ] Keep ESM-only enforcement active in validation and CI so new CommonJS patterns do not regress into runtime code or scripts.
- [x] Add migration replay and schema snapshot validation.
- [ ] Add end-to-end UI coverage for bootstrap, login, settings, review queue, job feedback, and recovery-sensitive flows where practical.
- [ ] Add fixture packs for canonical music identity, import review states, file-operation edge cases, auth failures, and restore/recovery scenarios.
- [ ] Validate fresh install, upgrade, restore preview/apply, and rollback-aware deployment behavior.
- [ ] Finalize Docker artifacts, README/doc index updates, compose examples, and operator setup guidance.
- [ ] Record V1 no-go conditions, smoke-test checklist, and release sign-off criteria.

## Dependencies

1. Phase 1 depends on Phase 0.
2. Phase 2 depends on Phase 1.
3. Phase 3 depends on Phases 1 and 2.
4. Phase 4 depends on Phase 3.
5. Phase 5 depends on Phases 2 through 4.
6. Phase 6 depends on Phases 1 through 5.

## Definition Of Done

- [ ] Fresh install reaches guarded bootstrap flow and completes initial admin setup successfully.
- [ ] Auth, session, settings, and audit contracts are stable and tested.
- [ ] Import candidates can be reviewed and applied through durable workflow state.
- [ ] Filesystem mutation and transcoding behavior are previewable, auditable, and operator-gated.
- [ ] Backup/restore, maintenance locks, and admin recovery are implemented and documented coherently.
- [ ] Critical-path validation passes for fresh install, upgrade, and restore scenarios.
- [ ] Documentation, packaging, and shipped runtime behavior are synchronized.

## Follow-Up Component Rule

- [ ] Keep the component task lists synchronized with this phase tracker whenever scope, sequencing, or acceptance rules change.

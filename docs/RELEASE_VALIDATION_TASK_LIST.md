# Harmoniarr Release And Validation Task List

Implementation source: `docs/harmoniarr.md`
Master execution tracker: `docs/IMPLEMENTATION_TASK_LIST.md`
Recovery source: `docs/BACKUP_RESTORE_DESIGN.md`
Security source: `docs/SECURITY_POLICY.md`
Issue #4 platform evidence map: `docs/ISSUE_4_RELEASE_VALIDATION_EVIDENCE.md`

## Current Status (2026-06-27)

- Validation and release closure are listed in the main plan, but the go/no-go pack is not split into an execution checklist.
- This file tracks the release-readiness, validation, packaging, and operational smoke-test component of V1.

## Pre-Flight Readiness

- [ ] Confirm supported runtime, Docker, and PostgreSQL baseline versions are still current for V1.
- [ ] Confirm required dependencies are installed in the standard image and documented.
- [ ] Confirm migration lineage, schema snapshot, and startup validation behavior are stable.
- [ ] Confirm release notes, README, and documentation index obligations are identified before closure.

## Test And Validation Gates

- [ ] Use `docs/ISSUE_4_RELEASE_VALIDATION_EVIDENCE.md` to confirm each shipped Issue #4 platform step has focused tests, browser scenarios, schema evidence, and release evidence tasks before closing release readiness.
- [ ] Run unit tests for validators, service logic, and normalization helpers.
- [ ] Run integration tests for auth/session, settings, import review, jobs, and recovery-sensitive operations.
	- Native integration coverage now also exercises the public app-user claim completion route end to end against the real HTTP and database-backed server graph, including admin-issued claim code creation, no auto-login on completion, and a subsequent normal login with the claimed password.
	- Native integration coverage now also proves delegated Request Music creation, target-user scoped inbox summary and list reads, linked import-candidate fulfillment projection, notification feed derivation, and delegated import-candidate visibility through the real HTTP and database-backed server graph.
	- The repository validation workflow now provisions a PostgreSQL service for `npm run validate`, so the shared integration suite can execute against a real external PostgreSQL runtime in CI instead of skipping when no container runtime is available inside the job.
	- The shared Docker smoke contract now also proves one packaged-runtime delegated Request Music journey by creating a target requester, submitting an admin-on-behalf request, and verifying target-user scoped summary, list, and notification visibility through the running container.
	- Remaining work is broader packaged-runtime execution beyond the queued delegated-request seam, so the release pack also captures linked fulfillment and adjacent operator-path evidence instead of only native server-graph proof.
- [ ] Run route-contract validation for normalized payloads and permission failures.
	- Native integration coverage now also exercises the delegated Request Music scope contract end to end by showing that non-admin `scope=all` requests are forced back to `mine`, linked import candidates stay target-user visible, and unrelated import candidates fail closed as not found.
- [x] Run migration replay and schema snapshot validation.
- [x] Run UI/end-to-end coverage for bootstrap, login, settings, review queue, jobs/history, and restore preview/apply where practical.
	- Packaged-runtime browser smoke now covers login, Settings, Activity Background Jobs, Import Review candidates, Recovery Backups, backup creation, and restore-preview readiness against the Docker walkthrough stack with JSON plus screenshot evidence.
	- Native ESM browser smoke coverage now also exercises bootstrap, login, settings, review queue, jobs/history, and recovery backup preview through a real temporary PostgreSQL-backed app runtime using Playwright as the browser engine while keeping the repository on `node:test`; remaining work is any restore-apply mutation proof the release wants beyond preview-plus-confirmation gating.
	- Native Issue #4 browser visual evidence now captures Library grid/list display modes, Needs Attention actions, Discover recommendations, populated requester Home, and mobile navigation to `artifacts/browser-visual-evidence/issue-4-media-surfaces/` during `test/browser/issue-4-visual-evidence.test.js`; remaining work is archiving those screenshots from a release run.

## Deployment-Path Validation

- [x] Validate fresh install on the standard Docker deployment path.
	- The shared Docker smoke validator now also bootstraps a target requester, submits a delegated Request Music item, and verifies target-user scoped summary, list, and notification visibility through the packaged runtime.
	- `npm run validate:docker-deployment-path` now orchestrates the live fresh-install contract plus optional released-image and upgrade-path checks from one ESM entrypoint, writing stable evidence filenames into `HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR` when that directory is configured.
	- Live Docker-backed execution passed on 2026-06-27 for the local workspace image path and wrote verified fresh-install evidence under `.tmp/docker-deployment-evidence`. See `docs/DOCKER_BACKED_DEPLOYMENT_PATH_VALIDATION_EXECUTION.md`.
	- Live released-image execution passed on 2026-06-27 for local tag `ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta` and wrote verified evidence under `.tmp/docker-release-upgrade-evidence`. See `docs/RELEASED_IMAGE_BASELINE_UPGRADE_EVIDENCE_EXECUTION.md`.
- [x] Validate fresh-install schema bootstrap against a disposable PostgreSQL database.
- [x] Validate upgrade from the prior accepted state or baseline image.
	- `npm run validate:docker-upgrade` now drives a baseline image followed by the candidate image against the same bind-mounted state, proving post-upgrade startup plus persisted settings continuity through the shared smoke contract.
	- The `release-image` workflow now also exposes an optional `baseline_image` dispatch input, falls back to repository variable `DOCKER_UPGRADE_BASELINE_IMAGE`, and uploads `harmoniarr-docker-smoke-upgrade-path.json` when published-image upgrade validation runs in CI.
	- Live local-tag upgrade execution passed on 2026-06-27 from `harmoniarr-walkthrough:latest` to `ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta`, with verified upgrade-path evidence under `.tmp/docker-release-upgrade-evidence`. Final release closure should repeat with registry-authenticated immutable digest refs because GHCR digest access returned `denied` in the local environment.
- [x] Validate startup refusal on incompatible or unsafe configuration states.
	- The shared Docker smoke contract now includes a fail-closed invalid-startup scenario using `docker compose up --abort-on-container-failure --exit-code-from harmoniarr`, asserting both service exit code `1` and the expected startup-refusal log message for an invalid bootstrap-owner configuration.
	- Live Docker-backed execution passed on 2026-06-27 through `npm run validate:docker-deployment-path`.
- [x] Validate embedded Postgres initialization, health reporting, and persistence behavior.
	- The shared Docker smoke contract now also asserts embedded PostgreSQL startup and database-preparation logs, runs in-container `pg_isready` plus `psql` identity checks while `/healthz` is passing, and verifies restart persistence with a disposable SQL probe row before accepting the existing-data restart path.
	- Live Docker-backed execution passed on 2026-06-27 through `npm run validate:docker-deployment-path`.
- [x] Validate FFmpeg/tooling availability in the running image.

## Recovery And Safety Validation

- [x] Validate backup/export creation and artifact inspection.
	- `npm run validate:docker-fresh-install` and `npm run validate:docker-released-image` now bootstrap an admin session inside the running container, create a backup artifact, and verify inventory plus detail reads through the shipped recovery routes.
	- Native integration coverage now also proves backup export creation plus artifact list or detail inspection against the real HTTP and database-backed recovery routes, so the remaining gap is packaged-runtime execution rather than missing server-graph proof.
	- Live Docker-backed execution passed on 2026-06-27 through `npm run validate:docker-deployment-path`.
- [x] Validate restore preview without unsafe side effects.
	- The shared smoke contract now verifies restore preview on the real running container both before and during an injected maintenance-lock conflict, asserting that the lock flips `blockedByLock` and prevents unsafe apply.
	- Native integration coverage now also proves restore preview returns `canApplyRestore=false` with `blockedByLock=true` under an injected maintenance lock and returns to ready state once the lock is released through the real HTTP and database-backed recovery routes.
	- Live Docker-backed execution passed on 2026-06-27 through `npm run validate:docker-deployment-path`.
- [x] Validate restore apply with maintenance locking and job pausing behavior.
	- The shared smoke contract now proves restore-apply rejection under an injected maintenance lock and then completes a successful restore-apply run after the lock is released, asserting the returned run metadata and that no active locks remain afterward.
	- Automatic import-reconciliation, library-discovery, and metadata-refresh heartbeats now also pause under blocking maintenance locks and surface that paused state through the existing operator heartbeat diagnostics.
	- The shared startup queue dispatcher now also pauses new operation-run claims under blocking maintenance locks and surfaces that paused dispatcher state through queue diagnostics.
	- In-flight queue workers now also pause and requeue safely under blocking maintenance locks, releasing their leases as `paused` and preserving retry budget while the lock remains active.
	- Focused native `node:test` coverage now proves the shared operation-pause readiness contract plus representative import-execution and library-scan worker requeue behavior in addition to the earlier discovery-worker proof.
	- Native integration coverage now also proves restore-apply rejection under a blocking maintenance lock and successful backed-up settings restoration after the lock is released, including completed `backup_restore_apply` run persistence and released maintenance-lock state through the real HTTP and database-backed recovery graph.
	- Live Docker-backed execution passed on 2026-06-27 through `npm run validate:docker-deployment-path`.
- [ ] Validate admin recovery flow against the documented runbook.
	- Native integration coverage now also proves the documented recovery runbook seam through the real database-backed `harmoniarrctl` arm/status/cancel commands, including force-required cancel behavior, force replacement of an armed run, and stable no-code status reads.
	- The public recovery lifecycle coverage now also verifies the documented post-recovery behavior that completion does not auto-login and that a fresh normal login succeeds afterward with the recovered credentials.
	- Remaining work is one live Docker-capable execution using the shipped `docker exec ... harmoniarrctl` wrapper so release evidence covers the packaged runtime rather than only the native server graph.
- [ ] Validate destructive filesystem actions stay preview-first and operator-gated.

## Security And Operational Validation

- [ ] Validate CSRF protection on cookie-authenticated write routes.
- [ ] Validate secret masking/redaction in settings, logs, diagnostics, and exports.
- [ ] Validate session expiry, token revocation, and forced re-auth behavior.
	- Native integration coverage now also proves the claim-completion path does not mint a new authenticated session cookie and still requires a fresh normal login afterward, complementing the existing refresh, logout, password-change, and recovery-session-revocation contracts.
	- The repository validation workflow now also supplies the PostgreSQL env contract needed for `npm run validate`, so these native auth and recovery integrations can run as part of normal CI rather than depending on local container availability.
- [ ] Validate maintenance-lock denial behavior for unsafe operations.
- [ ] Validate dependency-failure classification for slskd and metadata providers.
- [ ] Run a real release workflow execution with `DOCKERHUB_TRUSTED_MIRROR=true` and confirm the capability probe, ORAS recursive copy, and referrer-graph verification all succeed against the live registries.

## Packaging And Docs Closure

- [ ] Finalize Docker build artifacts and compose examples.
- [ ] Finalize environment reference and setup guidance.
- [ ] Update README and documentation index to match shipped V1 behavior.
- [ ] Prepare release notes and technical change summary.
- [ ] Record smoke-test commands and manual verification notes.
	- The Docker smoke scripts now optionally emit a machine-readable JSON evidence file when `HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH` is set, so release workflows and support diagnostics can archive the exact validated result instead of scraping console output.
	- The shared deployment-path wrapper now also gives operators one replayable command for live release evidence: it always runs fresh-install validation, adds released-image validation when `HARMONIARR_IMAGE` is set, and adds upgrade-path validation when `HARMONIARR_BASELINE_IMAGE` is set.
	- That same deployment-path wrapper now also supports `HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH`, writing one machine-readable summary artifact that records which checks ran, which were skipped, and which per-step evidence files were produced during the live run.
	- That machine-readable evidence path now also fail-closes on missing required validation sections for known smoke kinds, so fresh-install and released-image artifacts cannot silently omit packaged-runtime Request Music proof while still producing a JSON file.
	- The `release-image` workflow now also re-validates both published-image and upgrade-path smoke evidence files before uploading them as artifacts, so archived JSON proof follows the same shared contract checks as the writer instead of treating artifact presence alone as success.
	- The release-contract job now also downloads the archived published-image smoke artifact and re-verifies it before final release summary publication, so the consumer side fails closed if archived proof drifts from the expected shared contract.
	- When upgrade-path validation runs, the release-contract job now also downloads and re-verifies the archived upgrade smoke artifact before final summary publication, while still allowing the no-baseline release path to proceed cleanly when that optional job is skipped.
	- The release-image workflow now also writes and uploads `harmoniarr-docker-deployment-summary.json` from those archived smoke artifacts during release-contract verification, so one machine-readable artifact records the packaged-runtime deployment evidence set for the release run.
	- The `release-image` workflow now uses that same seam during published-image verification and uploads `harmoniarr-docker-smoke-released-image.json` as a workflow artifact so immutable-image smoke proof survives beyond the job log.
	- When a baseline immutable image is configured, the same workflow now also archives `harmoniarr-docker-smoke-upgrade-path.json` so upgrade-path evidence survives beyond the job log too.
	- Local combined deployment-path execution now produced and verified fresh-install, released-image, upgrade-path, and deployment-summary JSON under `.tmp/docker-release-upgrade-evidence`; final archived release proof still needs registry-authenticated immutable refs.
	- Local packaged-runtime browser-smoke execution now produced and verified `browser-operator-smoke` JSON plus seven checkpoint screenshots under `.tmp/docker-browser-smoke-evidence`; the release-image workflow now uploads `harmoniarr-docker-smoke-browser-screenshots` alongside the browser JSON artifact.
- [x] Document native local replay for release-image and container-maintenance workflow scripts with Node `--env-file` layering, local `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY` files, and trusted-mirror preflight commands.
- [ ] Document the promoted Docker Hub trusted-mirror flow, including the ORAS discovery probe, recursive artifact-copy step, and any OCI 1.1 referrers API versus referrers-tag behavior observed in the live release run.

## Go/No-Go Checklist

- [x] Fresh install passes.
- [x] Upgrade path passes.
- [x] Restore preview/apply path passes.
- [x] Critical-path tests pass.
- [ ] Docs and packaging match runtime behavior.
- [ ] No unresolved blocker remains for auth, import review, filesystem safety, or recovery behavior.

## Done Criteria

- [ ] V1 has an executable release-readiness checklist rather than implicit confidence.
- [ ] Validation covers fresh install, upgrade, restore, and critical operational safety paths.
- [ ] Packaging and documentation are synchronized with what actually ships.

# Harmoniarr Release And Validation Task List

Implementation source: `docs/harmoniarr.md`
Master execution tracker: `docs/IMPLEMENTATION_TASK_LIST.md`
Recovery source: `docs/BACKUP_RESTORE_DESIGN.md`
Security source: `docs/SECURITY_POLICY.md`

## Current Status (2026-04-27)

- Validation and release closure are listed in the main plan, but the go/no-go pack is not split into an execution checklist.
- This file tracks the release-readiness, validation, packaging, and operational smoke-test component of V1.

## Pre-Flight Readiness

- [ ] Confirm supported runtime, Docker, and PostgreSQL baseline versions are still current for V1.
- [ ] Confirm required dependencies are installed in the standard image and documented.
- [ ] Confirm migration lineage, schema snapshot, and startup validation behavior are stable.
- [ ] Confirm release notes, README, and documentation index obligations are identified before closure.

## Test And Validation Gates

- [ ] Run unit tests for validators, service logic, and normalization helpers.
- [ ] Run integration tests for auth/session, settings, import review, jobs, and recovery-sensitive operations.
	- Native integration coverage now also exercises the public app-user claim completion route end to end against the real HTTP and database-backed server graph, including admin-issued claim code creation, no auto-login on completion, and a subsequent normal login with the claimed password.
	- Native integration coverage now also proves delegated Request Music creation, target-user scoped inbox summary and list reads, linked import-candidate fulfillment projection, notification feed derivation, and delegated import-candidate visibility through the real HTTP and database-backed server graph.
	- The repository validation workflow now provisions a PostgreSQL service for `npm run validate`, so the shared integration suite can execute against a real external PostgreSQL runtime in CI instead of skipping when no container runtime is available inside the job.
	- Remaining work is packaged-runtime execution alongside the existing CI-backed run so the same coverage contributes release-image and operator-path evidence instead of only native server-graph proof.
- [ ] Run route-contract validation for normalized payloads and permission failures.
	- Native integration coverage now also exercises the delegated Request Music scope contract end to end by showing that non-admin `scope=all` requests are forced back to `mine`, linked import candidates stay target-user visible, and unrelated import candidates fail closed as not found.
- [x] Run migration replay and schema snapshot validation.
- [ ] Run UI/end-to-end coverage for bootstrap, login, settings, review queue, jobs/history, and restore preview/apply where practical.

## Deployment-Path Validation

- [ ] Validate fresh install on the standard Docker deployment path.
- [x] Validate fresh-install schema bootstrap against a disposable PostgreSQL database.
- [ ] Validate upgrade from the prior accepted state or baseline image.
	- `npm run validate:docker-upgrade` now drives a baseline image followed by the candidate image against the same bind-mounted state, proving post-upgrade startup plus persisted settings continuity through the shared smoke contract.
	- The `release-image` workflow now also exposes an optional `baseline_image` dispatch input, falls back to repository variable `DOCKER_UPGRADE_BASELINE_IMAGE`, and uploads `harmoniarr-docker-smoke-upgrade-path.json` when published-image upgrade validation runs in CI.
	- Remaining work is one live Docker-capable execution with `HARMONIARR_BASELINE_IMAGE` set to the prior accepted immutable image reference, plus any extra rollback-specific assertions the release wants beyond the current continuity probe.
- [ ] Validate startup refusal on incompatible or unsafe configuration states.
	- The shared Docker smoke contract now includes a fail-closed invalid-startup scenario using `docker compose up --abort-on-container-failure --exit-code-from harmoniarr`, asserting both service exit code `1` and the expected startup-refusal log message for an invalid bootstrap-owner configuration.
	- Remaining work is one live Docker-capable execution of `npm run validate:docker-fresh-install` or the released-image equivalent in an environment with a running Docker daemon.
- [ ] Validate embedded Postgres initialization, health reporting, and persistence behavior.
	- The shared Docker smoke contract now also asserts embedded PostgreSQL startup and database-preparation logs, runs in-container `pg_isready` plus `psql` identity checks while `/healthz` is passing, and verifies restart persistence with a disposable SQL probe row before accepting the existing-data restart path.
	- Remaining work is one live Docker-capable execution of the smoke contract in an environment with a running Docker daemon.
- [x] Validate FFmpeg/tooling availability in the running image.

## Recovery And Safety Validation

- [ ] Validate backup/export creation and artifact inspection.
	- `npm run validate:docker-fresh-install` and `npm run validate:docker-released-image` now bootstrap an admin session inside the running container, create a backup artifact, and verify inventory plus detail reads through the shipped recovery routes.
	- Native integration coverage now also proves backup export creation plus artifact list or detail inspection against the real HTTP and database-backed recovery routes, so the remaining gap is packaged-runtime execution rather than missing server-graph proof.
	- Remaining work is one live Docker-capable execution so the release evidence includes the real persisted artifact path and runtime-side payload handling.
- [ ] Validate restore preview without unsafe side effects.
	- The shared smoke contract now verifies restore preview on the real running container both before and during an injected maintenance-lock conflict, asserting that the lock flips `blockedByLock` and prevents unsafe apply.
	- Native integration coverage now also proves restore preview returns `canApplyRestore=false` with `blockedByLock=true` under an injected maintenance lock and returns to ready state once the lock is released through the real HTTP and database-backed recovery routes.
	- Remaining work is one live Docker-capable execution to capture evidence from the actual packaged runtime and operator filesystem layout.
- [ ] Validate restore apply with maintenance locking and job pausing behavior.
	- The shared smoke contract now proves restore-apply rejection under an injected maintenance lock and then completes a successful restore-apply run after the lock is released, asserting the returned run metadata and that no active locks remain afterward.
	- Automatic import-reconciliation, library-discovery, and metadata-refresh heartbeats now also pause under blocking maintenance locks and surface that paused state through the existing operator heartbeat diagnostics.
	- The shared startup queue dispatcher now also pauses new operation-run claims under blocking maintenance locks and surfaces that paused dispatcher state through queue diagnostics.
	- In-flight queue workers now also pause and requeue safely under blocking maintenance locks, releasing their leases as `paused` and preserving retry budget while the lock remains active.
	- Focused native `node:test` coverage now proves the shared operation-pause readiness contract plus representative import-execution and library-scan worker requeue behavior in addition to the earlier discovery-worker proof.
	- Native integration coverage now also proves restore-apply rejection under a blocking maintenance lock and successful backed-up settings restoration after the lock is released, including completed `backup_restore_apply` run persistence and released maintenance-lock state through the real HTTP and database-backed recovery graph.
	- Remaining work is one live Docker-capable execution to capture the same evidence from the packaged runtime and operator filesystem layout.
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
	- The `release-image` workflow now uses that same seam during published-image verification and uploads `harmoniarr-docker-smoke-released-image.json` as a workflow artifact so immutable-image smoke proof survives beyond the job log.
	- When a baseline immutable image is configured, the same workflow now also archives `harmoniarr-docker-smoke-upgrade-path.json` so upgrade-path evidence survives beyond the job log too.
- [x] Document native local replay for release-image and container-maintenance workflow scripts with Node `--env-file` layering, local `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY` files, and trusted-mirror preflight commands.
- [ ] Document the promoted Docker Hub trusted-mirror flow, including the ORAS discovery probe, recursive artifact-copy step, and any OCI 1.1 referrers API versus referrers-tag behavior observed in the live release run.

## Go/No-Go Checklist

- [ ] Fresh install passes.
- [ ] Upgrade path passes.
- [ ] Restore preview/apply path passes.
- [ ] Critical-path tests pass.
- [ ] Docs and packaging match runtime behavior.
- [ ] No unresolved blocker remains for auth, import review, filesystem safety, or recovery behavior.

## Done Criteria

- [ ] V1 has an executable release-readiness checklist rather than implicit confidence.
- [ ] Validation covers fresh install, upgrade, restore, and critical operational safety paths.
- [ ] Packaging and documentation are synchronized with what actually ships.

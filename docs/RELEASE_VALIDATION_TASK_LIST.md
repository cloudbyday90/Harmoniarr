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
- [ ] Run route-contract validation for normalized payloads and permission failures.
- [ ] Run migration replay and schema snapshot validation.
- [x] Run migration replay and schema snapshot validation.
- [ ] Run UI/end-to-end coverage for bootstrap, login, settings, review queue, jobs/history, and restore preview/apply where practical.

## Deployment-Path Validation

- [ ] Validate fresh install on the standard Docker deployment path.
- [x] Validate fresh-install schema bootstrap against a disposable PostgreSQL database.
- [ ] Validate upgrade from the prior accepted state or baseline image.
- [ ] Validate startup refusal on incompatible or unsafe configuration states.
	- The shared Docker smoke contract now includes a fail-closed invalid-startup scenario using `docker compose up --abort-on-container-failure --exit-code-from harmoniarr`, asserting both service exit code `1` and the expected startup-refusal log message for an invalid bootstrap-owner configuration.
	- Remaining work is one live Docker-capable execution of `npm run validate:docker-fresh-install` or the released-image equivalent in an environment with a running Docker daemon.
- [ ] Validate embedded Postgres initialization, health reporting, and persistence behavior.
- [x] Validate FFmpeg/tooling availability in the running image.

## Recovery And Safety Validation

- [ ] Validate backup/export creation and artifact inspection.
- [ ] Validate restore preview without unsafe side effects.
- [ ] Validate restore apply with maintenance locking and job pausing behavior.
- [ ] Validate admin recovery flow against the documented runbook.
- [ ] Validate destructive filesystem actions stay preview-first and operator-gated.

## Security And Operational Validation

- [ ] Validate CSRF protection on cookie-authenticated write routes.
- [ ] Validate secret masking/redaction in settings, logs, diagnostics, and exports.
- [ ] Validate session expiry, token revocation, and forced re-auth behavior.
- [ ] Validate maintenance-lock denial behavior for unsafe operations.
- [ ] Validate dependency-failure classification for slskd and metadata providers.
- [ ] Run a real release workflow execution with `DOCKERHUB_TRUSTED_MIRROR=true` and confirm the capability probe, ORAS recursive copy, and referrer-graph verification all succeed against the live registries.

## Packaging And Docs Closure

- [ ] Finalize Docker build artifacts and compose examples.
- [ ] Finalize environment reference and setup guidance.
- [ ] Update README and documentation index to match shipped V1 behavior.
- [ ] Prepare release notes and technical change summary.
- [ ] Record smoke-test commands and manual verification notes.
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

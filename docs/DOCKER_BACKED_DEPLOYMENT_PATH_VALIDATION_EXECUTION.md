# Docker-Backed Deployment-Path Validation Execution

Status: Implemented

## Context

The repository already had a shared Docker deployment-path validator. The
remaining release-readiness gap was live execution in a Docker-capable
environment with machine-readable evidence output and cleanup verification.

This run executed the validator locally on June 27, 2026 against the standard
`compose.yaml` deployment path using Docker 29.5.3 and Docker Compose v5.1.4.

## Official Guidance Reviewed

As of June 2026:

- Docker Compose documents isolated application stacks and lifecycle commands:
  <https://docs.docker.com/compose/>
- Docker Compose environment-variable interpolation is the authoritative source
  for required Compose variables:
  <https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/>
- Docker Build guidance recommends reproducible builds and controlled build
  inputs: <https://docs.docker.com/build/building/best-practices/>
- Docker Compose startup-order guidance recommends health-aware readiness over
  fixed sleeps: <https://docs.docker.com/compose/how-tos/startup-order/>
- OWASP Docker Security Cheat Sheet recommends least privilege, no unnecessary
  capabilities, and controlled secrets:
  <https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html>

## Recommendation

Use `npm run validate:docker-deployment-path` as the local replay command for
deployment-path evidence. Configure an evidence directory and summary manifest
so the run produces stable artifacts:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp\docker-deployment-evidence"
$env:HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH = ".tmp\docker-deployment-evidence\harmoniarr-docker-deployment-summary.json"
npm run generate:vapid-keys
# Set the generated VAPID_* values only in the current shell or secret store.
npm run validate:docker-deployment-path
```

Do not commit generated VAPID private keys or transient evidence files. Archive
the generated JSON evidence with the release workflow or external release
evidence store.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Run `validate:docker-deployment-path` locally | Exercises the same orchestration wrapper as release evidence; writes fresh-install evidence and summary manifest | Optional released-image and upgrade checks are skipped unless image refs are configured |
| Run only `validate:docker-fresh-install` | Shorter command and narrower output | Does not produce the deployment summary that records skipped optional validations |
| Run release workflow only | Best matches final published artifact flow | Slower feedback; requires registry/release credentials |
| Commit generated evidence JSON | Easy to inspect in repo | Evidence is environment-specific and should be archived as release artifacts instead |

## Execution

Command:

```powershell
npm run validate:docker-deployment-path
```

Environment:

- `HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR=.tmp\docker-deployment-evidence`
- `HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH=.tmp\docker-deployment-evidence\harmoniarr-docker-deployment-summary.json`
- `VAPID_CONTACT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` were generated
  for this validation shell only.

Initial run failed before container creation because the required Compose VAPID
variables were not set. After generating validation-only VAPID keys, the
deployment-path run passed.

Evidence generated:

- `.tmp\docker-deployment-evidence\harmoniarr-docker-deployment-summary.json`
- `.tmp\docker-deployment-evidence\harmoniarr-docker-smoke-fresh-install.json`

Evidence verification:

```powershell
npm run validate:docker-smoke-evidence
```

## Outcome

Passed:

- Fresh install on the standard Compose deployment path.
- Embedded PostgreSQL initialization and `/healthz` readiness.
- Migration state: `80 applied, 0 pending`.
- FFmpeg and FFprobe availability in the running image.
- Backup export creation and artifact inspection.
- Restore preview readiness and injected maintenance-lock conflict behavior.
- Restore apply completion after lock release.
- Existing-data restart with embedded PostgreSQL persistence.
- Delegated Request Music packaged-runtime smoke.
- Fail-closed startup refusal for invalid bootstrap-owner configuration.
- Docker cleanup: no `harmoniarrsmoke` containers or volumes remained after
  the run.

Skipped:

- Released-image validation, because `HARMONIARR_IMAGE` was not configured.
- Upgrade-path validation, because `HARMONIARR_BASELINE_IMAGE` was not
  configured.
- Browser smoke evidence, because this deployment-path run did not request the
  browser-smoke wrapper.

## Follow-Up

Released-image and baseline-upgrade evidence execution was completed as the
next slice with local image tags. See
`docs/RELEASED_IMAGE_BASELINE_UPGRADE_EVIDENCE_EXECUTION.md`.

The next high-value item is packaged-runtime browser-smoke execution against
the same released-image deployment stack, followed by a final registry-authenticated
immutable digest replay before release sign-off.

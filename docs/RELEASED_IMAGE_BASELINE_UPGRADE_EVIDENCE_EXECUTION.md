# Released-Image And Baseline-Upgrade Evidence Execution

Status: Implemented

## Context

The prior Docker deployment-path validation proved the local workspace image
fresh-install path but skipped the optional released-image and upgrade-path
checks because image references were not configured.

This run executed those remaining deployment-path checks locally on June 27,
2026 using Docker 29.5.3 and Docker Compose v5.1.4.

## Official Guidance Reviewed

As of June 2026:

- Docker Compose documents isolated stack lifecycle commands:
  <https://docs.docker.com/compose/>
- Docker Compose environment interpolation documents host-provided variables,
  including required variables used by `compose.yaml`:
  <https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/>
- Docker Build best practices recommend controlled build inputs and
  multi-stage runtime images:
  <https://docs.docker.com/build/building/best-practices/>
- Docker Compose startup-order guidance recommends health-aware readiness:
  <https://docs.docker.com/compose/how-tos/startup-order/>
- OWASP Docker Security Cheat Sheet recommends least privilege, avoiding
  unnecessary capabilities, and protecting secrets:
  <https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html>

## Recommendation

Use `npm run validate:docker-deployment-path` with all three evidence paths
enabled whenever release image refs are available:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp\docker-release-upgrade-evidence"
$env:HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH = ".tmp\docker-release-upgrade-evidence\harmoniarr-docker-deployment-summary.json"
$env:HARMONIARR_IMAGE = "ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta"
$env:HARMONIARR_BASELINE_IMAGE = "harmoniarr-walkthrough:latest"
npm run generate:vapid-keys
# Set the generated VAPID_* values only in this shell or a secret store.
npm run validate:docker-deployment-path
```

For final release closure, prefer registry-authenticated immutable digest
references. In this local run, `docker manifest inspect
ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta` and a digest-based Compose run were
denied by GHCR access, so the executable proof used the locally available tag
`ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta` plus baseline tag
`harmoniarr-walkthrough:latest`.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Run the combined deployment-path wrapper | Proves fresh install, released image, upgrade path, and summary writing through one command | Longest local runtime |
| Run released-image and upgrade scripts independently | Faster diagnosis and simpler failure isolation | Does not produce the combined deployment summary unless the wrapper also runs |
| Use local tags | Works without registry credentials when images are already present | Does not prove registry availability or immutable digest resolution |
| Use registry digest refs | Best release evidence for supply-chain traceability | Requires registry access and image availability |

## Final Recommendation Stack

- Keep `compose.yaml` as the canonical deployment path.
- Use `npm run validate:docker-deployment-path` as the release replay command.
- Use `HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR` and
  `HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH` for stable artifact paths.
- Use registry-authenticated immutable digest refs for final release evidence.
- Treat local tag-based validation as a useful executable rehearsal, not as a
  substitute for registry-pulled immutable proof.
- Keep VAPID values and transient evidence under shell-local environment or
  release artifact storage; do not commit generated secrets or `.tmp` evidence.

## Implementation Notes

The first combined run exposed a validator isolation bug: the fresh-install
step inherited `HARMONIARR_IMAGE` from the parent process. Because that step
builds the local image, Compose attempted to use the digest reference as a
build tag and failed before useful release evidence could run.

`scripts/docker-smoke-validation.js` now removes inherited
`HARMONIARR_IMAGE` from the generated Compose environment unless the caller
passes an explicit `imageRef`. Focused test coverage in
`test/scripts/docker-smoke-validation.test.js` proves that fresh-install builds
do not accidentally inherit a released-image ref, while explicit released-image
validation still receives the configured image ref.

## Execution

Combined command:

```powershell
npm run validate:docker-deployment-path
```

Environment:

- `HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR=.tmp\docker-release-upgrade-evidence`
- `HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH=.tmp\docker-release-upgrade-evidence\harmoniarr-docker-deployment-summary.json`
- `HARMONIARR_IMAGE=ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta`
- `HARMONIARR_BASELINE_IMAGE=harmoniarr-walkthrough:latest`
- `VAPID_CONTACT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` were generated
  for this validation shell only.

Evidence generated:

- `.tmp\docker-release-upgrade-evidence\harmoniarr-docker-smoke-fresh-install.json`
- `.tmp\docker-release-upgrade-evidence\harmoniarr-docker-smoke-released-image.json`
- `.tmp\docker-release-upgrade-evidence\harmoniarr-docker-smoke-upgrade-path.json`
- `.tmp\docker-release-upgrade-evidence\harmoniarr-docker-deployment-summary.json`

Each smoke evidence file was verified with `npm run
validate:docker-smoke-evidence`.

## Outcome

Passed:

- Fresh install on the standard Compose deployment path.
- Released-image smoke for `ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta`.
- Baseline-to-candidate upgrade smoke from `harmoniarr-walkthrough:latest` to
  `ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta`.
- Embedded PostgreSQL initialization, readiness, and restart persistence.
- Migration state: `80 applied, 0 pending`.
- FFmpeg and FFprobe availability in the running image.
- Backup export, restore preview/apply, and maintenance-lock conflict behavior.
- Delegated Request Music packaged-runtime smoke.
- Existing-data restart without snapshot re-bootstrap.
- Startup-refusal proof for invalid bootstrap-owner configuration.
- Docker cleanup: no `harmoniarrsmoke` or `harmoniarrupgrade` containers or
  volumes remained after the run.

Not proved:

- Remote GHCR digest pull/manifest availability for the release tag, because
  GHCR returned `denied` in this local environment.
- Browser-smoke evidence, because this deployment-path run did not request the
  browser-smoke wrapper.

## Follow-Up

Packaged-runtime browser-smoke execution was completed as the next slice. See
`docs/PACKAGED_RUNTIME_BROWSER_SMOKE_EXECUTION.md`.

The next high-value item is final registry-authenticated immutable replay:
repeat the deployment-path and browser-smoke evidence run with registry access
and digest refs, then archive the deployment summary, smoke JSON, and browser
screenshots together.

# Local Workflow Script Replay

The release-image and container-maintenance scripts under `scripts/` now support the same typed CLI-plus-environment contract locally that they use in GitHub Actions.

Use the native Node.js CLI for that local replay instead of adding a dotenv dependency or workflow-specific shell wrapper.

## Recommended Pattern

- Keep shared local defaults in an optional file such as `.env.local` and load it with `--env-file-if-exists`.
- Keep flow-specific values and secrets in an untracked file such as `.ops/release-image.env` or `.ops/container-maintenance.env` and load it with `--env-file`.
- Let the live shell environment win for one-off overrides. Node's current CLI contract keeps existing environment variables higher priority than env-file values, and later `--env-file` flags override earlier ones.
- Point `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY` at local scratch files when replaying steps that normally write GitHub workflow outputs.
- Create the parent directories for those scratch files before running the scripts.

Example layering pattern:

```powershell
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/write-release-metadata.js
```

## Release-Image Preflight

Use one env file for release-asset generation, release-contract verification, and release-summary rendering.

Suggested variables:

```dotenv
GITHUB_REPOSITORY=cloudbyday90/Harmoniarr
GITHUB_ACTOR=cloudbyday90
GITHUB_TOKEN=<ghcr-token-if-needed>
DOCKERHUB_USERNAME=<dockerhub-user-if-enabled>
DOCKERHUB_TOKEN=<dockerhub-token-if-enabled>

HARMONIARR_REPOSITORY_OWNER=cloudbyday90
HARMONIARR_REPOSITORY_NAME=Harmoniarr
HARMONIARR_ENABLE_DOCKERHUB=true
HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR=false
HARMONIARR_DOCKERHUB_NAMESPACE=cloudbyday90
HARMONIARR_DOCKERHUB_REPOSITORY=harmoniarr

HARMONIARR_RELEASE_TAG=v0.1.0-beta
HARMONIARR_RELEASE_VERSION=0.1.0-beta
HARMONIARR_RELEASE_DIGEST=sha256:<published-digest>
HARMONIARR_RELEASE_IMAGE_NAME=ghcr.io/cloudbyday90/harmoniarr
HARMONIARR_RELEASE_DOCKERHUB_IMAGE_NAME=cloudbyday90/harmoniarr
HARMONIARR_RELEASE_DOCKERHUB_TRUST_MODE=digest-parity
HARMONIARR_RELEASE_TAGS="v0.1.0-beta
latest"

HARMONIARR_RELEASE_ASSET_DIR=.tmp/release/assets
HARMONIARR_RELEASE_METADATA_PATH=.tmp/release/assets/harmoniarr-release-metadata.json
HARMONIARR_RELEASE_COMPOSE_OVERRIDE_PATH=.tmp/release/assets/harmoniarr-release-compose.override.yaml
HARMONIARR_RELEASE_VIEW_PATH=.tmp/release/release-view.json
HARMONIARR_RELEASE_EXPECTED_DIGEST=sha256:<published-digest>
HARMONIARR_RELEASE_EXPECTED_TAG=v0.1.0-beta
HARMONIARR_RELEASE_EXPECTED_VERSION=0.1.0-beta
HARMONIARR_RELEASE_EXPECTED_REPOSITORY=cloudbyday90/Harmoniarr
HARMONIARR_RELEASE_EXPECTED_IMAGE_NAME=ghcr.io/cloudbyday90/harmoniarr
HARMONIARR_RELEASE_EXPECTED_DOCKERHUB_IMAGE_NAME=cloudbyday90/harmoniarr
HARMONIARR_RELEASE_EXPECTED_DOCKERHUB_TRUST_MODE=digest-parity
HARMONIARR_RELEASE_MIRROR_KEY=dockerHub

HARMONIARR_SUMMARY_RELEASE_TAG=v0.1.0-beta
HARMONIARR_SUMMARY_IMAGE_REF=ghcr.io/cloudbyday90/harmoniarr@sha256:<published-digest>
HARMONIARR_SUMMARY_DOCKERHUB_IMAGE_NAME=cloudbyday90/harmoniarr
HARMONIARR_SUMMARY_SBOM_ASSET_NAME=harmoniarr-release.spdx.json
HARMONIARR_SUMMARY_METADATA_ASSET_NAME=harmoniarr-release-metadata.json
HARMONIARR_SUMMARY_COMPOSE_ASSET_NAME=harmoniarr-release-compose.override.yaml
HARMONIARR_SUMMARY_VERIFICATION_ASSET_NAME=harmoniarr-release-verification.txt
HARMONIARR_SUMMARY_TAGS="ghcr.io/cloudbyday90/harmoniarr:v0.1.0-beta
cloudbyday90/harmoniarr:v0.1.0-beta"
HARMONIARR_SUMMARY_ATTESTATION_STATUS=passed
HARMONIARR_SUMMARY_DOCKERHUB_MIRROR_STATUS=passed
HARMONIARR_SUMMARY_TRUSTED_MIRROR_PROBE_STATUS=not-requested
HARMONIARR_SUMMARY_TRUSTED_MIRROR_REFERRER_STATUS=not-requested

GITHUB_OUTPUT=.tmp/release/github-output.txt
GITHUB_STEP_SUMMARY=.tmp/release/summary.md
```

Common local commands:

```powershell
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/write-image-registry-config.js
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/write-release-metadata.js
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/verify-release-contract.js
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/release-workflow-summary.js publish-image
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/release-workflow-summary.js verify-release-contract
```

For one-off overrides, prefer CLI flags over editing the env file. Example:

```powershell
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/verify-release-contract.js --expected-dockerhub-trust-mode=trusted-mirror
```

## Trusted-Mirror Preflight

The trusted-mirror path uses the same release env file plus live registry credentials.

- GHCR auth uses `GITHUB_ACTOR` plus `GITHUB_TOKEN` when credentials are required for the local run.
- Docker Hub auth uses `DOCKERHUB_USERNAME` plus `DOCKERHUB_TOKEN`.
- Set `HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR=true` when you want the plan and summaries to reflect the ORAS-backed promotion path.

Common local commands:

```powershell
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/probe-release-mirror-capabilities.js
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/promote-release-mirror-trust.js
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/verify-release-mirror.js
node --env-file-if-exists=.env.local --env-file=.ops/release-image.env scripts/verify-release-mirror-referrers.js
```

The practical order is probe, promote, then verify digest parity and referrer parity.

## Container-Maintenance Preflight

Use a separate env file for Docker Hub cleanup and GitHub summary rendering.

Suggested variables:

```dotenv
DOCKERHUB_USERNAME=<dockerhub-user>
DOCKERHUB_TOKEN=<dockerhub-token>

HARMONIARR_DOCKERHUB_NAMESPACE=cloudbyday90
HARMONIARR_DOCKERHUB_REPOSITORY=harmoniarr
HARMONIARR_DOCKERHUB_KEEP_TAGS=5
HARMONIARR_DOCKERHUB_PROTECTED_TAGS=latest,v0.1.0-beta
HARMONIARR_DOCKERHUB_DRY_RUN=true

HARMONIARR_SUMMARY_KEEP_COUNT=5
HARMONIARR_SUMMARY_PACKAGE_NAME=harmoniarr
GITHUB_STEP_SUMMARY=.tmp/maintenance/summary.md
```

Common local commands:

```powershell
node --env-file-if-exists=.env.local --env-file=.ops/container-maintenance.env scripts/docker-hub-tag-maintenance.js
node --env-file-if-exists=.env.local --env-file=.ops/container-maintenance.env scripts/container-maintenance-summary.js ghcr-preview
node --env-file-if-exists=.env.local --env-file=.ops/container-maintenance.env scripts/container-maintenance-summary.js ghcr-active
node --env-file-if-exists=.env.local --env-file=.ops/container-maintenance.env scripts/container-maintenance-summary.js dockerhub-skip
```

For a local preview of Docker Hub deletions, keep `HARMONIARR_DOCKERHUB_DRY_RUN=true` in the env file and only override it deliberately on the command line:

```powershell
node --env-file-if-exists=.env.local --env-file=.ops/container-maintenance.env scripts/docker-hub-tag-maintenance.js --no-dry-run
```

## Practical Notes

- Prefer env files for values that already exist as workflow environment keys. That keeps local replay aligned with the GitHub Actions contract instead of creating a second configuration shape.
- Prefer CLI flags for temporary overrides, especially booleans such as `--enable-trusted-dockerhub-mirror` and `--no-dry-run`.
- Keep `.ops/` and `.tmp/` out of version control so local credentials, output files, and generated summaries do not drift into the repo.
- When a script emits `GITHUB_OUTPUT` entries locally, inspect that scratch file directly before moving on to the next script. It is the closest local equivalent to the workflow job output boundary.
# Release Process

This file is the single-source operational runbook for shipping a Harmoniarr release.

It is intentionally tied to the repo's current native-ESM scripts, GitHub Actions workflows, release assets, and Docker validation seams. If the workflows or release scripts change, update this file in the same slice.

## Release Inputs

- Public release label: `vX.Y.Z-beta`
- Package version: `X.Y.Z-beta`
- Release owner: `<name>`
- Release date: `YYYY-MM-DD`
- Scope summary: `<one-line summary>`
- Release notes path: use a temporary or operator-managed markdown file such as `.tmp/release-notes-vX.Y.Z-beta.md` if the notes are not maintained in a checked-in file
- Optional baseline immutable image for upgrade validation: `ghcr.io/<owner>/<image>@sha256:<digest>`

Version convention:

- Git tags, GitHub Release titles, and operator-facing notes use public labels such as `v0.1.0-beta`.
- `package.json` and other semver-bearing files use `0.1.0-beta`.

## Workflow Boundary

These workflows make up the release boundary that must stay green for a real release:

- `Repository Validation`: repository-wide validation on the checked-in code path.
- `Security Scanning`: image-tag policy plus npm/security scanning.
- `Supply Chain`: build artifacts, checksum manifest, SPDX SBOM, dependency snapshot, and build attestations.
- `Release Image`: publish the immutable multi-arch image, upload release assets, run immutable-image smoke validation, optionally run upgrade-path validation, and verify the release contract.
- `Container Image Maintenance`: post-release registry hygiene, not a release blocker for the current cut unless cleanup configuration itself changed.

## Preconditions

- The release scope is already reflected in [docs/IMPLEMENTATION_TASK_LIST.md](docs/IMPLEMENTATION_TASK_LIST.md) and [docs/RELEASE_VALIDATION_TASK_LIST.md](docs/RELEASE_VALIDATION_TASK_LIST.md).
- No unresolved release-blocking defects remain for auth, recovery, import review, deployment-path safety, or packaged-runtime validation.
- `npm run validate` passes on the release commit.
- `npm run validate:database` passes when migrations, schema bootstrap, or startup preparation changed.
- `npm run validate:security` passes.
- Schema snapshot is refreshed when migrations changed.
- Docker image builds locally when Docker is available.
- If release, maintenance, or mirror scripts changed, the affected workflow scripts are replayed locally with the `node --env-file` pattern from [docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md](docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md) before the first GitHub Actions run is treated as evidence.
- The plan for operator deployment notes explicitly records the immutable image reference as `tag@sha256:digest`, not tag-only text.
- If the repo is private or internal, attestation support is evaluated before provenance checks are treated as blocking.

## Local Preflight

Run the minimum repository validation set first:

```bash
npm run validate
npm run validate:security
```

Run database-specific validation when relevant:

```bash
npm run validate:database
```

Build the image locally when Docker is available:

```bash
docker build -t harmoniarr:test .
```

Prefer the shared deployment-path validator over one-off `docker run` checks. It is the executable local release-evidence seam for fresh-install proof and optional immutable-image proof.

Fresh-install only:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp/release/docker-evidence"
npm run validate:docker-deployment-path
```

Fresh-install plus released-image replay:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp/release/docker-evidence"
$env:HARMONIARR_IMAGE = "ghcr.io/cloudbyday90/harmoniarr@sha256:<published-digest>"
npm run validate:docker-deployment-path
```

Fresh-install plus released-image plus upgrade-path replay:

```powershell
$env:HARMONIARR_DOCKER_VALIDATION_EVIDENCE_DIR = ".tmp/release/docker-evidence"
$env:HARMONIARR_IMAGE = "ghcr.io/cloudbyday90/harmoniarr@sha256:<candidate-digest>"
$env:HARMONIARR_BASELINE_IMAGE = "ghcr.io/cloudbyday90/harmoniarr@sha256:<prior-accepted-digest>"
npm run validate:docker-deployment-path
```

Expected local evidence files when the command runs successfully:

- `harmoniarr-docker-smoke-fresh-install.json`
- `harmoniarr-docker-smoke-released-image.json` when `HARMONIARR_IMAGE` is set
- `harmoniarr-docker-smoke-upgrade-path.json` when `HARMONIARR_BASELINE_IMAGE` is set

If no working Docker daemon is available, do not mark deployment-path or packaged-runtime release evidence items complete. Capture that as an environment limitation, not a passed check.

## Release Execution

Preferred final path:

1. Update `package.json` and any surfaced version strings or operator-facing version references.
2. Update release-facing documentation that must ship with the cut, including README or operator deployment notes when behavior or assets changed.
3. Prepare release notes in a markdown file such as `.tmp/release-notes-vX.Y.Z-beta.md`, or use `gh release create --generate-notes` if generated notes are sufficient.
4. Run the local preflight above.
5. Commit the final release-prep changes.

   ```bash
   git commit -m "release: vX.Y.Z-beta"
   ```

6. Create and publish the GitHub Release.

   ```bash
   gh release create vX.Y.Z-beta --title "vX.Y.Z-beta" --notes-file .tmp/release-notes-vX.Y.Z-beta.md --target main
   ```

7. Publishing the GitHub Release triggers `Release Image` on `release.published`.
8. Wait for both `Supply Chain` and `Release Image` to finish successfully on the release commit.

Optional operator path:

- `Release Image` also supports `workflow_dispatch` with `release_tag` and optional `baseline_image` inputs.
- Use that path for reruns or operator-driven image publication when needed.
- Do not treat `workflow_dispatch` as equivalent to the final GitHub Release publication path, because the steps that upload assets to the GitHub Release only run on the real `release` event.

## What A Successful Release Produces

Expected GitHub Release assets:

- `harmoniarr-release.spdx.json`
- `harmoniarr-release-metadata.json`
- `harmoniarr-release-compose.override.yaml`
- `harmoniarr-release-verification.txt`

Expected published image outcome:

- GHCR image published at the release tag and version tag
- Docker Hub mirror published when `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured
- Trusted Docker Hub mirror probe, promotion, and referrer verification executed when trusted mirror mode is enabled

Expected `Release Image` workflow artifacts:

- `harmoniarr-docker-smoke-released-image.json`
- `harmoniarr-docker-smoke-upgrade-path.json` when upgrade validation ran
- `harmoniarr-image-attestation.json` when attestation verification ran

Expected `Release Image` verification stages:

- `publish-image`: build and push multi-arch image, generate SBOM release asset, write metadata assets, and attach provenance when supported
- `verify-published-image`: pull the immutable image, run `npm run validate:docker-released-image`, verify the emitted smoke evidence contract, and upload the archived evidence
- `verify-upgrade-path`: when a baseline image is configured, run `npm run validate:docker-upgrade`, verify the emitted upgrade evidence contract, and upload the archived evidence
- `verify-release-contract`: download release assets, download archived smoke evidence, re-verify the evidence contracts, validate the metadata and Compose override assets, verify mirror behavior, and run `gh attestation verify` for the published immutable image when supported

## Post-Publish Verification

Verify the release assets and immutability boundary first:

```bash
gh release view vX.Y.Z-beta --repo cloudbyday90/Harmoniarr --json assets,tagName,isImmutable
```

Verify the published image attestation against the immutable image reference:

```bash
gh attestation verify "oci://ghcr.io/cloudbyday90/harmoniarr@sha256:<published-digest>" --repo cloudbyday90/Harmoniarr
```

Then confirm all of the following:

- The published digest used in deployment notes is an immutable `tag@sha256:digest` reference, not just a mutable tag.
- The `harmoniarr-release-metadata.json` asset and `harmoniarr-release-compose.override.yaml` asset both resolve to the published immutable digest.
- The `verify-release-contract` job passed.
- The archived `harmoniarr-docker-smoke-released-image.json` artifact was verified successfully.
- The archived `harmoniarr-docker-smoke-upgrade-path.json` artifact was verified successfully when upgrade validation ran.
- The Docker Hub mirror verification passed when Docker Hub publishing is enabled.
- The trusted-mirror capability probe and referrer verification passed when trusted mirror mode is enabled.
- The `Supply Chain` workflow emitted the expected SBOM and any applicable attestations for the release commit.

## Operational Smoke After Publication

After the workflows pass, verify the operator-facing runtime path against the published immutable image, not a tag-only reference.

Minimum checks:

- Fresh data path starts and `/healthz` passes.
- Existing data path starts and migration checks remain clean.
- Login and session refresh work.
- slskd connection validation still works.
- Search, candidate review, and transfer status still work for the critical flow under test.
- Logs do not show startup, migration, embedded Postgres, or adapter failures.
- Queue workers do not fall into repeated retry loops or backlogs.
- Rollback to the prior accepted immutable image is still clear if needed.

## Practical Rules

- Treat release assets, archived smoke evidence, and attestation verification as separate gates. Artifact presence alone is not enough.
- Prefer immutable digest references in deployment notes and operator examples. Docker's current guidance still treats digest pinning as the safest way to keep deployments reproducible.
- Keep release-script preflight on the same env-driven contract the workflows use. Do not create a second local-only configuration shape when [docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md](docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md) already covers the supported one.
- Update this file whenever the release workflows, asset names, or deployment-path validation contract changes.

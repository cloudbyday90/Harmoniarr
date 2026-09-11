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
- `npm run validate:postgres-recovery` passes against its isolated generated fixture; retain the sanitized evidence and keep operator backup/cutover claims separate.
- Provider-collection access claims are backed by source-specific opt-in evidence from [the provider access runbook](docs/PROVIDER_ACCESS_ACCEPTANCE_OUTCOME.md); controlled tests and saved configuration alone do not establish live account access.
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

Run the full PostgreSQL continuity rehearsal with a local Docker engine and a new evidence path:

```powershell
npm run validate:postgres-recovery -- --evidence-path .tmp/release/postgres-recovery-evidence.json
```

This creates and removes an owned PostgreSQL 18.6 fixture container, performs a real dump/restore, and tests retained request work, encryption-key dependence, lease/cancellation behavior, and atomic failure rollback. It accepts no operator database or archive input and starts no application workers. See the separate [design](docs/POSTGRES_RECOVERY_REHEARSAL_DESIGN.md) and [outcome](docs/POSTGRES_RECOVERY_REHEARSAL_OUTCOME.md). The `Repository Validation` workflow runs the same direct ESM entry point in its independent recovery job and retains only sanitized evidence. A missing Docker runtime or failed command cannot count as passed recovery proof.

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

### Strict candidate acceptance

Use `npm run validate:docker-candidate` to test one resolved immutable application image across fresh installation, existing-data restart, and upgrade. This additional gate verifies actual container identity, the packaged migration ledger and pagination indexes, a retained generated request, packaged PostgreSQL recovery tools, and cleanup. It creates isolated fixtures with generated credentials and does not inherit the operator's `.env` or database/provider configuration. Docker Engine API 1.49+ is required for platform-manifest inspection on a containerd image store.

Obtain image references and source commits from the actual build/release metadata. Tags alone are rejected. Both images must carry the expected `org.opencontainers.image.revision` label, have distinct identities and source revisions, and use the same platform. The current transition check requires a baseline before `20260911_103324_missing_music_keyset_paging_indexes.sql` and a candidate containing that migration; it deliberately fails an already-migrated baseline.

```powershell
npm run validate:docker-candidate -- `
  --candidate-image <candidate-registry-digest-reference> `
  --baseline-image <baseline-registry-digest-reference> `
  --candidate-revision <full-candidate-commit-sha> `
  --baseline-revision <full-baseline-commit-sha> `
  --evidence-path .tmp/release/immutable-candidate-acceptance.json
```

For pre-publication testing, build source-identified candidate/baseline images using `docker build --label org.opencontainers.image.revision=<full-source-commit-sha>` from their respective source checkouts. Resolve their full local IDs with `docker image inspect <build-tag> --format '{{.Id}}'`, pass those IDs instead of registry references, and add `--allow-local-images`. The command never builds or substitutes an image during a scenario. Local evidence is marked `local-artifact-runtime`; it does not establish registry publication, provenance, or an accepted release baseline.

Each run requires a new evidence file. Failed validation leaves no passed artifact. Retain the successful sanitized JSON along with source/build metadata. The release attestation/contract gate still verifies trusted origin independently; a matching revision label is not attestation verification. See the separate [design](docs/IMMUTABLE_CANDIDATE_ACCEPTANCE_DESIGN.md) and [outcome](docs/IMMUTABLE_CANDIDATE_ACCEPTANCE_OUTCOME.md).

Optional top-level summary artifact:

- Set `HARMONIARR_DOCKER_VALIDATION_SUMMARY_PATH` when you want one machine-readable record of the deployment-path run in addition to the per-step smoke evidence files.
- The summary artifact records which checks ran, which were skipped, and the exact evidence file paths produced by the run.

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
- `harmoniarr-docker-deployment-summary.json`
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
- The archived `harmoniarr-docker-deployment-summary.json` artifact was produced from the verified smoke evidence set for the release run.
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

# Release Checklist

## Release Metadata

- Public release label: `vX.Y.Z-beta`
- Package version: `X.Y.Z-suffix`
- Date: `YYYY-MM-DD`
- Owner: `<name>`
- Scope/Highlights: `<one-line summary>`

## Preconditions

- Implementation plan is complete for the release scope.
- `npm run validate` passes.
- `npm run validate:database` passes when migrations or bootstrap logic changed.
- `npm run validate:security` passes.
- No failing CI jobs or unresolved release-blocking review tasks, including `Security Scanning`, `Supply Chain`, and `Release Image` when the release has been published.
- Database migrations are reviewed, idempotent, and safe for existing installs.
- Schema snapshot is refreshed when migrations changed.
- Docker image builds locally.
- Embedded Postgres startup path is verified for both fresh and existing data directories when relevant.
- slskd/Soulseek compatibility fixtures are updated when adapter behavior changed.
- The release plan identifies how the published container digest will be captured for operator-facing deployment notes.
- The release plan identifies how the SBOM release asset and verification note will be reviewed after publication.
- The release plan identifies how the machine-readable release manifest, Compose override asset, and post-publish immutable-image smoke verification will be reviewed after publication.

## Local Testing

Run these before cutting a release:

```bash
npm run validate
npm run validate:security
npm run validate:database
docker build -t harmoniarr:test .
```

If Docker smoke testing is available:

```bash
docker run --rm -p 21325:3000 harmoniarr:test
```

Then verify:

```bash
curl http://localhost:21325/healthz
```

For local preflight of the release-image and container-maintenance workflow scripts without a GitHub Actions run, use the native Node `--env-file` flow documented in `docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md`.

Document new non-breaking warnings, operational caveats, or release findings in the appropriate project notes before release.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated.
- Docker available locally.
- Release pipeline configured to build and publish container images from Git tags.
- Registry credentials configured in GitHub Actions.
- If the repository is private or internal, confirm the plan support level for GitHub artifact attestations before treating provenance steps as release-blocking.

## Release Steps

1. Update `RELEASE_NOTES.md` with the new version entry.
2. Update `CHANGELOG.md` with technical details when required.
3. Bump version references:
   - `package.json`
   - `client/package.json`
   - `server/package.json`
   - frontend app version constant if present
   - README badges, image tags, or install examples if present
4. Keep version conventions straight:
   - Git tags, release notes, and UI display use public labels such as `v0.1.0-beta`.
   - Package files use semver-safe values such as `0.1.0-beta`.
5. Run the local testing checklist.
6. If you changed release-image or container-maintenance script behavior, replay the affected workflow scripts locally with the documented `node --env-file` flow before relying on the GitHub Actions run as the first executable check.
7. Record the supply-chain outputs for the release candidate:
   - confirm the `Supply Chain` workflow uploaded the current SPDX SBOM artifact
   - confirm the dependency snapshot was accepted for the release commit
   - if the repository supports GitHub attestations, confirm provenance was emitted for the built artifacts
8. Publish the GitHub release or trigger the `Release Image` workflow for the target tag.
9. Capture the published image digest from the `Release Image` workflow output or attached verification note and update operator-facing deployment notes to use `tag@sha256:digest` where appropriate.
10. Confirm the release now includes:
   - the published GHCR image
   - the Docker Hub mirror when `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured
   - the `harmoniarr-release.spdx.json` asset
   - the `harmoniarr-release-metadata.json` manifest asset
   - the `harmoniarr-release-compose.override.yaml` immutable Compose override asset
   - the `harmoniarr-release-verification.txt` note with immutable reference and attestation commands
11. Confirm the release-contract verification job passed against the release asset inventory and the published image attestation.
12. Confirm the post-publish immutable-image smoke check passed against the digest that was just published.
13. Commit release changes:

   ```bash
   git commit -m "release: vX.Y.Z-beta"
   ```

14. Create the GitHub Release and tag with `gh`:

   ```bash
   gh release create vX.Y.Z-beta --title "vX.Y.Z-beta" --notes-file RELEASE_NOTES.md --target main
   ```

   If `RELEASE_NOTES.md` contains multiple versions, use a temporary file containing only the current release notes, or use `--generate-notes`.

## Post-Release Verification

- Confirm the release pipeline completed successfully.
- Confirm the published container image exists in GHCR and, when configured, in Docker Hub.
- Confirm the published container digest was recorded and any operator-facing Compose examples for that release use `tag@sha256:digest` references where a concrete artifact is being documented.
- Confirm the release contains the `harmoniarr-release.spdx.json` asset and `harmoniarr-release-verification.txt` note.
- Confirm the release contains the `harmoniarr-release-metadata.json` asset and `harmoniarr-release-compose.override.yaml` asset, and that both resolve to the published immutable digest.
- Confirm `gh release view <tag> --json assets` shows the release-contract assets expected by the manifest.
- Confirm `gh attestation verify oci://<image@digest> -R <owner/repo>` succeeds for the published image.
- Confirm the `Container Image Maintenance` workflow is configured with the expected `DOCKERHUB_NAMESPACE` and retention defaults before stale images begin to accumulate.
- Confirm the release commit has the expected SBOM artifact and dependency snapshot coverage.
- Start the released image with a fresh data volume and verify `/healthz`.
- Start the released image against an existing test data volume and verify migrations.
- Confirm the UI displays the expected version.
- Smoke test login/auth, slskd connection validation, search, candidate review, transfer status, and import review.
- Monitor logs for startup, migration, embedded Postgres, and adapter errors.
- Check for queue backlogs, slow migrations, repeated retry loops, and failed background jobs.
- Confirm rollback path is clear if issues appear.

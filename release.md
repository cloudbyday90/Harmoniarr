# Release Checklist

## Release Metadata

- Public release label: `vX.Y.Z-beta`
- Package version: `X.Y.Z-suffix`
- Date: `YYYY-MM-DD`
- Owner: `<name>`
- Scope/Highlights: `<one-line summary>`

## Preconditions

- Implementation plan is complete for the release scope.
- Server tests pass.
- Client tests pass.
- Integration tests pass.
- Coverage ratchet passes.
- No failing CI jobs or unresolved release-blocking review tasks.
- Database migrations are reviewed, idempotent, and safe for existing installs.
- Schema snapshot is refreshed when migrations changed.
- Docker image builds locally.
- Embedded Postgres startup path is verified for both fresh and existing data directories when relevant.
- slskd/Soulseek compatibility fixtures are updated when adapter behavior changed.

## Local Testing

Run these before cutting a release:

```bash
npm run lint
npm run migration:check
npm run test:ci
npm run test:integration
npm run test:coverage
npm run coverage:ratchet:check
npm --prefix client run build
docker build -t harmoniarr:test .
```

If Docker smoke testing is available:

```bash
docker run --rm -p 21325:21325 harmoniarr:test
```

Then verify:

```bash
curl http://localhost:21325/health
```

Document new non-breaking warnings, operational caveats, or release findings in the appropriate project notes before release.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated.
- Docker available locally.
- Release pipeline configured to build and publish container images from Git tags.
- Registry credentials configured in GitHub Actions.

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
6. Commit release changes:

   ```bash
   git commit -m "release: vX.Y.Z-beta"
   ```

7. Create the GitHub Release and tag with `gh`:

   ```bash
   gh release create vX.Y.Z-beta --title "vX.Y.Z-beta" --notes-file RELEASE_NOTES.md --target main
   ```

   If `RELEASE_NOTES.md` contains multiple versions, use a temporary file containing only the current release notes, or use `--generate-notes`.

## Post-Release Verification

- Confirm the release pipeline completed successfully.
- Confirm the published container image exists in the registry.
- Start the released image with a fresh data volume and verify `/health`.
- Start the released image against an existing test data volume and verify migrations.
- Confirm the UI displays the expected version.
- Smoke test login/auth, slskd connection validation, search, candidate review, transfer status, and import review.
- Monitor logs for startup, migration, embedded Postgres, and adapter errors.
- Check for queue backlogs, slow migrations, repeated retry loops, and failed background jobs.
- Confirm rollback path is clear if issues appear.

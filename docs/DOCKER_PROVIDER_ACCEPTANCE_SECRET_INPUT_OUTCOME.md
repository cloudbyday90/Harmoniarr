# Docker provider acceptance secret-input outcome

**Completed:** 2026-08-26

## Delivered

- Added the ESM-only `scripts/secret-input.js` module for one-of direct or
  password-file secret resolution.
- Added `--password-file` and
  `HARMONIARR_WALKTHROUGH_PASSWORD_FILE` to
  `validate-docker-provider-acceptance.js`.
- The helper reads a password-only file asynchronously, retains the value only
  in memory, and normalizes an optional terminal newline.
- Ambiguous direct-plus-file input, a missing source, an unreadable file, and
  an empty file fail with stable messages that exclude secret content, file
  paths, and filesystem details.
- Updated the local walkthrough to make a password-only file the preferred
  source and to explain that `docker/walkthrough.env` is not that format.

## Outcome

The strict read-only provider probe can now use an operator-managed local
secret file without placing the password in the command line. Existing
environment and CLI inputs remain available for backward-compatible,
disposable walkthrough automation. No application API, database state,
provider request, downloader action, or Music Queue selection changed.

## Validation record

Focused tests cover direct compatibility input, file reads, whitespace
normalization, dual-source rejection, and redaction of read failures. The
provider-acceptance input tests cover the new CLI option alongside the existing
strict requirements. Repository lint, ESM consistency, full validation, and
security results are recorded with the implementation commit.

## Next recommended item

With a password-only secret file configured and an operator-authorized real
Music Queue-origin transfer visible in Downloader, run:

```powershell
npm run validate:docker-provider-acceptance -- -- --password-file "C:\secrets\harmoniarr-walkthrough-password" --require-accepted-transfer --require-music-queue-link
```

If it reports a concrete readiness code, improve only the owning existing
screen. Do not create a new combined queue/download surface or manufacture a
peer-to-peer transfer for test evidence.

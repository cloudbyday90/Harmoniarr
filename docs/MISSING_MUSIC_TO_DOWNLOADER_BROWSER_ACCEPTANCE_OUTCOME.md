# Missing Music to Downloader browser acceptance outcome

**Completed:** 2026-08-26

## Delivered

The delivery adds an isolated browser acceptance test for the release-scoped
operator lifecycle from Missing Music to Downloader. It verifies:

1. `Start search` presents the existing clear confirmation before the request.
2. The search submission is a POST with a CSRF header and the expected
   release-only request payload.
3. Success goes directly to `Music Queue / wanted-amber` while the release is
   searching, then refreshes to the automatic `Downloading` handoff.
4. `View download progress for Autechre — Amber` opens Downloader scoped by
   `wantedReleaseId=wanted-amber`, not by a provider username or transfer ID.
5. Downloader shows only the linked live transfer, then shows the explicit
   `No live transfer for this Music Queue release` state after the fixture
   models it leaving the live queue.

The two existing browser fixture modules now expose small guarded state
transitions. This avoids a new all-purpose test singleton and keeps test data
at the workspace boundary that owns it.

## Security and accessibility outcome

- The test records only whether a CSRF header exists; it never retains or
  prints its secret value.
- The only write remains the existing CSRF-protected POST. The fixture does
  not bypass the app's authentication bootstrap or create new server routes.
- Browser locations are asserted to contain only the durable wanted-release
  identifier. The fixture provider user and raw transfer ID are specifically
  excluded.
- The scenario uses accessible role/name locators for the confirmation dialog,
  the descriptive progress link, headings, and the resulting empty state.
  This protects the practical accessible names that W3C guidance calls for.

## Validation evidence

All requested validation passed on 2026-08-26:

- `npm run lint:test`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/missing-music-to-downloader-browser-acceptance.test.js`
- `npm run validate`, covering copyright, migration/schema policy, ESM,
  Compose policy, lint, test hygiene, server/client/script/integration tests,
  and production builds
- `npm run validate:security`, with zero npm audit vulnerabilities
- `docker compose -f compose.walkthrough.yaml build harmoniarr`
- `docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr`
- `docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap`

The rebuilt local walkthrough is healthy at `http://127.0.0.1:47956`; the
bootstrap helper safely reported that its disposable walkthrough administrator
already exists.

## Next recommended item

Run a controlled provider-pipeline proof against a disposable Docker
environment after configuring a test-only provider. It should verify durable
Music Queue-to-Downloader linkage at the API boundary without using the local
walkthrough credentials or a personal music library.

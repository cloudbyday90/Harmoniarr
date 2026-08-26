# Missing Music canonical links and legacy redirects — outcome

**Status:** implemented

**Created:** 2026-08-26

## Delivered navigation contract

All active release-decision links now use Missing Music:

- `/app/missing` for the decision worklist;
- `/app/missing/:decisionId` for a release decision; and
- `/app/downloader` for administrator-only transfer monitoring.

Saved Music Queue, interim Acquisition, and Activity queue paths remain
compatible. The router redirects each of those paths to its canonical route,
retaining query and fragment state. A legacy release ID becomes only the
opaque Missing Music `decisionId`; the redirect never reads or supplies a
target user, provider username, transfer ID, path, token, or provider payload.

The redirect logic is isolated in
`src/client/lib/missing-music-legacy-route-redirect.js`. The Downloader return
link presentation is likewise isolated in
`src/client/lib/downloader-missing-music-release-link.js`. Router records and
Vue components remain thin consumers of these ESM helpers.

## User experience and authorization result

Visible navigation now consistently says **Missing Music** for release
decisions, while **Downloader** remains the transfer-operation destination.
The corresponding links use descriptive names such as **Open in Missing
Music** and **Open Missing Music release: Artist — Release**.

The browser compatibility layer does not authorize access. Missing Music APIs
continue to resolve every decision using the authenticated server session and
its allowed scope. Downloader remains protected by the existing
administrator-only route and server checks. This retains the multi-user
boundary: an administrator may see authorized household work; another user
cannot gain scope by altering a URL.

## Validation completed

- Pure ESM route-helper and Downloader-link unit tests cover query/hash
  preservation, malformed IDs, and canonical locations.
- `npm run test:client` — 4,226 passing tests.
- `npm run lint:client`, `npm run lint:test`, `npm run check-copyright`, and
  `npm run build:client` — passing.
- Focused browser acceptance verifies a saved Music Queue release link reaches
  the canonical scoped Missing Music URL; a direct legacy Acquisition
  Downloader URL reaches canonical Downloader while preserving its safe
  release filter.
- `npm run validate` — passing (server, client, scripts, integration, ESM,
  schema, lint, and production build checks).
- Walkthrough Compose rebuild — `docker compose -f compose.walkthrough.yaml
  build harmoniarr`, `up -d --wait --no-build harmoniarr`, and the one-shot
  bootstrap helper all succeeded; `GET /healthz` returned `200` with no pending
  migrations.

## Remaining recommendation

Add the remaining cross-user authorization and keyboard-inspector browser
coverage, then remove the now-unreachable interim Music Queue and Acquisition
view modules in a dedicated cleanup change. Keeping that retirement separate
avoids mixing compatibility protection with a broad deletion.

The approved design and sources are in
[Missing Music canonical links and legacy redirects](MISSING_MUSIC_LEGACY_DEEP_LINKS_DESIGN.md).

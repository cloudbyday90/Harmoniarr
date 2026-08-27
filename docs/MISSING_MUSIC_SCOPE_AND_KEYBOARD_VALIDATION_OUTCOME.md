# Missing Music scope and keyboard validation outcome

**Status:** implemented
**Completed:** 2026-08-27

## Delivered

- Legacy Music Queue and Acquisition links remain compatibility routes but
  resolve to the canonical Missing Music worklist or release inspector.
- The browser does not treat a legacy `requestedForUserId` query parameter as
  authority. It is preserved in the saved URL but does not select a user or
  become a decision-detail request parameter.
- Requesters receive the admin-only user filter only when the server grants
  `scope: "all"`; the real service continues to limit a requester to their
  own rows and returns the uniform unavailable result for a cross-user detail.
- The Missing Music inspector title and the page title after return navigation
  receive visible focus indicators.
- The native Start download dialog now adds a small reusable Tab-wrap helper.
  It retains native opening, Escape dismissal, backdrop behavior, and focus
  return to the Start download button.

## Test coverage

- Replaced stale Acquisition-overview browser expectations with canonical
  administrator/requester legacy-route acceptance coverage.
- Verified preserved legacy query/hash state is not converted into an API user
  filter or a detail query parameter.
- Verified requester legacy Downloader navigation remains blocked before a
  Downloader API request.
- Verified focus enters the release inspector, returns to the Missing Music
  page heading after route navigation, remains in the download dialog during
  forward Tab traversal, and returns to the invoker on Escape.
- Added focused unit tests for the reusable modal Tab-wrap decision.

## Security result

The change does not move authorization into the browser. The server-side
Missing Music decision service remains default-deny, derives the actor scope on
every request, does not enumerate users for a requester, and resolves
unauthorized detail identifiers as not found. The browser tests prove correct
navigation and presentation; the service tests prove the security boundary.

## Validation completed

- `npm run lint:client` — passing
- `npm run lint:test` — passing
- Focused Missing Music client and server tests — 26 passing
- `npm run build:client` — passing
- Focused browser acceptance — 6 passing
- `npm run validate` — passing (full lint, ESM, node, integration, and production-build checks)

## Pull request review

The GitHub API returned no open pull requests for `cloudbyday90/Harmoniarr` on
2026-08-27. No external branch was applied locally or merged.

## Next recommended item

Rebuild the walkthrough Compose service and visually inspect the completed
Missing Music flow at desktop, collapsed-sidebar, and mobile breakpoints. Keep
the subsequent removal of unreachable interim Music Queue and Acquisition
modules in its own cleanup change after that deployment check.

The rationale, options, recommendations, and official sources are in
[Missing Music scope and keyboard validation design](MISSING_MUSIC_SCOPE_AND_KEYBOARD_VALIDATION_DESIGN.md).

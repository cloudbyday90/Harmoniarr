# Missing Music walkthrough and responsive validation outcome

**Status:** Implemented
**Date:** 2026-08-27

## Delivered outcome

- Added the ESM `useMobileNavigationState` composable. It owns the mobile
  media-query subscription and cleanup instead of coupling that browser state
  to the app-shell component.
- Made the closed mobile sidebar inert and hidden from assistive technology.
  Opening it focuses the first navigation link; Escape, the close control, the
  backdrop, and a drawer-initiated route change return focus to the menu
  trigger. This prevents an off-screen focus stop while retaining ordinary
  desktop and collapsed-sidebar navigation.
- Rebuilt the disposable walkthrough image, started the app with Compose health
  waiting, and reran the one-shot bootstrap helper without removing existing
  local walkthrough data.

## Packaged-runtime browser evidence

The authenticated inspection ran against the rebuilt local service at
`http://127.0.0.1:47956/app/missing`. Screenshots are retained only in the
ignored `.tmp/missing-music-responsive-validation/rebuilt/` evidence path.

| Viewport | Result |
| --- | --- |
| Desktop, `1440 × 800` | Full primary sidebar visible; no document-level horizontal overflow; visible page-heading focus. |
| Collapsed sidebar, `800 × 800` | Collapsed navigation remained usable; no document-level horizontal overflow; visible page-heading focus. |
| Mobile, `320 × 800` | No document-level horizontal overflow; closed drawer links inert; opening moves focus into the drawer; Escape and a drawer-initiated route change restore trigger focus. |

The browser recorded zero console errors across all three viewports. The final
visual inspection found the Missing Music information hierarchy, sidebar modes,
and bottom navigation coherent at each checked width.

## Node and open-PR outcome

Node 24.20.0 is the upstream LTS patch, but Docker Hub does not publish
`node:24.20.0-alpine`. An attempted clean build therefore failed before the
application build stage. The published `node:24-alpine3.23` image executes
Node 24.19.0, so the repository retains its exact, buildable
`node:24.19.0-alpine` pin rather than using an unbuildable or floating tag.

Open Dependabot PR [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40)
proposes a Node 26.7.0 image for an isolated fixture. It was reviewed but not
applied locally: Node 26 is a Current line and the application deliberately
declares a Node 24 LTS-only engine range. No pull request was merged.

## Security and validation

- Local-only Compose remained bound to `127.0.0.1`; no production Compose
  resource or walkthrough data was reset.
- The walkthrough password was read from its local env file inside the
  transient browser process and was not emitted in test output or evidence.
- `node --test test/client/use-mobile-navigation-state.test.js` passed: 2 of 2.
- `npm run lint:client` passed.
- `npm run validate` passed, including the complete client/server test suites,
  ESM check, topology checks, copyright validation, and client build.
- `docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr`
  passed with the retained exact Node 24.19.0 image.
- `docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr`
  reported healthy; the bootstrap helper completed successfully.

## Next recommended work

Remove the now-unreachable interim Music Queue and Acquisition client modules
only after mapping their remaining route, test, and shared-component imports.
That cleanup should be a separate change so the canonical Missing Music and
Downloader handoff remains independently verifiable.

The design, alternatives, security boundaries, and official-source review are
in [Missing Music walkthrough and responsive validation design](MISSING_MUSIC_WALKTHROUGH_RESPONSIVE_VALIDATION_DESIGN.md).

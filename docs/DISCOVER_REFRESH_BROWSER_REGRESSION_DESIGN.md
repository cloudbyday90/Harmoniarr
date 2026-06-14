# Discover Refresh Browser Regression Design

## Status

Implemented on 2026-06-12.

This document records the recommendation, tradeoffs, implementation outcome, and validation for the browser regression that verifies Discover reload behavior after an operator adds multiple monitored artists.

## Problem

Discover uses the operator's monitored artist profile as the recommendation basis. Unit coverage already proves that `useDiscoverGraph().hydrateSeeds()` accepts multiple monitored artists, but the remaining product risk was end-to-end:

1. The operator adds one artist from Discover.
2. Discover recommends related artists.
3. The operator adds a second artist from those recommendations.
4. The operator reloads Discover.
5. Discover should still hydrate from both monitored artists and preserve overlap-based recommendations.

Without browser coverage, regressions in route hydration, fixture persistence, browser storage, modal submission, or accessible card state could pass lower-level tests while still breaking the real workflow.

## Official Research

Research was performed against official sources in June 2026 for practices current as of May 2026.

- Playwright Best Practices: https://playwright.dev/docs/best-practices
  - Prefer tests that operate like users, use locators, and rely on web-first waiting behavior.
- Playwright Locators: https://playwright.dev/docs/locators
  - Prefer user-facing attributes and explicit contracts such as `page.getByRole()`.
- Playwright Auto-waiting: https://playwright.dev/docs/actionability
  - Actions and assertions should use auto-waiting behavior instead of fixed sleeps.
- Playwright Locator API: https://playwright.dev/docs/api/class-locator
  - Prefer locators and web assertions over element handles because element handles are more race-prone.
- Node.js Test Runner: https://nodejs.org/api/test.html
  - Native `node:test` supports asynchronous tests, suites, hooks, skips, timeouts, and deterministic process exit on failure.
- OWASP Web Security Testing Guide: https://owasp.org/www-project-web-security-testing-guide/
  - Security testing benefits from explicit business-logic checks because automated tools alone do not prove workflow correctness.

## Options Considered

### Option 1: Extend client unit coverage only

Pros:

- Fastest test execution.
- Easy to isolate graph scoring and hydration logic.
- No browser or database runtime requirement.

Cons:

- Does not prove the modal add flow, router reload, browser storage, accessible selectors, or mounted Discover view behavior.
- Cannot catch mismatches between fixture API shape and the real UI workflow.

### Option 2: Add a broad smoke assertion to the existing operator browser smoke

Pros:

- Reuses an existing end-to-end path.
- Minimal new file count.

Cons:

- Makes an already broad smoke scenario more fragile and harder to diagnose.
- Couples the refresh regression to unrelated artist-detail, search, activity, and import-review checks.

### Option 3: Add a focused browser regression with deterministic metadata fixtures

Pros:

- Tests the exact user-visible contract.
- Keeps failure scope narrow: Discover add, monitored-profile hydration, reload, and recommendation overlap.
- Reuses the existing browser runtime, bootstrap helpers, and metadata fixture interception.
- Avoids real external MusicBrainz/Cover Art Archive calls, reducing flake and protecting test determinism.

Cons:

- Requires client build output and the browser integration runtime.
- Slightly expands the metadata fixture surface to model multiple artists.

## Final Recommendation Stack

Use Option 3.

- Runtime: existing `node:test` browser suite with `createBrowserSmokeRuntime()`.
- Browser automation: Playwright through the existing lightweight runtime.
- Selectors: user-facing role/name locators for headings, buttons, lists, list items, dialogs, and recommendation cards.
- Waiting model: Playwright locator waits and page reload URL waits; no fixed sleeps.
- Data: deterministic browser fixture interception with sessionStorage-backed monitored artist state.
- Security posture: fixture-only external metadata/artwork responses; no live network dependency for MusicBrainz or Cover Art Archive; UI mutations still flow through the existing CSRF-protected application session and same-origin fetch path.

## Implementation Outcome

Added `test/browser/discover-refresh-regression.test.js`.

The test:

1. Installs deterministic metadata browser fixtures.
2. Bootstraps the admin through the real UI.
3. Navigates to Discover.
4. Searches for Boards of Canada.
5. Adds Boards of Canada through the add-artist modal.
6. Adds Autechre from the resulting recommendations.
7. Verifies the live Discover page shows:
   - `2 monitored`
   - monitored list items for Boards of Canada and Autechre
   - Aphex Twin as a recommendation
   - `Shared by 2 of your monitored artists`
8. Reloads `/app/discover`.
9. Repeats the same assertions after reload.

Updated `testing/browser/metadata-browser-fixtures.js`.

The fixture now supports:

- multiple monitored artists
- MusicBrainz import routes for fixture-backed artists
- operator projection save/read routes keyed by local metadata artist ID
- sessionStorage persistence of monitored artist IDs across reload
- shared recommendation overlap through Aphex Twin and Tycho

## Validation

Passed:

- `node --check testing/browser/metadata-browser-fixtures.js`
- `node --check test/browser/discover-refresh-regression.test.js`
- `npm run lint:test`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/discover-refresh-regression.test.js`

Expected local test noise:

- Browser/integration runtime now injects deterministic test VAPID keys, so Discover browser regression coverage should not emit ephemeral-key warnings. The production hardening is documented in `WEB_PUSH_VAPID_HARDENING_DESIGN.md`.
- PostgreSQL may emit idle pooled client termination messages during integration runtime teardown.

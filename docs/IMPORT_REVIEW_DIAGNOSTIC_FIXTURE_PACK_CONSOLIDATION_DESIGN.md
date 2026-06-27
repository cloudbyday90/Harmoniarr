# Import Review Diagnostic Fixture-Pack Consolidation

Status: Implemented

## Context

Import Review diagnostic browser coverage now spans per-file diagnostics,
diagnostic row handoff, focused file handoff, repair success, repair failure,
retry success, and direct route reload. The behavior is covered, but older
suites still duplicated the same candidate, run, route, and file identifiers.
That duplication made future recovery work more expensive and increased the
chance that one diagnostic scenario would silently drift away from the others.

## Official Guidance Reviewed

As of June 2026:

- Playwright recommends keeping tests isolated and testing observable behavior:
  <https://playwright.dev/docs/best-practices>
- Playwright locator guidance favors user-facing locators over brittle
  implementation selectors: <https://playwright.dev/docs/locators>
- Playwright actionability and auto-waiting guidance supports assertions that
  wait for real UI readiness: <https://playwright.dev/docs/actionability>
- Node.js documents the built-in test runner used by this repository:
  <https://nodejs.org/api/test.html>
- OWASP authorization guidance recommends deny-by-default, server-side
  authorization and avoiding client-side trust: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

## Recommendation

Create a modular diagnostic fixture-pack layer for shared Import Review browser
state. Keep lower-level candidate/run builders in
`testing/browser/import-review-browser-helpers.js`, but expose diagnostic
scenario constants and route helpers from
`testing/browser/import-review-diagnostic-fixtures.js`.

The fixture pack should own:

- stable diagnostic candidate, comparison candidate, run, and file identifiers;
- direct route suffixes for selected-run and focused-file contexts;
- the shared diagnostic repair failure message;
- workspace creation that still delegates to the existing production-shaped
  metadata browser fixture seeding path.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Add a named fixture-pack module | Reduces duplication without hiding the lower-level builders | Adds one test-support module |
| Keep every suite self-contained | Easy to read in isolation | Repeats identifiers and can drift |
| Move all builders into one large helper | Fewer files | Increases the existing helper's size and weakens ownership boundaries |
| Use shared route suffix helpers | Makes URL contracts consistent across direct/reload/repair tests | Tests must import one more helper |

## Final Stack

- **Base builders:** `testing/browser/import-review-browser-helpers.js` keeps
  generic Import Review candidate/run/payload builders.
- **Diagnostic fixture pack:** `testing/browser/import-review-diagnostic-fixtures.js`
  exports diagnostic constants, workspace creation, and route suffix helpers.
- **Browser suites:** diagnostic suites import the fixture pack for candidate
  IDs, file IDs, failure copy, and route setup while keeping their own
  behavior-specific assertions.
- **Security posture:** fixture URLs carry opaque IDs only. The suites continue
  exercising role-gated browser routes and production-shaped API fixtures
  rather than trusting client-only state.

## Outcome

- Older diagnostic row handoff and repair-state suites no longer duplicate
  candidate/run payload builders.
- All diagnostic repair and direct-route browser suites now share the same
  file ID, route suffix, and failure-message constants.
- Media-inspection per-file diagnostics reuse the same diagnostic workspace
  shape as later handoff and repair coverage.
- The consolidation is test-support only; no production Import Review behavior
  changed.

## Follow-Up

The next high-value item is queued-worker maintenance-lock pause proof. Import
Review recovery coverage now has stable fixture packs; the remaining release
risk is proving background workers pause and resume correctly under maintenance
locks in a Docker-capable validation path.

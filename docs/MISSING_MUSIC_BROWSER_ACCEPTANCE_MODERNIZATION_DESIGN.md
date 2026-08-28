# Missing Music Browser Acceptance Modernization — Design

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

Harmoniarr now sends historic Music Queue URLs to the canonical Missing Music
worklist or release decision. Four browser suites still try to operate retired
Music Queue rows, review panels, provider-repair notices, and acquisition API
fixtures after that redirect. This design removes those obsolete tests and
keeps browser coverage aligned with the current user workflow.

The goal is not to recreate old controls just to satisfy test locators. It is
to verify the current, server-authorized Missing Music contract using the
semantic names a person and assistive technology encounter.

## Baseline evidence

The following legacy suites contain seven failing scenarios:

- `music-queue-automatic-download-handoff-browser-verification.test.js`
- `music-queue-folder-setup-recovery-confirmation-browser-verification.test.js`
- `music-queue-provider-repair-context-browser-verification.test.js`
- `music-queue-provider-repair-recovery-confirmation-browser-verification.test.js`

Each navigation begins at `/app/music-queue`. The router correctly redirects to
Missing Music before a legacy `.music-queue-*` element or acquisition-release
fixture can be used. The failures are timeouts waiting for controls that no
longer exist, rather than production workflow failures.

The audit also found one stale assertion embedded in the otherwise-current
Activity diagnostics suite. It retained the useful compatibility check for
`/app/activity/queue`, but expected the retired
`/app/acquisition/music-queue` destination. The route is intentionally a
Missing Music alias now, so that assertion must verify `/app/missing` while
retaining its query and fragment state.

The current browser suites cover the surviving contract:

| Retired assertion | Canonical coverage | Reason |
| --- | --- | --- |
| Legacy worklist/release navigation | `missing-music-legacy-redirect-browser-acceptance` | Saved Music Queue URLs retain query and fragment state while landing on Missing Music. |
| Legacy Activity queue navigation | `activity-advanced-diagnostics-boundary-browser-verification` | The historic Activity queue bookmark retains its URL state while landing on the canonical Missing Music worklist. |
| Release decision navigation and focus | `missing-music-decision-detail-browser-acceptance` | Uses the accessible details link, verifies the canonical URL, focused heading, and visible focus indicator. |
| Match selection and explicit download confirmation | `missing-music-decision-detail-browser-acceptance` | A match is selected before a download can start; confirmation is keyboard-operable. |
| Missing Music to Downloader handoff | `missing-music-decision-detail-browser-acceptance` | Uses an opaque decision ID, excludes provider identifiers, and verifies the return action. |
| Multi-user worklist filters, status, and next step | `missing-music-worklist-browser-acceptance` | Exercises administrator-visible user filters and named release actions. |
| Settings folder/provider recovery policy | Settings recovery client tests and Settings browser suites | Settings remains the setup surface; retired per-row repair links are no longer a Missing Music UI contract. |

## Decision

1. Delete the four stale Music Queue-only browser modules.
2. Correct the retained Activity queue compatibility assertion to use the
   canonical Missing Music destination.
3. Keep the dedicated legacy-route browser acceptance suite; compatibility is
   still a supported production behavior.
4. Strengthen the canonical decision-detail browser test to focus and assert
   the accessible **Open status details for …** link before activation.
5. Continue using role-and-name locators for headings, links, buttons,
   dialogs, lists, and status regions. Do not introduce test-only CSS selectors
   or data attributes for existing accessible controls.
6. Keep browser fixtures on the `missing-music/decisions` API rather than the
   retired acquisition-release presentation API.

The only production UI change is a scoped 2px keyboard focus ring for the
release-details link. No API route, authorization rule, or database schema
changes.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Make legacy suites pass by restoring Music Queue controls | Preserves test count | Reintroduces obsolete UI and competing workflows | Rejected |
| Change only old URLs in the suites | Small diff | Still tests retired DOM, payloads, labels, and actions | Rejected |
| Delete stale suites without reviewing current coverage | Fast | Risks silently dropping user-visible contracts | Rejected |
| Retire stale suites and strengthen canonical acceptance coverage | Tests the supported workflow with meaningful, accessible contracts | Requires an explicit coverage audit | **Adopted** |

## W3C and Playwright model

WCAG 2.2 requires a visible focus indicator for keyboard-operable interfaces.
The canonical decision-detail suite therefore verifies focus and its visible
indicator when a person enters a release detail. Dynamic messages remain
exposed through `role="status"` where the UI reports an updated state.

Playwright recommends locating controls by the role and accessible name that
people use, with auto-waiting rather than custom polling. The modernized test
therefore targets the named **Open status details for Autechre — Amber** link,
not a styling class that may change without changing the user experience.

## Security and multi-user model

- Canonical Missing Music browser tests use the opaque decision ID only; they
  do not place provider peers, transfer IDs, secrets, or authorization scope in
  browser URLs.
- Worklist responses remain server-authorized. The administrator user filter is
  a request parameter, not a browser assertion of access.
- The Downloader handoff test verifies that its URL does not expose provider
  identifiers and returns to the authorized Missing Music decision.
- Retiring the old acquisition fixtures removes dead test paths that could
  incorrectly imply the browser owns release authorization or setup recovery.

## Recommendation stack

1. **One supported interaction model:** test Missing Music, not retired Music
   Queue controls.
2. **Compatibility at the route boundary:** keep a small legacy redirect test
   for saved URLs; do not replicate an entire legacy UI.
3. **Accessible contracts first:** use role, accessible name, status, and focus
   assertions before CSS implementation details.
4. **Canonical fixtures:** mock only the Missing Music decision projection and
   authorized Downloader handoff endpoints.
5. **Security regression checks:** assert opaque URLs and retain server-owned
   multi-user authorization behavior.

## Sources checked 2026-08-28

- [W3C WCAG 2.2: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible)
- [W3C Technique ARIA22: `role=status`](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22)
- [W3C WCAG 2.2: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [Playwright: Locators](https://playwright.dev/docs/locators)
- [Playwright: Auto-waiting](https://playwright.dev/docs/actionability)

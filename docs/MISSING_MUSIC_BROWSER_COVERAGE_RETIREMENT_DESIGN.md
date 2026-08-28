# Canonical Missing Music Browser Coverage Retirement — Design

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

The application now has one release-decision surface: **Missing Music**.
Historic `/app/music-queue` paths remain supported only as compatibility
redirects to Missing Music. Thirteen browser modules still attempt to interact
with the retired Music Queue page and its acquisition-release fixtures. Their
24 declared scenarios therefore wait for headings, inspector panels, and
actions that a person can no longer reach.

This change retires the obsolete browser modules and preserves coverage at the
right boundary: current Missing Music, Downloader, Activity, and the
server/integration workflow contracts.

## Evidence

The isolated `music-queue-current-work-browser-verification` scenario opens
`/app/music-queue` and waits for an **Actions** heading. The router correctly
redirects to `/app/missing`; no such heading exists there, so Playwright times
out after ten seconds. The same pattern occurs throughout the remaining
Music-Queue-only modules.

The modules are:

- `music-queue-current-work-browser-verification`
- `music-queue-manual-safe-add-confirmation-browser-verification`
- `music-queue-post-transfer-library-add-browser-verification`
- `music-queue-progress-strip-browser-verification`
- `music-queue-quality-recovery-browser-verification`
- `music-queue-release-add-diagnostics-browser-acceptance`
- `music-queue-release-progress-browser-acceptance`
- `music-queue-release-row-hierarchy-browser-verification`
- `music-queue-shared-discovery-browser-acceptance`
- `music-queue-shared-recovery-browser-acceptance`
- `music-queue-terminal-recovery-browser-acceptance`
- `music-queue-transfer-recovery-browser-verification`
- `music-queue-waiting-empty-state-browser-verification`

## Retained coverage

| Retired concern | Current coverage boundary |
| --- | --- |
| Worklist filters, account ownership, named next steps | `missing-music-worklist-browser-acceptance` |
| Release detail, keyboard focus, match selection, explicit download start | `missing-music-decision-detail-browser-acceptance` |
| Saved Music Queue paths | `missing-music-legacy-redirect-browser-acceptance` |
| Release-scoped transfer view and safe return path | `missing-music-to-downloader-browser-acceptance` and Downloader browser coverage |
| Durable discovery, transfer, quality, safe-add, retry, and ownership behavior | Server and integration tests for the acquisition pipeline and Missing Music decision services |
| Human-readable history and advanced diagnosis | Activity and Import Review browser coverage |

This is a change to browser-test ownership, not a removal of authorization,
pipeline, or release-lifecycle tests.

## Decision

1. Delete the thirteen retired Music Queue-only browser modules.
2. Keep the narrow legacy-route suite. It proves that saved URLs still land at
   the supported surface without reinstating the retired DOM.
3. Keep browser tests role- and name-based against the canonical Missing Music
   controls; do not add test-only selectors or aliases to make retired controls
   appear present.
4. Keep authoritative lifecycle and multi-user rules in server and integration
   tests, where authorization and durable state are actually enforced.
5. Do not alter the production router, API, or database schema in this
   retirement. The supported route and compatibility behavior already exist.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Restore the Music Queue view for old tests | Preserves test count | Reintroduces a competing workflow and contradicts the canonical route | Rejected |
| Point retired tests at Missing Music unchanged | Small diff | Keeps obsolete fixtures, labels, and assertions rather than testing current behavior | Rejected |
| Remove tests without a coverage audit | Fast | Could silently eliminate user-visible or security-relevant behavior | Rejected |
| Retire obsolete UI tests and retain current, layered coverage | Aligns coverage with the product and keeps authority tests at the server boundary | Fewer browser modules | **Adopted** |

## Accessibility and security rationale

The current Missing Music tests use native form controls, headings, links,
buttons, dialogs, visible keyboard focus, and named status feedback. These
are the contracts users and assistive technologies encounter. W3C guidance
requires clear headings and labels and visible focus for keyboard operation;
testing a route that immediately redirects cannot establish either property.

Multi-user scope remains server-authorized. Browser URLs contain only opaque
decision identifiers; they never embed a target user, provider identifier,
transfer ID, filesystem path, or credential. The retained administrator filter
test verifies that the UI describes scope, while the server remains the source
of permission decisions.

## Recommendation stack

1. **One decision workspace:** Missing Music owns release decisions.
2. **Narrow compatibility:** retain saved Music Queue redirects, not a second
   interactive page.
3. **Layered validation:** use browser tests for current accessible behavior;
   use server/integration tests for durable pipeline and authorization rules.
4. **No test-only product debt:** do not restore deprecated controls for
   locators.

## Sources checked 2026-08-28

- [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- [W3C WCAG 2.2: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible)
- [W3C WAI: Selecting Web Accessibility Evaluation Tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)
- [Playwright: Locators](https://playwright.dev/docs/locators)
- [Playwright: Test isolation](https://playwright.dev/docs/browser-contexts)

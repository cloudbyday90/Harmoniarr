# Music Queue Folder Setup Recovery Confirmation And Browser Verification

Status: **Implemented - 2026-07-26**

## Goal

Make a successful folder repair visible without turning Settings into an
operations console. When the server safely releases Music Queue work after a
validated folder save, Settings confirms only the number of releases returned
to automatic search. The Music Queue remains the place that shows progress.

## Research

- [WAI-ARIA `status` role](https://www.w3.org/TR/wai-aria/#status) defines a
  non-focusable, polite live region for advisory status changes. The save
  confirmation belongs in the existing inline Settings save area instead of a
  modal or focus-stealing alert.
- [W3C notification guidance](https://www.w3.org/WAI/tutorials/forms/notifications/)
  distinguishes success messages from errors that require immediate attention.
  Folder recovery is a successful result, so it should be concise and polite.
- [Playwright locators](https://playwright.dev/docs/locators) recommends
  role-based locators and retrying assertions. The browser test uses the
  Settings status role, labels, and user-visible release state rather than CSS
  timing or implementation-specific selectors.
- [Playwright actionability](https://playwright.dev/docs/actionability)
  documents the checks before interactions. The verification waits for the
  actionable folder link and visible save result instead of fixed delays.

## Options Considered

### Global Toast

Pros: visible even after scrolling away from the save bar.

Cons: duplicates the existing inline save result, disappears before a person
can confirm it, and adds another interruption to a busy Settings screen.

### Inline Save Confirmation

Pros: appears at the action that caused it, uses existing visual structure,
and can be exposed as one polite `status` region.

Cons: not visible after navigating away.

### No Confirmation

Pros: no additional interface surface.

Cons: makes a successful recovery indistinguishable from an ordinary Settings
save and encourages unnecessary manual investigation.

## Final Recommendation Stack

1. Keep `musicQueueRecovery` server-computed and bounded. The client receives
   only `releasedCount` and whether the normal discovery run started.
2. Use `settings-save-presentation.js` as the pure ESM presentation boundary.
   It accepts only a positive safe integer and otherwise falls back to the
   ordinary `Settings saved.` message.
3. Render the existing Media & storage save message as `role="status"` with
   `aria-atomic="true"`. Do not create a duplicate toast.
4. Say `Music Queue is searching` only when the server reports that it started
   the normal discovery run; otherwise say it `will search` automatically.
5. Keep the phrase release-centered and avoid paths, request ids, provider
   state, mount information, and any promise that a download has begun.
6. Run browser coverage through the Docker/Testcontainers-backed app runtime:
   `Needs setup` -> `Set up folders` -> validated save confirmation ->
   `Searching`, with no candidate or diagnostic action.

## Security And Reliability

- The browser does not send a release id, recovery code, or filesystem path to
  invoke recovery. It submits the existing Settings form; the server decides
  eligibility after its readiness checks.
- Presentation treats counts as untrusted response data and only renders a
  positive safe integer.
- The normal confirmation exposes a count only. It does not disclose mounted
  paths, provider responses, credentials, or background-run identifiers.
- The separate server test remains the authority for the targeted recovery
  mutation: unrelated quality stops, exhausted searches, provider pauses,
  download recovery, and ordinary Settings saves remain out of scope.

## Outcome

- `useSettingsForm` now derives the save text from the response using a pure
  presentation module.
- Media & storage announces the successful result through one polite live
  status region.
- Browser verification starts from a Music Queue folder stop, follows the
  normal `Set up folders` handoff, saves valid folders, confirms the bounded
  automatic-search result, and observes the release return to `Searching`.
- Client tests cover singular, plural, deferred, ordinary, and malformed
  recovery responses.
- The same browser path found and fixed a native-form validity defect: the
  default maximum artwork dimension (`4000`) did not satisfy its previous
  64-pixel increment. The field now accepts one-pixel increments and the
  verification asserts that the complete Settings form is valid before save.

## Next High-Value Item

Extend the automatic search lifecycle proof to a quality-safe selection and
download handoff: demonstrate that a release returns from folder setup,
automatically chooses a policy-compliant match, and reaches Downloader without
opening Advanced diagnostics. Keep failure coverage explicit for an
unacceptable FLAC/quality result and for an unavailable provider.

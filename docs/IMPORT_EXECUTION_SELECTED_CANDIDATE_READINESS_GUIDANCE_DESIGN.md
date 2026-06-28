# Import Execution Selected Candidate Readiness Guidance Design

Date: 2026-06-28

## Outcome

Wanted rows now show a bounded next-step guidance block when discovery or
Import Review state exists but the operator still has to act before Downloader
activity is expected.

This closes the walkthrough confusion where a release could show `Selected for
download` while Downloader stayed empty. The UI now explicitly distinguishes:

- run discovery before any candidates exist
- open Import Review when search responses have candidate results
- select a pending candidate before download execution
- start the download run after a candidate is selected
- watch Downloader after transfer enqueue evidence exists
- review diagnostics when provider acceptance fails or is blocked

## Official Sources Reviewed

- Vue computed properties:
  <https://vuejs.org/guide/essentials/computed.html>. Derived row guidance stays
  in computed presentation state and pure helpers instead of mutating release
  data in the template.
- Vue conditional rendering:
  <https://vuejs.org/guide/essentials/conditional>. The guidance block is
  rendered only when the helper returns actionable state.
- Playwright locators:
  <https://playwright.dev/docs/locators>. Browser verification uses scoped
  role/text locators matching the operator-visible table state.
- Playwright assertions:
  <https://playwright.dev/docs/test-assertions>. Tests wait on visible guidance
  text instead of fixed sleeps.
- W3C ARIA status messages:
  <https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22>. The next-step block
  uses `role="status"` for advisory workflow state that should be discoverable
  without interrupting the operator.
- OWASP REST Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>.
  User-facing messages remain generic and bounded; they do not expose raw
  provider payloads, paths, or internal stack details.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  The presentation layer keeps diagnostic summaries bounded to workflow state
  and avoids surfacing sensitive provider data.

## Recommendation

Add the readiness guidance as client presentation derived from the existing
Wanted read model.

Pros:

- No new privileged route, schema change, or provider polling path.
- Keeps Import Review as the explicit operator action boundary.
- Makes selected-but-not-enqueued state understandable from Activity > Wanted.
- Uses a pure helper that is easy to unit test and reuse.

Cons:

- It explains the next action but does not execute it from Wanted.
- The guidance depends on the existing aggregate state being fresh.
- It adds one more compact status block to a dense table cell.

## Final Stack

- Pure presentation helper:
  `src/client/lib/wanted-release-normalization.js`
- Wanted table rendering:
  `src/client/views/ActivityWantedView.vue`
- Unit tests:
  `test/client/wanted-release-normalization.test.js`
- Browser verification:
  `test/browser/wanted-import-review-selection-handoff-browser-verification.test.js`

## Security Notes

- The helper only reads bounded release, discovery, Import Review, and execution
  summary fields already returned by the Wanted read path.
- No API key, provider response body, local filesystem path, or raw slskd file
  list is rendered.
- The UI does not add client-side authorization. Mutations still happen through
  existing CSRF-backed Import Review routes.

## Follow-Up

Import Review selected-run progress refresh visibility is complete; see
[IMPORT_REVIEW_SELECTED_RUN_PROGRESS_REFRESH_VISIBILITY_DESIGN.md](IMPORT_REVIEW_SELECTED_RUN_PROGRESS_REFRESH_VISIBILITY_DESIGN.md).

The next high-value item is **Import Review blocked/failed execution retry
guidance**: make blocked and queue-failed execution items provide an explicit
retry/reselect path from the diagnostic panel, with browser verification for the
failure-state recovery loop.

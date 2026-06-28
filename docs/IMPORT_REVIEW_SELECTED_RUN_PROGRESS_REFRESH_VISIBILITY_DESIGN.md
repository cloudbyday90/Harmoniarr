# Import Review Selected-Run Progress Refresh Visibility Design

Date: 2026-06-28

## Outcome

Import Review now shows a selected-run progress notice inside the `Queue
selected for download` panel. The notice explains whether the run is:

- queued and waiting for the execution worker
- actively syncing transfer state
- refreshing selected-run detail
- running without transfer observations yet
- showing current Downloader transfer progress
- failed or blocked and needs diagnostic review
- complete and ready for the next workflow step

This makes the post-selection path clearer: `Start download run` creates the
execution run, then the operator can stay in Import Review and use `Refresh` or
`Sync transfer state` to see accepted, active, blocked, failed, completed, or
missing transfer evidence.

## Official Sources Reviewed

- Vue computed properties:
  <https://vuejs.org/guide/essentials/computed.html>. The component derives the
  notice through a computed value and keeps the state matrix in a pure helper.
- Vue conditional rendering:
  <https://vuejs.org/guide/essentials/conditional.html>. The notice renders only
  when a selected execution run exists.
- Playwright locators:
  <https://playwright.dev/docs/locators>. Browser coverage asserts
  operator-visible text scoped to the execution panel.
- Playwright assertions:
  <https://playwright.dev/docs/test-assertions>. The browser test uses
  retrying assertions/waits instead of fixed sleeps.
- W3C ARIA status messages:
  <https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22>. The notice uses
  `role="status"` with polite live-region behavior for non-interrupting progress
  updates.
- OWASP REST Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>.
  The UI remains a bounded presentation layer and does not expose raw provider
  responses or stack details.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  User-facing diagnostics stay summarized and avoid provider secrets, local
  filesystem paths beyond existing sanitized previews, and raw payload dumps.

## Recommendation

Keep the selected-run progress guidance as client presentation derived from the
existing Import Review execution summary and selected run detail.

Pros:

- No new route, schema, provider polling path, or authorization surface.
- Makes the existing `Refresh` and `Sync transfer state` controls legible.
- Uses a pure helper with focused unit tests for the state matrix.
- Browser coverage proves the pending-run and synced-transfer states in the real
  operator journey.

Cons:

- It does not auto-run transfer sync on every panel render.
- It depends on existing execution summary freshness and heartbeat behavior.
- It explains blocked/failed states but leaves repair/retry workflow to later
  diagnostics work.

## Final Stack

- Pure presentation helper:
  `src/client/lib/import-candidate-presentation.js`
- Execution panel rendering:
  `src/client/components/ImportCandidateExecutionPanel.vue`
- Unit tests:
  `test/client/import-candidate-presentation.test.js`
- Browser verification:
  `test/browser/wanted-import-review-selection-handoff-browser-verification.test.js`

## Security Notes

- The notice reads only the already-bounded selected run summary and execution
  item counts.
- It does not render raw slskd responses, API keys, request headers, exception
  stacks, or full provider payloads.
- Mutations remain behind the existing CSRF-backed Import Review start/sync
  routes; the new work only improves presentation.

## Follow-Up

The next high-value item is **Import Review blocked/failed execution retry
guidance**: make blocked and queue-failed execution items provide an explicit
retry/reselect path from the diagnostic panel, with browser verification for the
failure-state recovery loop.

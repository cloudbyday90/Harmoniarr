# Request Detail Failed-Import Recovery Handoff

## Status

Implemented in June 2026.

## Problem

Request Detail now exposes operator-only diagnostics and an `Open in import
review` drill-through for failed pipeline candidates. The unverified gap was
the target workspace: a candidate query could navigate to Import Review but
still fail to select the candidate, lose failure context, or hide the recovery
control needed to reopen a failed candidate.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright assertions: https://playwright.dev/docs/test-assertions
- Playwright actionability: https://playwright.dev/docs/actionability
- MDN `<details>` element: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
- WCAG 2.2 focus visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Verify the handoff through browser-visible route, text, and focus state | Proves the actual operator workflow instead of only query construction | Requires Import Review fixture coverage |
| Keep `candidate` query selection independent from the current queue filter | Failed candidates can open even while the queue list remains on its default pending filter | The list can show zero matching rows while detail is populated |
| Seed Import Review fixture data through the existing browser fixture layer | Reuses the production API client/composable path | Adds fixture surface for import-candidate endpoints |
| Assert recovery action reachability without executing the mutation in this slice | Keeps this test focused on handoff and selection | Leaves full action-state verification for the next slice |

## Final Recommendation Stack

- Preserve Request Detail's operator-only `activity-candidates?candidate=...`
  link.
- Use Import Review's existing query-state synchronization as the selection
  contract.
- Extend `metadata-browser-fixtures.js` with modular Import Review seed data for
  queue list, candidate detail, planning preview, stage summaries, run
  summaries, and simple transition endpoints.
- Add browser verification that:
  - expands the failed Request Detail candidate,
  - activates `Open in import review` by keyboard,
  - lands on `/app/activity/candidates?candidate=candidate-private`,
  - selects the failed candidate detail even when the pending queue filter shows
    zero rows,
  - shows the source folder and validation blocker,
  - and exposes a focusable `Reopen` recovery action.

## Implementation Outcome

- Added `seedMetadataImportReviewWorkspace` to the browser metadata fixture.
- Added fixture-backed Import Review endpoints for:
  - `GET /api/v1/import-candidates`
  - `GET /api/v1/import-candidates/:id`
  - candidate planning/apply previews
  - selected/import-pending summaries
  - execution/apply/media-inspection summaries
  - simple select/hold/reject/reopen transitions for future browser tests
- Added
  `test/browser/request-detail-failed-import-recovery-handoff-browser-verification.test.js`.

## Security Notes

The recovery control remains admin/operator UI only because Request Detail only
renders the drill-through when the role-projected candidate includes operator
diagnostics, and Import Review already gates candidate-management controls to
admin sessions. The fixture keeps requester projection tests separate so private
paths, peer names, candidate IDs, run IDs, and recovery controls stay out of
requester flows.

## Next High-Value Item

Verify Import Review failed-candidate recovery action states. This handoff slice
proves the operator lands on the right failed candidate with a focusable
`Reopen` action; the adjacent risk is whether executing `Reopen` updates the
candidate status, refreshes summaries/queue state, preserves focus/error
feedback, and handles transition failures cleanly.

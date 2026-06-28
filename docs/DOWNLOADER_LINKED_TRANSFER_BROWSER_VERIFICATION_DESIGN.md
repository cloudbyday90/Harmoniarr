# Downloader Linked Transfer Browser Verification Design

Status: Implemented
Date: 2026-06-27

## Purpose

The Downloader read model now links live transfer rows back to Import Review
candidates when persisted execution evidence contains the matching transfer.
This browser verification proves that the operator-visible handoff works end to
end:

- the Downloader row exposes `Open candidate`
- the row link navigates to the selected Import Review candidate
- the transfer diagnostics drawer exposes the same handoff
- the drawer link navigates to the same selected candidate

## Research Summary

- Playwright recommends role and text locators because they match how users and
  assistive technology perceive the page. The test uses role locators for
  headings, rows, buttons, links, progress bars, and dialogs.
- Playwright locators are retryable and re-resolve after DOM changes, which is
  appropriate for Vue route transitions and async fixture hydration.
- Playwright best practices favor testing user-visible behavior rather than
  implementation internals. The fixture owns API responses, while the
  assertions verify visible Downloader and Import Review behavior.
- Vue Router supports named-route navigation with query objects, matching the
  existing `activity-candidates?candidate=...&status=all` handoff contract.
- OWASP object-property authorization guidance supports keeping fixture and UI
  assertions bounded to candidate identifiers, statuses, and user-visible
  source labels rather than raw execution snapshots or provider payloads.

Sources:

- Playwright locators: https://playwright.dev/docs/locators
- Playwright auto-waiting/actionability: https://playwright.dev/docs/actionability
- Playwright best practices: https://playwright.dev/docs/best-practices
- Vue Router programmatic navigation: https://router.vuejs.org/guide/essentials/navigation.html
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options Considered

### Option A: Unit-test only

Pros:

- Fast and already mostly covered by route-helper and drawer contract tests.
- No browser runtime dependency.

Cons:

- Does not prove the native dialog opens.
- Does not prove the row and drawer links navigate through Vue Router into
  Import Review.
- Misses interaction bugs in the built client bundle.

### Option B: Add a full database-backed integration path

Pros:

- Exercises the real server read model, database, and client together.

Cons:

- Requires more setup and live provider-like state than needed for this UI
  handoff.
- Would be slower and more brittle for a browser contract whose behavior is
  mostly client routing and rendering.

### Option C: Add a deterministic browser fixture

Pros:

- Proves the built client behavior in Chromium.
- Keeps the fixture narrow: Downloader queue API plus existing Import Review
  fixture state.
- Uses user-facing locators and route-state assertions.
- Caught a real native-dialog open-path bug.

Cons:

- It does not prove the SQL correlation query; that remains covered by server
  unit tests.
- It requires rebuilding the client bundle before running the browser scenario.

## Final Recommendation

Use Option C for this slice.

Keep SQL/read-model proof in focused server tests. Use browser verification for
the operator handoff:

- seeded live Downloader transfer
- seeded Import Review candidate detail and preview
- row-level handoff
- drawer-level handoff
- route query assertions for selected candidate context

## Security Notes

- The browser fixture exposes only the same bounded fields expected from the
  public Downloader read model.
- The fixture does not expose API keys, raw slskd payloads, raw
  `planning_snapshot`, provider exceptions, or hidden filesystem paths beyond
  the existing Import Review operator fixture.
- The test runs as an admin because Downloader and Import Review are
  operator/admin surfaces.

## Implementation Outcome

- Added `testing/browser/downloader-browser-fixtures.js` with a narrow
  `/api/v1/downloader/queue` fixture for a linked live transfer.
- Added
  `test/browser/downloader-import-candidate-linkage-browser-verification.test.js`
  proving row and drawer handoffs to Import Review.
- Completed the reverse handoff in
  `IMPORT_REVIEW_DOWNLOADER_TRANSFER_HANDOFF_DESIGN.md`, where Import Review
  execution live-transfer rows can open the matching Downloader details drawer.
- Fixed `DownloaderTransferDetailDrawer.vue` native dialog opening by binding
  the Vue function ref correctly and opening on mount-time ref assignment.
- Extended `downloader-detail-drawer-contract.test.js` to guard the drawer ref
  and linked-candidate handoff contract.

## Validation

Focused validation:

- `npm run build:client`
- `node --test test/client/downloader-detail-drawer-contract.test.js test/client/downloader-import-review-link.test.js`
- `node --test --test-concurrency=1 test/browser/downloader-import-candidate-linkage-browser-verification.test.js`

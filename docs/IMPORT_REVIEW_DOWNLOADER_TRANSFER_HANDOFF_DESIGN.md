# Import Review Downloader Transfer Handoff Design

Status: Implemented
Date: 2026-06-27

## Purpose

Import Review execution detail can show live slskd transfer observations after a
download run is reconciled. After Downloader rows gained handoffs back to Import
Review candidates, the remaining workflow gap was the reverse path: from an
Import Review execution transfer row back to the matching live Downloader row.

This design adds a route-safe handoff from Import Review live transfer rows to
Downloader transfer details.

## Research Summary

- Vue Router supports named-route navigation with structured query objects,
  which fits a stable `downloader` route handoff without constructing URLs by
  hand.
- MDN documents `URLSearchParams` as the browser-native abstraction for reading
  and comparing query parameters. The browser proof checks the generated query
  state through `URL`.
- Playwright recommends role and text locators for resilient browser tests
  because they match user-visible behavior and accessibility semantics.
- Playwright's auto-waiting/actionability model is appropriate for Vue route
  changes and async API fixture hydration.
- OWASP object-property authorization guidance favors bounded task-specific
  fields. This handoff routes only transfer `username` and `id`; it does not add
  a new API or expose raw provider snapshots.

Sources:

- Vue Router programmatic navigation: https://router.vuejs.org/guide/essentials/navigation.html
- MDN `URLSearchParams`: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
- Playwright locators: https://playwright.dev/docs/locators
- Playwright auto-waiting/actionability: https://playwright.dev/docs/actionability
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options Considered

### Option A: Link to Downloader without opening details

Pros:

- Very small change.
- Avoids adding route-query handling to Downloader.

Cons:

- Operators still need to find the matching row manually.
- The handoff is weak when multiple transfers have similar filenames.

### Option B: Add a new Downloader transfer-detail route

Pros:

- Clean route shape for one transfer detail.
- Could become bookmarkable in the future.

Cons:

- Adds route and view complexity for an interaction already supported by the
  existing drawer.
- Creates a second transfer-detail surface before there is enough need.

### Option C: Add a query-driven details handoff to the existing Downloader page

Pros:

- Reuses the existing Downloader page and diagnostics drawer.
- Keeps routing bounded to `username`, `transferId`, and `open=details`.
- Requires no new server API or mutation path.
- Works with the existing Import Review live-transfer evidence.

Cons:

- The handoff can only open details while the transfer is still visible in the
  live Downloader queue.
- If slskd no longer reports the transfer, Downloader will load normally
  without opening a drawer.

## Final Recommendation

Use Option C.

The route contract is:

```text
/app/downloader?username=<source-user>&transferId=<provider-transfer-id>&open=details
```

`ImportCandidateExecutionPanel` should render `Open in Downloader` only for
live transfers that include both `username` and `id`. `DownloaderView` should
select and open the matching row after the queue read model loads.

## Security Notes

- No new backend route or mutation is added.
- Existing role protection remains unchanged for Downloader and Import Review.
- The route query contains only the provider transfer id and source username
  already visible to operators in both surfaces.
- The route does not expose API keys, raw slskd payloads, raw execution
  snapshots, filesystem move plans, or provider exceptions.

## Implementation Outcome

- Added `downloader-transfer-route.js`, a shared client helper for building and
  normalizing Downloader transfer handoff routes.
- `ImportCandidateExecutionPanel.vue` now renders `Open in Downloader` beside
  live transfer rows with complete transfer identity.
- `DownloaderView.vue` now reads the transfer handoff query, waits for the
  queue read model, and opens the matching diagnostics drawer.
- Closing a query-opened drawer removes the handoff query keys while preserving
  unrelated query state.
- A follow-up stale-link notice now explains direct handoff URLs whose transfer
  has disappeared from the live Downloader queue. See
  `DOWNLOADER_STALE_TRANSFER_HANDOFF_NOTICE_DESIGN.md`.
- A follow-up transfer sync notice now explains Import Review execution
  summaries whose live Downloader row has disappeared after completion,
  failure, or temporary queue loss. See
  `IMPORT_REVIEW_TRANSFER_SYNC_NOTICE_DESIGN.md`.
- Added client helper and component contract tests.
- Added a browser scenario proving the Import Review execution transfer link
  opens the matching Downloader details drawer.

## Validation

Focused validation:

- `node --test test/client/downloader-transfer-route.test.js test/client/import-review-downloader-handoff-contract.test.js test/client/downloader-detail-drawer-contract.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-downloader-transfer-handoff-browser-verification.test.js`

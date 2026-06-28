# Import Review Transfer Sync Notice Design

Status: Implemented
Date: 2026-06-27

## Purpose

Import Review execution detail can receive a completed or failed transfer summary
after Downloader has already dropped the live transfer row. Without a live row,
operators could see a successful execution summary and no `Open in Downloader`
handoff, which looked like the transfer never started.

This design adds a durable transfer-state notice for execution items that have
summary evidence but no live Downloader row.

## Research Summary

- Vue recommends keeping conditional rendering simple and moving derived state
  into reusable computed/helper logic when it is reused by the template.
- Playwright recommends user-visible role and text locators for browser proofs,
  backed by actionability auto-waiting for async UI updates.
- MDN documents the ARIA `status` role as a polite live-region pattern for
  non-disruptive status updates.
- OWASP object-property guidance favors bounded task-specific fields. The
  notice uses normalized transfer counts and status only; it does not expose raw
  provider payloads or secrets.

Sources:

- Vue conditional rendering: https://vuejs.org/guide/essentials/conditional.html
- Vue computed properties: https://vuejs.org/guide/essentials/computed.html
- Playwright locators: https://playwright.dev/docs/locators
- Playwright auto-waiting/actionability: https://playwright.dev/docs/actionability
- MDN ARIA `status` role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options Considered

### Option A: Leave the summary table as the only evidence

Pros:

- No new UI.
- Uses data already available in the execution panel.

Cons:

- Operators must infer why the live row and Downloader link are gone.
- Completed transfers can look indistinguishable from incomplete handoff data.

### Option B: Always render a generic "no live transfer" notice

Pros:

- Simple to implement.
- Explains why no row is shown.

Cons:

- Too vague for completed, failed, and temporarily missing transfers.
- Risks adding noise when there is no meaningful transfer evidence.

### Option C: Render a derived notice only when summary evidence exists without live rows

Pros:

- Explains completed, failed, missing, and stale in-progress states using the
  normalized transfer summary already exposed by the read model.
- Keeps the route-safe `Open in Downloader` handoff limited to live rows with
  complete transfer identity.
- Uses a small reusable presentation helper with focused unit coverage.

Cons:

- Adds one more derived state path to the Import Review panel.
- Requires browser coverage to ensure the notice remains visible in the real
  route and fixture flow.

## Final Recommendation

Use Option C.

`buildLiveTransferSyncNotice(item)` derives the notice from
`liveTransferSummary` or the persisted transfer observation fallback. The Vue
panel renders the notice as a polite `role="status"` block only when no live
transfer rows are present.

## Security Notes

- No new backend endpoint, mutation, or provider call is added.
- The notice uses normalized counts/status already present in the execution
  read model.
- Raw Downloader payloads, file operation internals, API keys, and provider
  exceptions are not exposed.
- Existing Import Review route protection remains unchanged.

## Implementation Outcome

- Added `buildLiveTransferSyncNotice` to the Import Review presentation helper.
- `ImportCandidateExecutionPanel.vue` now explains completed, failed,
  temporarily missing, and stale in-progress transfer summaries when no live
  Downloader row exists.
- The `Open in Downloader` handoff remains available only for live rows with
  complete transfer identity.
- Added unit coverage for the derived notice states.
- Added browser coverage proving a completed transfer summary remains visible
  after the live Downloader row disappears.

## Validation

Focused validation:

- `node --test test/client/import-candidate-presentation.test.js test/client/import-review-downloader-handoff-contract.test.js test/client/downloader-transfer-route.test.js`
- `node --test --test-concurrency=1 test/browser/import-review-downloader-transfer-handoff-browser-verification.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `npm run build:client`

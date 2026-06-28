# Downloader Stale Transfer Handoff Notice Design

Status: Implemented
Date: 2026-06-27

## Purpose

Import Review can route an operator to Downloader with a specific live transfer
identity. That transfer can disappear before the operator opens or reloads the
link because slskd may complete, remove, or age out the transfer from the live
queue.

Before this change, Downloader silently ignored the route query when the
transfer was not in the current queue. This design makes that state explicit
without treating it as an application error.

## Research Summary

- Vue Router documents `useRoute` and `useRouter` for Composition API route
  state and recommends watching the specific route properties expected to
  change rather than the whole route object.
- MDN documents `role="status"` as a polite live-region role, which fits an
  advisory state that should be announced without interrupting the operator.
- Playwright recommends user-facing role and text locators, and its locator
  auto-waiting model fits Vue route changes plus async queue fixture hydration.
- OWASP object-property authorization guidance supports keeping route and UI
  state bounded. The notice does not add a backend read path and does not expose
  provider secrets or raw transfer payloads.

Sources:

- Vue Router Composition API: https://router.vuejs.org/guide/advanced/composition-api.html
- MDN ARIA `status` role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- Playwright locators: https://playwright.dev/docs/locators
- Playwright auto-waiting/actionability: https://playwright.dev/docs/actionability
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options Considered

### Option A: Keep the current silent fallback

Pros:

- No new UI.
- Avoids explaining a provider lifecycle edge case.

Cons:

- Operators cannot tell whether the link failed, the page is still loading, or
  the transfer disappeared.
- Direct reloads from Import Review look broken when the route query remains in
  the URL.

### Option B: Show a blocking error

Pros:

- Highly visible.
- Makes failures impossible to miss.

Cons:

- The state is not a Harmoniarr error. The queue can legitimately move on.
- Error treatment would add avoidable alert noise on a workflow that already has
  persisted Import Review history.

### Option C: Show a polite, dismissible stale-transfer notice

Pros:

- Clearly explains that the live transfer is no longer visible.
- Keeps the page usable and the queue visible.
- Lets the operator clear only the handoff query keys.
- Requires no backend route, no mutation, and no new provider polling.

Cons:

- Does not automatically navigate back to Import Review because the Downloader
  route intentionally carries only transfer identity, not candidate identity.

## Final Recommendation

Use Option C.

Downloader should show a `role="status"` notice only when all of these are true:

- the route query asks for `open=details`
- the query includes a complete transfer identity
- the queue has loaded
- the current queue does not contain that transfer

The notice should be non-blocking, explain that the transfer may have completed,
been removed, or aged out of the live Soulseek list, and provide `Clear link` to
remove the bounded handoff query state.

## Security Notes

- No backend route, mutation, or provider call was added.
- The route remains bounded to `open`, `transferId`, and `username`.
- The notice does not render raw slskd payloads, filesystem plans, API keys,
  exceptions, or Import Review execution snapshots.
- Existing Downloader route authorization remains the access boundary.

## Implementation Outcome

- `DownloaderView.vue` now derives `routeTransferLookupNotice` from the existing
  normalized route query and current queue state.
- A polite `role="status"` card explains stale direct transfer links.
- `Clear link` reuses the existing handoff-query removal helper so unrelated
  query state is preserved.
- `testing/browser/downloader-browser-fixtures.js` now includes an empty
  configured queue fixture for stale-link scenarios.
- The Import Review Downloader handoff browser test now covers both the happy
  path and a direct stale-transfer reload.

## Validation

Focused validation:

- `node --test test/client/downloader-transfer-route.test.js test/client/import-review-downloader-handoff-contract.test.js test/client/downloader-detail-drawer-contract.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-downloader-transfer-handoff-browser-verification.test.js`

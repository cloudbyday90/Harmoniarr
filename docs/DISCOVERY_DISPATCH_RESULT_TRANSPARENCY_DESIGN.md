# Discovery Dispatch Result Transparency Design

Status: Implemented
Date: 2026-06-27
Owner: Library automation + operator UX

## Purpose

Operators can now start discovery dispatch from Wanted and verify that Import
Review candidates appear. The next gap was row-level transparency: after a
dispatch run, each wanted release should explain what happened to its search.

This design adds compact discovery result evidence to Wanted rows so operators
can distinguish:

- searches that produced Import Review candidates
- searches that returned no candidates and are cooling down
- failed dispatch attempts
- exhausted automatic search attempts
- releases queued for a future dispatch

## Research Sources

Official sources reviewed for the June 2026 implementation:

- slskd configuration documentation:
  https://github.com/slskd/slskd/blob/master/docs/config.md
- slskd relay/controller documentation:
  https://github.com/slskd/slskd/blob/master/docs/relay.md
- OWASP API Security 2023 API5 Broken Function Level Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/
- OWASP REST Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- Vue list rendering documentation:
  https://vuejs.org/guide/essentials/list.html
- Playwright locator documentation:
  https://playwright.dev/docs/locators

Relevant findings:

- Provider credentials and API keys must remain server-side; row-level UI should
  summarize operational outcomes only.
- Browser verification should assert visible outcomes with stable locators and
  avoid fixed sleeps.
- Existing discovery request evidence already records dispatch success,
  dispatch failure, search result counts, and exhausted-search state; no schema
  migration is required.

## Options

### Option A: Only Show Latest Run Totals

Keep discovery result visibility at the top-level dispatch card.

Pros:

- Simple UI.
- No additional row content.

Cons:

- Operators still cannot see which release produced candidates or no results.
- Does not explain why individual wanted rows remain pending.

### Option B: Add A Separate Dispatch Detail Page

Create a dedicated route for per-run release outcomes.

Pros:

- Can grow into deeper diagnostics.
- Keeps Wanted table compact.

Cons:

- Requires more navigation for the common question.
- Duplicates evidence already attached to wanted release rows.

### Option C: Add Compact Wanted Row Result Projection

Derive a row-level dispatch result from `discoveryRequest.evidence` and render it
in the Wanted table.

Pros:

- Uses existing durable evidence.
- Keeps the answer next to the affected release.
- Requires no schema or route changes.
- Preserves existing admin-only discovery detail projection.

Cons:

- Adds a table column and detail row.
- Deeper run-level troubleshooting still belongs in Background Jobs or Import
  Review.

## Recommendation Stack

Use Option C.

Implementation stack:

- `buildDiscoveryDispatchResult()` in
  `src/client/lib/wanted-release-normalization.js` owns pure evidence parsing.
- `ActivityWantedView.vue` renders a `Discovery` column plus optional detail
  row with last search, search id, attempts, files, and exhaustion reason.
- `testing/browser/wanted-browser-fixtures.js` models candidate-producing and
  zero-candidate searches without provider secrets.
- Existing `library_discovery_requests.evidence` remains the source of truth.

Security posture:

- No slskd API keys or provider credentials are exposed.
- Requester projections still omit discovery details at the route layer.
- The manual dispatch route remains fresh-admin and CSRF protected.
- Row-level messages are summaries of already-authorized operator evidence.

## Implemented Behavior

Wanted rows now show:

- `1 candidate` with `Last search produced Import Review candidates.`
- `No candidates` with cooldown retry context
- `Search failed` when `lastDispatchFailure` exists
- `No results` when automatic search attempts are exhausted
- `Ready to search`, `Cooling down`, `Blocked`, or `Not queued` fallback states

The existing recovery notice for `download_recovery_exhausted` remains
unchanged and appears below the row.

## Validation

Focused validation:

- `node --test test/client/wanted-release-normalization.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/activity-releases-wanted-browser-verification.test.js`

The browser fixture now verifies candidate-producing and no-candidate dispatch
outcomes on the Wanted table.

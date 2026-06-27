# My Requests Card-Grid Browser Verification

Status: **Implemented.** This document records the design and outcome for
browser-verifying the My Requests request-card grid.

It builds on:

- [ACTIVITY_RELEASES_WANTED_BROWSER_VERIFICATION_DESIGN.md](ACTIVITY_RELEASES_WANTED_BROWSER_VERIFICATION_DESIGN.md)
- [MISSING_RELEASE_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md](MISSING_RELEASE_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md)
- [PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md)
- [CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)
- [KEYBOARD_FOCUS_AUDIT_DESIGN.md](KEYBOARD_FOCUS_AUDIT_DESIGN.md)

---

## 1. Purpose

My Requests is the remaining request-card grid in the platform-wide roving
rollout. It differs from release-card grids because each card is itself the
link target and the status/date area is informational, not a secondary action
row. The browser proof needs to verify:

- one roving Tab stop across request cards;
- visible focus and Arrow/Home/Control+Home/Control+End movement;
- status filtering against real request payload fields;
- keyboard activation into request detail.

---

## 2. Research (official sources)

Sources were located via web search; URLs were not assumed.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex | [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Keep one `tabindex="0"` target in the composite and move focus by updating roving state. |
| Layout grid behavior | [W3C APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and [Layout Grid Examples](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/) | A grid of independent link-like cards can reduce Tab stops while preserving arrow-key movement. |
| Native semantics | [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) | Preserve the existing native list of request cards; do not introduce table semantics for card content. |
| Focus visibility | [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) and [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Browser coverage should assert that the focused request card has a visible focus indicator. |
| Playwright locators/input | [Playwright Best Practices](https://playwright.dev/docs/best-practices), [Locators](https://playwright.dev/docs/locators), and [Actions](https://playwright.dev/docs/input) | Prefer role/name locators around visible UI and real keyboard input for Tab/Arrow/Enter flows. |

---

## 3. Recommendations, pros, and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Verify roving only | Fastest path | Misses the My Requests-specific filter and activation risks | Rejected. |
| Browser-test roving, filters, and detail activation | Covers the actual user workflow and request-card selector | Requires a narrow media-request fixture | **Adopted.** |
| Reuse wanted/release fixtures | Fewer files | Wrong API shape; would blur request-specific contracts | Rejected. |
| Add a dedicated media-request browser fixture | Deterministic and reusable for future request-flow browser specs | Adds one small ESM fixture | **Adopted.** |
| Keep filter logic inline in the view | No new helper | The current bug was caused by inline field assumptions | Rejected. |
| Extract request filter-status mapping to a pure helper | Unit-testable and documents the API contract | One small presentation helper | **Adopted.** |

---

## 4. Final recommendation stack

1. **Pure filter-status helper.** Map current media request payloads
   (`requestState` + `fulfillmentStatus.code`) into the existing My Requests
   filter buckets: pending, downloading, complete, failed.
2. **Focused browser suite.** Verify `/app/my-requests` renders the request
   grid, roves across all cards, filters to the downloading request, restores
   the full grid, and opens request detail from the focused card with `Enter`.
3. **Dedicated media-request fixture.** Intercept only request read endpoints:
   list, summary, detail, pipeline, and events. Do not intercept mutations.
4. **Security posture.** The production API remains scoped through
   `scope=mine`; the fixture is browser-test-only and no auth, CSRF, or
   persistence behavior changes are introduced.

---

## 5. Outcome

| File | Change |
| --- | --- |
| `src/client/lib/my-requests-presentation.js` | Adds `getMyRequestFilterStatus()` for current request payloads. |
| `src/client/views/MyRequestsView.vue` | Filters by `getMyRequestFilterStatus()` instead of the nonexistent `request.status` field. |
| `test/client/my-requests-presentation.test.js` | Covers the new filter-status mapping. |
| `testing/browser/media-request-browser-fixtures.js` | New deterministic media-request fixture for My Requests browser specs. |
| `test/browser/my-requests-card-grid-keyboard-roving.test.js` | New browser suite proving roving movement, status filtering, and keyboard activation into request detail. |
| `docs/DISCOVER_FOLLOWUP_DESIGN_AREAS.md` | Moves My Requests browser verification into Completed and narrows the remaining proposal. |
| `docs/IMPLEMENTATION_TASK_LIST.md` | Updates the current-status tracker with the My Requests verification slice. |

---

## 6. Validation

Validation for this slice:

- `node --test test/client/my-requests-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/my-requests-card-grid-keyboard-roving.test.js test/browser/activity-releases-wanted-browser-verification.test.js`
- `npm run lint:test`
- `npm run lint:client`
- `git diff --check`

The browser suite uses the existing skip behavior when Chromium or the local
database/container runtime is unavailable.

# Activity Releases/Wanted Browser Verification

Status: **Implemented.** This document records the design and outcome for
browser-verifying Activity Releases and Activity Wanted.

It builds on:

- [MISSING_RELEASE_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md](MISSING_RELEASE_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md)
- [PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md)
- [CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)
- [KEYBOARD_FOCUS_AUDIT_DESIGN.md](KEYBOARD_FOCUS_AUDIT_DESIGN.md)

---

## 1. Purpose

Activity has two remaining high-value release surfaces:

- **Activity Releases** renders two release-card grids: recent and upcoming
  monitored-artist release groups.
- **Activity Wanted** renders a tabular acquisition workbench with wanted
  releases and an operator recovery action.

The goal is to prove both surfaces in a real browser without changing their
information architecture. Releases stays a roving release-card grid; Wanted
stays a table because expected/matched/missing counts are tabular data.

---

## 2. Research (official sources)

Sources were located via web search; URLs were not assumed.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex | [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Composite collections should keep one Tab stop and move focus inside the component with arrow keys. |
| Layout grid behavior | [W3C APG — Layout Grid Examples](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/) | Card-like link/button grids can use arrow navigation after focus enters the collection. |
| Native semantics | [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) | Use native list semantics for card grids and native table semantics for tabular wanted data instead of applying ARIA roles that override correct HTML. |
| Focus visibility | [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) and [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Browser proof should verify visible focus on custom roving cards and keyboard-reachable controls. |
| Playwright locators | [Playwright Locators](https://playwright.dev/docs/locators) and [Best Practices](https://playwright.dev/docs/best-practices) | Prefer user-facing role/name locators and small deterministic browser scenarios. |
| Playwright keyboard input | [Playwright Actions](https://playwright.dev/docs/input) and [Keyboard API](https://playwright.dev/docs/api/class-keyboard) | Use Playwright key events for Tab/Arrow/Home/End behavior rather than synthetic DOM dispatch. |

---

## 3. Recommendations, pros, and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Convert Activity Wanted to cards | Visually consistent with Missing | Loses tabular scanability for counts/status/date and creates churn outside the verification goal | Rejected. |
| Verify Activity Releases only | Covers the card-grid rollout | Leaves the operator recovery action unproven | Rejected. |
| Verify Releases grids plus Wanted table/action | Matches each component's semantics and covers both Activity release surfaces | Requires two narrow fixtures | **Adopted.** |
| Reuse the existing wanted fixture and extend it for retry POST | Keeps Activity Wanted deterministic and avoids live mutations | Adds one test-only interception branch | **Adopted.** |
| Add a dedicated release-radar fixture | Keeps `/api/v1/library/release-radar` coverage scoped and reusable | Adds one small fixture module | **Adopted.** |

---

## 4. Final recommendation stack

1. **Activity Releases browser suite.** Verify recent and upcoming release-card
   grids expose roving focus, visible focus rings, and active-card request
   actions while inactive-card actions are suppressed.
2. **Activity Wanted browser suite.** Verify the wanted table has an accessible
   name, renders summary rows, exposes the recovery notice, and lets an operator
   trigger `Retry discovery` by keyboard.
3. **Narrow fixtures.** Add `release-radar-browser-fixtures.js` for release
   radar reads and extend `wanted-browser-fixtures.js` for recovery retry POSTs.
4. **Semantic hardening.** Add `aria-label="Wanted releases"` to the Activity
   Wanted table so tests and assistive tech can address the table by name.
5. **Security posture.** The browser fixture is test-only. Production mutation
   auth/CSRF behavior remains unchanged; the UI still calls the same
   admin-only retry API path.

---

## 5. Outcome

| File | Change |
| --- | --- |
| `src/client/views/ActivityWantedView.vue` | Adds an accessible name to the wanted releases table. |
| `testing/browser/release-radar-browser-fixtures.js` | New deterministic release-radar fixture for Activity Releases browser specs. |
| `testing/browser/wanted-browser-fixtures.js` | Extends the existing wanted fixture with a recovery retry POST response and request capture. |
| `test/browser/activity-releases-wanted-browser-verification.test.js` | New browser suite for Activity Releases roving grids and Activity Wanted recovery table/action behavior. |
| `docs/DISCOVER_FOLLOWUP_DESIGN_AREAS.md` | Moves Activity releases/wanted verification into Completed and narrows the remaining proposal. |
| `docs/IMPLEMENTATION_TASK_LIST.md` | Updates the current-status tracker with the Activity release/wanted browser verification slice. |

---

## 6. Validation

Validation for this slice:

- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/activity-releases-wanted-browser-verification.test.js test/browser/missing-card-grid-keyboard-roving.test.js`
- `npm run lint:test`
- `npm run lint:client`
- `git diff --check`

The browser suite uses the existing skip behavior when Chromium or the local
database/container runtime is unavailable.

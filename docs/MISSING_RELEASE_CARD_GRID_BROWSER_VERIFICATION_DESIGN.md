# Missing Release-Card Grid Browser Verification

Status: **Implemented.** This document records the design and outcome for
browser-verifying the Missing page release-card grid.

It builds on:

- [PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md)
- [HOME_MIXED_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md](HOME_MIXED_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md)
- [CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)
- [KEYBOARD_FOCUS_AUDIT_DESIGN.md](KEYBOARD_FOCUS_AUDIT_DESIGN.md)

---

## 1. Purpose

Missing is the next high-value card-grid browser target because it is not a
read-only card grid. Each `ReleaseCard` contains a primary detail focus target
plus one or more secondary controls:

- the normal `Request` action;
- optional `Retry discovery` action when download recovery is exhausted.

This slice verifies that the grid itself remains a single roving-tabindex
composite while active-card actions remain keyboard-reachable and inactive-card
actions are removed from the Tab path.

---

## 2. Research (official sources)

Sources were located via web search; URLs were not assumed.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex | [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Composite widgets should expose one `tabindex="0"` target and move focus with managed keyboard behavior. |
| Grid-style movement | [W3C APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and [Layout Grid Examples](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/) | Layout grids of links/buttons can use arrow keys for efficient movement after focus enters the collection. |
| Native semantics | [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) | Keep the card collection as a native list of interactive cards; do not apply table-like grid roles to non-tabular releases. |
| Focus appearance | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Runtime proof should include visible focus, not only DOM attributes. |
| Playwright locators/input | [Playwright Locators](https://playwright.dev/docs/locators), [Actions](https://playwright.dev/docs/input), and [Keyboard API](https://playwright.dev/docs/api/class-keyboard) | Use role/name locators around user-facing surfaces and Playwright-generated keyboard input for Tab and roving keys. |
| A11y testing scope | [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing) | Automated scans are complementary; targeted keyboard assertions are required for custom roving behavior. |

---

## 3. Recommendations, pros, and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Verify only roving card movement | Fastest test | Misses the highest-risk Missing-specific contract: request/retry action tab order | Rejected. |
| Verify roving movement plus action tab management | Proves the actual interactive grid behavior | Slightly more fixture setup | **Adopted.** |
| Reuse metadata or library fixtures | Fewer files | Those fixtures do not own wanted-summary/wanted-release route shape | Rejected. |
| Add a narrow wanted-release browser fixture | Deterministic, scoped to Missing endpoints, reusable for Activity Wanted | Adds one small fixture module | **Adopted.** |
| Click the Request action and submit the modal | Broader workflow coverage | Pulls media-request mutation concerns into a keyboard-grid test | Deferred to request-flow E2E coverage. |

---

## 4. Final recommendation stack

1. **Focused Missing browser suite.** Add a browser spec for `/app/missing` that
   verifies roving movement across release cards.
2. **Action-tab proof.** Assert that Tab from the active card reaches its
   request action, then ArrowRight moves the active roving cell and suppresses
   the previous card's action controls with `tabindex="-1"`.
3. **Wanted browser fixture.** Add a small fixture that intercepts
   `/api/v1/library/wanted-summary`, `/api/v1/library/wanted-releases`, and
   `/api/v1/library/reconciliation-summary`.
4. **Recovery-card coverage.** Include a wanted release with exhausted download
   recovery so the active card exposes both `Retry discovery` and `Request`.
5. **Security posture.** No production routes, persistence, auth, or network
   behavior changes are introduced. The fixture is browser-test-only and the
   page still runs under the normal authenticated app shell.

---

## 5. Outcome

| File | Change |
| --- | --- |
| `testing/browser/wanted-browser-fixtures.js` | New deterministic wanted-summary/wanted-release/reconciliation fixture for Missing and future Activity Wanted browser specs. |
| `test/browser/missing-card-grid-keyboard-roving.test.js` | New browser suite proving Missing release-card roving movement and active/inactive action Tab behavior. |
| `docs/DISCOVER_FOLLOWUP_DESIGN_AREAS.md` | Moves Missing browser verification into Completed and narrows the remaining proposal to Activity, My Requests, and Artist Detail. |
| `docs/IMPLEMENTATION_TASK_LIST.md` | Updates the current-status tracker with the Missing browser verification slice. |

No production component changes were required by this slice; the shared
`useArtworkGridRoving` and `useRovingTabindex` behavior already covered the
Missing grid correctly.

---

## 6. Validation

Validation for this slice:

- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/missing-card-grid-keyboard-roving.test.js test/browser/home-card-grid-keyboard-roving.test.js`
- `npm run lint:test`
- `npm run lint:client`
- `git diff --check`

The browser suite uses the existing skip behavior when Chromium or the local
database/container runtime is unavailable.

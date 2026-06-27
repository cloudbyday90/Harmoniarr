# Home Mixed Card-Grid Browser Verification

Status: **Implemented.** This document records the design and outcome for
browser-verifying Home's mixed monitored-artist card grids.

It builds on:

- [DISCOVER_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](DISCOVER_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md)
- [PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md)
- [CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)
- [KEYBOARD_FOCUS_AUDIT_DESIGN.md](KEYBOARD_FOCUS_AUDIT_DESIGN.md)

---

## 1. Purpose

Home is the highest-risk remaining platform card-grid surface because each Home
variant uses a mixed roving selector:

- operator Home: `.hx-media-card__link-area, .operator-home__discover-card`;
- requester Home: `.hx-media-card__link-area, .requester-home-discover-card`.

That means the grid contains normal artist card link areas and a trailing
Discover `RouterLink` tail card in one composite. This slice verifies that both
cell types participate in the same roving tabindex model in a real browser.

---

## 2. Research (official sources)

Sources were located via web search; URLs were not assumed.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex | [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | A composite should keep one `tabindex="0"` target and move it as keyboard focus moves inside the component. |
| Grid-style keyboard movement | [W3C APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and [Layout Grid Examples](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/) | Layout grids of links/buttons may use arrow keys to move focus between independent interactive cells. |
| Native semantics | [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) | Keep Home card collections as native lists of links/buttons instead of forcing tabular ARIA grid semantics onto non-tabular cards. |
| Focus visibility | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Browser proof should assert a visible focus indicator on the focused tail card, not just attribute state. |
| Browser assertions | [Playwright Locators](https://playwright.dev/docs/locators), [Actions](https://playwright.dev/docs/input), and [Keyboard API](https://playwright.dev/docs/api/class-keyboard) | Use role/name locators for user-facing surfaces and Playwright-generated keyboard events for Tab/Arrow/Home/End behavior. |
| A11y testing scope | [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing) | Automated scans are complementary; targeted keyboard assertions remain necessary for custom roving composites. |

---

## 3. Recommendations, pros, and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Verify operator Home only | Fastest path; covers one mixed selector | Leaves requester Home's parallel selector unproven | Rejected. Both variants share the risk. |
| Verify both Home variants with browser fixtures | Proves the two mixed selectors and both tail-card classes | Requires requester account setup in the browser runtime | **Adopted.** |
| Fold Home into the existing Library/Search suite | Fewer test files | Suite intent becomes broad and harder to triage | Rejected. Home gets a focused suite. |
| Add a reusable requester browser helper | Keeps account setup out of the spec body; future suites can reuse it | Adds one small test helper module | **Adopted.** |
| Add product code before running the browser suite | May preempt issues | Risks changing behavior without evidence | Rejected. Run evidence against the existing implementation first. |

---

## 4. Final recommendation stack

1. **Focused Home browser suite.** Add one browser spec file for operator and
   requester Home monitored-artist grids.
2. **Shared keyboard helpers.** Reuse `assertRovingGridMovement`,
   `assertLocatorFocused`, and `getItemControlTabindexes`.
3. **Deterministic metadata fixture state.** Use the existing
   `markBoardsOfCanadaAddedInMetadataBrowserFixture` helper so each Home variant
   has one monitored artist plus the trailing Discover card.
4. **Requester browser helper.** Extract minimal requester creation/login helpers
   under `testing/browser/` for reuse outside screenshot evidence tests.
5. **Security posture.** The helper uses the real authenticated admin user route
   and CSRF token when creating the requester. No production route, auth, or
   persistence behavior changes are introduced.

---

## 5. Outcome

| File | Change |
| --- | --- |
| `test/browser/home-card-grid-keyboard-roving.test.js` | New browser suite proving operator and requester Home mixed card grids move focus from the artist card to the Discover tail card and manage inactive card actions. |
| `testing/browser/user-browser-helpers.js` | New ESM browser helper for creating and logging in a requester account through real UI/API flows. |
| `docs/DISCOVER_FOLLOWUP_DESIGN_AREAS.md` | Moves Home mixed card-grid browser verification into Completed and scopes the remaining proposal to Missing/Activity/My Requests/Artist Detail. |
| `docs/IMPLEMENTATION_TASK_LIST.md` | Updates the current-status tracker with the Home browser verification slice. |

No production component changes were required by this slice; the prior shared
`useArtworkGridRoving` and `useRovingTabindex` hardening covered Home's mixed
selectors correctly.

---

## 6. Validation

Validation for this slice:

- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/home-card-grid-keyboard-roving.test.js test/browser/platform-card-grid-keyboard-roving.test.js`
- `npm run lint:test`
- `npm run lint:client`
- `git diff --check`

The browser suite uses the existing skip behavior when Chromium or the local
database/container runtime is unavailable.

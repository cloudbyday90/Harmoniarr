# Platform Card-Grid Browser Keyboard Verification

Status: **Implemented (Library + Search slice).** This document records the
design and outcome for extending Discover's runtime keyboard proof to the first
platform card-grid families: Library release cards and Search artist/release
cards.

It builds on:

- [DISCOVER_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](DISCOVER_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md)
- [CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)
- [KEYBOARD_FOCUS_AUDIT_DESIGN.md](KEYBOARD_FOCUS_AUDIT_DESIGN.md)

---

## 1. Purpose

Batch X proved Discover's roving tabindex behavior in a real browser. The next
high-value item was to reuse that evidence pattern on the broader card-grid
rollout without trying to cover every surface at once.

This slice covers:

- `LibraryView` release grid (`ReleaseCard`);
- `SearchView` artist grid (`ArtistCard`);
- `SearchView` release grid (`ReleaseCard`);
- inactive secondary card controls leaving the Tab sequence while active-card
  controls remain reachable.

The last item is the important runtime finding from Batch X generalized to the
shared grid wrapper: action buttons on inactive cards should not pre-empt the
active roving card, but the action on the active card must still be available to
keyboard users.

---

## 2. Research (official sources)

Sources were located via web search; URLs were not assumed.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex | [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Roving composites keep exactly one `tabindex="0"` item and put peer items at `tabindex="-1"`. |
| Grid movement | [W3C APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Arrow keys plus Home/End variants are expected movement keys for grid-like composites after focus enters. |
| Native semantics | [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) | Keep the existing native list/listitem/card semantics; do not introduce artificial grid roles for non-tabular card collections. |
| Focus appearance | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Runtime evidence should include visible focus indicators, not only `tabindex` state. |
| Playwright locators | [Playwright Locators](https://playwright.dev/docs/locators) | Use role/name locators for page surfaces and scoped CSS only inside the owned grid container. |
| Playwright keyboard input | [Playwright Actions](https://playwright.dev/docs/input) and [Keyboard API](https://playwright.dev/docs/api/class-keyboard) | Use Playwright-generated keyboard events for Tab and roving navigation rather than synthetic DOM calls. |
| Playwright accessibility testing | [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing) | Automated accessibility scans are useful later, but targeted keyboard assertions are required for custom roving behavior. |

---

## 3. Recommendations, pros, and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Extend Batch X helpers to Library + Search | Reuses proven browser runtime; covers both `ArtistCard` and `ReleaseCard`; low fixture complexity | Still leaves Home/Missing/Activity/My Requests/Artist Detail for later | **Adopted.** |
| Add all remaining surfaces in one browser suite | Broadest coverage in one commit | High setup complexity; failures become harder to isolate | **Rejected for this slice.** Work component families one at a time. |
| Keep inactive card actions in the Tab order | No extra DOM synchronization | Runtime-proven issue: inactive buttons can pre-empt the active roving card | **Rejected.** |
| Manage inactive secondary controls in `useArtworkGridRoving` | Fixes the issue for shared grids; keeps active-card actions reachable | Slightly broader behavior change across all artwork grids using the wrapper | **Adopted.** |
| Add axe dependency now | Broader a11y scan coverage | Does not prove roving focus movement; introduces a new dependency before behavior proof is complete | **Deferred.** |

---

## 4. Final recommendation stack

1. **Shared behavior in `useArtworkGridRoving`.** The wrapper now passes a
   secondary-control selector to `useRovingTabindex`, so all shared artwork grids
   inherit the inactive-action Tab-order hardening proven in Discover.
2. **Reusable browser helpers.** `keyboard-accessibility-helpers.js` now exposes
   grid movement and item-control tabindex assertions, keeping specs compact.
3. **Deterministic fixtures.** Library uses existing release fixtures. Search
   gets a dedicated `fixture electronic` query with multiple artist and release
   results, avoiding changes to the Discover-owned Boards of Canada path.
4. **Surface-level browser specs.** One focused suite covers Library release
   cards and Search artist/release cards using the existing temporary app runtime.
5. **Security posture.** No route, auth, data persistence, or network surface is
   added. Source changes mutate only `tabindex` attributes inside component-owned
   grid items. Tests exercise normal authenticated UI flow through the browser.

---

## 5. Outcome

| File | Change |
| --- | --- |
| `src/client/composables/useArtworkGridRoving.js` | For shared artwork grids, forwards a default secondary-control selector to `useRovingTabindex` and accepts both getter functions and Vue refs/computed refs for `count`. |
| `src/client/composables/useRovingTabindex.js` | `refresh()` now attaches to the current grid element before syncing tabindex, fixing async/`v-if` grids that render after component mount. |
| `testing/browser/keyboard-accessibility-helpers.js` | Added reusable grid-movement and item-control tabindex assertions. |
| `testing/browser/metadata-browser-fixtures.js` | Added a multi-result `fixture electronic` catalog query for deterministic Search grid coverage. |
| `test/browser/platform-card-grid-keyboard-roving.test.js` | New Playwright suite for Library release cards and Search artist/release grids. |
| `docs/DISCOVER_FOLLOWUP_DESIGN_AREAS.md` | Moves Library/Search runtime verification into Completed and scopes the remaining proposal to the next platform surfaces. |

Runtime validation found two shared issues that unit tests had not covered:

- `LibraryView` renders its release grid behind async data/`v-if`; tabindex state
  could sync after data arrived, but the keydown/focusin listeners were not
  attached to the live grid element. `useRovingTabindex.refresh()` now binds the
  current element before applying tabindex.
- `SearchView` passed computed refs for the grid counts while
  `useArtworkGridRoving` only watched getter functions. The wrapper now accepts
  both forms and performs an immediate refresh, so late-rendered artist and
  release grids initialize consistently.

---

## 6. Validation

Planned validation for this slice:

- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/discover-keyboard-roving.test.js test/browser/platform-card-grid-keyboard-roving.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `node --test test/client/roving-index.test.js`

The browser suite uses the existing skip behavior when Chromium or the local
database/container runtime is unavailable.

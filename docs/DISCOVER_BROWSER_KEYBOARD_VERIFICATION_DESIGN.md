# Discover Browser Keyboard Verification

Status: **Implemented (Discover slice).** This document records the design and
outcome for the runtime Playwright verification of Discover's roving-tabindex
surfaces: the recommended-artist card grid and monitored-artist chip band.

It closes the remaining Discover follow-up from
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md) for the
Discover component while leaving broader platform card-grid coverage as the next
component-level slice.

---

## 1. Purpose

Batches D-W completed the source-level Discover redesign work: roving tabindex,
list semantics, skeleton/fade artwork loading, typeahead, focus rings, and
performance hints. Batch L still documented one gap: runtime proof in a seeded
browser.

This slice adds that proof for Discover:

- one managed roving target in the recommended-artist grid;
- ArrowRight / Control+End / Control+Home movement across recommendation cards;
- one managed roving target in the monitored-artist chip band;
- ArrowRight / Home movement across chips;
- visible rendered focus outlines on both surfaces;
- Tab enters the chip band and recommendation grid at one managed target.

During runtime verification, the first test pass exposed a gap: inactive card
action buttons were still in the natural Tab order. That meant Tab could enter
the recommendation grid at an inactive card's Add button before reaching the
active roving card link. The fix keeps secondary actions accessible on the
active card only: inactive item controls receive `tabindex="-1"`, while controls
inside the active item keep their native focusability.

---

## 2. Research (official sources)

Sources were located via web search; URLs were not assumed.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex | [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | A composite should keep one item at `tabindex="0"` while peer items use `tabindex="-1"`; keyboard movement updates the active item. |
| Grid keyboard intent | [W3C APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Direction keys, Home/End, and Control+Home/End are standard focus movement keys for grid-like composites. |
| Native semantics | [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/) | Preserve native semantics where possible; Harmoniarr keeps card/chip containers as lists and links, not artificial ARIA grids. |
| Focus visibility | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Runtime checks should verify an actual visible focus indicator, not only source presence. |
| Playwright locators | [Playwright Locators](https://playwright.dev/docs/locators) | Prefer resilient locators and auto-waiting role/name selection over brittle CSS-only page targeting. |
| Playwright keyboard actions | [Playwright Actions](https://playwright.dev/docs/input) and [Keyboard API](https://playwright.dev/docs/api/class-keyboard) | Use locator/page keyboard actions to produce real browser keyboard events for Tab and arrow-key behavior. |
| Playwright a11y testing | [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing) | Automated a11y checks are useful but do not replace targeted keyboard assertions; this slice focuses on the behavior the source audit could not prove. |

---

## 3. Recommendations, pros, and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add a targeted Discover browser suite using the existing smoke runtime | Uses seeded metadata fixtures; verifies real DOM focus, rendered CSS, and keyboard events; no new package | Covers Discover first, not every grid | **Adopted.** |
| Add `@axe-core/playwright` immediately | Broad automated a11y scan; aligns with future release evidence | New dependency and larger suite; axe does not prove custom roving behavior by itself | **Deferred.** Add after targeted keyboard behavior is stable. |
| Remove all card action buttons from Tab order | Reduces grid Tab stops further | Would make Discover's add action harder or impossible for keyboard users unless a new action model is designed | **Rejected.** |
| Manage inactive card action controls only | Prevents inactive controls from pre-empting the active roving card; keeps the active card's Add button reachable | Adds a small DOM-sync responsibility to the roving controller | **Adopted.** |
| Test every platform card grid in one suite | Broadest coverage | Higher fixture/setup complexity; failures would be harder to localize | **Deferred.** Work one component family at a time. |

---

## 4. Final recommendation stack

1. **Behavior-first browser tests.** Use Playwright against Harmoniarr's existing
   temporary PostgreSQL-backed app runtime and metadata browser fixtures.
2. **Roving owns inactive secondary controls.** The controller continues to
   manage card links as the roving cells, and now also removes inactive card
   controls from the Tab sequence while preserving active-card actions.
3. **Small shared helper module.** Keep reusable focus assertions in
   `testing/browser/keyboard-accessibility-helpers.js` instead of duplicating
   DOM-evaluation code across browser specs.
4. **Role/name selectors first.** Navigate and locate surfaces by accessible
   roles (`list`, `button`, `link`) and labels; use CSS selectors only inside the
   owned roving containers for the exact managed cells.
5. **No new dependency for this slice.** The first pass proves keyboard movement,
   `tabindex` state, and focus outlines. Axe integration remains a later suite
   layer, not a substitute for these assertions.
6. **Security posture.** Browser tests exercise existing authenticated UI flows
   through the normal runtime. No app code, route, auth, or data-writing surface
   is added. The helper reads focus state, computed outline styles, and scoped
   `tabindex` attributes from already-rendered DOM. The source fix writes only
   `tabindex` attributes inside the component-owned grid subtree.

---

## 5. Outcome

| File | Change |
| --- | --- |
| `src/client/composables/useRovingTabindex.js` | Added optional managed secondary-control synchronization so inactive item controls leave the Tab sequence and active item controls keep native focusability. |
| `src/client/components/media/PaginatedArtworkGrid.vue` | Passes the Discover card action selector into roving synchronization. |
| `testing/browser/keyboard-accessibility-helpers.js` | New shared assertions for focused locators, rendered focus outline, and roving `tabindex` synchronization. |
| `test/browser/discover-keyboard-roving.test.js` | New seeded Discover Playwright suite covering recommendation-card roving, monitored-chip roving, focus rings, and Tab entry points. |
| `docs/DISCOVER_FOLLOWUP_DESIGN_AREAS.md` | Moved the Discover runtime verification item into Completed and added the next component-level proposal. |

---

## 6. Validation

Planned validation for this slice:

- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/discover-keyboard-roving.test.js`
- `npm run lint:test`

If Chromium or the local database/container runtime is unavailable, the browser
suite follows the existing skip path used by the other `test/browser` specs and
reports the concrete prerequisite that is missing.

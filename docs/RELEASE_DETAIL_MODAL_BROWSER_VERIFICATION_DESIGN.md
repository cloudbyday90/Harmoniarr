# Release Detail Modal Browser Verification Design

## Status

Implemented on 2026-06-25.

## Scope

This slice verifies `ReleaseDetailModal` from the Artist Detail flow in a real
browser. The modal is the next dense keyboard workflow after card-grid entry:
it contains initial modal focus, Escape and close behavior, edition switching,
request actions, MusicBrainz links, tracklists, and operator track override
controls.

## Official Sources Reviewed

- W3C APG modal dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- W3C APG modal dialog example:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/
- W3C WCAG technique H102, HTML `dialog`:
  https://www.w3.org/WAI/WCAG22/Techniques/html/H102
- W3C WCAG 2.2 Focus Visible:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- W3C WCAG 2.2 Focus Appearance:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- W3C WCAG 2.2 Focus Not Obscured:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright locators:
  https://playwright.dev/docs/locators
- Playwright input actions:
  https://playwright.dev/docs/input

## Recommendations

1. Keep the modal on native `<dialog>.showModal()`.
   W3C technique H102 documents the HTML dialog element as a native modal
   option; it gives the browser a chance to manage top-layer modal behavior and
   background inertness rather than rebuilding those mechanics.
2. Make focus management explicit at the component boundary.
   APG modal guidance expects focus to move into the dialog on open and return
   to the invoking control on close. `ReleaseDetailModal` now records the
   previously focused element, focuses the close button on open, closes the
   native dialog before emitting `close`, and restores focus to the opener when
   possible.
3. Avoid ARIA menu roles without menu keyboard behavior.
   The edition overflow popover is a small native button list, not a full APG
   menu widget. Removing `role="menu"`/`role="menuitem"` avoids promising arrow
   key behavior that the component does not implement.
4. Expose edition selection semantically.
   Edition pills are now native pressed buttons with `aria-pressed` and a stable
   accessible label such as `Switch to edition, US, 1998, 4 tracks`.
5. Verify with user-facing Playwright locators and real keyboard actions.
   Playwright's official guidance favors locators with auto-waiting and
   user-facing attributes. The suite opens from Artist Detail by keyboard,
   asserts modal focus containment, switches editions, and changes a track
   override through the rendered select.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Native `<dialog>` | Browser-backed modal top layer and background inertness | Still benefits from explicit opener focus restoration | Adopted |
| Custom ARIA dialog | Full app-level control | More code and higher risk of focus/inert regressions | Rejected |
| APG menu role for edition actions | Familiar if full menu keyboard support exists | Incorrect without arrow-key/menuitem behavior | Rejected |
| Native button list for edition actions | Honest semantics, no custom keyboard contract | Less rich than a full menu widget | Adopted |
| Browser-only verification | Proves real focus, Tab, Escape, and select behavior | Heavier than unit tests | Adopted for this interaction |

## Final Recommendation Stack

- `ReleaseDetailModal.vue` remains a small native-dialog component.
- Initial focus goes to the close button; close/Escape restore focus to the
  release card opener.
- Edition choices use native buttons with `aria-pressed`.
- Edition overflow uses native button/list semantics rather than ARIA menu
  roles.
- Shared browser helpers assert focus containment and Tab trapping.
- The metadata browser fixture supports a second Music Has the Right to Children
  edition and honors `preferReleaseId` so edition switching is tested against a
  real changed payload.

## Outcome

- Added `release-detail-modal-browser-verification.test.js`.
- Added `assertFocusWithin` and `assertTabFocusContained` to the shared browser
  keyboard helper module.
- Hardened `ReleaseDetailModal.vue` focus open/close behavior, edition labels,
  edition selected state, overflow semantics, and focus rings.
- Hardened `ReleaseCard.vue` keyboard activation by replacing Vue key modifiers
  on the custom `role="button"` card body with an explicit Enter/Space keydown
  handler.
- Extended `metadata-browser-fixtures.js` with a second release edition and a
  `preferReleaseId` tracklist resolver.

## Security Notes

This is a browser/UI verification slice. It does not add server routes or widen
authorization. The existing request and canonical mutation APIs keep their
current CSRF/auth boundaries. The test fixture remains deterministic browser
interception data and does not store credentials or secrets.

## Validation

Run from the repository root:

```powershell
npm run build:client
node --test --test-concurrency=1 test/browser/release-detail-modal-browser-verification.test.js test/browser/artist-detail-section-grid-keyboard-roving.test.js
npm run lint:client
npm run lint:test
git diff --check
```

Browser tests serve `dist/client`; rebuild the client before running them when
Vue component code changes.

## Next High-Value Item

Request action browser verification is the next logical slice. The card grids
and Release Detail modal now prove users can reach request controls by keyboard;
the remaining high-value workflow is proving request submission, confirmation,
admin requester-for selection, pending/requested feedback, and focus recovery
across the shared request surfaces.

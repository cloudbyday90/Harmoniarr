# Artist Detail Section Grid Browser Verification Design

## Status

Implemented on 2026-06-25.

## Scope

This slice verifies the Artist Detail discography card grids in a real browser.
Artist Detail is different from other artwork-grid surfaces because each
discography section is its own card grid instance (`Albums`, `EPs`, etc.) and
operator users also get per-card selection controls inside the release card
action slot.

## Official Sources Reviewed

- W3C ARIA Authoring Practices, keyboard interface:
  https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- W3C ARIA Authoring Practices, layout grid examples:
  https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/
- W3C WCAG 2.2, Focus Visible:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- W3C WCAG 2.2, Focus Appearance:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- W3C WCAG 2.2, Focus Not Obscured:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- Playwright best practices:
  https://playwright.dev/docs/best-practices
- Playwright Locator API:
  https://playwright.dev/docs/api/class-locator
- Playwright input actions:
  https://playwright.dev/docs/input

## Recommendations

1. Keep each Artist Detail section as an independent roving composite.
   W3C APG layout-grid guidance supports one Tab stop for a collection of
   interactive widgets with arrow-key movement inside the collection. Artist
   Detail has multiple collections, so each section needs independent roving
   state rather than one page-wide grid.
2. Verify with role-based Playwright locators first.
   Playwright recommends user-facing locators because they follow the
   accessibility tree and are less coupled to implementation structure.
3. Keep visible headings and accessible list names synchronized.
   The visible section heading already uses `pluralizeReleaseType`; the list
   name should use the same helper so screen-reader users hear the same section
   label and edge cases such as `Other` do not become `Others`.
4. Assert inactive action-control suppression in browser.
   Unit tests can prove pure roving math, but only a rendered browser can prove
   nested card actions do not re-enter the sequential Tab order before the
   active card.

## Pros And Cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| One Artist Detail page-wide grid | Fewer roving instances | Arrow keys would cross semantic section boundaries | Rejected |
| Per-section `ArtistReleaseSectionGrid` instances | Matches page structure and APG one-composite-per-collection guidance | Requires browser proof for independent state | Adopted |
| CSS-only/static audit | Fast | Cannot prove Tab-order management or focus movement | Rejected |
| Focused Playwright browser suite | Proves runtime DOM, ARIA names, focus rings, and nested controls | Heavier than unit tests | Adopted |

## Final Recommendation Stack

- Keep `ArtistReleaseSectionGrid.vue` as the per-section ESM component boundary.
- Continue using `useArtworkGridRoving` for release cards with
  `.hx-media-card__link-area` as the managed cell.
- Name each list with `pluralizeReleaseType(section.type)`.
- Seed browser fixture release groups across at least two section types.
- Add a focused Playwright suite that verifies:
  - Albums and EPs render as separately named lists.
  - Arrow/Home/Control+Home/Control+End movement works within each list.
  - Moving in one list does not mutate the active roving item in the other list.
  - Operator release selection controls are tabbable only for the active card in
    their own section.

## Outcome

- `metadata-browser-fixtures.js` now seeds Boards of Canada with two Albums and
  two EPs, including deterministic artwork and tracklist payloads.
- `ArtistDetailView.vue` now names each discography list with the same
  `pluralizeReleaseType` helper used for its visible heading.
- `artist-detail-section-grid-keyboard-roving.test.js` verifies the per-section
  browser contract using the shared keyboard accessibility helper module.

## Security Notes

This is a client/browser verification slice. It does not add new routes, storage
writes, authentication flows, or sensitive data exposure. The fixture data stays
inside browser-test interception and uses deterministic local payloads. Browser
assertions use public ARIA names and scoped class selectors for the existing card
component contract.

## Validation

Run:

```powershell
npm run build:client
node --test --test-concurrency=1 test/browser/artist-detail-section-grid-keyboard-roving.test.js test/browser/my-requests-card-grid-keyboard-roving.test.js
npm run lint:test
npm run lint:client
git diff --check
```

Note: browser teardown can emit `[harmoniarr-db] pooled idle client error:
Connection terminated unexpectedly` from temporary PostgreSQL cleanup. Treat it
as non-fatal when the test process exits with code 0.

## Next High-Value Item

Release detail modal browser verification is the next logical item. Artist
Detail cards open `ReleaseDetailModal`, where the operator can inspect editions,
tracklists, request state, and track override controls. That is the next
keyboard-heavy workflow after card-grid entry is proven.

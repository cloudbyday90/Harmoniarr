# Artist Detail Bulk-Change Confirmation Design

Status: Implemented
Last updated: 2026-06-27
Owner: Product + client architecture

## Scope

This slice implements the accepted Artist Detail guard for unusually broad draft
bulk operations:

- require confirmation when a single Artist Detail bulk action affects more
  than `25` release groups
- require confirmation when a single Artist Detail bulk action affects more
  than `250` known tracks
- keep normal section-level bulk actions immediate and draft-only
- preserve the existing `Save policy` / `Cancel` boundary

The first implemented component is section-level release-group selection:
`Select all` and `Clear all` per discography section. Track-level section bulk
changes are not fabricated from incomplete section data; the track threshold is
counted when resolved release media or explicit track counts are present.

## Official Source Review

Reviewed as of June 2026:

- WAI-ARIA Authoring Practices Guide, Dialog Modal Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WAI-ARIA Authoring Practices Guide, Button Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/button/
- MDN, `<dialog>` element:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
- MDN, `HTMLElement.focus()`:
  https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus
- Vue, Computed Properties:
  https://vuejs.org/guide/essentials/computed.html
- Vue, Watchers:
  https://vuejs.org/guide/essentials/watchers.html
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Playwright, Locators:
  https://playwright.dev/docs/locators
- Playwright, Best Practices:
  https://playwright.dev/docs/best-practices

## Recommendations

1. Keep thresholds in a pure client service.

   Pros: deterministic unit tests, no Vue coupling, easy threshold reuse when
   track-level section bulk controls arrive.
   Cons: the server still owns final authorization and validation; client
   thresholds are an interaction guard, not a security boundary.

2. Use native dialog semantics through the existing `ConfirmDialog` component.

   Pros: consistent styling, browser modal behavior, WAI-ARIA-compatible
   accessible name and modal semantics.
   Cons: broad confirmation copy must remain concise because the shared dialog
   is intentionally generic.

3. Keep section actions draft-only.

   Pros: bulk actions remain reversible through `Cancel`, match the current
   Artist Detail editing contract, and avoid immediate backend side effects.
   Cons: users must still save policy before reconciliation sees the change.

4. Do not create track overrides from unloaded section data.

   Pros: avoids inventing user intent for tracks not currently present in the
   section model.
   Cons: track-level section bulk operations still need a later design once the
   page has complete tracklist context.

## Final Stack

- `src/client/lib/artist-detail-bulk-selection.js`
  - threshold constants
  - release/track summarization
  - confirmation decision
  - draft application helper
- `src/client/lib/artist-detail-presentation.js`
  - fixed section-action labels
  - confirmation body and status copy
- `src/client/views/ArtistDetailView.vue`
  - per-section `Select all` / `Clear all`
  - confirmation only above threshold
  - draft-only mutation until `Save policy`
- `test/client/artist-detail-bulk-selection.test.js`
  - threshold boundaries
  - track counting
  - draft application
- `test/browser/artist-detail-bulk-change-confirmation-browser-verification.test.js`
  - small operation applies immediately
  - large operation opens confirmation before draft mutation

## Security Notes

The confirmation dialog is not treated as authorization. Operator-only editing
is still gated by role-aware view state, and final persistence still travels
through the authenticated operator policy save endpoint. The UI avoids dynamic
HTML and uses fixed text helpers with interpolated counts only.

## Outcome

Artist Detail now supports section-level release-group bulk editing with a
large-change confirmation threshold. Normal small changes stay fast, while
large catalog changes require an explicit confirmation before mutating the
draft state.

## Follow-Up Status

Artist Detail large-catalog filtering and sorting was implemented in
`ARTIST_DETAIL_LARGE_CATALOG_CONTROLS_DESIGN.md`. The next high-value follow-up
is non-destructive operator library removal semantics.

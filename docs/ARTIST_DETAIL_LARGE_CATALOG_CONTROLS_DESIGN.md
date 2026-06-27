# Artist Detail Large-Catalog Controls Design

Status: Implemented
Last updated: 2026-06-27
Owner: Product + client architecture

## Scope

This slice implements local Artist Detail section controls for large catalogs:

- per-section search
- per-section selection-state filtering for operators
- per-section sorting
- reset controls
- visible-subset bulk actions when a section is filtered

The controls are intentionally local to Artist Detail. They do not change the
operator policy save contract, create durable preferences, or alter server
authorization.

## Official Source Review

Reviewed as of June 2026:

- MDN, `<input type="search">`:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/search
- MDN, `<select>`:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select
- W3C WAI Forms Tutorial, Labeling Controls:
  https://www.w3.org/WAI/tutorials/forms/labels/
- WAI-ARIA Authoring Practices Guide, Button Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/button/
- Vue, Computed Properties:
  https://vuejs.org/guide/essentials/computed.html
- Vue, Form Input Bindings:
  https://vuejs.org/guide/essentials/forms.html
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Cross-Site Scripting Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Playwright, Locators:
  https://playwright.dev/docs/locators
- Playwright, Best Practices:
  https://playwright.dev/docs/best-practices

## Recommendations

1. Keep controls section-local and client-only.

   Pros: no schema/API churn, no ambiguity about durable operator intent, easy
   reset per section.
   Cons: controls do not persist across navigation or reload.

2. Use native controls with labels.

   Pros: accessible names come from real labels, keyboard behavior is native,
   Playwright can verify the user-facing contract.
   Cons: native select styling is less custom than a bespoke toolbar.

3. Filter before sorting.

   Pros: predictable behavior for large catalogs, faster mental model, and bulk
   actions can target the visible subset.
   Cons: users need to reset controls to return to full-section bulk actions.

4. Let visible-subset bulk actions reuse the existing confirmation guard.

   Pros: one policy for large changes, consistent draft-only behavior, no extra
   modal or endpoint.
   Cons: action labels need to shift from `all` to `visible` when filters are
   active to avoid surprise.

## Final Stack

- `src/client/lib/artist-detail-section-controls.js`
  - stable selection-filter and sort options
  - pure query/filter/sort application
  - active-state detection
- `src/client/lib/artist-detail-presentation.js`
  - section-control labels
  - filtered count summaries
  - visible-subset bulk labels
- `src/client/views/ArtistDetailView.vue`
  - per-section control state
  - filtered/sorted section projection
  - reset action
  - no-match state
- `test/client/artist-detail-section-controls.test.js`
  - query, selection filter, manual override filter, sort, and mutation-safety
    coverage
- `test/browser/artist-detail-large-catalog-controls-browser-verification.test.js`
  - expanded large-catalog fixture coverage for search, visible bulk draft
    changes, selection filtering, reset, and sort order

## Security Notes

The controls are a local view convenience only. They do not authorize operator
policy changes. Requester sessions still do not receive operator-only selection
filters or release-selection controls, and save authorization remains enforced
by the authenticated server endpoint. The implementation uses Vue text bindings
and native form controls, avoiding dynamic HTML injection.

## Outcome

Artist Detail now scales better for large discographies. Operators can narrow a
section by title or metadata text, filter by current draft selection state or
manual overrides, sort by date/title/selection state, and apply bulk draft
actions to the visible subset.

## Next High-Value Item

Non-destructive operator library removal semantics is the next high-value
follow-up. Artist Detail now covers large-catalog curation depth; the remaining
larger product risk is distinguishing "remove from my view/library" from
deleting shared media.

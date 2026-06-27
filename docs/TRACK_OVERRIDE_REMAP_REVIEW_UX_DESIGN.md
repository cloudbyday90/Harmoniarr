# Track Override Remap Review UX Design

Last updated: 2026-06-27

## Scope

This document records the design and implementation outcome for surfacing saved
track override remap review states in Artist Detail and Release Detail.

The existing schema and backend projection already persist and expose
`operator_track_override.remap_status` with `resolved`, `review_needed`, and
`orphaned` states. This slice therefore focuses on operator-facing review UX,
copy, filtering, and browser verification rather than a new migration.

## Official Source Review

- W3C WCAG 2.2 labels and instructions: user input controls need labels or
  instructions, and user-facing labels should be descriptive.
  <https://www.w3.org/WAI/WCAG22/quickref/#labels-or-instructions>
- W3C WCAG 2.2 error identification: actionable problems should be identified
  in text, not only by color or placement.
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
- WAI-ARIA Authoring Practices Guide: use accessibility semantics to support
  common interactive patterns; the existing modal keeps the standard dialog
  pattern and focus containment.
  <https://www.w3.org/WAI/ARIA/apg/>
- Vue 3 computed properties and form bindings: derived UI state belongs in
  computed/pure helpers, while native form controls stay bound through standard
  value/change flows.
  <https://vuejs.org/guide/essentials/computed.html>
  <https://vuejs.org/guide/essentials/forms>
- Playwright locators and best practices: browser checks should prefer
  user-visible roles, labels, and text over implementation-specific selectors
  when proving user flows.
  <https://playwright.dev/docs/locators>
  <https://playwright.dev/docs/best-practices>
- OWASP Authorization and CSRF guidance: mutation routes should remain
  least-privilege and CSRF protected. This slice does not add a mutation route;
  it preserves the existing Artist Policy save boundary.
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

## Options Considered

### Option A: Backend Remap Repair Workflow First

Add explicit repair endpoints and persistence transitions for resolving
`review_needed` and `orphaned` states.

Pros:

- Gives operators a complete remediation workflow in one pass.
- Can audit every repair action separately from the policy save.

Cons:

- Expands a UX visibility gap into a larger mutation design.
- Needs route authorization, CSRF, audit events, and reconciliation semantics.
- Delays surfacing already-persisted risk to operators.

### Option B: Client Visibility and Filter UX First

Use the existing operator projection and draft save boundary to expose review
states, show affected cards, and make affected tracks easy to locate.

Pros:

- Uses existing persisted state and save semantics.
- Keeps security posture narrow: no new write endpoint.
- Improves operator safety immediately by making ambiguous overrides visible.
- Fits current Artist Detail section controls and Release Detail modal patterns.

Cons:

- Does not yet provide a dedicated one-click remap repair action.
- `orphaned` overrides that no longer match a visible track row are surfaced as
  a release-level note rather than a row-level control.

### Option C: Hide Affected Overrides Until Repair Exists

Keep ambiguous states out of the UI until a full repair workflow exists.

Pros:

- Avoids adding partial remediation UI.

Cons:

- Continues hiding saved exceptions that can affect reconciliation.
- Conflicts with the Artist Detail rule that broad policy and manual overrides
  must stay visible together.

## Final Recommendation Stack

Selected option: **Option B, client visibility and filter UX first**.

Implementation stack:

- Add a pure ESM presentation module:
  `src/client/lib/operator-track-override-remap-review.js`.
- Extend `operator-artist-detail-draft.js` with draft-aware track override
  lookup and release-group review summary helpers.
- Extend section controls with a `Track review needed` filter backed by an
  injected predicate.
- Show review state in Artist Detail cards with a text label and semantic
  warning/danger pill.
- Show review state in Release Detail with:
  - a release-level review note for all affected saved overrides
  - row-level badges for matched track overrides
  - existing native select controls for draft state changes
- Keep the security boundary unchanged: operators still resolve draft state by
  saving Artist Policy through the existing role-gated save path.
- Add pure helper tests and fixture-backed Playwright coverage using
  user-facing labels and text.

## Outcome

Implemented:

- `operator-track-override-remap-review.js` centralizes remap status
  normalization, summary counts, pill tones, and user-facing copy.
- Artist Detail section controls now include `Track review needed`.
- Affected release cards now display `Track review` plus compact summary text.
- Release Detail displays a review note before saving Artist Policy and
  row-level `Needs review` / `No current track match` status where a saved
  override can be matched to a visible track row.
- Browser fixture projections now count `review_needed` and `orphaned` states
  instead of hardcoding zero.
- Release Detail browser verification now proves the Artist Detail filter,
  card-level review indicator, modal-level review note, and row-level status.

## Follow-Up

The dedicated repair workflow is now implemented in
`TRACK_OVERRIDE_REMAP_REPAIR_WORKFLOW_DESIGN.md`. The next high-value item is
operator audit visibility for saved Artist Policy changes, including repaired
remap states and cleared track overrides.

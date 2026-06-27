# Track Override Remap Repair Workflow Design

Last updated: 2026-06-27

## Scope

This document records the design and implementation outcome for repairing
ambiguous saved track overrides after Artist Detail surfaces `review_needed` or
`orphaned` remap states.

The previous UX made ambiguous overrides visible. This slice adds the operator
repair workflow:

- `Keep this track` resolves a matched reviewed override to `resolved` while
  preserving its desired/suppressed intent.
- `Clear override` removes a stale reviewed override from the policy draft.
- Operators still persist the repair by saving Artist Policy, preserving the
  existing save/cancel and reconciliation boundary.

## Official Source Review

- W3C WCAG 2.2 labels and instructions: repair controls need clear labels that
  explain the action and target.
  <https://www.w3.org/WAI/WCAG22/quickref/#labels-or-instructions>
- W3C WCAG 2.2 error identification: ambiguous override states should be
  identified with text, not only by warning color.
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
- WAI-ARIA Authoring Practices dialog pattern: the repair actions live inside
  the existing Release Detail dialog and keep focus containment unchanged.
  <https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/>
- Vue 3 computed properties and form bindings: repair state is derived through
  computed values and draft mutations remain explicit event handlers.
  <https://vuejs.org/guide/essentials/computed.html>
  <https://vuejs.org/guide/essentials/forms>
- Playwright locator guidance: browser verification targets visible labels,
  roles, and text rather than private implementation structure.
  <https://playwright.dev/docs/locators>
  <https://playwright.dev/docs/best-practices>
- OWASP Authorization and CSRF guidance: a new mutation route would need
  role-gating, freshness/CSRF checks, and validation. This implementation avoids
  expanding the write surface by reusing the existing secured Artist Policy save.
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

## Options Considered

### Option A: New Backend Repair Endpoint

Add a route such as `POST /metadata/artists/:id/operator/track-overrides/:id/repair`
with explicit repair actions.

Pros:

- Each repair can be persisted immediately.
- Future audit events can capture the exact repair action.

Cons:

- Adds a second mutation path for the same Artist Policy state.
- Requires fresh-session, CSRF, route authorization, request validation, route
  inventory, and backend service tests.
- Creates a Save Policy inconsistency: a row repair could persist while other
  visible draft edits remain unsaved.

### Option B: Draft Repair Through Existing Save Boundary

Add repair actions to Release Detail that mutate the current Artist Policy
draft. The operator persists all repairs and other policy edits together with
Save Policy.

Pros:

- Preserves the established Artist Detail save/cancel contract.
- Avoids a new attack surface and keeps CSRF/authorization on the existing save.
- Keeps repair operations reversible until Save Policy.
- Reuses the current `operator_track_override` replacement flow and
  reconciliation queueing behavior.

Cons:

- Repair is not durable until Save Policy.
- Per-repair audit events are not available yet.

### Option C: Automatic Repair on Track Selection Change

Resolve review states automatically when the operator changes the desired-state
select.

Pros:

- Minimal UI.

Cons:

- Hides a durable state transition behind a broader desired-state change.
- Makes it easy to resolve ambiguity accidentally.
- Does not help stale overrides that no longer match a visible track row.

## Final Recommendation Stack

Selected option: **Option B, draft repair through existing Save Policy**.

Implementation stack:

- Extend `operator-artist-detail-draft.js` with pure repair helpers:
  - `resolveDraftTrackOverrideRemapReview`
  - `removeDraftTrackOverride`
- Extend Release Detail with explicit repair events:
  - matched rows expose `Keep this track` and `Clear override`
  - unmatched reviewed overrides appear in a compact repair panel with
    `Clear override`
- Keep all persistence on `saveOperatorArtistDraft`.
- Preserve existing role checks by only exposing controls through the existing
  operator-editing props.
- Add focused helper tests plus Playwright browser verification for the
  matched-row repair path.

## Outcome

Implemented:

- Matched reviewed overrides can be resolved in Release Detail without changing
  desired/suppressed intent.
- Matched and unmatched reviewed overrides can be cleared from the draft.
- The Release Detail review note disappears immediately when the operator
  resolves the last ambiguous override.
- The draft remains dirty until Save Policy, matching the rest of Artist Detail.
- No database migration or new route was required.

## Follow-Up

Implemented 2026-06-27 in
[ARTIST_POLICY_AUDIT_VISIBILITY_DESIGN.md](ARTIST_POLICY_AUDIT_VISIBILITY_DESIGN.md):
saved Artist Policy changes now emit bounded `artist_policy_saved` Activity
events with changed release selections, changed track overrides, repaired remap
states, cleared overrides, snapshot context, and reconciliation context.

The next high-value item is browser verification for that Activity trail: repair
a reviewed override, save policy, verify the Activity feed row, and follow its
Artist Detail link.

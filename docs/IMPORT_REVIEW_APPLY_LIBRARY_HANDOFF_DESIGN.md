# Import Review Apply Library Handoff Design

Status: Implemented
Date: 2026-06-27

## Purpose

After import apply completes, operators need a clear way to confirm that the
release now appears in Library. The previous runway showed apply counts and item
details, but did not provide an explicit next step into the Library read model.

This design adds a bounded handoff from a completed apply run to Library with
the complete-release filter already applied.

## Research Summary

- Vue recommends conditional rendering with derived state kept in component or
  helper logic instead of repeated template expressions.
- Playwright recommends user-visible role and text locators plus built-in
  actionability waiting for route and UI verification.
- MDN documents `role="status"` as a polite live region for non-interruptive
  workflow updates.
- OWASP API3 guidance favors bounded response properties and task-specific data
  exposure. The handoff derives from existing run status and count fields only.

Sources:

- Vue conditional rendering: https://vuejs.org/guide/essentials/conditional.html
- Vue computed properties: https://vuejs.org/guide/essentials/computed.html
- Playwright locators: https://playwright.dev/docs/locators
- Playwright actionability: https://playwright.dev/docs/actionability
- MDN ARIA `status` role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options Considered

### Option A: Leave apply run detail as the final state

Pros:

- No new UI.
- Apply detail already contains applied counts.

Cons:

- Operators must manually navigate to Library and recreate the relevant filter.
- The workflow feels incomplete after a successful apply run.

### Option B: Auto-redirect to Library after apply completes

Pros:

- Strong confirmation path.
- Puts the operator directly into the resulting Library state.

Cons:

- Disrupts diagnostics review for historical and warning-bearing apply runs.
- Makes direct run-detail reloads less predictable.

### Option C: Show an explicit Library handoff on completed apply runs

Pros:

- Preserves the apply detail as the source of truth.
- Gives operators one visible, keyboard-accessible next action.
- Uses existing Library route/query state and existing apply summary fields.
- Avoids a new backend route or broader payload.

Cons:

- Adds one more status notice to the apply runway.
- Library confirmation still depends on reconciliation data being available to
  the Library read model.

## Final Recommendation

Use Option C.

`buildImportApplyLibraryHandoffNotice` renders only when the current apply run is
`completed` and at least one release was applied or applied with warnings. The
notice links to `Library` with `focus=library&status=complete`, so operators land
on the complete-release view without exposing raw provider payloads or file
operation internals.

## Security Notes

- No new API route or mutation was added.
- The UI uses existing bounded count fields: `appliedCount` and
  `appliedWithWarningsCount`.
- The link carries only route-local filter state.
- Apply operation paths remain inside the existing authenticated Import Review
  detail, and provider credentials are never exposed.

## Implementation Outcome

- Added `buildImportApplyLibraryHandoffNotice` to the Import Review presentation
  helper.
- `ImportCandidateApplyPanel.vue` now renders a polite status notice and
  `Open Library` link when a completed apply run has applied releases.
- Added unit coverage for null, inactive, success, and warning handoff states.
- Added browser coverage proving a completed apply run links into Library with
  the complete-status filter and renders the applied release from the Library
  read model.

## Validation

Focused validation:

- `node --test test/client/import-candidate-presentation.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/import-review-completed-download-apply-handoff-browser-verification.test.js`
- `npm run lint:client`
- `npm run lint:test`

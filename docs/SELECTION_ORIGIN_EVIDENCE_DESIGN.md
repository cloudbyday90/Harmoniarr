# Selection-origin evidence design

**Status:** implemented 2026-08-25

## Problem

`selectionSource: manual` tells Harmoniarr that an operator override exists,
but it does not tell the operator whether the saved intent came from choosing a
specific edition in Artist Detail or including the policy-selected release from
Missing Music. The distinction exists at command time but was discarded before
the desired-state and Music Queue read models were built.

The product must not infer that distinction from titles, release IDs, or an old
activity event. Such inference would be incorrect after a later policy save,
restore, or edition change.

## Research basis

Research was completed against the official sources below on 2026-08-25.

- [W3C WCAG 2.2 — Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
  requires components with the same function to be identified consistently.
  The same durable origin has the same visible and accessible label in Artist
  Detail and Music Queue.
- [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/), updated
  March 2026, recommends short, clearly labelled controls and instructions.
  This slice adds no new control; the provenance text says what was saved and
  where it came from without adding another acquisition action.
- [W3C WCAG — Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  supports exposing dynamic reconciliation updates programmatically without
  moving focus. The prior reconciliation `role="status"` remains limited to
  state changes; static origin is plain visible text.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists for fixed value sets. Origins are validated
  as a small enum at the service boundary and constrained in PostgreSQL.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating permissions on every request and preventing guessed-ID
  access. No route is added; the existing user-scoped Music Queue read path and
  selection mutation authorization remain the only access boundaries.

## Options considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Derive origin from the release ID or activity log | No schema change | Ambiguous after an edit, restore, or legacy data; can present a false claim. Rejected. |
| Add a free-form origin note to request evidence | Flexible | Not durable with the selection record and not allowlist-validatable. Rejected. |
| Backfill legacy selections as `manual_edition` | Immediately shows a detailed label | Guesses historical intent. Rejected. |
| Persist a nullable constrained origin with the selection | Accurate for new commands, backward-compatible for existing rows, reusable in both read models | Requires a focused migration and contract propagation. Selected. |

## Recommended design

1. Add nullable `selection_origin` to `operator_release_group_selection`.
   Accepted values are `manual_edition` and `manual_inclusion`. A non-null
   origin is valid only with `selection_source = 'manual'`.
2. Preserve `null` for legacy or generic manual selections. Do not backfill or
   infer an origin.
3. The Artist Detail manual-edition command writes `manual_edition`; the
   Missing Music manual-inclusion command writes `manual_inclusion`.
4. Carry the field through the operator effective state and desired-state plan
   into `library_wanted_releases.evidence`.
5. Surface that data through a dedicated `evidence.operatorSelection` object in
   the existing user-scoped Music Queue response.
6. Present three honest states in both views:
   - `manual_edition`: **Edition selected**
   - `manual_inclusion`: **Manual inclusion**
   - legacy / unknown manual origin: **Manual selection**

## Security and compatibility

The field is server-normalized, database-constrained, and never accepted from a
new public request parameter. Existing Artist Detail and Missing Music commands
already perform fresh-session, CSRF, ownership, metadata membership, and
snapshot-concurrency checks; this change extends their saved draft only.

The Music Queue service receives the data from its existing user-scoped wanted
release read model. It exposes a narrow allowlisted object, not arbitrary JSON
from persisted evidence. No cross-user lookup, new mutation, or client-supplied
identifier is introduced.

## Non-goals

- Do not change policy-selected releases into manual selections.
- Do not turn Artist Detail into a second Downloader or Music Queue action
  surface.
- Do not label partial track overrides as an edition selection.
- Do not alter historical records to invent an origin.

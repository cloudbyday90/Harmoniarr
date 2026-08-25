# Manual selection and Music Queue visibility design

**Status:** implemented 2026-08-25

## Problem

An operator can save an edition from Artist Detail, but the saved choice is
easy to lose once the dialog closes. Music Queue also receives the choice's
provenance from the server, yet its client read model currently discards it.
The result is a needless gap between the place where an operator makes a
durable selection and the place where Harmoniarr performs the later work.

This design makes the existing state visible without turning Artist Detail into
a second Music Queue or adding a new download control.

## Research basis

Research was completed against the official sources below on 2026-08-25.

- [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  says that changes in waiting, progress, or results that do not move focus
  must be programmatically determinable. A short reconciliation update is
  therefore exposed as a polite status message only when it is relevant to a
  saved manual selection; static provenance is ordinary text, not a live
  region.
- [W3C WCAG 2.2 — Understanding Link Purpose (In Context)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html)
  recommends descriptive link names that identify their destination. The
  optional handoff names both the release and Music Queue rather than using a
  generic "See all" or "Details" label.
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  recommends CSRF protection on cookie-authenticated state-changing requests.
  This slice adds no mutation and preserves the existing fresh-session,
  CSRF-protected manual-selection command.

## Options considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Add a new queue command to Artist Detail | Faster-looking path to download | Collapses operator selection and acquisition work; creates two workflow entry points. Rejected. |
| Put a generic reconciliation banner at the top of every Artist Detail view | Simple implementation | Repeats global state and does not identify the release it affects. Rejected. |
| Show only an optimistic toast after saving | No layout change | The durable choice disappears after the toast and cannot be compared with Music Queue. Rejected. |
| Preserve provenance in the Music Queue read model and show compact, release-scoped state | Keeps the decision visible where it matters; uses existing user-scoped data; does not add mutations | Requires small presentation helpers and UI test coverage. Selected. |

## Recommendation stack

1. **Use durable state, not a client flag.** Artist Detail reads
   `operatorState` from its refreshed projection. Music Queue retains the
   server-provided selection provenance in its normalized read model.
2. **Use one clear provenance label.** The label is **Manual selection**. It
   is accurate for a saved edition and for a manual inclusion that already
   resolves to an edition; the UI must not claim a particular command path that
   the queue evidence does not carry.
3. **Show reconciliation only where it explains change.** A saved manual
   selection may show **Latest save queued**, **Updating Music Queue**, or
   **Update did not finish**, with concise next-step text. It does not promise
   an immediate download.
4. **Link to one exact queue release when available.** The Artist Detail card
   offers **Open _{release}_ in Music Queue** only after a user-scoped queue
   release with the same metadata release-group identifier exists. The
   destination is the existing direct release route, not a broad filter.
5. **Keep actions on Music Queue.** The Artist Detail card is navigational;
   matching, retry, download, and library-add actions remain inside the queue
   inspector where their evidence and safeguards are visible.

## Data and security boundary

No schema, route, or permission change is required. The client preserves
`evidence.selectionSource` and `evidence.selectionState` already returned by
the user-scoped Music Queue API, along with the metadata release-group ID used
for local correlation. It does not infer provenance from title strings or send
those IDs to a new endpoint.

The existing manual-edition save route remains the sole mutation boundary. It
continues to require a fresh authenticated session, CSRF protection, ownership
checks, release membership validation, and snapshot concurrency protection.

## Accessibility behavior

- Provenance is visible text and a token-backed pill; color is supplemental.
- Reconciliation updates use a concise `role="status"` message without moving
  focus or interrupting the operator's current work.
- The Artist Detail handoff is a native link outside the card's clickable
  detail control, avoiding nested interactive controls. Its accessible name
  includes the release title and destination.
- The existing release-grid roving focus target remains unchanged; the new
  link is a separate, natural tab stop in the card's actions area.

## Deliberate non-goals

- Do not combine Music Queue and Downloader in this slice.
- Do not display provider diagnostics on Artist Detail.
- Do not create a new global reconciliation dashboard.
- Do not automatically open, filter, or mutate Music Queue after saving an
  edition.

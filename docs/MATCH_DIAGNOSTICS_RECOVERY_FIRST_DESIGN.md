# Match Diagnostics Recovery-First Design

## Status

Implemented on 2026-07-29.

## Problem

`Match diagnostics` was still organized as a four-stage control dashboard. It
led with counts and runway stages, then placed raw source folders, file rows,
paths, and several competing transitions at the same visual level. That shape
made an exception tool look like the normal way to get music and obscured the
only question that matters in a diagnostic session: what is the current state,
and is there one safe action to take?

Music Queue remains the release-centered workflow. Match diagnostics is an
admin-focused exception surface with direct deep links from file and run
diagnostics.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) | State text identifies what needs attention and describes the recovery context instead of relying on color or a raw status code. |
| [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Successful transitions retain a polite status message; failures remain assertive text feedback. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Native disclosures keep evidence and uncommon transitions keyboard-operable without a custom control model. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Source paths and file-level evidence remain advanced diagnostic data and are not moved into the default recovery summary. |

## Options

### Keep the staged dashboard and raw detail panel

Pros: no UI churn; every diagnostic control remains immediately visible.

Cons: it competes with Music Queue, implies manual processing is routine, and
exposes path/file evidence before an operator needs it.

### Remove diagnostics after Music Queue

Pros: smallest normal workflow surface.

Cons: removes useful direct run/file recovery paths before the release read
model covers every exceptional state.

### Recovery-first diagnostics with disclosed evidence

Pros: makes the automatic state and one safe repair scannable, retains direct
diagnostic URLs, and keeps all existing evidence and secondary transitions
available on demand.

Cons: an operator must open a disclosure for raw paths, file rows, and less
common transitions; that is deliberate because those are not normal actions.

## Final Recommendation Stack

1. Keep Match diagnostics as an advanced route, never as a normal Music Queue
   destination.
2. Lead the selected-match workspace with a concise current-state card and at
   most one safe primary action.
3. Map normal automatic progress to text such as `Waiting for download`,
   `Download in progress`, and `Waiting to add to library`; do not show an
   action where automation should continue.
4. Map a persisted preview blocker, failure, rejection, or hold to a specific
   repair only when the authenticated user can perform it.
5. Put pause, rejection, and other uncommon transitions under `Other match
   actions` with a confirmation boundary for rejection.
6. Place raw source paths, file rows, naming plans, collision checks, and
   file-level decisions inside `View match and file evidence`. A direct file
   diagnostic link opens this disclosure so focus can move to the affected row.

## Implementation

- `import-candidate-recovery-presentation.js` owns state labels, tone,
  descriptions, primary action selection, and secondary transition ordering.
- `ImportCandidateRecoveryPanel.vue` renders the status, one primary action,
  polite success feedback, assertive failure feedback, and guarded secondary
  actions.
- `ImportCandidateDetailPanel.vue` now owns evidence only. It no longer mixes
  candidate transitions with raw paths and file inspection.
- `ImportReviewView.vue` removes the prominent stage dashboard, leads with the
  recovery card, and uses a native evidence disclosure. Existing query/hash
  state and file-focus handoffs remain intact.

## Security Boundary

This change adds no API route, persistence, or authorization path. Existing
admin checks, fresh-session validation, CSRF protection, and server-side
transition validation remain the mutation boundary. The default recovery card
does not render source folders, filenames, path mapping, provider payloads, or
secrets. Those existing diagnostic details remain behind the authenticated
evidence disclosure, and only the direct affected-file route state opens it.

## Verification

- Pure client tests cover blocker, automatic, read-only, and secondary-action
  presentation states.
- Existing browser diagnostics suites now verify recovery-first headings,
  primary repairs, direct-file evidence expansion and focus, retry feedback,
  preserved route state, read-only evidence access, and the retained
  confirmation boundary.
- Client lint, test lint, production builds, complete tests, and a local
  no-cache walkthrough rebuild are release gates.

## Outcome

Match diagnostics now starts with the automatic state and one bounded repair.
Operators can still inspect every raw detail, but they no longer have to parse a
candidate-run dashboard to determine what should happen next.

## Next High-Value Item

Reduce the remaining raw match queue/filter rail inside Match diagnostics to a
compact, disclosed `Find a match` diagnostic tool while preserving direct
candidate and file recovery links. Run-history controls are now separately
collapsed and documented in
[Match Diagnostics Run History Controls Design](MATCH_DIAGNOSTICS_RUN_HISTORY_CONTROLS_DESIGN.md).

# Activity Advanced Diagnostics Boundary

Status: **Implemented.**

## Goal

Keep Activity useful as a short, readable history while preserving the existing
match, inspection, download-run, and library-add controls for operators who
need to diagnose an exception. Normal music progress belongs in Music Queue,
live transfers belong in Downloader, and completed releases belong in Library.

## Research And Decision

The W3C menu tutorial recommends semantic, labelled navigation and a clear
indication of the current destination. The Activity diagnostics list remains a
labelled `nav` made of links rather than a custom menu widget. [W3C WAI menu
structure](https://www.w3.org/WAI/tutorials/menus/structure/)

The native HTML disclosure pattern provides a compact, keyboard-operable way to
hide optional content. `summary` is the control for its parent `details`, and
the disclosure content supplies its accessible description. [MDN `summary`
reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary)

The chosen design keeps one visible `Advanced diagnostics` disclosure in the
Activity workspace. It uses clear link labels and does not introduce custom
menu keyboard behavior. [W3C WAI navigation design](https://www.w3.org/WAI/curricula/designer-modules/navigation-design/)

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep raw Candidate and Imports routes as primary Activity destinations | No route migration. | Keeps implementation terms and manual controls in the normal workflow. | Reject. |
| Remove Import Review and apply controls now | Simplest normal UI. | Removes critical operator recovery and would invalidate durable diagnostic links. | Reject. |
| Canonical diagnostics routes with legacy aliases | Makes the boundary explicit, preserves deep links, and confines advanced controls to an intentional route. | Requires route and handoff updates. | **Adopt.** |

## Route Contract

Canonical routes are:

- `/app/activity/diagnostics/matches`: raw match evidence, selection recovery,
  media inspection, download-run, and library-add controls.
- `/app/activity/diagnostics/library-adds`: import-pending and path-planning
  diagnostics.
- `/app/activity/diagnostics/failed-library-adds`: failed library-add records.

The former `/app/activity/candidates`, `/app/activity/imports`, and
`/app/activity/failed` URLs redirect to the canonical diagnostics routes while
preserving query parameters and hash anchors. This keeps bookmarked run and
candidate drill-down URLs functional without retaining candidate-first
navigation.

## Presentation Contract

- Activity timeline actions use Music Queue, Downloader, Library, Settings, or
  Request Detail whenever a normal recovery surface exists.
- A raw-match handoff is labelled `Open advanced diagnostics`, never `Open
  candidates` or `Open Import Review`.
- `Advanced diagnostics` is the only Activity entry point for manual match
  selection, inspection, download-run reconciliation, and adding downloads to
  the library.
- The diagnostics page may use precise implementation language because it is
  explicitly entered for troubleshooting. It still avoids credentials, secrets,
  and unrestricted provider payloads.
- Push notifications for completed downloads and completed library adds point
  to Downloader and Library instead of the diagnostics workbench.

## Security And Compatibility

The route move is client-only. It does not widen operator permissions, expose
new data, or change candidate/apply API behavior. Existing requester route
restrictions cover canonical and legacy diagnostics route names. Legacy route
redirects preserve only already-supported query and fragment state; the
Import Review route-state normalizer remains the allowlist for that state.

## Validation

1. Client tests prove new diagnostic route targets are used by Music Queue,
   Downloader, Wanted, and request-detail handoffs.
2. Browser coverage proves the Activity disclosure reveals the canonical
   diagnostics link and that a legacy URL preserves its selected diagnostic
   state after redirection.
3. Existing Import Review browser suites continue to cover manual recovery,
   download execution, and library-add behavior through the compatibility URL.

## Final Recommendation Stack

1. Keep Music Queue as the normal release-progress and recovery surface.
2. Keep Downloader as the live transfer surface and Library as the completion
   surface.
3. Use Activity for events and minimal repair handoffs.
4. Keep match/import/apply controls under `Advanced diagnostics` until their
   release-level replacements are proven end to end.
5. Group diagnostic links by operator task, put recovery first, and keep DOM
   order aligned with visual order. See
   `docs/ACTIVITY_ADVANCED_DIAGNOSTICS_TASK_GROUPING_DESIGN.md`.

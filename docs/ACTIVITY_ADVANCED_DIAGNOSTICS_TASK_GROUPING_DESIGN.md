# Activity Advanced Diagnostics Task Grouping

## Status

Implemented on 2026-07-29.

## Problem

The original `Advanced diagnostics` disclosure was a flat row of eleven
equally weighted controls. It preserved every diagnostic route, but it did not
answer what an operator should do first. The most common recovery tools were
mixed with source administration and historical records, and Activity's visual
order differed from its DOM order on the normal timeline route.

Activity remains an event history. Music Queue, Downloader, and Library remain
the normal progress surfaces. Advanced diagnostics is an intentional exception
path for troubleshooting; it should organize existing tools without bringing
candidate-first navigation back into routine use.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) | Give each diagnostic task group a short, descriptive heading and explanation so people can predict what its links contain. |
| [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep DOM and visual order aligned: timeline content precedes collapsed diagnostics on the normal Activity route, while diagnostics precedes direct diagnostic content. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Retain one native disclosure boundary instead of adding a custom menu or nonstandard keyboard interaction. |
| [W3C WAI Navigation Design](https://www.w3.org/WAI/curricula/designer-modules/navigation-design/) | Use named navigation groups that reduce unnecessary noise and remain understandable across keyboard, touch, and narrow layouts. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Keep advanced event and provider evidence access restricted and do not expose raw paths, secrets, or provider payloads in the normal Activity surface. |

## Options

### Keep the flat link row

Pros: smallest implementation and all routes stay visible.

Cons: recovery actions are indistinguishable from historical and source
administration controls; the result is visually noisy and difficult to scan.

### Create a separate diagnostic hub route

Pros: offers room for richer explanations and troubleshooting workflows.

Cons: adds another route and navigation layer before an already specialized
tool; it also makes direct recovery slower.

### Group existing links inside the disclosure

Pros: keeps URLs and permission behavior unchanged, puts recovery first,
provides concise purpose text, and preserves the normal Activity workflow.

Cons: operators still need to open the disclosure before using specialist
tools; that is intentional for a non-routine surface.

## Final Recommendation Stack

1. Keep one native `Advanced diagnostics` disclosure and all current direct
   diagnostic URLs.
2. Put `Resolve an issue` first, with Background jobs and Failed library adds
   as the most direct recovery paths.
3. Keep Match diagnostics and Library-add diagnostics together under `Inspect
   music`; this remains advanced troubleshooting, not a normal queue view.
4. Separate saved records from source and historical records using concise
   group descriptions.
5. Render the disclosure after normal timeline content in DOM and visual order.
   When a direct diagnostic route is open, render the disclosure before the
   specialist content in both orders.
6. Centralize static route metadata in a small ESM navigation module. Do not
   add API calls, dynamic provider data, or new route permissions.

## Implementation

- `src/client/lib/activity-diagnostic-navigation.js` owns immutable task groups
  and existing named destinations.
- `ActivityDiagnosticsDisclosure.vue` renders the grouped native disclosure,
  semantic navigation sections, and responsive link lists.
- `ActivityWorkspaceView.vue` composes the disclosure before or after
  `RouterView` according to the active route so keyboard focus and visual order
  agree.

## Security Boundary

This is a presentation-only change. It does not add or change API routes,
authorization, provider calls, event payloads, or persisted data. The link map
contains only existing route names. Raw candidate, provider, path, and failure
evidence remains restricted to the authenticated specialist routes and is not
included in Activity's normal timeline.

## Verification

- Client unit coverage confirms recovery is first, destinations are unique,
  and legacy candidate/import route names are absent from the normal
  navigation map.
- Browser coverage confirms grouped headings, safe descriptions, recovery
  links, retained canonical drill-down routes, route-specific DOM order, and
  44px mobile link targets without horizontal overflow.
- Client lint, test lint, production build, broader test coverage, and the
  local walkthrough rebuild are run before release.

## Outcome

Advanced diagnostics now behaves like a compact troubleshooting index. It
starts with recovery, keeps specialist match tools secondary, and separates
record/source investigation without making Activity another control center.

The Match diagnostics entry screen now follows that same hierarchy: it leads
with the selected match's automatic state and one available repair, while raw
paths, file rows, and collision evidence remain disclosed. See
[Match Diagnostics Recovery-First Design](MATCH_DIAGNOSTICS_RECOVERY_FIRST_DESIGN.md).

## Next High-Value Item

Move the remaining Match diagnostics runway panels behind a `Run history and
controls` disclosure and translate their visible labels from candidate/import
jargon to match/download/add-to-library language, while preserving direct run
links and operator-only controls.

# Settings And Activity Action Hierarchy Refinement

Status: **Implemented.**

Date: 2026-08-01.

## 1. Problem

The Settings and Activity foundations are sound, but several established UI
patterns gave secondary controls the same visual prominence as the action that
actually changes a household user's system:

- a direct Activity diagnostic route expanded the full diagnostics directory
  before its selected content;
- routine Activity events repeated navigation links even though automatic work
  was proceeding normally; and
- healthy Setup status, disclosure toggles, and saved-connection verification
  controls competed with primary setup and save actions.

This created unnecessary vertical density and made the next useful action less
obvious. No server behavior, authorization boundary, route, or diagnostic
capability needs to change.

## 2. Official Sources Reviewed

The following official sources were reviewed on 2026-08-01 against the
requested June 2026 baseline.

| Source | Design input |
| --- | --- |
| [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) | Headings and labels need to identify purpose without repeating surrounding context. |
| [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification) | Controls that perform the same secondary function should remain consistently identified and presented. |
| [USWDS Button](https://designsystem.digital.gov/components/button/) | A page should distinguish its important action; navigation and less important actions should not compete with it as prominent buttons. |
| [W3C WAI: Designing for Web Accessibility](https://www.w3.org/WAI/tips/designing/) | Group related content with headings and spacing, reduce clutter, and retain responsive access to every control. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- |
| Restyle every Settings and Activity control in one pass | Could make every surface look more uniform. | High regression risk, obscures the important workflow changes, and creates unnecessary visual churn. | Reject. |
| Target shared secondary controls and the two high-density workflows | Removes repeated emphasis while preserving all capabilities, routes, and accessibility semantics. | Leaves later visual polish work for independently scoped pages. | Adopt. |
| Remove diagnostics and routine history handoffs completely | Maximally reduces density. | Makes legitimate diagnostic access and release-context recovery harder to find. | Reject. |

## 4. Final Recommendation Stack

### Settings

- Keep one primary action for a state-changing next step: setup repair or
  saving configuration.
- Render read-only status checks, verification actions, and disclosure toggles
  as ghost controls. Their labels and keyboard behavior remain unchanged.
- On a healthy Setup page, retain the status pill, concise completed state,
  and required-task list, but remove repeated explanatory copy. The hidden
  live status remains available to assistive technology.

### Activity

- Keep the diagnostics directory on every Activity route, but leave it closed
  by default. A direct diagnostic route continues to provide `Activity
  timeline` and retains its deep link.
- Keep action links only in `Needs attention`. Routine entries remain a
  readable record of automatic work rather than a row of repeated navigation
  decisions.
- Do not change event authorization, filtering, response payloads, or the
  release-scoped route target builder. The view decides only whether an
  already-safe link belongs in the current attention section.

### Accessibility And Security

- Preserve semantic `<details>`, buttons with existing `aria-controls` and
  `aria-expanded`, and status live regions.
- Continue to render only existing, allowlisted client routes. This refinement
  does not add client-provided route or object identifiers to any mutation.
- Validate desktop and mobile layouts with the project-pinned Playwright
  Chromium bundle and assert that direct diagnostics start closed.

## 5. Implementation Outcome

- `SettingsDisclosure` and `SettingsSaveBar` now consistently mark secondary
  show, hide, and verification actions as ghost controls.
- Setup removes duplicate healthy-state guidance and keeps `Check status`
  secondary to setup repair or configuration work.
- Direct Activity diagnostics begin collapsed instead of displacing their
  selected page content.
- The Activity timeline renders its safe route handoff only inside the
  attention section. Routine search, download, add, and request events remain
  concise historical records.
- A successfully resolved Music Queue detail now follows later authorized
  queue-list refreshes for that same release. A missing or mismatched scoped
  detail is never replaced from the list, preserving the generic unavailable
  boundary.

## 6. Acceptance

- A direct diagnostic URL renders its requested content before any expanded
  diagnostic navigation and the navigation remains available on demand.
- A warning or terminal Activity item retains its appropriate focused action.
- A routine Activity entry has no destination handoff link.
- An active selected Music Queue release updates from the next authorized list
  refresh without replacing a scoped unavailable state.
- A healthy Setup page communicates readiness once visibly, keeps a
  screen-reader status update, and does not promote a read-only status refresh
  over setup or save work.
- Secondary Settings controls preserve their accessible labels and operate on
  desktop and mobile layouts without horizontal overflow.

## 7. Next Step

Run a focused responsive visual review of the remaining long-form Settings
forms, starting with Media & storage. Consolidate duplicate inline helper
copy only where the save state, form-group heading, and field label already
identify the same decision.

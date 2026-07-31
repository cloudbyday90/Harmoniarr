# Settings Information Hierarchy Design

## Scope

This slice improves the normal Settings path for:

1. System & security
2. Connections
3. Library
4. Media & storage

It does not change setting values, server validation, permissions, secrets, or
provider behavior. The goal is to make the settings that matter during normal
setup easy to scan, while retaining less common tuning and diagnostics without
turning each page into a wall of cards and helper text.

## Problem

The Settings pages had accumulated controls correctly, but not consistently.
Core setup, optional features, and expert tuning shared the same visual weight.
Several pages repeated the same default guidance in a card subtitle, group
description, and field hint. General also retained an older save footer even
after Connections, Library, and Media & storage adopted the shared save-state
contract.

That made it harder to answer three basic questions:

1. What do I need to set up now?
2. What can I safely leave alone?
3. Where is the one action that saves my changes?

## Research Baseline

The requested June 2026 guidance was reviewed against current official sources
on 2026-07-31.

- [W3C Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/) recommends
  short, simple forms that request only what is needed for the task.
- [W3C Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends visually and semantically grouping related inputs with
  `fieldset` and `legend`, making a long form easier to understand in smaller
  parts.
- [W3C Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/)
  recommends concise instructions associated with the relevant form or
  control, rather than relying on placeholder text.
- [USWDS Form Guidance](https://designsystem.digital.gov/components/form/)
  recommends simple vertical form blocks, contextual help, and avoiding
  disabled controls except when processing or preventing a duplicate action.
- [GOV.UK Validation Pattern](https://design-system.service.gov.uk/patterns/validation/)
  requires a retryable form to preserve entered values and describe how to
  correct an error.

## Options Considered

### Keep page-local groups and disclosure labels

Pros:

- Lowest implementation effort.
- No component work.

Cons:

- Terminology and visual cadence continue to drift.
- Repeated helper text remains difficult to scan.
- General retains a different save and recovery interaction.

### Move all settings behind one progressive multi-step wizard

Pros:

- The first-time path would be tightly focused.
- Advanced fields could remain out of the initial journey.

Cons:

- Poor fit for returning operators who need one setting quickly.
- Creates a second navigation and save model beside the existing Settings
  routes.
- Risks hiding security or recovery controls that need direct access.

### Shared field groups with compact, categorized disclosures

Pros:

- Preserves direct routes and familiar page boundaries.
- Gives core controls a semantic and visual grouping without adding cards.
- Marks Advanced and Optional areas consistently while keeping their heading
  meaningful.
- Lets field-level help exist only where it changes a decision.
- Brings General onto the shared save/retry contract.

Cons:

- Requires migration of four pages and their source-contract tests.
- Compact disclosure text depends on its adjacent title, so the accessible name
  must retain the full action description.

## Decision

Use a shared `SettingsFormGroup` Vue component and an extended
`SettingsDisclosure` contract.

### Hierarchy Contract

1. Each page starts with the normal setup controls that apply to the page's
   main outcome.
2. A `SettingsFormGroup` renders related controls in a semantic `fieldset`
   with a `legend`, a concise group-level explanation, and no nested card.
3. Only the first core group uses the `Main setup` cue. Later groups use clear
   task labels without repeating the cue.
4. Advanced and Optional disclosures show a short visible `Show` or `Hide`
   action, with their full contextual action retained in `aria-label`.
5. Advanced and Optional categories are shown once in the disclosure header;
   titles do not repeat words such as "advanced" or "optional".
6. Every page ends with the shared sticky save bar. It remains the only form
   save action and preserves the existing retry and verification behavior.

### Per-Page Application

| Page | Always visible | Disclosed |
| --- | --- | --- |
| System & security | Remote access protections and security posture | Base URL and diagnostic logging |
| Connections | Soulseek mode and external service details when selected | Connection behavior and optional music sources |
| Library | Search timing, limits, and automatic downloads | Source safety, retention, ranking, audio thresholds, naming |
| Media & storage | Required download, staging, and library folders plus readiness | Path translations, additional folders, cover art, provider usage |

### Security and Accessibility Boundary

- The pass does not relax server-side validation or permission checks.
- Raw secrets remain write-only and are never rendered in group descriptions or
  change baselines.
- Labels remain explicit and associated with the relevant control. New primary
  inputs receive stable `for` and `id` pairings.
- The save footer uses the existing polite saved/saving messages and assertive
  retryable failure behavior. A save failure keeps entered values available.
- A control is disabled only where that state prevents a conflicting action,
  such as duplicate saving or clearing a stored credential.

## Implementation Outcome

- Added `SettingsFormGroup` for reusable semantic form grouping.
- Extended `SettingsDisclosure` with compact actions and Advanced/Optional
  category cues while preserving descriptive accessible action labels.
- Simplified primary copy across the four scoped pages and removed repeated
  default explanation where a group-level description is sufficient.
- Migrated System & security to `SettingsSaveBar`, including the established
  load-versus-save failure split.
- Added client contracts and Docker-backed browser verification for the
  hierarchy, disclosure semantics, save path, and responsive no-overflow
  behavior.

## Acceptance Criteria

- Each scoped page has one visible normal setup path and one shared save action.
- Related primary controls are grouped by semantic fieldsets.
- Advanced and Optional areas are clearly marked but do not repeat their
  category in the title.
- Compact visible disclosure actions retain descriptive accessible names.
- General has the same retryable save-state behavior as the other primary
  Settings pages.
- Browser verification covers the four pages at desktop and mobile widths.

## Next Step

The next high-value Settings slice is a **setup readiness landing pass**. The
Setup route should become the focused first-run and recovery entry point: show
the few prerequisites for automatic music handling, summarize what is ready,
and link directly to the relevant normal Settings page without exposing
advanced configuration or diagnostics first.

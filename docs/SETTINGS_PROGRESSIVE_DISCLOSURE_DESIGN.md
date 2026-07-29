# Settings Progressive Disclosure Design

## Status

Implemented on 2026-07-25.

## Problem

Settings previously opened on security and system controls, while the tab bar
gave routine setup, provider health, storage, library behavior, optional
providers, retention, naming templates, and account recovery equal weight.
This made the normal local-install path difficult to identify and presented
high-impact controls before their context.

## Research

Sources were checked on 2026-07-25 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use a real button with `aria-expanded` and `aria-controls` for each expandable settings group. |
| [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) | Keep visible, specific field labels and concise format/help text near inputs without overwhelming the first view. |
| [W3C WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) | Keep failures textual and tied to their operation; do not rely on color-only health or save feedback. |
| [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Show frequent, high-value tasks first and reveal specialized options on request with explicit labels. |

## Options

### Keep the existing tab set and forms

Pros: no route or layout change.

Cons: routine setup remains indistinguishable from rare or potentially
destructive settings; users must scan every tab and lengthy form.

### Replace Settings with a forced setup wizard

Pros: a clear initial sequence.

Cons: unsuitable after first install, breaks direct access to individual
controls, and incorrectly turns independent maintenance tasks into a linear
workflow.

### Setup-first Settings with progressive disclosure

Pros: makes the normal setup order obvious, keeps deep links intact, reduces
visual load, preserves expert access, and does not hide a required recovery
path behind an irreversible step.

Cons: an operator must explicitly open a well-named advanced group for rare
controls.

## Final Recommendation Stack

1. Make `Settings` open a concise setup overview, not an advanced system form.
2. Keep `Connections`, `Media & storage`, `Library`, and `Notifications` in
   the primary navigation; put system, access, account, recovery, and metadata
   tooling under an explicit `More settings` disclosure.
3. Keep the Soulseek ownership decision, address/key fields, saved connection
   result, and its test action together in Connections. Keep supporting service
   health and optional source integrations, timeouts, and playlist expansion
   behind named disclosures. See `SETTINGS_CONNECTIONS_HIERARCHY_DESIGN.md`.
4. Keep library scheduling and automatic-download preference visible. Hide
   source policy, retention, scoring, audio thresholds, and naming templates
   until requested.
5. Keep Media folders and folder readiness visible; keep a missing path
   translation as a direct setup action, and place translation details,
   optional folders, artwork, and usage telemetry behind named disclosures.
   See `docs/SETTINGS_MEDIA_STORAGE_HIERARCHY_DESIGN.md`.
6. Preserve the existing routes, server-side validation, CSRF requirements,
   write-only secret behavior, and generic error handling. This is a UI
   information-architecture change, not a relaxation of security controls.

## Component Contract

`SettingsDisclosure.vue` is a neutral, reusable section rather than a nested
card. It owns only local open state and exposes slots for existing form fields.
Its trigger is a semantic button with `aria-expanded` and `aria-controls`; the
panel is a labelled region. Hidden content remains mounted so an operator does
not lose unsaved input while scanning the page.

## Verification

- Unit/source-contract coverage verifies the disclosure semantics, setup route,
  primary/secondary navigation, and the preserved field bindings.
- Browser coverage verifies that Settings starts at setup, the secondary nav
  opens on request, and Connections/Library expose advanced groups without
  hiding primary actions.
- The existing settings API, validation, session, CSRF, and secret handling
  tests remain part of the full suite.

## Outcome

Settings now leads with the actions a local operator needs to complete first:
connect the download service, set folders, and choose library behavior. The
remaining capabilities retain direct routes but no longer compete for attention
with those tasks.

## Next High-Value Item

Extend Activity repair handoffs for the remaining common Music Queue lifecycle
events: match selected, download started, audio check outcomes, library add, and
request fulfillment. The UI structure is now ready to link each event to its
single appropriate repair surface instead of exposing a workbench.

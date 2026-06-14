# Discover Seed Terminology Guard Design

Status: Accepted for implementation
Last updated: 2026-06-12
Owner: Product + client architecture

## Purpose

This document closes the first high-value item from
`DISCOVER_RECOMMENDATION_MODEL_PLAN.md`: proving that Discover no longer exposes
legacy `seed` terminology in user-facing copy or accessible names.

The goal is not to rename every internal implementation symbol yet. The current
graph composable still uses `seed` internally as legacy recommendation-input
plumbing. That cleanup belongs to the later internal naming phase. This design
guards the product surface first.

## Research Baseline

Official sources reviewed in June 2026 for current guidance as of May 2026:

- W3C WCAG 2.2, Success Criterion 2.5.3, requires accessible names for labeled
  UI components to contain the visible label text, and recommends putting the
  visible label at the start of the accessible name:
  https://www.w3.org/TR/WCAG22/#label-in-name
- W3C WAI-ARIA Authoring Practices, "Providing Accessible Names and
  Descriptions", explains that `aria-label` provides a non-rendered accessible
  name and should be tested because it is not visible:
  https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- Vue official accessibility guide documents `aria-label`, `aria-labelledby`,
  and `aria-describedby` usage in Vue templates:
  https://vuejs.org/guide/best-practices/accessibility
- Vue Test Utils official guide identifies Vue Test Utils v2 as the official
  Vue 3 component testing utility:
  https://test-utils.vuejs.org/guide/
- Node.js official test runner documentation supports focused ESM tests using
  `node:test` and subtests:
  https://nodejs.org/api/test.html

Applied here:

- Visible copy and accessible labels are both product surface.
- `aria-label` strings need the same terminology guard as rendered text because
  they are exposed to assistive technology users.
- The lowest-churn guard belongs at the pure presentation-helper boundary before
  reaching for browser or component tests.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| A. Manual audit only | Fast, no code | Regression-prone; cannot safely check off the plan item |
| B. Aggregate presentation-helper test | Small, fast, catches copy and aria-label drift at the source | Does not inspect every rendered template literal |
| C. Component render test | Exercises Vue template output and props | More setup; duplicates helper assertions for this scope |
| D. Full browser/a11y test | Highest confidence for rendered UI | Disproportionate for a terminology-only guard; slower and more brittle |
| E. Rename internal `seed` variables/classes now | Reduces future confusion | Higher churn; can disturb graph behavior and CSS without changing product output |

## Final Recommendation Stack

### R1. Guard presentation helpers first

Add one aggregate regression test in `test/client/discover-presentation.test.js`
that collects all fixed Discover copy and aria-label strings produced by
`src/client/lib/discover-presentation.js`, then asserts no legacy product terms
appear.

Blocked terms:

- `seed`
- `seeds`
- `seed artist`
- `add as seed`
- `seed match`
- `followed artist`
- `following`

### R2. Keep the guard scoped to fixed platform copy

Do not fail on arbitrary artist names, artist disambiguation, or remote metadata
values. Those values can legitimately contain words that overlap with blocked
product terms. Vue escapes interpolated strings by default, and existing helper
tests already verify fixed-enumeration labels for provenance and strength.

### R3. Do not rename internal `seed` plumbing in this phase

Keep `seeds`, `addSeed`, `seedCount`, and CSS class names unchanged for now. They
are internal implementation details. Rename them only in the later "Internal
naming cleanup" phase with broader graph/composable coverage.

### R4. Update the platform plan only after validation

After the focused test passes, mark `No user-facing seed language remains` as
complete in `DISCOVER_RECOMMENDATION_MODEL_PLAN.md`. Mark the broader Phase 1
terminology pass complete only if the remaining Phase 1 surface is already
covered by existing copy updates and this new guard.

## Security

This change is primarily terminology and accessibility risk reduction, but it
preserves the existing security posture:

- Fixed labels remain fixed enumerations, not engine- or user-supplied markup.
- The guard avoids testing remote metadata as platform copy, preventing false
  failures from legitimate artist data.
- The code remains pure ESM and framework-free at the presentation-helper
  boundary, limiting test setup and avoiding global mocks.

## Validation

- `node --test test/client/discover-presentation.test.js`
- `npm run lint:test`

No browser validation is required unless a later change modifies Vue templates,
focus behavior, or rendered layout.

## Outcome

Implemented:

- Added an aggregate regression test in
  `test/client/discover-presentation.test.js`.
- Covered fixed Discover copy, recommendation labels, search-result labels, and
  accessible names produced by `discover-presentation.js`.
- Left internal `seed` graph/composable naming unchanged for the later internal
  naming cleanup phase.
- Follow-up completed on 2026-06-13: the scoped client Discover graph rename is
  documented in `DISCOVER_INTERNAL_NAMING_RENAME_DESIGN.md`.

Validation completed:

- `node --test test/client/discover-presentation.test.js` — 95/95 passing.
- `npm run lint:test` — passing.

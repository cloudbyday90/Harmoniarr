# Fidelity Settings Quality Review Design

> Quality review of the Phase 5 Fidelity thresholds implementation against
> research-backed best practices (Vue 3, OWASP, NN/g, WCAG 2.2). Documents
> findings, options considered, and applied improvements.

## Research Sources

| Source | Topic | URL |
| --- | --- | --- |
| Vue.js Official Guide | Form bindings, composables, `v-model.number` | https://vuejs.org/guide/essentials/forms |
| Vue.js Official Guide | Composable extraction patterns | https://vuejs.org/guide/reusability/composables |
| Nielsen Norman Group | Progressive disclosure | https://www.nngroup.com/articles/progressive-disclosure/ |
| UXPin (2026) | Progressive disclosure patterns, conditional/step-by-step/contextual | https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/ |
| OWASP | Input validation cheat sheet (allowlist, syntactic/semantic, client vs server) | https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html |
| AllAccessible (2025) | WCAG 2.2 compliance guide (target size, focus, form validation) | https://www.allaccessible.org/blog/wcag-22-complete-guide-2025 |
| Reddit r/vuejs (Sep 2025) | Community form validation approaches without heavy libraries | https://www.reddit.com/r/vuejs/comments/1nd4izi/ |

## Research Findings

### 1. Vue 3 Composable Pattern (Vue.js Official)

- Use `reactive` for objects, `ref` for primitives.
- Extract reusable logic into composables with factory functions.
- Return `readonly` refs when consumers should not mutate directly.
- **Applied to Harmoniarr**: `useSettingsForm` correctly uses `reactive` for the form object (v-model needs mutability, so `readonly` would break binding). Factory function with dependency injection (`fetchSettingsFn`, `updateSettingsFn`) is correct.

### 2. Progressive Disclosure (NN/g)

NN/g defines progressive disclosure as: "Initially show users only a few of the most important options. Offer a larger set of specialized options upon request."

Key criteria:
1. **Correct split** between initial and secondary features.
2. **Obvious progression mechanism** — users must easily discover how to access advanced options.
3. **Maximum 2 levels** — beyond 2 levels, users get lost.

UXPin (2026) identifies 3 categories:
- **Step-by-step**: Sequential stages (wizards).
- **Conditional**: Hide until explicitly requested (advanced toggle).
- **Contextual**: Surface based on user's current situation.

**Applied to Harmoniarr**: Fidelity and Scoring are "conditional" progressive disclosure — advanced settings that most operators never change. Current implementation uses an "(advanced)" badge but no collapse mechanism.

### 3. Input Validation (OWASP)

OWASP Input Validation Cheat Sheet key principles:
- Validate at both **syntactic** (format) and **semantic** (business meaning) levels.
- **Allowlist > denylist** — define what IS authorized.
- **Client-side for UX, server-side for security** — both should be implemented.
- Use **strong types** (numbers, booleans, dates) for implicit validation.
- Validate **length/range/format/type**.

**Applied to Harmoniarr**: The server-side `settings-validator.js` provides authoritative validation. The client uses HTML5 `type="number"` with `min`/`max`/`step` for first-pass UX validation. This two-layer approach matches OWASP guidance exactly.

### 4. Accessibility (WCAG 2.2)

Relevant criteria for settings forms:
- **2.5.8 Target Size (Minimum)**: Interactive targets >= 24×24 CSS pixels.
- **3.3.7 Redundant Entry**: Don't make users re-enter information.
- **Focus visible**: Clear focus indicators on all interactive elements.

## Current Implementation Assessment

| Aspect | Status | Notes |
| --- | --- | --- |
| Composable pattern | Correct | `reactive` for form object, factory with DI |
| Payload builder | Correct | Shallow spread, no validation in client |
| HTML5 validation | Correct | `type="number"`, `min`, `max`, `step` match server ranges |
| Server-side validation | Correct | `settings-validator.js:379-434` is authoritative boundary |
| Progressive disclosure badge | Correct | "(advanced)" pill matches scoring card |
| Collapse mechanism | Not implemented | Parent doc says "collapsed by default" but scoring card also doesn't collapse |
| Reset to defaults | Not implemented | Scoring card has one; fidelity should match |
| Single-field `hx-form-row` | Inconsistent | `trustHealthyMinSuccessRate` wrapped in `hx-form-row` alone; Retention's single field is NOT wrapped |
| Labels and helper text | Correct | `hx-field-label` + `cfg-field-hint` on every field |
| Contract tests | Correct | 4 tests covering presence, wiring, constraints, labels |
| Payload tests | Correct | 2 tests covering custom values and defaults |

## Options Considered

### Option 1: Add "Reset to defaults" button (recommended)

Add a reset button matching the scoring card pattern:
- `FIDELITY_DEFAULTS` constant in view's `<script setup>`.
- `resetFidelityDefaults()` function using `Object.assign`.
- Button in a footer `cfg-group` after the Source trust section.

| Pros | Cons |
| --- | --- |
| Matches scoring card pattern (consistency) | Adds 12 lines to view |
| NN/g: advanced settings should have easy reset path | Another constant to keep in sync |
| Reduces operator error for 9-field form | |

### Option 2: Add progressive disclosure collapse toggle

Add a `v-if` toggle to collapse the card body:
- `ref('fidelityExpanded')` in view.
- Click handler on header to toggle.
- `v-if="fidelityExpanded"` on `hx-card-body`.

| Pros | Cons |
| --- | --- |
| Matches parent doc "collapsed by default" spec | Inconsistent with scoring card (also "advanced", not collapsed) |
| NN/g: conditional disclosure for advanced features | Adds state management complexity |
| Reduces initial page length | Operators may not discover the section |

### Option 3: Fix single-field `hx-form-row` inconsistency (recommended)

Remove the wrapping `hx-form-row` from `trustHealthyMinSuccessRate`:
- Single fields should use `hx-field` directly (matching Retention pattern).

| Pros | Cons |
| --- | --- |
| Consistent with Retention card | Minor visual change |
| Cleaner markup | |

### Option 4: Add client-side JavaScript validation

Add computed validation state with visual error indicators:
- Computed property checking each field's range.
- CSS class binding for error state.
- Inline error messages.

| Pros | Cons |
| --- | --- |
| Faster feedback than server round-trip | Duplicates server validation logic |
| Catches errors before save | HTML5 native validation already provides this |
| | Maintenance burden: client ranges must match server |

### Option 5: Add aria-describedby for helper text

Link each helper text to its input via ARIA:
- Add `id` to each `cfg-field-hint`.
- Add `aria-describedby` to each input.

| Pros | Cons |
| --- | --- |
| WCAG 2.2 best practice | Adds significant markup noise for 9 fields |
| Screen readers announce helper text | Design system may already handle this |
| | No `data-testid` pattern in existing code |

## Final Recommendation Stack

### R1. Add "Reset to defaults" button for fidelity (accepted)

Matches scoring card pattern. Low risk, high consistency value. Add
`FIDELITY_DEFAULTS` constant, `resetFidelityDefaults()` function, and a
`cfg-group` footer with the reset button.

Outcome: Implemented. Added `FIDELITY_DEFAULTS` constant and
`resetFidelityDefaults()` in `SettingsLibraryView.vue`. Added contract test
for reset button presence.

### R2. Fix single-field `hx-form-row` inconsistency (accepted)

Remove the `hx-form-row` wrapper from the single `trustHealthyMinSuccessRate`
field, matching the Retention card pattern where `outcomeEventMaxAgeDays` is a
standalone `hx-field`.

Outcome: Implemented. Changed `hx-form-row > hx-field` to bare `hx-field` for
the healthy min success rate field.

### R3. Progressive disclosure collapse (deferred)

The scoring card (Phase 2) also uses the "(advanced)" badge without collapse.
Adding collapse to fidelity alone would create inconsistency. If collapse is
desired, it should be applied to both scoring and fidelity cards together as a
separate follow-up task. Current badge-only approach is acceptable per NN/g's
"obvious progression mechanism" criterion — the badge clearly signals advanced
content, and the visual grouping (2 sub-groups with helper text) provides
structure within the card.

Outcome: Deferred. Document the decision. Collapse for both scoring and
fidelity can be implemented as a follow-up.

### R4. Client-side JavaScript validation (rejected)

HTML5 native validation (`type="number"`, `min`, `max`, `step`) already
provides browser-level feedback (red outline, tooltip on invalid values). The
server-side validator is the authoritative security boundary. Adding JavaScript
validation would duplicate logic and create a maintenance burden. The two-layer
approach (HTML5 UX + server security) matches OWASP guidance.

Outcome: Not implemented. Current HTML5 + server validation is sufficient.

### R5. aria-describedby (deferred)

The Harmoniarr design system (`design-system.css`) and component patterns do not
currently use `aria-describedby` for any existing settings fields. Adding it to
fidelity alone would be inconsistent. This should be applied systematically
across all settings views as a separate accessibility initiative.

Outcome: Deferred. Systematic `aria-describedby` should be a cross-cutting
accessibility improvement for all settings views.

## Security Posture

The fidelity settings implementation maintains a secure posture:

1. **Client-side**: HTML5 input validation provides UX-level guards. No
   sensitive data is exposed (thresholds are operational parameters, not secrets).
2. **Transport**: The existing `PUT /api/v1/settings` endpoint requires admin
   authentication and CSRF protection.
3. **Server-side**: `settings-validator.js:379-434` provides authoritative
   validation with `normalizeIntegerSetting` (range-bounded) and
   `normalizeRateSetting` (0–1 range). Invalid values are rejected before
   persistence.
4. **Defense-in-depth**: The server resolver provides additional clamping
   fallbacks even if validation is bypassed.

## Test Plan

After applying R1 and R2:

- `node --test test/client/settings-form.test.js` — 13 payload tests
- `node --test test/client/settings-library-view-contract.test.js` — 29 contract tests (28 + 1 new reset button test)
- `npm run lint:client` — 0 warnings

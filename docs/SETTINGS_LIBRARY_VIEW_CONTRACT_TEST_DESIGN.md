# Settings Library View Contract Test Design

> Phase D2 of the Settings Library track. This document covers the contract test
> file for `SettingsLibraryView.vue`, verifying structural patterns in the Vue
> SFC source using the established source-text regex assertion pattern.

## Problem

Phase C2 replaced the "Coming soon" placeholder with a functional
`SettingsLibraryView.vue` containing a "Discovery scheduling" card with 4 form
fields. No contract test exists to guard against structural regressions such
as broken v-model bindings, missing state branches, or removed field
constraints.

D2 creates a contract test following the same pattern used by the 9 existing
`*-contract.test.js` files in the codebase.

## Research Baseline

### Established contract test pattern (9 existing files)

All 9 existing contract test files (`test/client/*-contract.test.js`) follow an
identical pattern:

- **Framework:** `node:test` + `node:assert/strict` — no Vitest, no @vue/test-utils
- **File reading:** `readFile` from `node:fs/promises`, reading `.vue` files as UTF-8 text
- **URL construction:** `new URL('../../src/client/...', import.meta.url)` for resolving source file paths
- **Assertions:** `assert.match(source, /pattern/)` for positive, `assert.doesNotMatch(source, /pattern/)` for negative
- **Naming convention:** `ComponentName verb description` (e.g., "ConfirmDialog follows the WAI-ARIA alertdialog pattern")
- **Copyright:** GPL v3 header (17 lines)
- **No DOM, no component mounting, no test framework wrappers**

### What existing contract files assert about

| Category | Examples |
|---|---|
| ARIA roles/attributes | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-live` |
| Event bindings | `@cancel`, `@click`, `@submit`, `defineEmits` |
| Component imports | `import X from './X.vue'`, `<ComponentName` in template |
| CSS classes | `hx-pill`, `hx-toast__action`, `rsp-track` |
| Conditional rendering | `v-if`, `v-else-if` guards |
| Props/emits declarations | `defineEmits([...])`, `propName: {` |
| Negative assertions | `assert.doesNotMatch` for legacy patterns |
| Touch targets | `min-width: 44px`, `min-height: 44px` |
| Cross-site validation | Iterating consumer files with `for...of` |

### Component under test: `SettingsLibraryView.vue` (104 lines)

The view has three mutually exclusive rendering branches:

| Branch | Condition | Content |
|---|---|---|
| Loading | `v-if="isLoading"` | Card with "Loading settings..." |
| Error | `v-else-if="errorMessage && !successMessage"` | Card with "Settings unavailable" |
| Form | `v-else` | `<form @submit.prevent="saveSettings">` wrapping "Discovery scheduling" card |

The form card contains 4 number inputs in 2 groups:

| Label | v-model | min | max | step |
|---|---|---|---|---|
| Automatic cooldown (hours) | `form.library.discoveryCooldownHours` | 1 | 168 | 1 |
| Fallback cooldown (hours) | `form.library.discoveryFallbackCooldownHours` | 1 | 168 | 1 |
| Batch size | `form.library.discoveryBatchSize` | 1 | 50 | 1 |
| Max search attempts | `form.library.maxSearchAttempts` | 1 | 10 | 1 |

The view imports and invokes `useSettingsForm()` without options, calling
`loadSettings()` in `onMounted`.

### D2 specification (from parent design doc)

1. The "Discovery scheduling" section is visible and expanded by default.
2. All four fields are wired to `form.library.*`.
3. The section is absent when the view is in an error state.

## Options Considered

### Decision 1: Test scope — spec minimum vs expanded coverage

| Option | Pros | Cons |
|---|---|---|
| **A — Minimum (3 tests, D2 spec only)** | Minimal; matches spec exactly | Leaves structural regressions undetected |
| **B — Expanded (8 tests, spec + structural)** | Catches regressions in state branches, form wiring, composable integration, and save bar; matches density of existing contract files | More tests to maintain |

**Chosen: Option B.** Existing contract files average 6-8 tests each. The spec's
3 requirements translate to 3 core tests, but additional structural tests are
needed for parity with existing contract files.

### Decision 2: Accessibility assertions

| Option | Pros | Cons |
|---|---|---|
| **A — Include label associations** | Matches patterns in 4 of 9 existing contract files | Form uses `hx-field-label` which may not have explicit `for`/`id` |
| **B — Skip accessibility assertions** | Simpler | Misses accessibility regressions |

**Chosen: Option A.** The view uses `hx-field-label` elements wrapping inputs.
Asserting `<label` presence and `hx-field-label` class usage confirms the
accessibility pattern is maintained.

### Decision 3: Negative assertions

| Option | Pros | Cons |
|---|---|---|
| **A — Include `doesNotMatch` assertions** | Prevents regressions; 5 of 9 files use them | More regex patterns |
| **B — Skip negative assertions** | Simpler | Less protection |

**Chosen: Option A.** The D2 spec explicitly requires "section is absent when
view is in error state" — this is inherently a negative assertion. Using
`doesNotMatch` to verify the form does not render during error follows the
pattern established by `operation-status-badge-contract.test.js`.

## Final Recommendation

### Test file: `test/client/settings-library-view-contract.test.js`

8 tests in 4 groups:

#### Group 1 — Composable integration (1 test)

- `SettingsLibraryView imports and invokes useSettingsForm with loadSettings in onMounted`
  - Asserts `import { useSettingsForm }` import path
  - Asserts `useSettingsForm()` call
  - Asserts `void loadSettings()` in `onMounted`

#### Group 2 — State branches (2 tests)

- `SettingsLibraryView renders the Discovery scheduling form in the default branch`
  - Asserts "Discovery scheduling" heading present in the form branch
  - Asserts `<form @submit.prevent="saveSettings">` present
- `SettingsLibraryView hides the form when in error state`
  - Asserts the form is guarded behind `v-else` (after error `v-else-if`)
  - Uses `doesNotMatch` to verify the Discovery scheduling content is not in the error branch

#### Group 3 — Form field wiring (3 tests)

- `SettingsLibraryView wires all four fields to form.library.*`
  - Asserts `v-model="form.library.discoveryCooldownHours"`
  - Asserts `v-model="form.library.discoveryFallbackCooldownHours"`
  - Asserts `v-model="form.library.discoveryBatchSize"`
  - Asserts `v-model="form.library.maxSearchAttempts"`
- `SettingsLibraryView constrains inputs to validator ranges`
  - Asserts `min="1" max="168"` on cooldown fields
  - Asserts `min="1" max="50"` on batch size
  - Asserts `min="1" max="10"` on max search attempts
  - Asserts `step="1"` on all fields
- `SettingsLibraryView labels all fields with hx-field-label`
  - Asserts 4 `hx-field-label` elements with descriptive text

#### Group 4 — Save bar (2 tests)

- `SettingsLibraryView submits through saveSettings with save-state feedback`
  - Asserts `@submit.prevent="saveSettings"`
  - Asserts `:disabled="isSaving"` on submit button
  - Asserts conditional error/success message spans
- `SettingsLibraryView renders loading state before settings are fetched`
  - Asserts `v-if="isLoading"` with loading message

## Files

| File | Role |
|---|---|
| `test/client/settings-library-view-contract.test.js` | New: 8 contract tests for `SettingsLibraryView.vue` |

## Security

- No production code changes — D2 is test-only.
- Contract tests verify `@submit.prevent` prevents default form submission
  (CSRF-safe by ensuring the form uses the composable's `saveSettings` which
  goes through the API client with CSRF token handling).
- Input constraints (`min`/`max`) tested to match validator ranges, preventing
  out-of-range values from being submitted.

## Outcome

8 new contract tests covering the complete structural contract of
`SettingsLibraryView.vue`:

- 1 composable integration test
- 2 state branch tests
- 3 form field wiring tests
- 2 save bar tests

Combined with the existing 9 contract test files, this gives 10 contract test
files totaling ~70+ contract tests across the platform.

## Validation

- `node --test test/client/settings-library-view-contract.test.js` — 8 new
  tests pass.
- `npm run lint` — no lint errors.

# Acquisition Settings Test Design

> Phase 3, steps A4 + E2 of the Settings Library track. Covers contract tests for
> the `SettingsLibraryView` acquisition card and payload builder tests for the
> `acquisition` namespace.

## Scope

This phase adds frontend-only tests. No new server test files needed — the backend
`acquisition` namespace is already covered by `settings-validator.test.js` and the
existing `resolveAcquisitionSettings` resolver in
`source-user-ignore-service.js:24-32`.

### Contract tests (`test/client/settings-library-view-contract.test.js`)

Extend the existing contract test file with acquisition-specific assertions:

1. **Card presence**: The "Acquisition policy" card title and subtitle are present in
   the form branch.
2. **Toggle wiring**: `v-model="form.acquisition.autoIgnoreEnabled"` checkbox is
   present.
3. **Cooldown wiring**: `v-model.number="form.acquisition.autoIgnoreCooldownHours"`
   input is present with correct `min`, `max`, `step`.
4. **Disabled binding**: The cooldown input has
   `:disabled="!form.acquisition.autoIgnoreEnabled"` binding.
5. **Field labels**: Both fields have `hx-field-label` labels.

### Payload builder tests (`test/client/settings-form.test.js`)

Extend the existing payload builder test file:

1. **`acquisition` spread**: `buildSettingsUpdatePayload` includes an `acquisition`
   namespace with `{ ...form.acquisition }` spread.
2. **Custom values**: Non-default acquisition values pass through correctly.

## Pattern

Follows the Phase 2 scoring contract tests:

- Node.js built-in `node:test` + `node:assert/strict`
- Source-text regex assertions against the `.vue` file (no DOM rendering)
- `createAcquisitionForm()` helper for payload tests

## Test Count

~7 tests:

Contract tests (5):
1. Card presence
2. Toggle wiring (`form.acquisition.autoIgnoreEnabled`)
3. Cooldown wiring (`form.acquisition.autoIgnoreCooldownHours`)
4. Cooldown disabled binding
5. Field labels

Payload tests (2):
1. Default acquisition values pass through
2. Custom acquisition values pass through

## Outcome

Contract + payload test coverage for the acquisition namespace, matching the scoring
test pattern from Phase 2.

# Retention Settings Test Design

> Phase 4 of the Settings Library track. Covers contract tests for the
> `SettingsLibraryView` retention card and payload builder tests for the
> `retention` namespace.

## Scope

### Contract tests (`test/client/settings-library-view-contract.test.js`)

5 tests following the acquisition contract test pattern:

1. **Card presence**: "Retention" title and warning subtitle are present.
2. **Field wiring**: All 3 fields are wired to `form.retention.*`.
3. **Input constraints**: Fields have correct `min`/`max`/`step` matching validator
   ranges.
4. **Warning text**: The destructive operation warning is present in the template.
5. **Field labels**: All 3 fields have `hx-field-label` labels.

### Payload builder tests (`test/client/settings-form.test.js`)

2 tests following the acquisition payload test pattern:

1. **Custom values**: Non-default retention values pass through correctly.
2. **Default values**: `createRetentionForm()` defaults pass through correctly.

## Pattern

Follows Phase 3 acquisition test pattern exactly:

- Node.js `node:test` + `node:assert/strict`
- Source-text regex assertions via `assert.match(source, /regex/)`
- `assert.deepEqual(payload.retention, {...})` namespace-slice assertions
- `createRetentionForm()` helper with defaults matching server validator

## Test Count

7 tests:

Contract tests (5):
1. Card presence (title + subtitle)
2. Field wiring (3 fields)
3. Input constraints (3 field ranges)
4. Warning text present
5. Field labels (3 labels)

Payload tests (2):
1. Custom retention values pass through
2. Default retention values pass through

## Outcome

(To be filled after implementation.)

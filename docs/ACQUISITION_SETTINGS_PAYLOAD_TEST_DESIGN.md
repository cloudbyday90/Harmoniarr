# Acquisition Settings Payload Test Design

> Phase 3, step C2 of the Settings Library track. Adds payload builder tests for
> the `acquisition` namespace to `settings-form.test.js`.

## Problem

Steps A1–B1 implemented the acquisition namespace in the payload builder, composable,
and view. The payload builder test file needs dedicated tests verifying that
`buildSettingsUpdatePayload` correctly spreads `acquisition` values into the API
payload.

## Research

### Node.js `assert.deepEqual` for namespace-level assertions

From the Node.js documentation (`node:assert/strict`):

> `assert.deepEqual(actual, expected[, message])` — Tests for deep equality between
> two values. It recursively checks all properties of objects and elements of arrays.

The existing test file uses `assert.deepEqual(payload.namespace, {...})` to verify a
specific namespace's output without asserting the entire payload structure. This is
already a focused assertion pattern — each test constructs a minimal form, builds the
payload, and asserts only the namespace under test.

**Note on `assert.partialDeepStrictEqual`:** Node.js v22.2+ added this method, which
only compares properties present in `expected`. However, the existing tests already
achieve focus by asserting on `payload.library` or `payload.scoring` directly (a
namespace slice), not the full payload. Switching to `partialDeepStrictEqual` would
provide no additional benefit and would introduce inconsistency with the 7 existing
tests that use `deepEqual`.

### Existing test pattern

The test file has 7 tests across two patterns:

1. **Full-payload deep-equal** (1 test, line 52): Constructs a complete form fixture
   and asserts the entire payload matches. This test was updated in A1 to include
   `acquisition` defaults.
2. **Namespace-specific deep-equal** (2 tests, lines 288 + 328): Constructs a form
   with custom values for one namespace, builds the payload, and asserts only
   `payload.library` or `payload.scoring`.

The library test (line 288) and scoring test (line 328) share a common structure:
- Call `buildSettingsUpdatePayload` with custom namespace values
- Use `assert.deepEqual(payload.namespace, {...})` for focused verification

This is the pattern to follow for acquisition.

### Test fixture helpers

The file defines three helper functions:
- `createArtworkForm()` — 14 fields (complex transforms)
- `createLibraryForm()` — 4 fields with defaults
- `createScoringForm()` — 8 fields with defaults
- `createAcquisitionForm()` — 2 fields with defaults (added in A1)

The `createAcquisitionForm()` helper already exists from A1.

## Options Considered

### Decision 1: Number of tests

| Option | Pros | Cons |
|---|---|---|
| **A — 2 tests** (custom values + default values) | Matches the scoring pattern (1 test); the full-payload test (line 52) already covers defaults; custom values test verifies spread works | — |
| **B — 1 test** (custom values only) | Minimal; defaults already covered by the full-payload test at line 52 | — |
| **C — 3 tests** (custom values + enabled toggle + disabled toggle) | More coverage | Over-testing; the payload builder is a simple spread — toggling doesn't change spread behavior |

**Chosen: A.** Two tests provide clear coverage:
1. Custom acquisition values pass through correctly (verifies spread works with
   non-default data).
2. Default acquisition values from `createAcquisitionForm()` pass through correctly
   (verifies the happy path with defaults from the composable).

This matches the scoring test pattern (1 test with custom values) plus adds a default
values test for completeness since acquisition has only 2 fields and the test is
trivially simple.

### Decision 2: Assert on namespace slice vs full payload

| Option | Pros | Cons |
|---|---|---|
| **A — `assert.deepEqual(payload.acquisition, {...})`** (namespace slice) | Focused; matches library and scoring tests; no noise from other namespaces | — |
| **B — `assert.partialDeepStrictEqual(payload, { acquisition: {...} })`** (partial full payload) | Uses newer Node.js API; more expressive about intent | Inconsistent with 7 existing tests; no practical benefit over slice |

**Chosen: A.** Consistency with the existing 7 tests outweighs any benefit from
using a newer assertion API. The namespace slice pattern is clear and well-established.

## Final Recommendation

Add 2 tests after the scoring test (after line 375):

### Test 1: Custom acquisition values

```
buildSettingsUpdatePayload includes acquisition policy fields
```
- Form with `autoIgnoreEnabled: true` and `autoIgnoreCooldownHours: 48`
- Assert `payload.acquisition` equals `{ autoIgnoreEnabled: true, autoIgnoreCooldownHours: 48 }`

### Test 2: Default acquisition values

```
buildSettingsUpdatePayload includes acquisition defaults when using createAcquisitionForm
```
- Form with `createAcquisitionForm()` (defaults: `false` and `24`)
- Assert `payload.acquisition` equals `{ autoIgnoreEnabled: false, autoIgnoreCooldownHours: 24 }`

Both tests follow the namespace-slice pattern with `assert.deepEqual`.

## Files

| File | Change |
|---|---|
| `test/client/settings-form.test.js` | Add 2 acquisition payload tests after scoring test |

## Security

- Tests verify that the payload builder faithfully spreads form values without
  transformation or omission. This catches regressions where the spread is removed
  or the namespace is accidentally renamed.
- No secret fields in the `acquisition` namespace — no secret-clearing logic to test.

## Outcome

2 payload builder tests added to `settings-library-view-contract.test.js`:

1. **Custom values**: `autoIgnoreEnabled: true`, `autoIgnoreCooldownHours: 48` pass
   through the spread correctly.
2. **Default values**: `createAcquisitionForm()` defaults (`false`, `24`) pass through
   correctly.

Both tests use `assert.deepEqual(payload.acquisition, {...})` namespace-slice pattern,
matching the library and scoring tests.

9/9 form tests pass, 19/19 contract tests pass, 0 lint warnings.

## Validation

- `node --test test/client/settings-form.test.js` — all 9 tests pass (7 existing + 2 new).
- `npx eslint test/client/settings-form.test.js --max-warnings 0` — no lint errors.

# Settings Form Library Payload Test Design

> Phase E2 of the Settings Library track. This document covers extending
> `test/client/settings-form.test.js` with library namespace test cases for
> `buildSettingsUpdatePayload`.

## Problem

Phase B5 added `library: { ...form.library }` to the payload builder in
`settings-form.js` and added 1 dedicated test plus updated 2 existing test
fixtures. The E2 specification requires verifying that `buildSettingsUpdatePayload`
correctly handles the `library` namespace.

## Research Baseline

### Existing test file structure

`test/client/settings-form.test.js` (290 lines, 6 tests):

- **Framework:** `node:test` + `node:assert/strict`
- **Structure:** Flat `test()` calls, no `describe`/`it`
- **Assertions:** `assert.deepEqual` (5), `assert.equal` (4)
- **No copyright header**
- **No section divider comments**
- **Two factory functions:** `createArtworkForm()` (15 keys), `createLibraryForm()` (4 keys)
- **Test pattern:** Construct form object inline (sometimes using factories), call `buildSettingsUpdatePayload`, assert on output

### Library namespace in the payload builder

`settings-form.js:106`:

```js
library: { ...form.library },
```

This is a bare shallow spread — identical to the `security` and `system`
namespaces. No normalization, no conditional inclusion, no field enumeration,
no secret handling. Every own enumerable property on `form.library` is copied
directly into `payload.library`.

### Comparison with other namespace handling patterns

| Namespace | Pattern | Test coverage |
|---|---|---|
| `artwork` | Explicit field enumeration + parsing (comma-separated) | 2 tests |
| `security` | Shallow spread | Implicit in test 1 |
| `system` | Shallow spread | Implicit in test 1 |
| `paths` | Spread + 2 normalized overrides | 2 tests |
| `library` | Shallow spread | 1 dedicated test + implicit in 2 tests |
| `slskd` | Explicit field extraction + secret handling | 2 tests |
| `providers` | Conditional inclusion + explicit fields + secret/clear pattern | 1 test |

The library namespace uses the simplest pattern (shallow spread). It requires
less testing than namespaces with normalization or secret handling.

## E2 Spec vs B5 Coverage

| E2 Requirement | B5 Test | Line | Status |
|---|---|---|---|
| Payload includes `library` spread when `form.library` is present | Test 6: dedicated library test | 252 | **Covered** |
| `library.discoveryCooldownHours` is passed through as-is | Test 6: asserts value `12` | 284 | **Covered** |
| All four `library` fields are included in the payload | Test 6: `assert.deepEqual` on all 4 | 284-289 | **Covered** |

Additionally, tests 1-2 use `createLibraryForm()` and verify the default
library values (6, 2, 5, 3) appear in the full payload output.

**All E2 requirements are fully satisfied.**

## Options Considered

### Decision: Close E2 as-is vs add additional tests

| Option | Pros | Cons |
|---|---|---|
| **A — Close E2 as complete** | All 3 spec requirements met; library uses the simplest spread pattern; 3 tests already cover it; server validator handles field-level validation | No explicit edge-case tests |
| **B — Add 1 defensive test** | Tests edge case: missing or empty `form.library` | Library is always initialized by `useSettingsForm` composable with defaults; testing undefined behavior tests the spread operator, not application logic |

**Chosen: Option A.** The `library` namespace is a raw spread with no
transformation logic. All 3 E2 requirements are satisfied by the existing
tests. The server-side validator (tested in E1 with 7 tests) handles
field-level validation and range checking. Adding more client-side tests for
the spread pattern would test the JavaScript spread operator rather than
application logic.

## Final Recommendation

No code changes required. E2 is fully satisfied by B5's test additions:

- **Test 6** (line 252): "includes library discovery scheduling fields" —
  dedicated test with custom values verifying all 4 fields pass through.
- **Tests 1-2** (lines 39, 113): Implicitly verify default library values in
  the full payload via `createLibraryForm()` factory.

## Files

| File | Change |
|---|---|
| (none) | No code changes needed |

## Security

- No production code changes.
- The library spread pattern passes all form values to the server, where the
  settings validator (E1) enforces type and range constraints. Defense-in-depth
  is maintained.

## Outcome

E2 is satisfied with zero additional code changes. The B5 phase already added
sufficient coverage:

- 1 dedicated library payload test with custom values
- 2 full-payload tests including library defaults
- 1 `createLibraryForm()` factory for reusable test fixtures

## Validation

- `node --test test/client/settings-form.test.js` — 6 tests pass (unchanged).

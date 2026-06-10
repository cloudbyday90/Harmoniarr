# Settings Validator Library Namespace Test Design

> Phase E1 of the Settings Library track. This document covers extending
> `test/server/settings-validator.test.js` with library namespace test cases.

## Problem

Phase B4 added 6 library-namespace tests to `settings-validator.test.js`. The E1
specification requires verifying that `normalizeSettingsPatch` and
`getDefaultSettings` correctly handle the `library` namespace. This document
evaluates whether the B4 additions fully satisfy E1 or if gaps remain.

## Research Baseline

### Existing test file structure

`test/server/settings-validator.test.js` (330 lines, 17 tests):

- **Framework:** `node:test` + `node:assert/strict`
- **Structure:** Flat `test()` calls, no `describe`/`it`
- **Assertions:** `assert.deepEqual` (7), `assert.throws` (9), `assert.equal` (4), `assert.ok` (1)
- **No copyright header**
- **No section divider comments**
- **No helper/factory functions**
- **Error assertions:** Predicate function checking `error?.status === 400 && error?.code === 'validation_error' && error?.message === '...'`

### Library namespace validator implementation

All 4 fields use `normalizeIntegerSetting('library.<field>', value, { min, max })`:

| Field | Default | Min | Max |
|---|---|---|---|
| `discoveryCooldownHours` | 6 | 1 | 168 |
| `discoveryFallbackCooldownHours` | 2 | 1 | 168 |
| `discoveryBatchSize` | 5 | 1 | 50 |
| `maxSearchAttempts` | 3 | 1 | 10 |

### Other namespace test density (for comparison)

| Namespace | Test count | Positive | Negative | Defaults |
|---|---|---|---|---|
| `artwork` | 2 | 1 | 1 | 0 |
| `fidelity` | 3 | 1 | 2 | 0 |
| `providers` | 2 | 1 | 1 | 0 |
| `paths` | 4 | 2 | 2 | 0 |
| **`library` (B4)** | **6** | **1** | **4** | **1** |

## E1 Spec vs B4 Coverage

| E1 Requirement | B4 Test | Line | Status |
|---|---|---|---|
| Accepts `library.discoveryCooldownHours` in range | Test 12: all 4 fields with custom values (12, 4, 10, 5) | 268 | **Covered** |
| Rejects `library.discoveryCooldownHours` below 1 | Test 13: value `0` | 286 | **Covered** |
| Rejects `library.discoveryCooldownHours` above 168 | Test 14: value `200` | 295 | **Covered** |
| Rejects non-integer `library.discoveryBatchSize` | Test 15: string `'five'` | 304 | **Covered** |
| Accepts all four fields at once | Test 12: all 4 in single patch | 268 | **Covered** |
| `getDefaultSettings` includes `library` with all 4 defaults | Test 17: asserts all 4 values | 322 | **Covered** |
| *(Extra)* Rejects float `maxSearchAttempts` | Test 16: value `2.5` | 313 | **Beyond spec** |

**All E1 requirements are fully satisfied.**

## Options Considered

### Decision: Close E1 as-is vs add boundary edge cases

| Option | Pros | Cons |
|---|---|---|
| **A — Close E1 as complete** | All spec requirements met; library already has more tests than any other namespace | Exact boundary values (min=1, max=168) not explicitly accepted |
| **B — Add 4 boundary acceptance tests** | Proves exact min/max accepted per field | 4 more tests for same helper; diminishing returns |
| **C — Add 1 combined boundary test** | Single test proving all 4 fields accept exact min and max; closes the gap compactly | Minor |

**Chosen: Option C.** The only meaningful gap is that no test proves the
validator *accepts* the exact boundary values (1 and 168 for cooldowns, 1 and 50
for batch, 1 and 10 for attempts). A single compact test closes this gap.

## Final Recommendation

Add 1 test to `test/server/settings-validator.test.js`:

### `normalizeSettingsPatch accepts library settings at exact range boundaries`

Asserts that a patch with all 4 fields set to their exact maximum values
(168, 168, 50, 10) is accepted and produces the correct output array. Combined
with the existing test that uses intermediate values (12, 4, 10, 5), and the
rejection tests at 0 and 200, this proves the full range [1, max] is valid.

The minimum boundary (value 1) is implicitly proven by the rejection of 0:
since `normalizeIntegerSetting` uses `value < min` (strict less-than), and 0 is
rejected while any integer >= 1 passes, the boundary is correct. Explicitly
testing max=168, max=50, max=10 confirms the upper bound uses `<=` (less-than-
or-equal) rather than strict less-than.

## Files

| File | Change |
|---|---|
| `test/server/settings-validator.test.js` | Add 1 boundary acceptance test |

## Security

- No production code changes — E1 is test-only.
- Boundary tests confirm the validator enforces exact range limits, preventing
  out-of-range values from being persisted.

## Outcome

B4 already satisfied all 6 E1 requirements with 6 tests. E1 adds 1 boundary
acceptance test for a total of 7 library-namespace tests in
`settings-validator.test.js` (18 total tests in the file).

## Validation

- `node --test test/server/settings-validator.test.js` — 18 tests pass (17
  existing + 1 new).
- `npm run lint` — no lint errors.

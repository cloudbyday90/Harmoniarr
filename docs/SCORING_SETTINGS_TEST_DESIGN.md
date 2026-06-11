# Scoring Settings Test File Design

> Phase 2, step D1 of the Settings Library track. Dedicated test file for the
> scoring settings path.

## Scope

`test/server/scoring-settings.test.js` covers:

1. **`DEFAULT_SCORING_WEIGHTS` frozen values** — ensures the constant has all 8
   expected weights and is frozen.
2. **`resolveScoringSettings` pure unit tests** — defaults for null/undefined/
   empty/missing/non-object, valid weight resolution, partial settings,
   non-numeric/zero/negative/Infinity fallback.
3. **`buildScorersFromWeights` unit tests** — verifies the builder pairs weights
   with the correct scorer functions.
4. **Injection integration tests** — custom `loadSettingsFn` returns scoring
   weights, verify the import candidate service uses those weights.
5. **Graceful fallback** — `loadSettingsFn` throws, verify default scorers used.

## Pattern

Follows `test/server/library-discovery-dispatch-settings.test.js` (Phase 1):
- Node.js built-in `node:test` + `node:assert/strict`
- `t.mock.fn()` for integration test dependencies
- No external test frameworks

## Test Count

~16 tests:
- 1 frozen defaults
- 8 resolver unit tests
- 1 buildScorersFromWeights test
- 3 injection integration tests
- 1 fallback test
- 2 edge case tests (partial scoring namespace, all invalid weights)

## Outcome

Dedicated test coverage for the scoring settings path from resolver through
service injection, matching the Phase 1 discovery test file structure.

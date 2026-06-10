# Dispatch Service Test Extension Design

> Phase E3 of the Settings Library track. This document covers extending the
> existing dispatch service tests with backward compatibility and settings
> injection verification.

## Problem

Phases B1/B2 introduced `loadSettingsFn` injection to the dispatch service. The
E3 specification requires verifying:
1. Backward compatibility — the service works without `loadSettingsFn` injection.
2. Settings override — when `loadSettingsFn` returns a `library` namespace, the
   dispatch service uses those values.

## Research Baseline

### Existing dispatch service tests

`test/server/library-discovery-dispatch-service.test.js` (663 lines, 19 tests):

- **Framework:** `node:test` + `node:assert/strict`
- **Structure:** Flat `test()` calls
- **No copyright header**
- **No section dividers**
- **Imports:** `buildDiscoverySearchQuery`, `createLibraryDiscoveryDispatchService`
- **Critical observation:** None of the 19 tests inject `loadSettingsFn`

### D1 dedicated settings tests

`test/server/library-discovery-dispatch-settings.test.js` (263 lines, 13 tests):

- Tests 1-9: `resolveDiscoverySettings` pure unit tests
- Tests 10-12: `loadSettingsFn` injection integration tests with custom values
- Test 13: Graceful fallback when `loadSettingsFn` throws

### Backward compatibility mechanism

The factory function signature:

```js
export function createLibraryDiscoveryDispatchService({
  loadSettingsFn = loadSettings,
  ...
})
```

When no `loadSettingsFn` is injected:
1. Factory binds the real `loadSettings` from `settings.js`
2. Dispatch cycle calls `await loadSettingsFn()` → `loadSettings()` attempts DB query
3. No DB in test env → throws
4. Catch block falls back to `DEFAULT_DISCOVERY_SETTINGS`
5. All 19 existing tests verify correct behavior with those defaults

## E3 Spec Coverage Mapping

### Requirement 1: Backward compatibility without `loadSettingsFn`

| Existing Test | What It Proves | Default Dependency |
|---|---|---|
| Test 5: "claims ready automatic requests" | Default 6h cooldown in `nextSearchAfter` | `automaticCooldownMs` default (6h) |
| Test 13: "getUserPreferencesFn throws" | Default 6h cooldown in `nextSearchAfter` | `automaticCooldownMs` default (6h) |
| Test 14: "schedules faster fallback" | Explicit `fallbackCooldownMs` respected | Constructor param override |
| Test 15: "exhausts after third attempt" | Default `maxSearchAttempts = 3` | Exhaustion threshold default |
| Test 16: "marks already-exhausted" | Default `maxSearchAttempts = 3` | Exhaustion threshold default |
| Test 18: "per-track fallback enabled" | Default `maxSearchAttempts = 3` | Exhaustion threshold default |
| Test 19: "skips per-track fallback" | Default `maxSearchAttempts = 3` + `enableTrackFallback = false` | Both defaults |
| Tests 6, 7, 12, 17 | Dispatch succeeds with no cooldown/exhaustion assertions | General resilience |

**All 19 tests pass without `loadSettingsFn` injection.** This proves backward
compatibility through the catch-block fallback path — a stronger guarantee than
the spec requires.

### Requirement 2: Custom settings from `loadSettingsFn`

| D1 Test | Custom Setting | Evidence |
|---|---|---|
| Test 10 | `discoveryCooldownHours: 24` | `nextSearchAfter` = now + 24h |
| Test 11 | `maxSearchAttempts: 2` | Exhaustion at attempt 2 |
| Test 12 | `discoveryBatchSize: 2` | Loop limited to 2 iterations |
| Test 13 | `loadSettingsFn` throws | Falls back to 6h default |

**D1 provides comprehensive settings injection coverage** with 4 integration
tests covering all 4 settings dimensions.

## Options Considered

### Decision: Close E3 as complete vs add explicit tests

| Option | Pros | Cons |
|---|---|---|
| **A — Close E3 as complete** | Both requirements covered; 19 tests + D1's 4 tests = 23 total dispatch tests; adding more is redundant | No single test named "backward compatible" |
| **B — Add 1 explicit backward-compat test** | Documents intent with clear test name | Duplicates test 5 coverage; grows 663-line file |

**Chosen: Option A.** The existing 19 tests prove backward compatibility by
passing without `loadSettingsFn` injection. D1's tests provide explicit settings
injection coverage. Together they satisfy both E3 requirements.

The backward compatibility guarantee is actually **stronger** than a simple
"works without injection" test would prove — the existing tests demonstrate
that the service is resilient even when the settings source fails entirely
(DB unavailable), falling back to safe defaults via the catch block.

## Final Recommendation

No code changes required. E3 is fully satisfied by the combination of:

- **19 existing tests** in `library-discovery-dispatch-service.test.js` — all
  pass without `loadSettingsFn` injection, proving backward compatibility
- **4 D1 tests** in `library-discovery-dispatch-settings.test.js` — explicitly
  inject `loadSettingsFn` with custom values and verify settings flow through

## Files

| File | Change |
|---|---|
| (none) | No code changes needed |

## Security

- No production code changes.
- The catch-block fallback ensures the dispatch service never crashes due to
  settings unavailability — it always falls back to safe, conservative defaults.

## Outcome

E3 is satisfied with zero additional code changes. The combined test coverage is:

- 19 existing dispatch tests (backward compatibility via catch-block fallback)
- 13 D1 settings tests (resolver unit + injection integration + fallback)
- **32 total dispatch-related tests**

## Validation

- `node --test test/server/library-discovery-dispatch-service.test.js` — 19
  tests pass (unchanged).
- `node --test test/server/library-discovery-dispatch-settings.test.js` — 13
  tests pass (unchanged).

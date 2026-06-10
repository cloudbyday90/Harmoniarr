# Library Discovery Dispatch Settings Test Design

> Phase D1 of the Settings Library track. This document covers the dedicated
> test file for the settings-aware dispatch service: the `resolveDiscoverySettings`
> pure resolver, `DEFAULT_DISCOVERY_SETTINGS` constants, `loadSettingsFn`
> injection, and graceful fallback behavior.

## Problem

Phases A1–B2 added settings resolution to the dispatch service, and C2 added
the frontend. The existing test file (`library-discovery-dispatch-service.test.js`)
has 19 tests covering search query building and dispatch behavior — but **zero
coverage** for the settings-aware code path:

1. `resolveDiscoverySettings` is not imported or tested.
2. No test injects `loadSettingsFn` — the resolution path is uncontrolled.
3. The catch block (graceful fallback) is never intentionally tested.
4. Custom settings values flowing through the dispatch cycle are unverified.

D1 creates a dedicated test file covering all settings-specific behavior.

## Research Baseline

### Reference test pattern: `ledger-retention-policy.test.js`

This file (89 lines, 6 tests) tests the `resolveLedgerRetentionPolicy` pure
resolver using the same conventions:

- GPL copyright header
- `import assert from 'node:assert/strict'`
- `import test from 'node:test'`
- Descriptive test names starting with the function name
- Pure unit tests calling the resolver directly with controlled inputs
- `assert.equal` / `assert.deepEqual` for assertions

### Existing dispatch service test pattern

`library-discovery-dispatch-service.test.js` (663 lines, 19 tests) uses:

- `t.mock.fn(async () => ...)` for all collaborator stubs
- `createLibraryDiscoveryDispatchService({ ... })` with injected dependencies
- `service.dispatchReadyDiscoveryRequests({ ... })` to invoke the method
- `mock.callCount()` and `mock.calls[0].arguments[0]` for verification

### Coverage gaps identified

| Gap | Risk | Severity |
| --- | --- | --- |
| `resolveDiscoverySettings` untested | Resolver bug could break all settings | High |
| `loadSettingsFn` never injected | Settings path is untested in CI | High |
| Catch block untested | Fallback regression would be silent | Medium |
| `DEFAULT_DISCOVERY_SETTINGS` untested | Constant regression undetected | Low |

## Options Considered

### Decision 1: Separate file vs extend existing

| Option | Pros | Cons |
| --- | --- | --- |
| **A — New file `library-discovery-dispatch-settings.test.js`** | Focused scope; clear separation of concerns; matches D1 definition | Two test files for one source file |
| **B — Append to existing `library-discovery-dispatch-service.test.js`** | Single file for all dispatch tests | Existing file is already 663 lines; mixes pure resolver tests with integration tests |

**Chosen: Option A.** The parent design doc (D1) specifies a new file. The
separation also keeps the pure resolver tests (fast, no mocks) distinct from
the integration tests (slower, heavy mocking).

### Decision 2: Test scope — resolver only vs resolver + dispatch integration

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Resolver only** | Fast; no mocking needed; pure unit tests | Doesn't verify settings flow through dispatch |
| **B — Resolver + dispatch integration** | End-to-end settings coverage | More mocking; slightly slower |

**Chosen: Option B.** The resolver tests are fast pure unit tests. The dispatch
integration tests (3–4 tests with injected `loadSettingsFn`) verify that custom
settings actually control dispatch behavior. Together they provide comprehensive
coverage of the settings path.

## Final Recommendation

### Test file: `test/server/library-discovery-dispatch-settings.test.js`

#### Group 1 — `DEFAULT_DISCOVERY_SETTINGS` (1 test)

- Assert all 4 frozen values match expected constants

#### Group 2 — `resolveDiscoverySettings` pure unit tests (8 tests)

- Returns defaults when called with no arguments
- Returns defaults when called with `null`
- Returns defaults when called with empty object
- Returns defaults when `library` namespace is missing
- Converts valid `discoveryCooldownHours` to milliseconds
- Returns defaults for partial settings (some keys set, others missing)
- Returns defaults for non-integer values (strings, floats, NaN, undefined)
- Returns all four values when all are valid integers

#### Group 3 — Settings consumption in dispatch cycle (3 tests)

- `loadSettingsFn` returns custom cooldown → `nextSearchAfter` uses custom value
- `loadSettingsFn` returns custom `maxSearchAttempts` → exhaustion uses custom value
- `loadSettingsFn` returns custom `discoveryBatchSize` → loop bound uses custom value

#### Group 4 — Graceful fallback (1 test)

- `loadSettingsFn` throws → dispatch falls back to `DEFAULT_DISCOVERY_SETTINGS`

## Files

| File | Role |
| --- | --- |
| `test/server/library-discovery-dispatch-settings.test.js` | New: resolver, settings consumption, and fallback tests. |

## Security

- Tests verify that non-integer values always fall back to safe defaults.
- Tests verify that the catch block prevents unhandled rejections from
  propagating.
- No production code changes — D1 is test-only.

## Outcome

13 new tests covering the complete settings-aware dispatch path:

- 1 constant assertion
- 8 pure resolver unit tests
- 3 dispatch integration tests with injected `loadSettingsFn`
- 1 graceful fallback test

Combined with the existing 19 dispatch tests, this gives 32 total tests for
the dispatch service — comprehensive coverage of both the original dispatch
behavior and the new settings resolution path.

## Validation

- `node --test test/server/library-discovery-dispatch-settings.test.js` — 13
  new tests pass.
- `node --test test/server/library-discovery-dispatch-service.test.js` —
  existing 19 tests still pass.
- `npm run lint` — no lint errors.

# Discovery Dispatch Settings Consumption Design

> Phase B1 (+ B2) of the Settings Library track. This document covers wiring
> the previously-injected `loadSettingsFn` into the dispatch cycle so that
> runtime settings override hardcoded constructor parameters for every dispatch
> invocation.

## Problem

Phase A1 extracted defaults, A2 injected `loadSettingsFn`, and A3 added
`resolveDiscoverySettings`. The dispatch service now has all the pieces to read
settings at runtime — but it does not consume them. Every dispatch cycle still
uses the factory-closure values (`automaticCooldownMs`, `fallbackCooldownMs`,
`dispatchBatchSize`) and the imported `MAX_DISCOVERY_SEARCH_ATTEMPTS` constant.

B1 (and B2, combined here because they are inseparable) changes the dispatch
cycle to resolve settings fresh on each invocation, replacing all four
closure/constant references with settings-derived values.

## Research Baseline

### Existing settings-read patterns (hot-path services)

The codebase has two patterns for reading settings on the hot path:

**Pattern A — Propagation (no try/catch):**
`ledger-retention-service.js:60-67` calls `resolvePolicyAndCutoffs(now)` which
invokes `await loadSettingsFn()` without try/catch. The outer method
`applyLedgerRetention` (line 108-166) catches any error and returns a structured
error summary `{ ok: false, error: message }`.

**Pattern B — Graceful fallback (try/catch with default):**
`source-user-ignore-service.js:150-205` wraps the entire function body
(including `await loadSettingsFn()`) in try/catch. On failure, it returns
`{ applied: false, skipReason: 'error' }`. The docstring (line 140) is explicit:
this is on the "outcome-recording hot path" and must never throw.

### Graceful degradation best practices (2026)

Production Node.js services should distinguish between operational errors
(transient DB timeouts, connection resets) and programming errors (null
dereference, type mismatch). For background heartbeat operations:

- Transient failures should degrade gracefully — the next tick retries.
- The system should never introduce a new failure mode that didn't exist before.
- Error observability can come from the surrounding operation-run lifecycle
  rather than from the settings-read path itself.

Applied here:

- Before B1, the dispatch service never read the DB for configuration. It used
  constructor params.
- After B1, introducing a DB dependency that can fail the entire run is a
  regression in resilience.
- The worker (`library-discovery-worker.js:136-158`) already catches errors and
  marks runs as failed. A transient settings-load failure would produce a noisy
  failed run that the operator cannot fix (it self-heals on the next tick).

### JavaScript closure scoping constraint

`buildNextZeroCandidateSchedule` is a nested function inside the factory. It
closes over the factory's `automaticCooldownMs`, `fallbackCooldownMs` params and
the module-level `MAX_DISCOVERY_SEARCH_ATTEMPTS` import.

Declaring local variables of the same name inside
`dispatchReadyDiscoveryRequests` does NOT affect the nested function — it
continues reading the factory's closure variables. The only way to pass
settings-derived values into `buildNextZeroCandidateSchedule` is to parameterize
it explicitly.

This means B1 and B2 are inseparable: B1 already requires parameterizing the
function for cooldowns, and adding `maxSearchAttempts` as a 4th parameter is
trivial. Splitting them would mean modifying the same function signature twice.

### `loadSettings()` failure modes

`settings.js:22-35` calls `queryable.query()` against the `app_settings` table.
Possible failures:

- **DB connection error** — transient, self-healing.
- **Table does not exist** — impossible after migrations run; `getDefaultSettings()`
  provides safe fallbacks anyway.
- **Corrupt data** — `resolveDiscoverySettings` already validates each value with
  `Number.isInteger` and falls back to `DEFAULT_DISCOVERY_SETTINGS`.

## Options Considered

### Decision 1: Error handling when `loadSettingsFn()` throws

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Graceful fallback to `DEFAULT_DISCOVERY_SETTINGS`** | Resilient: heartbeat never fails due to transient DB issue; matches pre-B1 behavior; consistent with `source-user-ignore-service` pattern | Settings failures are silent (no failed run to alert operator) |
| **B — Propagate to worker** | Simple; errors visible as failed runs; consistent with `resolvePolicyAndCutoffs` pattern | Regresses resilience: introduces new DB dependency that can fail the entire run |
| **C — Fallback + error in result** | Resilient AND observable | Changes result shape; more complex |

**Chosen: Option A.** Before B1, configuration never depended on the DB. After
B1, a transient DB outage should not add a new failure mode to the heartbeat.
If the DB is down for settings, it is likely down for request claims too, so the
dispatch loop returns `{ attemptedCount: 0 }` naturally — a noisy failed run
adds no actionable information.

### Decision 2: Combine B1 + B2

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Combined B1 + B2** | Single clean refactor; one function signature change; atomic | Larger diff |
| **B — B1 only, leave `MAX_DISCOVERY_SEARCH_ATTEMPTS`** | Smaller change | Inconsistent: settings-derived cooldowns but hardcoded max attempts; same function modified again in B2 |

**Chosen: Option A.** The functions are too intertwined to split cleanly.

### Decision 3: Constructor param vs settings resolution priority

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Settings override constructor params** | Runtime values always win; operator changes take effect immediately; backward compatible | Constructor params become effectively dead for production |
| **B — Remove constructor params** | Cleaner; less confusion | Breaking change for existing tests; larger refactor |

**Chosen: Option A.** Preserve backward compatibility. Constructor params
remain useful for tests that inject `loadSettingsFn: async () => ({})` or omit
it entirely.

## Final Recommendation

### 1. Settings resolution with graceful fallback

At the top of `dispatchReadyDiscoveryRequests`, resolve settings inside a
try/catch that falls back to `DEFAULT_DISCOVERY_SETTINGS`:

```js
let effectiveSettings;
try {
  effectiveSettings = resolveDiscoverySettings(await loadSettingsFn());
} catch {
  effectiveSettings = DEFAULT_DISCOVERY_SETTINGS;
}
```

### 2. Local effective constants

Extract the four resolved values into local constants for clarity and
consistency with the design doc's `effective*` naming convention:

```js
const effectiveAutomaticCooldownMs = effectiveSettings.automaticCooldownMs;
const effectiveDispatchBatchSize = effectiveSettings.dispatchBatchSize;
const effectiveFallbackCooldownMs = effectiveSettings.fallbackCooldownMs;
const effectiveMaxSearchAttempts = effectiveSettings.maxSearchAttempts;
```

### 3. Parameterize `buildNextZeroCandidateSchedule`

Add four parameters to replace the two closure variables and one imported
constant:

```js
function buildNextZeroCandidateSchedule({
  automaticCooldownMs,
  dispatchedAt,
  fallbackCooldownMs,
  maxSearchAttempts,
  searchAttemptCount,
}) {
  // ... uses parameter values instead of closures/constants
}
```

### 4. Replace all closure/constant references

In `dispatchReadyDiscoveryRequests`:
- Loop bound: `effectiveDispatchBatchSize` instead of `dispatchBatchSize`
- Initial `nextSearchAfter`: `effectiveAutomaticCooldownMs` instead of `automaticCooldownMs`
- Exhaustion check: `effectiveMaxSearchAttempts` instead of `MAX_DISCOVERY_SEARCH_ATTEMPTS`
- Call to `buildNextZeroCandidateSchedule`: pass all four settings-derived values

### 5. Remove `MAX_DISCOVERY_SEARCH_ATTEMPTS` import

The import from `library-discovery-search-query.js` is no longer consumed in
the dispatch service. Remove it from the import statement. The constant remains
in `library-discovery-search-query.js` for its own use and for
`DEFAULT_DISCOVERY_SETTINGS`.

### 6. Remove eslint-disable comment

The `loadSettingsFn` parameter is now consumed, so the
`// eslint-disable-line no-unused-vars` comment is removed.

### 7. Preserve constructor params as defaults

The factory's `automaticCooldownMs`, `fallbackCooldownMs`, and `dispatchBatchSize`
parameters remain with their `DEFAULT_DISCOVERY_SETTINGS` defaults. They are no
longer read inside `dispatchReadyDiscoveryRequests` (settings override them) but
they remain available for direct use if `loadSettingsFn` is not injected or
fails. This preserves backward compatibility with existing tests.

## Files

| File | Role |
| --- | --- |
| `src/server/library/library-discovery-dispatch-service.js` | Consume `loadSettingsFn` in dispatch cycle; parameterize `buildNextZeroCandidateSchedule`; remove unused import. |

## Security

- The try/catch around `loadSettingsFn()` prevents unhandled rejections that
  could crash the heartbeat process.
- `resolveDiscoverySettings` (A3) already validates all values with
  `Number.isInteger` and falls back to `DEFAULT_DISCOVERY_SETTINGS` for invalid
  entries — corrupt DB values cannot produce nonsensical scheduling parameters.
- `DEFAULT_DISCOVERY_SETTINGS` is `Object.freeze()`'d (A1) — cannot be mutated
  at runtime.
- No new endpoints or input vectors are introduced.

## Outcome

Every dispatch cycle now reads the freshest settings from the database. When
the `library` namespace is absent (fresh install, no persisted settings), the
resolver returns values identical to `DEFAULT_DISCOVERY_SETTINGS` — zero
behavioral change from the pre-B1 state. When an operator updates discovery
scheduling parameters through the Settings UI, the next dispatch cycle picks
them up without a server restart.

Transient database failures during settings resolution gracefully fall back to
the hardcoded defaults, matching the pre-B1 resilience level.

`buildNextZeroCandidateSchedule` is now a pure function with explicit
parameters, making it independently testable with any combination of
cooldown and max-attempts values.

## Validation

- `node --test test/server/library-discovery-dispatch-service.test.js` —
  existing 19 tests pass (constructor params still serve as defaults when
  `loadSettingsFn` is not injected).
- `npm run lint` — no lint errors.
- `npm run build:server` — server build succeeds.

# Settings Validator Library Namespace Design

> Phase B4 of the Settings Library track. This document covers adding the
> `library` namespace to `settings-validator.js` so that discovery scheduling
> parameters can be persisted and validated through the existing settings API.

## Problem

Phases A1–A3 and B1–B3 added the runtime consumption path: settings are read,
resolved, and used by the dispatch service. But there is no **write path** —
the `library` namespace does not exist in `settingDefinitions`, so:

- `normalizeSettingsPatch({ library: { ... } })` throws `"Unknown settings
  namespace: library"`.
- `getDefaultSettings()` does not include `library`, so `loadSettings()` never
  returns library defaults for the resolver to project.
- The frontend cannot persist discovery scheduling parameters.

B4 adds the `library` namespace definition with four integer settings and their
range constraints, immediately enabling both read and write paths.

## Research Baseline

### Existing validator architecture

`settings-validator.js` (538 lines) uses a declarative `settingDefinitions`
map with 9 namespaces. Each setting has:

- `defaultValue` — the value returned by `getDefaultSettings()` and used as the
  database-level default on fresh installs.
- `normalize(value)` — a function that validates, transforms, and throws
  `createSettingsValidationError` on failure. Returns the sanitized value.

Two exported entry points consume `settingDefinitions`:

1. `getDefaultSettings()` (line 497-506) — iterates all namespaces and keys,
   returning `{ namespace: { key: defaultValue, ... }, ... }`.
2. `normalizeSettingsPatch(input)` (line 508-538) — validates a flat patch
   object, checks namespace/key existence, calls each `normalize`, and returns
   an array of `{ namespace, settingKey, value }` tuples for persistence.

### `normalizeIntegerSetting` helper

`normalizeIntegerSetting(settingName, value, { min, max })` (line 469-483):

1. Checks `Number.isInteger(value)` — rejects floats, NaN, strings, booleans,
   `undefined`, `null`.
2. If `min` is provided, checks `value >= min`.
3. If `max` is provided, checks `value <= max`.
4. Returns the value unchanged (no coercion).

This is an allowlist validator per OWASP recommendations: it validates type,
range, and rejects anything outside the declared bounds.

### Closest analog: `fidelity` namespace

The `fidelity` namespace (line 378-433) has 6 integer fields and 2 rate fields,
all using `normalizeIntegerSetting` and `normalizeRateSetting`. Test coverage
includes:

- Positive case: all fields accepted in range (`test:226-252`).
- Negative case: out-of-range integer (`test:254-259`).
- Negative case: out-of-range rate (`test:261-266`).

### OWASP input validation recommendations

OWASP REST Security Cheat Sheet: "When validating input, do not trust input
parameters or objects. Validate length, range, format, and type. Utilize strong
types like numbers, booleans, dates, or fixed data ranges for implicit
validation."

OWASP Injection Prevention Rule #1: "Perform proper input validation as a
primary defense against injection attacks. Positive or allowlist input
validation with appropriate canonicalization is recommended."

Applied here:

- `normalizeIntegerSetting` is an allowlist validator: it accepts only true
  integers within declared bounds.
- No string interpolation or SQL construction — the validator returns a plain
  integer that is later persisted via parameterized query (`settings.js:39-55`).
- Error messages include the setting name and bound but never expose internal
  state, stack traces, or database details.

## Options Considered

### Decision 1: Namespace placement

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Append after `fidelity`** | No disruption to existing ordering; matches incremental addition pattern | Slightly separated from `acquisition`/`retention` |
| **B — Insert after `acquisition`** | Logical grouping of operation-related settings | Reorders existing source; confuses git blame |

**Chosen: Option A.** The file has been built incrementally — each new namespace
is appended.

### Decision 2: Range bounds for cooldown hours

| Option | Pros | Cons |
| --- | --- | --- |
| **A — 1 to 168 (1 hour to 7 days)** | Prevents zero/negative (infinite loops) and excessively long waits (effectively disabled) | Operator cannot set a 30-day cooldown without a code change |
| **B — 0 to 8760 (0 to 365 days)** | Maximum flexibility | Zero cooldown risks tight dispatch loops; 365 days is effectively disabled with no visibility |

**Chosen: Option A.** Zero cooldown would cause the dispatch service to
re-search immediately on every heartbeat tick (every 30 seconds), creating a
tight loop. A minimum of 1 hour is reasonable for any real-world use case.

### Decision 3: Default value alignment

The validator stores values in user-facing units (hours), while the dispatch
service's `DEFAULT_DISCOVERY_SETTINGS` uses milliseconds. The defaults must be
equivalent:

| Validator default | Dispatch service default | Equivalent? |
| --- | --- | --- |
| `discoveryCooldownHours: 6` | `automaticCooldownMs: 21600000` (6 × 3,600,000) | Yes |
| `discoveryFallbackCooldownHours: 2` | `fallbackCooldownMs: 7200000` (2 × 3,600,000) | Yes |
| `discoveryBatchSize: 5` | `dispatchBatchSize: 5` | Yes |
| `maxSearchAttempts: 3` | `maxSearchAttempts: 3` | Yes |

`resolveDiscoverySettings` (A3) performs the hour-to-ms conversion, so the
validator only needs to store and validate the hour values.

## Final Recommendation

### 1. Add `library` namespace to `settingDefinitions`

Insert after the `fidelity` namespace closing brace (line 433), before the
outer closing brace (line 434):

```js
library: {
  discoveryCooldownHours: {
    defaultValue: 6,
    normalize(value) {
      return normalizeIntegerSetting('library.discoveryCooldownHours', value, { min: 1, max: 168 });
    },
  },
  discoveryFallbackCooldownHours: {
    defaultValue: 2,
    normalize(value) {
      return normalizeIntegerSetting('library.discoveryFallbackCooldownHours', value, { min: 1, max: 168 });
    },
  },
  discoveryBatchSize: {
    defaultValue: 5,
    normalize(value) {
      return normalizeIntegerSetting('library.discoveryBatchSize', value, { min: 1, max: 50 });
    },
  },
  maxSearchAttempts: {
    defaultValue: 3,
    normalize(value) {
      return normalizeIntegerSetting('library.maxSearchAttempts', value, { min: 1, max: 10 });
    },
  },
},
```

### 2. Tests (extend `test/server/settings-validator.test.js`)

Positive cases:
- Accept all four `library` fields at once.
- `getDefaultSettings()` includes `library` with all four defaults.

Negative cases:
- Reject `discoveryCooldownHours` below 1.
- Reject `discoveryCooldownHours` above 168.
- Reject non-integer `discoveryBatchSize` (e.g., string `'five'`).
- Reject non-integer `maxSearchAttempts` (e.g., float `2.5`).

### 3. No new helper functions needed

The existing `normalizeIntegerSetting` with `{ min, max }` handles all four
fields. No new normalization helpers are required.

## Files

| File | Role |
| --- | --- |
| `src/server/validators/settings-validator.js` | Add `library` namespace with four integer setting definitions. |
| `test/server/settings-validator.test.js` | Add positive and negative test cases for `library` namespace. |

## Security

- All four settings use `normalizeIntegerSetting` which rejects non-integer
  types (strings, floats, booleans, null, undefined) before any persistence.
- Range bounds prevent resource exhaustion: batch size capped at 50, search
  attempts capped at 10, cooldowns bounded to 1–168 hours.
- Error messages are descriptive but do not leak internal state, stack traces,
  or database schema details.
- The settings API endpoint (`PUT /api/v1/settings`) already requires admin
  authentication — no new endpoints or permission changes.
- Values are persisted via parameterized SQL (`settings.js:39-55`) — no SQL
  injection risk.

## Outcome

After B4, the full settings lifecycle for discovery scheduling is complete:

1. **Write path:** Admin updates `library` settings via the API.
   `normalizeSettingsPatch` validates all four fields against type and range
   constraints. `persistSettings` writes them to `app_settings` via
   parameterized SQL.
2. **Read path:** `loadSettings()` merges persisted values with
   `getDefaultSettings()` (now including `library`). The dispatch service calls
   `resolveDiscoverySettings` (A3) to project hours into milliseconds with
   fallback to `DEFAULT_DISCOVERY_SETTINGS` (A1).
3. **Graceful fallback:** If `loadSettingsFn()` fails (B1), the dispatch cycle
   falls back to `DEFAULT_DISCOVERY_SETTINGS` — which matches the validator
   defaults exactly.

## Validation

- `node --test test/server/settings-validator.test.js` — existing + new
  `library` cases.
- `npm run lint` — no lint errors.
- `npm run build:server` — server build succeeds.

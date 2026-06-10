# Discovery Settings Resolver Design

> Phase A3 of the Settings Library track. This document covers the
> `resolveDiscoverySettings` helper that projects the persisted `library`
> namespace into the dispatch-service-specific shape with defensive fallbacks
> to `DEFAULT_DISCOVERY_SETTINGS`.

## Problem

Phase A2 injected `loadSettingsFn` into the dispatch service but did not
consume it. Before the service can read settings at runtime (B1), there must
be a pure resolver function that:

1. Projects the raw `settings.library` namespace into the dispatch-specific
   shape (milliseconds for cooldowns, raw integers for batch size and attempts).
2. Falls back to `DEFAULT_DISCOVERY_SETTINGS` for every missing or invalid key.
3. Is testable in isolation without a database or service wiring.

## Research Baseline

### Existing resolver tiers in the codebase

The project has four tiers of settings resolver sophistication:

| Tier | Pattern | Coercion | Range | Example |
| --- | --- | --- | --- | --- |
| 1 | `resolveAcquisitionSettings` | `Number` + `isFinite` | None | `source-user-ignore-service.js:24` |
| 2 | `resolveLedgerRetentionPolicy` | `parseInt(,10)` + `isInteger` | `Math.max/min` clamp | `ledger-retention-policy.js:37` |
| 3 | `mapFidelitySettingsToSpectralThresholds` | `pickNumber` + `isFinite` | None (deferred) | `fidelity-threshold-settings.js:42` |
| 4 | `resolveSpectralThresholds` | `toFiniteNumber` + `isFinite` | Range + monotonic | `media-spectral-analysis.js:77` |

### MDN: Number.isInteger vs Number.isFinite

MDN documents `Number.isInteger()` as returning `true` only for actual integer
numbers, rejecting `NaN`, `Infinity`, strings, booleans, and floats.
`Number.isFinite()` returns `true` for any finite number including floats.

<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger>
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite>

Applied here:

- Discovery scheduling parameters (hours, batch size, attempts) are inherently
  integers. Using `Number.isInteger` rejects nonsensical float values like
  `2.5` hours or `3.7` batch size.
- The settings validator (B4) also enforces integer constraints, so the
  resolver provides defense-in-depth rather than sole validation.

### Tier 2: resolveLedgerRetentionPolicy pattern

`ledger-retention-policy.js` uses `Number.isInteger` with a `clampInteger`
helper that clamps parsed values to declared min/max bounds. The resolver
accepts the full settings tree, optional-chains into the namespace, and falls
back to an empty object.

Applied here:

- The discovery resolver follows this Tier 2 pattern: `Number.isInteger`
  for type safety, explicit fallback to `DEFAULT_DISCOVERY_SETTINGS`, and
  optional-chaining into `settings?.library`.
- Range clamping is deferred to the settings validator (B4). The resolver's
  job is projection and fallback, not validation.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Tier 1: `Number` + `isFinite`** | Minimal code | Accepts floats for batch size and attempts |
| **B — Tier 2: `Number.isInteger` + fallback (chosen)** | Rejects floats; matches validator expectations; most defensive for scheduling integers | Slightly more code |
| **C — Dedicated adapter module** | Full separation | Over-engineering for single consumer |

## Final Recommendation

Export a pure `resolveDiscoverySettings` function that:

1. Accepts the full settings tree (not just the `library` slice).
2. Optional-chains into `settings?.library` with an empty-object fallback.
3. For each of the four scheduling keys, checks `Number.isInteger` and falls
   back to the corresponding `DEFAULT_DISCOVERY_SETTINGS` value.
4. Converts hour values to milliseconds for cooldown parameters.
5. Returns a flat object matching the `DEFAULT_DISCOVERY_SETTINGS` shape
   (all values in the units the dispatch service expects: milliseconds and
   integers).

```js
export function resolveDiscoverySettings(settings) {
  const library = settings?.library && typeof settings.library === 'object'
    ? settings.library
    : {};

  return {
    automaticCooldownMs: Number.isInteger(library.discoveryCooldownHours)
      ? library.discoveryCooldownHours * 60 * 60 * 1000
      : DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs,
    dispatchBatchSize: Number.isInteger(library.discoveryBatchSize)
      ? library.discoveryBatchSize
      : DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize,
    fallbackCooldownMs: Number.isInteger(library.discoveryFallbackCooldownHours)
      ? library.discoveryFallbackCooldownHours * 60 * 60 * 1000
      : DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs,
    maxSearchAttempts: Number.isInteger(library.maxSearchAttempts)
      ? library.maxSearchAttempts
      : DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts,
  };
}
```

The resolver is exported so it can be unit-tested directly without service
wiring.

## Files

| File | Role |
| --- | --- |
| `src/server/library/library-discovery-dispatch-service.js` | Add `resolveDiscoverySettings` export. |

## Security

- The resolver is a pure function with no side effects. It cannot mutate the
  input settings object or the `DEFAULT_DISCOVERY_SETTINGS` map (which is
  frozen by A1).
- It performs no I/O and has no access to the database, filesystem, or network.
- Invalid values (non-integers, `NaN`, `undefined`) always fall back to the
  safe hardcoded defaults, preventing misconfiguration from producing
  nonsensical scheduling parameters (e.g., `NaN` milliseconds).

## Outcome

A pure, exported, unit-testable resolver projects the `library` settings
namespace into the dispatch-service shape. When settings are absent (fresh
install, no persisted `library` namespace), the resolver returns the exact
same values as `DEFAULT_DISCOVERY_SETTINGS`. When settings are present, it
converts hour values to milliseconds and validates integer types before
passing them through.

## Validation

- `node --test test/server/library-discovery-dispatch-service.test.js` —
  existing 19 tests pass (resolver added but not yet consumed by the service).
- `node --test test/server/library-discovery-dispatch-settings.test.js` —
  new resolver tests (D1, added separately).
- `npm run lint` — no lint errors.

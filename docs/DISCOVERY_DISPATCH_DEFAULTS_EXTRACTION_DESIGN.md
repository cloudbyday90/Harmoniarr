# Discovery Dispatch Defaults Extraction Design

> Phase A1 of the Settings Library track. This document covers extracting the
> hardcoded discovery dispatch constants into an exported, frozen default map
> so that subsequent phases (A3 resolver, B1 settings consumption, B4 validator)
> can reference a single canonical source.

## Problem

The discovery dispatch service (`library-discovery-dispatch-service.js`) defines
three private constants at lines 29–31 that control scheduling behaviour:

```js
const defaultAutomaticCooldownMs = 6 * 60 * 60 * 1000;
const defaultDispatchBatchSize = 5;
const defaultFallbackCooldownMs = 2 * 60 * 60 * 1000;
```

A fourth related constant (`MAX_DISCOVERY_SEARCH_ATTEMPTS = 3`) lives in a
separate module (`library-discovery-search-query.js:21`).

These values are used as constructor-parameter defaults and are not exported.
Subsequent phases need a single, importable, immutable map of all four defaults
for:

- The settings resolver (A3) to fall back to when settings are absent.
- The settings validator (B4) to declare matching `defaultValue` entries.
- Unit tests to assert exact default values without magic numbers.

## Research Baseline

### Object.freeze() for configuration maps (MDN)

MDN documents `Object.freeze()` as the highest integrity level JavaScript
provides for preventing object mutation: no new properties, no removals, no
reassignments, no prototype changes. For flat objects containing only
primitives, shallow freeze provides full immutability.

<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze>

Applied here:

- The default map contains only integer primitives, so `Object.freeze()` is
  sufficient — no recursive deep freeze is needed.

### Established codebase convention

The project has 61 uses of `Object.freeze()` for exported constant maps.
The naming convention is `export const DEFAULT_* = Object.freeze({...})`.
Key examples:

| File | Constant |
| --- | --- |
| `media-spectral-analysis.js:48` | `DEFAULT_SPECTRAL_THRESHOLDS = Object.freeze({...})` |
| `source-user-trust-threshold-simulator.js:31` | `DEFAULT_TRUST_THRESHOLDS = Object.freeze({...})` |
| `source-user-reputation-model.js:25` | `DEFAULT_REPUTATION_MODEL_OPTIONS = Object.freeze({...})` |
| `source-user-reputation-model.js:36` | `DEFAULT_AUTO_IGNORE_THRESHOLDS = Object.freeze({...})` |
| `ledger-retention-policy.js:31` | `ledgerRetentionBounds = Object.freeze({...})` |

Applied here:

- The new constant follows `DEFAULT_DISCOVERY_SETTINGS` naming.
- Shallow `Object.freeze()` matches every existing flat-config precedent.
- The map is exported so tests and the resolver can import it directly.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Flat `Object.freeze()` map (chosen)** | Matches 61 existing uses; no new abstractions; flat primitives mean shallow freeze is sufficient; trivially testable | None for this use case |
| **B — Deep-freeze with recursive helper** | Future-proof for nested structures | Over-engineering — map is flat primitives; no `deepFreeze` utility in codebase |
| **C — Individual exported constants** | Maximum granularity for imports | Four separate names instead of one unit; breaks the established map pattern |

## Final Recommendation

Export a single `DEFAULT_DISCOVERY_SETTINGS` map with `Object.freeze()`,
containing all four scheduling parameters. The factory function's default
parameter values change to reference this map. No behavioural change.

```js
export const DEFAULT_DISCOVERY_SETTINGS = Object.freeze({
  automaticCooldownMs: 6 * 60 * 60 * 1000,
  dispatchBatchSize: 5,
  fallbackCooldownMs: 2 * 60 * 60 * 1000,
  maxSearchAttempts: MAX_DISCOVERY_SEARCH_ATTEMPTS,
});
```

### Step-by-step

1. Delete the three private constants (lines 29–31).
2. Add the exported frozen map after the imports (before the factory function).
3. Update the factory parameter defaults to reference the map keys.

## Files

| File | Role |
| --- | --- |
| `src/server/library/library-discovery-dispatch-service.js` | Replace private constants with exported frozen default map. |

## Security

- The exported map is frozen, preventing accidental or malicious mutation by
  importing modules. Any attempt to reassign a property throws a `TypeError`
  in strict mode (which ESM enforces by default).
- No new attack surface is introduced. The values are the same hardcoded
  defaults that existed before — they are simply more visible and more
  protected.

## Outcome

The four discovery scheduling defaults are available as a single immutable
exported constant, matching the established codebase convention. The factory
function's default parameters now reference the map instead of inline
literals. All existing tests pass without modification because the runtime
values are identical.

## Validation

- `node --test test/server/library-discovery-dispatch-service.test.js` — all
  existing tests pass with identical behaviour.
- `npm run lint` — no lint errors.
- Manual verification that `DEFAULT_DISCOVERY_SETTINGS` is frozen:
  `Object.isFrozen(DEFAULT_DISCOVERY_SETTINGS) === true`.

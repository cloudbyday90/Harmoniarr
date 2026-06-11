# Scoring Namespace Validator Design

> Phase 2, step B3 of the Settings Library track. This document covers adding
> a `scoring` namespace to the settings validator with per-field weight
> validation and a cross-field sum-to-1.0 constraint.

## Problem

The scoring pipeline (A1–B1) reads `scoring.*` settings at runtime, but no
validation exists at the persistence boundary. An operator (or API caller) could
persist a zero, negative, or non-numeric weight, which would silently corrupt
scoring. The validator needs:

1. **Per-field validation**: Each weight must be a finite number in [0.01, 1.0].
2. **Cross-field constraint**: All 8 weights together should sum to 1.0 (the
   scoring algorithm normalizes by totalWeight, so non-1.0 sums don't break
   scoring, but sum-to-1.0 is the intended operator contract).

## Research

### OWASP Input Validation Cheat Sheet

> "Validate length, range, format, and type. Utilize strong types like numbers,
> booleans, dates, or fixed data ranges for implicit validation."
>
> "Range checks for numerical data and dates."

Per-field `normalizeRateSetting` with `{min: 0.01, max: 1.0}` satisfies the
OWASP range and type requirements.

### Zod cross-field validation pattern

Zod's `.superRefine()` validates at the object level after individual fields
are validated. The pattern is:

1. Validate each field individually (type, range).
2. After all fields pass, run a namespace-level check on the collected values.

This maps directly to our architecture: `normalizeSettingsPatch` already
validates per-field; we add a post-namespace hook for cross-field constraints.

### Floating-point epsilon tolerance

The default weights (0.25 + 0.20 + 0.12 + 0.12 + 0.10 + 0.08 + 0.08 + 0.05)
sum to exactly 1.0 in decimal but may not in IEEE 754 binary. Epsilon
tolerance (`Math.abs(sum - 1.0) < 0.0001`) is standard practice in every major
validation library.

## Options Considered

### Decision 1: Cross-field validation mechanism

| Option | Pros | Cons |
|---|---|---|
| **A — Separate `namespaceValidators` map** | No changes to `settingDefinitions` structure; no filtering in `getDefaultSettings`; extensible for future namespaces | Two maps to maintain |
| **B — Metadata property inside `settingDefinitions`** | Co-located with field definitions | Must filter in `getDefaultSettings` + `normalizeSettingsPatch`; duck-typing fragile |
| **C — Inline check in `normalizeSettingsPatch`** | Simplest for one namespace | Tightly coupled; not reusable |

**Chosen: A.** A `namespaceValidators` map separate from `settingDefinitions`.
`getDefaultSettings` and per-field iteration remain untouched. The map is
consulted in `normalizeSettingsPatch` after per-field processing.

### Decision 2: Sum check scope for partial patches

`normalizeSettingsPatch` only sees the patch, not the full persisted state.

| Option | Pros | Cons |
|---|---|---|
| **A — Check sum only when all 8 fields present** | Handles full-UI-submission; no false positives on partial API calls | Partial patches skip sum check |
| **B — Always enforce sum** | Strongest guarantee | Impossible — validator doesn't know current persisted values |
| **C — Load current settings, merge, validate** | Full accuracy | Major architectural change; validator would need DB access |

**Chosen: A.** Per-field `normalizeRateSetting({min: 0.01, max: 1.0})` is the
security boundary. Sum check is a UX guard for the full-namespace case (the
normal UI path). Partial API patches are protected by per-field validation.

### Decision 3: Epsilon tolerance

| Option | Pros | Cons |
|---|---|---|
| **A — `Math.abs(sum - 1.0) < 0.0001`** | Handles IEEE 754 precision; standard practice | Very slightly non-1.0 sums accepted |
| **B — `sum === 1.0` strict equality** | Exact | Broken by float arithmetic |

**Chosen: A.** The default weights sum to 1.0 in decimal; epsilon ensures they
pass validation in binary.

### Decision 4: Default values source

| Option | Pros | Cons |
|---|---|---|
| **A — Import `DEFAULT_SCORING_WEIGHTS` from `download-result-scoring.js`** | Single source of truth; no drift | Cross-module import |
| **B — Duplicate literals** | No dependency | Drift risk |

**Chosen: A.** The validator already imports from external modules
(`slskd-config.js`, `deployment-security-service.js`). One more import prevents
drift between `DEFAULT_SCORING_WEIGHTS` and the validator defaults.

## Final Recommendation

1. Add `scoring` namespace to `settingDefinitions` with 8 weight fields.
   Each field uses `normalizeRateSetting` with `{min: 0.01, max: 1.0}`.
   Default values come from `DEFAULT_SCORING_WEIGHTS`.

2. Add `namespaceValidators` map with a `scoring` entry that checks
   `Math.abs(sum - 1.0) < 0.0001` when all 8 fields are present in the patch.

3. Modify `normalizeSettingsPatch` to call namespace validators after per-field
   processing for each namespace present in the input.

### Code sketch

```js
// Import
import { DEFAULT_SCORING_WEIGHTS } from '../library/download-result-scoring.js';

// In settingDefinitions, after library:
scoring: {
  weightFormatTier: {
    defaultValue: DEFAULT_SCORING_WEIGHTS.weightFormatTier,
    normalize(value) {
      return normalizeRateSetting('scoring.weightFormatTier', value, { min: 0.01, max: 1.0 });
    },
  },
  // ... 7 more fields
},

// New map
const SCORING_WEIGHT_KEYS = [
  'weightFormatTier', 'weightCandidateTrackMatch', 'weightAudioDepth',
  'weightDuration', 'weightFormatConsistency', 'weightTrackCount',
  'weightPeerDelivery', 'weightUploaderReputation',
];

const namespaceValidators = {
  scoring(namespaceUpdates) {
    const keys = namespaceUpdates.map((u) => u.settingKey);
    if (keys.length === SCORING_WEIGHT_KEYS.length
        && SCORING_WEIGHT_KEYS.every((k) => keys.includes(k))) {
      const sum = namespaceUpdates.reduce((s, u) => s + u.value, 0);
      if (Math.abs(sum - 1.0) >= 0.0001) {
        throw createSettingsValidationError('scoring weights must sum to 1.0');
      }
    }
  },
};

// In normalizeSettingsPatch, after per-field loop:
for (const [ns, nsUpdates] of namespaceUpdatesByNamespace) {
  namespaceValidators[ns]?.(nsUpdates);
}
```

## Files

| File | Change |
|---|---|
| `src/server/validators/settings-validator.js` | Add import, `scoring` namespace, `namespaceValidators`, modify `normalizeSettingsPatch` |

## Security

- **Per-field boundary**: `normalizeRateSetting` rejects non-numbers, NaN,
  Infinity, zero, negative values, and values > 1.0. No weight can be 0 or
  negative through the persistence path.
- **Sum boundary**: When all 8 fields are submitted, the sum must be within
  0.0001 of 1.0. This prevents accidentally top-heavy or empty scoring profiles.
- **Partial patch safety**: Partial patches are protected by per-field
  validation. The scoring algorithm normalizes by `totalWeight`, so any
  combination of valid individual weights produces correct proportional scores.
- **OWASP compliance**: Type validation (number), range validation ([0.01, 1.0]),
  server-side enforcement, allowlist approach (only known setting keys accepted).

## Outcome

The `scoring` namespace in the settings validator enforces:
- Per-field: each weight is a finite number in [0.01, 1.0]
- Cross-field: all 8 weights sum to 1.0 (when all submitted together)

This is the first cross-field validation in the settings system, enabled by a
new `namespaceValidators` extension point that future namespaces can use.

## Validation

- `node --test test/server/settings-validator.test.js` — all existing tests
  pass plus new scoring namespace tests.
- `npx eslint src/server/validators/settings-validator.js --max-warnings 0`
  — no lint errors.

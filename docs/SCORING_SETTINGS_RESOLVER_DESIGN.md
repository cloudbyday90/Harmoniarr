# Scoring Settings Resolver Design

> Phase 2, step A3 of the Settings Library track. This document covers adding
> a `resolveScoringSettings` resolver that projects the `scoring` settings
> namespace into a `scorers` array for `scoreDownloadResult`.

## Problem

Phase A1 extracted `DEFAULT_SCORING_WEIGHTS` and `buildScorersFromWeights`.
Phase A2 injected `loadSettingsFn` into the import candidate service. The
missing piece is a resolver that reads persisted `scoring.*` values and produces
a `scorers` array with fallbacks for missing or invalid weights.

## Research Baseline

### Phase 1 pattern: `resolveDiscoverySettings`

The discovery resolver (`library-discovery-dispatch-service.js:38`) follows a
consistent pattern:

1. Safely extract namespace: `settings?.library && typeof settings.library === 'object'`
2. Per-field validation with fallback: `Number.isInteger(library.field) ? library.field : DEFAULT`
3. Return clean object with all resolved values

### Scoring algorithm tolerance

`scoreDownloadResult` normalizes by total applied weight (line 327):

```js
const compositeScore = totalWeight > 0
  ? Math.round((weightedSum / totalWeight) * 100) / 100
  : null;
```

This means non-1.0 weight sums do not break the algorithm — they proportionally
adjust. The resolver does not need to enforce a sum constraint.

### Validation type for weight fields

Discovery uses `Number.isInteger` because its fields are integers (hours, counts).
Scoring weights are decimals (0.01–1.0), so the validation must use
`typeof value === 'number' && Number.isFinite(value) && value > 0`.

This accepts: `0.01`, `0.25`, `0.5`, `1.0`
This rejects: `'0.25'` (string), `NaN`, `Infinity`, `0`, `-0.1`, `null`, `undefined`

## Options Considered

### Decision 1: Resolver location

| Option | Pros | Cons |
|---|---|---|
| **A — In `download-result-scoring.js`** | Co-located with defaults + builder + scorer functions | File grows slightly |
| **B — New `scoring-settings-resolver.js`** | Separation of concerns | Extra module for ~20 lines; must import 3 symbols |

**Chosen: Option A.** Same pattern as Phase 1 — resolver lives alongside defaults.

### Decision 2: Sum-to-1.0 validation in resolver

| Option | Pros | Cons |
|---|---|---|
| **A — No sum check** | Resolver is per-field defensive; validator (B3) enforces sum; algorithm tolerates non-1.0 | Manual DB edits could produce non-1.0 |
| **B — Sum check** | Defense in depth | Duplicate validation; algorithm already normalizes |

**Chosen: Option A.** The scoring algorithm normalizes by `totalWeight`, so
non-1.0 sums are handled gracefully. The validator (B3) is the enforcement
point at the persistence boundary.

## Final Recommendation

Add `resolveScoringSettings(settings)` to `download-result-scoring.js`:

```js
export function resolveScoringSettings(settings) {
  const scoring = settings?.scoring && typeof settings.scoring === 'object'
    ? settings.scoring
    : {};

  function resolveWeight(key) {
    const value = scoring[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? value
      : DEFAULT_SCORING_WEIGHTS[key];
  }

  return buildScorersFromWeights({
    weightFormatTier: resolveWeight('weightFormatTier'),
    weightCandidateTrackMatch: resolveWeight('weightCandidateTrackMatch'),
    weightAudioDepth: resolveWeight('weightAudioDepth'),
    weightDuration: resolveWeight('weightDuration'),
    weightFormatConsistency: resolveWeight('weightFormatConsistency'),
    weightTrackCount: resolveWeight('weightTrackCount'),
    weightPeerDelivery: resolveWeight('weightPeerDelivery'),
    weightUploaderReputation: resolveWeight('weightUploaderReputation'),
  });
}
```

Returns a `scorers` array (same shape as `DEFAULT_SCORERS`) via
`buildScorersFromWeights`. Invalid or missing individual weights fall back to
`DEFAULT_SCORING_WEIGHTS`. The resolver is pure, exported, and testable.

## Files

| File | Change |
|---|---|
| `src/server/library/download-result-scoring.js` | Add `resolveScoringSettings` export |

## Security

- The resolver produces a `scorers` array with validated weights. Invalid values
  always fall back to safe defaults — no weight can be zero or negative.
- The resolver does not execute the scorer functions — it only pairs validated
  weights with function references.

## Outcome

`resolveScoringSettings` is a pure, exported resolver that projects the
`scoring` settings namespace into a `scorers` array. It reuses
`buildScorersFromWeights` from A1 and falls back to `DEFAULT_SCORING_WEIGHTS`
for missing or invalid individual values.

## Validation

- `node --test test/server/download-result-scoring.test.js` — all existing
  tests pass (no behavioural change to existing code).
- `npm run lint` — no lint errors.

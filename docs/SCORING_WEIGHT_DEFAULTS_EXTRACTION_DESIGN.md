# Scoring Weight Defaults Extraction Design

> Phase 2, step A1 of the Settings Library track. This document covers extracting
> the hardcoded scoring weight values from `DEFAULT_SCORERS` into a separate
> exported constant map.

## Problem

The 8 scoring weights are embedded inline in the `DEFAULT_SCORERS` array
(`download-result-scoring.js:235-244`), mixed with scorer function references.
To make these weights configurable via settings, they must first be extracted
into a named constant that can be imported by the resolver (A3) and the
settings validator (B3).

## Research Baseline

### Current `DEFAULT_SCORERS` structure

```js
const DEFAULT_SCORERS = [
  { name: 'formatTier',            weight: 0.25, fn: scoreFormatTier },
  { name: 'candidateTrackMatch',   weight: 0.20, fn: scoreCandidateTrackMatch },
  { name: 'audioDepth',            weight: 0.12, fn: scoreAudioDepth },
  { name: 'duration',              weight: 0.12, fn: scoreDuration },
  { name: 'formatConsistency',     weight: 0.10, fn: scoreFormatConsistency },
  { name: 'trackCount',            weight: 0.08, fn: scoreTrackCount },
  { name: 'peerDelivery',          weight: 0.08, fn: scorePeerDelivery },
  { name: 'uploaderReputation',    weight: 0.05, fn: scoreUploaderReputation },
];
```

- **Module-private** (not exported)
- Used only by `scoreDownloadResult` as the default `scorers` parameter
- Consumers import `scoreDownloadResult`, not `DEFAULT_SCORERS`

### Parallel with Phase 1 A1

Phase 1 extracted `DEFAULT_DISCOVERY_SETTINGS` from hardcoded constants in the
dispatch service. The same pattern applies: extract values into a frozen
constant, rebuild the original structure from the new constant.

## Options Considered

### Decision 1: Shape of `DEFAULT_SCORING_WEIGHTS`

| Option | Pros | Cons |
|---|---|---|
| **A — Flat object with `weight` prefix** | Matches settings namespace keys directly; resolver reads one-to-one | Needs builder to create `scorers` array |
| **B — Map by scorer name** | Matches `DEFAULT_SCORERS` name keys | Mismatch with settings keys (`weightFormatTier` vs `formatTier`) |

**Chosen: Option A.** The flat object uses the exact settings key names
(`weightFormatTier`, `weightCandidateTrackMatch`, etc.), eliminating
translation between settings and resolver.

### Decision 2: Rebuild `DEFAULT_SCORERS` from the new constant

| Option | Pros | Cons |
|---|---|---|
| **A — Rebuild via `buildScorersFromWeights`** | Single source of truth; builder reused by A3 resolver | Changes how `DEFAULT_SCORERS` is constructed |
| **B — Keep both independent** | Zero risk | Two sources of truth for same values |

**Chosen: Option A.** Rebuilding ensures single source of truth. The builder
function is also needed by `resolveScoringSettings` (A3).

## Final Recommendation

### Add `DEFAULT_SCORING_WEIGHTS`

Exported, frozen constant with all 8 weight values:

```js
export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  weightFormatTier: 0.25,
  weightCandidateTrackMatch: 0.20,
  weightAudioDepth: 0.12,
  weightDuration: 0.12,
  weightFormatConsistency: 0.10,
  weightTrackCount: 0.08,
  weightPeerDelivery: 0.08,
  weightUploaderReputation: 0.05,
});
```

### Add `buildScorersFromWeights(weights)`

Helper that pairs a weights object with scorer functions:

```js
export function buildScorersFromWeights(weights) {
  return [
    { name: 'formatTier',          weight: weights.weightFormatTier,          fn: scoreFormatTier },
    { name: 'candidateTrackMatch', weight: weights.weightCandidateTrackMatch, fn: scoreCandidateTrackMatch },
    { name: 'audioDepth',          weight: weights.weightAudioDepth,          fn: scoreAudioDepth },
    { name: 'duration',            weight: weights.weightDuration,            fn: scoreDuration },
    { name: 'formatConsistency',   weight: weights.weightFormatConsistency,   fn: scoreFormatConsistency },
    { name: 'trackCount',          weight: weights.weightTrackCount,          fn: scoreTrackCount },
    { name: 'peerDelivery',        weight: weights.weightPeerDelivery,        fn: scorePeerDelivery },
    { name: 'uploaderReputation',  weight: weights.weightUploaderReputation,  fn: scoreUploaderReputation },
  ];
}
```

### Rebuild `DEFAULT_SCORERS`

```js
const DEFAULT_SCORERS = buildScorersFromWeights(DEFAULT_SCORING_WEIGHTS);
```

This keeps `DEFAULT_SCORERS` as a module-private constant with identical
runtime shape. `scoreDownloadResult` and its callers are unaffected.

## Files

| File | Change |
|---|---|
| `src/server/library/download-result-scoring.js` | Add `DEFAULT_SCORING_WEIGHTS`, `buildScorersFromWeights`; rebuild `DEFAULT_SCORERS` |

## Security

- No behavioural change — `DEFAULT_SCORERS` has identical runtime shape.
- `DEFAULT_SCORING_WEIGHTS` is `Object.freeze()` to prevent mutation.
- The exported constant will be used by the settings validator (B3) to
  establish baseline weights and by the resolver (A3) for fallback values.

## Outcome

`DEFAULT_SCORING_WEIGHTS` is exported as a frozen constant with all 8 weight
values. `buildScorersFromWeights` is exported as a helper for building scorers
arrays from any weights object. `DEFAULT_SCORERS` is rebuilt from the new
constant, preserving identical runtime behaviour.

## Validation

- `node --test test/server/download-result-scoring.test.js` — all existing
  tests pass (no behavioural change).
- `npm run lint` — no lint errors.

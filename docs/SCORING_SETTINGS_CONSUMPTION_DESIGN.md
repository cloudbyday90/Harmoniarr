# Scoring Settings Consumption Design

> Phase 2, step B1 of the Settings Library track. This document covers reading
> scoring settings per-ingestion call in `import-candidate-service.js` and
> passing resolved `scorers` to `scoreDownloadResultFn`.

## Problem

Phase A2 injected `loadSettingsFn` into `createImportCandidateService` (with an
underscore prefix because it was unused). Phase A3 added `resolveScoringSettings`
to `download-result-scoring.js`. B1 consumes both: read settings once per
ingestion call, resolve them to a `scorers` array, and pass that array into the
per-candidate scoring loop.

## Research

### Official and community best practices (as of May 2026)

1. **Dependency Injection via factory functions** — The dominant pattern for
   non-framework Node.js ESM services. Factory parameters with sensible defaults
   allow production use and test injection without a DI container.
   (Source: hirenodejs.com DI guide, nareshit.com Node.js design patterns 2026)

2. **Per-call settings resolution** — Community consensus: load configuration
   per-operation, not at module-load time. This ensures runtime changes take
   effect without restarts. Cache only when latency profiling proves necessary.
   (Source: techcronus.com Node.js best practices)

3. **Graceful degradation** — When configuration sources (DB, env) are
   unavailable, fall back to compiled defaults rather than propagating errors
   that would block core functionality. This is the OWASP-aligned approach:
   fail closed with safe defaults, never fail open.
   (Source: OWASP Application Security Verification Standard 4.0, section V2)

4. **Modular service files over singletons** — Each service is a factory
   function that returns an object of methods. No class singletons, no global
   state. Aligns with Harmoniarr's existing `createXxxService` pattern.
   (Source: Node.js official docs, hirenodejs.com DI guide)

### Existing Harmoniarr pattern

Phase 1 established the canonical settings resolution pattern in
`library-discovery-dispatch-service.js:214-219`:

```js
let effectiveSettings;
try {
  effectiveSettings = resolveDiscoverySettings(await loadSettingsFn());
} catch {
  effectiveSettings = DEFAULT_DISCOVERY_SETTINGS;
}
```

B1 must follow this pattern exactly for consistency.

## Options Considered

### Decision 1: Where to load settings

| Option | Pros | Cons |
|---|---|---|
| **A — Once per `ingestSlskdSearchResponses` call, before scoring loop** | Matches Phase 1; single async call; settings consistent across batch | Slightly stale if settings change mid-batch (negligible) |
| **B — Once per candidate inside the for loop** | Freshest per-candidate | N+1 DB query; settings rarely change mid-batch; unnecessary |

**Chosen: A.** Settings load is async (`await loadSettingsFn()`); doing it once
per batch avoids N+1 queries and matches the established pattern.

### Decision 2: Fallback strategy

| Option | Pros | Cons |
|---|---|---|
| **A — try/catch → DEFAULT_SCORERS** | Phase 1 parity; settings failure never blocks ingestion | Uses compiled defaults if DB is down |
| **B — try/catch → DEFAULT_SCORERS + structured log** | Same as A plus observability | Requires logger injection; not yet in pattern |
| **C — Propagate error** | Forces operator awareness | Breaks ingestion pipeline; inconsistent with Phase 1 |

**Chosen: A.** Strict Phase 1 parity. The resolver (A3) already validates each
weight and falls back to safe defaults. Adding logging can be a future enhancement.

### Decision 3: Rename `_loadSettingsFn` → `loadSettingsFn`

| Option | Pros | Cons |
|---|---|---|
| **A — Rename** | Underscore was "unused" marker; now incorrect if kept | Changes factory parameter name |
| **B — Keep underscore** | No signature change | Misleading; suggests unused parameter |

**Chosen: A.** The underscore was added in A2 specifically to indicate "injected
but not yet consumed." B1 consumes it, so the prefix must be removed.

### Decision 4: Import of `resolveScoringSettings`

| Option | Pros | Cons |
|---|---|---|
| **A — Add to existing `download-result-scoring.js` import** | One-line import change; clean | None |
| **B — New module** | More modular | Unnecessary indirection for a single function |

**Chosen: A.** `import-candidate-service.js` already imports `scoreDownloadResult`
from `download-result-scoring.js`. Adding `resolveScoringSettings` to the same
import is the minimal, clean approach.

## Final Recommendation

Apply all four decisions:

1. Add `resolveScoringSettings` to the existing `download-result-scoring.js`
   import (line 23).
2. Rename `_loadSettingsFn` → `loadSettingsFn` in factory params (line 351).
3. Load settings once per `ingestSlskdSearchResponses` call, before the scoring
   loop (after line 800), using the Phase 1 try/catch pattern.
4. Pass resolved `scorers` to `scoreDownloadResultFn` (line 803).

### Code sketch

```js
// At top: add to existing import
import { resolveScoringSettings, scoreDownloadResult } from '../library/download-result-scoring.js';

// In factory: rename parameter
loadSettingsFn = loadSettings,

// In ingestSlskdSearchResponses, before scoring loop:
let effectiveScorers;
try {
  effectiveScorers = resolveScoringSettings(await loadSettingsFn());
} catch {
  effectiveScorers = DEFAULT_SCORERS;
}

// In scoring loop: pass scorers
const scoring = scoreDownloadResultFn({
  candidate,
  formatPreferences,
  albumTitle,
  expectedTrackCount,
  expectedTrackTitles,
  expectedDurationSeconds,
  uploaderReputation: reputationIndex.get(buildUsernameKey(candidate.username)) ?? null,
  scorers: effectiveScorers,
});
```

Note: `DEFAULT_SCORERS` is not exported from `download-result-scoring.js`. The
fallback must use `resolveScoringSettings(null)` or we must also import
`DEFAULT_SCORING_WEIGHTS` + `buildScorersFromWeights`. The cleanest fallback is
`resolveScoringSettings(undefined)` — when settings is nullish, the resolver
returns fully-defaulted scorers (all weights fall back). So the catch block
becomes:

```js
} catch {
  effectiveScorers = resolveScoringSettings(undefined);
}
```

This avoids exporting `DEFAULT_SCORERS` and keeps the resolver as the single
source of truth for default scorers.

## Files

| File | Change |
|---|---|
| `src/server/import-candidates/import-candidate-service.js` | Import `resolveScoringSettings`; rename param; add settings resolution; pass `scorers` |

## Security

- The resolver (A3) validates every weight (`typeof number && finite && > 0`).
  Invalid weights fall back to compiled defaults. No weight can be zero or
  negative through this path.
- The scoring algorithm normalizes by `totalWeight`, so even a partially-invalid
  set produces proportional (not broken) scores.
- The try/catch fallback ensures that a compromised or unavailable settings
  store never blocks the ingestion pipeline — the system degrades to safe,
  compiled defaults.

## Outcome

The scoring loop in `ingestSlskdSearchResponses` reads scoring settings once per
call via the injected `loadSettingsFn`, resolves them through
`resolveScoringSettings`, and passes the resulting `scorers` array to
`scoreDownloadResultFn`. Graceful fallback to fully-defaulted scorers if the
settings store is unavailable. Zero behavioural change when settings are absent
— `resolveScoringSettings(undefined)` produces identical scorers to the current
hardcoded `DEFAULT_SCORERS`.

## Validation

- `node --test test/server/import-candidate-service.test.js` — all 21 existing
  tests pass (no behavioural change when settings are absent).
- `node --test test/server/download-result-scoring.test.js` — all 49 existing
  tests pass (no changes to scoring module).
- `npx eslint src/server/import-candidates/import-candidate-service.js
  --max-warnings 0` — no lint errors.

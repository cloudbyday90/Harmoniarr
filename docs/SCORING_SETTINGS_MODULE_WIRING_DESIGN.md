# Scoring Settings Module Wiring Design

> Phase 2, step B2 of the Settings Library track. This document confirms that
> the `loadSettingsFn` wiring through `import-candidate-module.js` was completed
> during step A2.

## Problem

The original plan split settings injection into two steps:
- **A2**: Add `loadSettingsFn` parameter to `createImportCandidateService` factory
- **B2**: Wire `loadSettingsFn: loadSettings` through `import-candidate-module.js`

## Research

No additional research needed — this is a wiring verification, not a new feature.

## Analysis

Step A2 (committed in `10011f3`) implemented both the factory parameter injection
and the module wiring in a single change:

| Location | What | Status |
|---|---|---|
| `import-candidate-service.js:351` | `loadSettingsFn = loadSettings` factory param | Done in A2 |
| `import-candidate-module.js:65` | `import { loadSettings } from '../settings.js'` | Done in A2 |
| `import-candidate-module.js:117` | `loadSettingsFn: loadSettings` in `createImportCandidateService` call | Done in A2 |

Step B1 then consumed the wiring by reading settings per-ingestion call and
renaming `_loadSettingsFn` → `loadSettingsFn` in the factory.

## Recommendation

**No code changes needed.** The wiring is complete and verified. B2 is satisfied
by A2's implementation. The full chain is:

```
import-candidate-module.js:117  loadSettingsFn: loadSettings
  → import-candidate-service.js:351  loadSettingsFn = loadSettings (factory default)
    → ingestSlskdSearchResponses line 804  resolveScoringSettings(await loadSettingsFn())
```

## Security

`loadSettings` is imported directly from `../settings.js` at the module
composition root (`import-candidate-module.js`). This is the composition root
pattern — dependencies are wired in one place, not scattered through business
logic. No injection attack surface is introduced because the wiring is static.

## Outcome

B2 requires no additional code changes. The wiring was completed as part of A2
and verified during B1 implementation. This step is a confirmation-only gate.

## Validation

- `import-candidate-module.js:117` — `loadSettingsFn: loadSettings` present
- `import-candidate-module.js:65` — `import { loadSettings } from '../settings.js'` present
- 21/21 import candidate service tests pass (B1 verified the full chain)

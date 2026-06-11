# Scoring Settings Injection Design

> Phase 2, step A2 of the Settings Library track. This document covers injecting
> the `loadSettingsFn` dependency into the import candidate service so that
> subsequent phases (A3 resolver, B1 runtime consumption) can read persisted
> scoring weights at runtime.

## Problem

The import candidate service (`import-candidate-service.js`) has no settings
awareness. Its scoring weights are fixed to `DEFAULT_SCORERS` (now rebuilt from
`DEFAULT_SCORING_WEIGHTS` via A1). To make scoring weights configurable through
the admin settings API, the service needs a way to read the persisted `scoring`
namespace at runtime.

## Research Baseline

### Established Pattern: direct `loadSettingsFn` injection

Twenty-plus services across the codebase inject `loadSettingsFn = loadSettings`
as a constructor default. Phase 1 A2 applied this pattern to the dispatch
service. The same pattern applies here.

### Phase 1 A2 reference

Phase 1 A2 (`DISCOVERY_DISPATCH_SETTINGS_INJECTION_DESIGN.md`) completed the
identical injection for `library-discovery-dispatch-service.js`. The steps were:

1. Import `loadSettings` from `../settings.js`.
2. Add `loadSettingsFn = loadSettings` to the factory parameter list.
3. Import `loadSettings` in the wiring module and pass it through.

### Scoring A2 differences

| Aspect | Phase 1 A2 | Scoring A2 |
|---|---|---|
| Target file | `library-discovery-dispatch-service.js` | `import-candidate-service.js` |
| Factory | `createLibraryDiscoveryDispatchService` | `createImportCandidateService` |
| Wiring module | `library-module.js:112` | `import-candidate-module.js:113` |
| Import path | `../settings.js` | `../settings.js` |

The pattern is identical. Only the target files differ.

## Options Considered

No alternatives needed — this follows the established pattern. The single
decision is the injection location, which is dictated by the architecture:
`import-candidate-service.js` is where `scoreDownloadResultFn` is called.

## Final Recommendation

1. **`import-candidate-service.js`**: Import `loadSettings` from `../settings.js`.
   Add `loadSettingsFn = loadSettings` to the `createImportCandidateService`
   factory parameter list (after `scoreDownloadResultFn`, before `slskdService`).

2. **`import-candidate-module.js`**: Import `loadSettings` from `../settings.js`.
   Pass `loadSettingsFn: loadSettings` at line 113 in the
   `createImportCandidateService` call.

The service does **not** call `loadSettingsFn` yet — that is B1. This phase
only prepares the injection point so the parameter exists and defaults to the
real loader.

## Files

| File | Change |
|---|---|
| `src/server/import-candidates/import-candidate-service.js` | Import `loadSettings`, add `loadSettingsFn` factory parameter |
| `src/server/import-candidates/import-candidate-module.js` | Import `loadSettings`, pass `loadSettingsFn: loadSettings` to factory |

## Security

- `loadSettingsFn` is an injectable dependency. In production it defaults to the
  real `loadSettings` which queries PostgreSQL through the authenticated
  connection pool. In tests it can be replaced with a deterministic stub.
- No new attack surface. The function is an internal implementation detail.
- Settings endpoints require admin authentication at the route level.

## Outcome

The import candidate service accepts `loadSettingsFn` as a constructor
dependency, defaulting to the real `loadSettings` function. The import candidate
module explicitly passes `loadSettings` through. No behavioural change — the
parameter is accepted but not yet consumed. All 21 existing tests pass without
modification.

## Validation

- `node --test test/server/import-candidate-service.test.js` — 21 tests pass.
- `node --test test/server/download-result-scoring.test.js` — 49 tests pass.
- `npm run lint` — no lint errors.

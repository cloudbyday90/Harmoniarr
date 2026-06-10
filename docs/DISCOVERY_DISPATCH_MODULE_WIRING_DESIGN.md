# Discovery Dispatch Module Wiring Design

> Phase B3 of the Settings Library track. This document verifies that the
> `loadSettingsFn` wiring through `library-module.js` — originally completed in
> A2 — remains correct after B1/B2 consumed the dependency.

## Problem

Phase B3 requires verifying that `library-module.js` correctly passes
`loadSettings` to the dispatch service factory. This wiring was completed in A2
(`DISCOVERY_DISPATCH_SETTINGS_INJECTION_DESIGN.md`) when `loadSettingsFn:
loadSettings` was added to the factory call. Now that B1/B2 have consumed the
injection, B3 confirms the wiring is complete and no additional changes are
needed.

## Research Baseline

### Current wiring in `library-module.js`

The dispatch service factory call at `library-module.js:103-115`:

```js
libraryDiscoveryDispatchService = createLibraryDiscoveryDispatchService({
  enableTrackFallback,
  getReleaseTracklistExpectationsFn: async ({ metadataReleaseId }) => {
    const trackRows = await listMetadataTracksByReleaseId(metadataReleaseId);
    return buildReleaseTracklistExpectations(trackRows);
  },
  getUserPreferencesFn,
  importCandidateService,
  libraryDiscoveryRequestStore,
  loadSettingsFn: loadSettings,
  onDiscoveryRequestExhaustedFn,
  slskdService,
}),
```

The import at `library-module.js:21`:

```js
import { loadSettings } from '../settings.js';
```

### Full call chain verification

1. `library-module.js:112` passes `loadSettingsFn: loadSettings` to the factory.
2. `library-discovery-dispatch-service.js:69` accepts it as
   `loadSettingsFn = loadSettings` (defaulting to the direct import if not
   provided).
3. `library-discovery-dispatch-service.js:216` calls
   `resolveDiscoverySettings(await loadSettingsFn())` inside a try/catch.
4. `settings.js:22-35` queries `app_settings`, merges with
   `getDefaultSettings()`, and returns the full settings tree.
5. `resolveDiscoverySettings` (A3) projects `settings.library` into the
   dispatch-service shape with `Number.isInteger` validation and hour-to-ms
   conversion.

### Other module-level wiring concerns

`library-module.js` also wires:

- `libraryDiscoveryWorker` (line 267-286): receives
  `dispatchDiscoveryRequests: libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests`.
  No changes needed — the worker calls the method, which now internally resolves
  settings.
- `libraryDiscoveryRunService` (line 287-293): creates operation runs. No
  settings dependency.
- `libraryDiscoveryRecoveryRetryService` (line 299-305): retry logic. No
  settings dependency.

No other services in `library-module.js` need `loadSettingsFn` injection at this
time. Future phases (scoring weights, reconciliation thresholds) may add
settings to additional services.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Confirm existing wiring is sufficient (chosen)** | Zero code changes; wiring already correct; A2 completed this | None |
| **B — Switch to `settingsService` injection** | Matches some other modules | Introduces an adapter layer for no benefit; Pattern A (direct `loadSettingsFn`) is used by 20+ hot-path services |

## Final Recommendation

No code changes needed. The wiring completed in A2 is correct and sufficient.

## Files

| File | Role |
| --- | --- |
| `src/server/library/library-module.js` | Verified: already passes `loadSettingsFn: loadSettings` at line 112. |

## Security

- `loadSettings` queries `app_settings` using parameterized SQL (`settings.js:23-25`).
- The dispatch service wraps the call in try/catch with graceful fallback to
  `DEFAULT_DISCOVERY_SETTINGS` (B1), preventing unhandled DB errors from
  propagating.
- No new endpoints or input vectors introduced.

## Outcome

B3 is confirmed complete with zero additional code changes. The A2 wiring
(`loadSettingsFn: loadSettings` at `library-module.js:112`) is correct, and
B1/B2 successfully consume it on every dispatch cycle.

## Validation

- `npm run lint` — no lint errors.
- `npm run build:server` — server build succeeds.
- `node --test test/server/library-discovery-dispatch-service.test.js` — 19
  existing tests pass (wiring is transparent to tests; they inject their own
  `loadSettingsFn` or rely on the default import).

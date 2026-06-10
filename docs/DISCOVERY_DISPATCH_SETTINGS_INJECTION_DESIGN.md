# Discovery Dispatch Settings Injection Design

> Phase A2 of the Settings Library track. This document covers injecting the
> `loadSettingsFn` dependency into the discovery dispatch service so that
> subsequent phases (A3 resolver, B1 runtime consumption) can read persisted
> settings on each dispatch cycle.

## Problem

The discovery dispatch service (`library-discovery-dispatch-service.js`) has no
settings awareness. Its scheduling parameters (`automaticCooldownMs`,
`dispatchBatchSize`, `fallbackCooldownMs`) are fixed at construction time via
factory-parameter defaults (now referencing `DEFAULT_DISCOVERY_SETTINGS` from A1).

To make these configurable through the admin settings API, the service needs a
way to read the persisted `library` namespace at runtime. This requires
injecting an async settings-loading function as a constructor dependency.

## Research Baseline

### `loadSettings` function (settings.js)

The `loadSettings` export from `src/server/settings.js` is an async function
that queries the `app_settings` PostgreSQL table, overlays persisted values onto
`getDefaultSettings()`, and returns the merged settings object. It accepts an
optional `queryable` parameter for transaction scoping.

### Established Pattern A: direct `loadSettingsFn` injection

Twenty-plus services across the codebase inject `loadSettingsFn = loadSettings`
as a constructor default, following the same structure:

```js
import { loadSettings } from '../settings.js';

export function createXxxService({
  loadSettingsFn = loadSettings,
} = {}) {
  async function someMethod() {
    const settings = resolveXxxSettings(await loadSettingsFn());
  }
}
```

Examples: `source-user-ignore-service.js:41`, `ledger-retention-service.js:49`,
`import-candidate-preview-service.js:95`, `backup-export-service.js:135`.

Applied here:

- The dispatch service follows this exact pattern.
- A resolver helper (A3) will project the raw `library` namespace into the
  dispatch-specific shape with fallbacks.

### `fidelity-threshold-settings.js` adapter pattern (Pattern C)

The fidelity thresholds use a dedicated adapter module that wraps `loadSettingsFn`
in error-safe loaders. This is more refined but was created because **two**
separate consumers (spectral classifier and trust simulator) need the same
projection.

Applied here:

- Only the dispatch service needs discovery settings, so a dedicated adapter
  module is over-engineering. The resolver (A3) in the same file is sufficient.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Direct `loadSettingsFn` injection (chosen)** | Matches 20+ existing services; simple; resolver handles projection inline; testable with stub injection | Resolver logic co-located with dispatch service |
| **B — Adapter module (like `fidelity-threshold-settings.js`)** | Separation of concerns; reusable loader | Over-engineering for a single consumer; adds a file for a one-method adapter |
| **C — `settingsService` injection** | Consistent with `library-scan-service.js` pattern | Heavier payload with secrets and path validation; dispatch only needs `library` namespace; inconsistent with hot-path pattern |

## Final Recommendation

1. Import `loadSettings` from `../settings.js`.
2. Add `loadSettingsFn = loadSettings` to the factory parameter list.
3. Import `loadSettings` in `library-module.js` and pass it through to the
   dispatch service factory.

The service does **not** call `loadSettingsFn` yet — that is B1. This phase
only prepares the injection point so that the parameter exists and defaults to
the real loader. Existing tests that create the service without `loadSettingsFn`
continue to work because the default is `loadSettings` (a real async function
that would query the database, but it is never called until B1).

## Files

| File | Role |
| --- | --- |
| `src/server/library/library-discovery-dispatch-service.js` | Add `loadSettingsFn` import and factory parameter. |
| `src/server/library/library-module.js` | Import `loadSettings` and pass it to the dispatch service factory. |

## Security

- `loadSettingsFn` is an injectable dependency. In production it defaults to the
  real `loadSettings` which queries PostgreSQL through the authenticated
  connection pool. In tests it can be replaced with a deterministic stub.
- No new attack surface. The function is not exposed outside the service; it is
  an internal implementation detail.
- Settings reads already require admin authentication at the route level. The
  dispatch service runs server-side as part of the background heartbeat, which
  is operator-initiated.

## Outcome

The discovery dispatch service accepts `loadSettingsFn` as a constructor
dependency, defaulting to the real `loadSettings` function. The library module
explicitly passes `loadSettings` through. No behavioural change — the parameter
is accepted but not yet consumed. All 19 existing tests pass without
modification.

## Validation

- `node --test test/server/library-discovery-dispatch-service.test.js` — 19
  tests pass (no tests pass `loadSettingsFn`, so the default is used).
- `npm run lint` — no lint errors.

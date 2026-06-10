# Settings Library Configuration Design

> Part of the operator-settings track. This document covers the Library settings
> view that replaces the "Coming soon" placeholder in the Settings workspace. It
> surfaces existing backend-only namespaces (`acquisition`, `retention`, `fidelity`)
> and introduces new `library` and `scoring` namespaces for discovery scheduling,
> reconciliation behaviour, and download scoring weights.

## Problem

The Settings workspace has eight tabbed views. Seven are fully functional with
real form fields, save behaviour, and validation feedback. The eighth — Library —
renders a static "Coming soon" card:

> Library configuration will be available here in a future update.

Its subtitle promises "Download scoring, discovery schedule, and reconciliation
behaviour" but delivers nothing.

Meanwhile, three complete settings namespaces (`acquisition`, `retention`,
`fidelity`) exist in the backend validator, database, and API, but have no UI.
Operators cannot configure auto-ignore policy, operation-run retention, or
spectral fidelity thresholds without editing the database directly.

Additionally, several discovery, scoring, and reconciliation parameters are
hardcoded in server modules with no persistence path:

| What | Location | Current Value |
| --- | --- | --- |
| Discovery cooldown (first search) | `library-discovery-dispatch-service.js:29` | 6 hours |
| Discovery cooldown (fallback) | `library-discovery-dispatch-service.js:31` | 2 hours |
| Discovery batch size | `library-discovery-dispatch-service.js:30` | 5 |
| Max search attempts | `library-discovery-search-query.js:21` | 3 |
| Scoring weights (8 values) | `download-result-scoring.js` | hardcoded |
| Minimum track match ratio | `candidate-track-matcher.js` | 0.5 |
| Browse folder name ratio | `candidate-browse-planning.js` | 0.6 |
| Browse partial coverage | `candidate-browse-planning.js` | 0.4 |

## Research Baseline

### Settings validator pattern

The existing `settings-validator.js` uses a declarative definition map
(`settingDefinitions`) organized by namespace. Each setting has a `defaultValue`
and a `normalize(value)` function that validates, transforms, and throws
`createSettingsValidationError` on failure. The main entry point
`normalizeSettingsPatch(input)` returns an array of `{ namespace, settingKey,
value }` tuples.

Applied here:

- New namespaces follow the same `settingDefinitions` pattern.
- Each new field gets a `normalize` function reusing the existing helpers:
  `normalizeIntegerSetting`, `normalizeBooleanSetting`, `normalizeRateSetting`.

### Settings form builder pattern

`settings-form.js` maps flat form state to the structured API payload. Each
namespace is either spread directly (for simple key-value fields) or transformed
(comma-separated parsing, array normalization, secret clearing).

Applied here:

- New namespaces follow the spread pattern for simple key-value fields.
- The `scoring` namespace uses a dedicated normalization helper to ensure weights
  sum to 1.0 and no single weight drops below a minimum floor (0.01).

### Settings consumption pattern (Pattern A)

Services that read settings on the hot path inject `loadSettingsFn` (defaulting
to `loadSettings` from `settings.js`) and call it fresh each time they need
values. A resolver helper projects the raw namespace into a clean shape with
fallbacks. Example from `source-user-ignore-service.js:24-32`:

```js
function resolveAcquisitionSettings(settings) {
  const acquisition = settings?.acquisition ?? {};
  return {
    autoIgnoreEnabled: acquisition.autoIgnoreEnabled === true,
    autoIgnoreCooldownHours: Number.isFinite(Number(acquisition.autoIgnoreCooldownHours))
      ? Number(acquisition.autoIgnoreCooldownHours)
      : 24,
  };
}
```

Applied here:

- The discovery dispatch service follows this pattern: inject `loadSettingsFn`,
  add a `resolveDiscoverySettings` helper, read fresh on each dispatch cycle.
- Fallback to the current hardcoded defaults when settings are absent.

### Existing settings view conventions

All functional settings views use the `useSettingsForm` composable for load/save
lifecycle, `useConfirm` for destructive-action confirmation, and `useToast` for
save feedback. Form fields use the design-system input components with
consistent label, description, and validation-error styling.

Applied here:

- The Library settings view follows the same composable and component patterns.
- The view is split into collapsible sections (one per concern area) to manage
  the high field count without overwhelming the operator.

### Progressive disclosure for advanced thresholds

Nielsen Norman Group's research on progressive disclosure recommends showing
only the most common options at the top level, with advanced or expert options
available but not prominent.

Applied here:

- Discovery scheduling and acquisition policy are top-level sections (most
  operators will touch these).
- Scoring weights and fidelity thresholds are collapsed by default under
  "Advanced" headings, with reset-to-defaults buttons.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Single flat form with all fields** | Simple to build; one namespace; one save | 20+ fields is overwhelming; no logical grouping; poor progressive disclosure |
| **B — Separate views per namespace** | Clean separation; each page is small | Too many tabs in the Settings workspace; navigation sprawl; related settings (discovery + scoring) are split |
| **C — Sectioned single view with collapsed advanced groups (chosen)** | One page with logical sections; progressive disclosure; related settings co-located; matches the existing Media & Storage pattern (artwork + paths in one view) | More initial implementation; requires section toggle UI |

## Final Recommendation Stack

### 1. New `library` namespace (discovery scheduling)

Persist discovery dispatch parameters that are currently hardcoded or
env-var-only:

| Setting | Type | Default | Range |
| --- | --- | --- | --- |
| `discoveryCooldownHours` | integer | 6 | 1 – 168 |
| `discoveryFallbackCooldownHours` | integer | 2 | 1 – 168 |
| `discoveryBatchSize` | integer | 5 | 1 – 50 |
| `maxSearchAttempts` | integer | 3 | 1 – 10 |

Backend changes:

- Add `library` namespace to `settingDefinitions` in `settings-validator.js`.
- `library-discovery-dispatch-service.js` reads `library.*` settings from
  `loadSettingsFn` instead of using hardcoded constants.
- Fall back to the current hardcoded defaults when settings are absent (backward
  compatible).

Frontend:

- Section: "Discovery scheduling" with four integer fields.
- Helper text explains each field (e.g., "Wait this long before re-searching
  for a release that has never had a candidate").

### 2. New `scoring` namespace (download result scoring)

Surface the eight scoring weights from `download-result-scoring.js`:

| Setting | Type | Default | Range |
| --- | --- | --- | --- |
| `weightFormatTier` | rate | 0.25 | 0.01 – 1.0 |
| `weightCandidateTrackMatch` | rate | 0.20 | 0.01 – 1.0 |
| `weightAudioDepth` | rate | 0.12 | 0.01 – 1.0 |
| `weightDuration` | rate | 0.12 | 0.01 – 1.0 |
| `weightFormatConsistency` | rate | 0.10 | 0.01 – 1.0 |
| `weightTrackCount` | rate | 0.08 | 0.01 – 1.0 |
| `weightPeerDelivery` | rate | 0.08 | 0.01 – 1.0 |
| `weightUploaderReputation` | rate | 0.05 | 0.01 – 1.0 |

Validation: the `normalize` function checks that all eight weights sum to
1.0 (within a 0.02 tolerance). If they do not, it throws a validation error
listing the actual sum.

Backend changes:

- Add `scoring` namespace to `settingDefinitions`.
- `download-result-scoring.js` reads weights from settings when available,
  falling back to the hardcoded defaults.

Frontend:

- Collapsed section: "Download scoring weights" (advanced).
- Eight number inputs with a live sum indicator. The save button is disabled
  when the sum is not 1.00.
- "Reset to defaults" button restores the eight default values.

### 3. Surface existing `acquisition` namespace (auto-ignore policy)

The `acquisition` namespace already exists in the validator and database:

| Setting | Type | Default |
| --- | --- | --- |
| `autoIgnoreEnabled` | boolean | false |
| `autoIgnoreCooldownHours` | integer | 24 |

No backend changes needed — only frontend UI.

Frontend:

- Section: "Acquisition policy" with a toggle and cooldown input.
- The cooldown input is disabled when `autoIgnoreEnabled` is false.

### 4. Surface existing `retention` namespace (history cleanup)

The `retention` namespace already exists in the validator and database:

| Setting | Type | Default |
| --- | --- | --- |
| `operationRunMaxAgeDays` | integer | 90 |
| `operationRunRetainCountPerType` | integer | 50 |
| `outcomeEventMaxAgeDays` | integer | 180 |

No backend changes needed — only frontend UI.

Frontend:

- Section: "Retention" with three integer fields.
- Helper text warns that reducing retention deletes historical data.

### 5. Surface existing `fidelity` namespace (spectral thresholds)

The `fidelity` namespace already exists in the validator and database (8 fields):

| Setting | Type | Default |
| --- | --- | --- |
| `spectralAuthenticMinCutoffHz` | integer | 20,000 |
| `spectralSuspiciousMinCutoffHz` | integer | 19,000 |
| `spectralTranscodeMidCutoffHz` | integer | 16,000 |
| `spectralMinSampleRateHz` | integer | 44,100 |
| `trustWatchFailureCount` | integer | 3 |
| `trustWatchMaxSuccessRate` | rate | 0.5 |
| `trustWatchEvidenceCount` | integer | 3 |
| `trustHealthyEvidenceCount` | integer | 5 |
| `trustHealthyMinSuccessRate` | rate | 0.8 |

No backend changes needed — only frontend UI.

Frontend:

- Collapsed section: "Fidelity thresholds" (advanced).
- Split into two sub-groups: "Spectral analysis" (4 fields) and "Source trust"
  (4 fields).
- Helper text explains what each threshold controls.

### 6. Update `settings-form.js` payload builder

Add the new namespaces (`library`, `scoring`) and the newly-surfaced namespaces
(`acquisition`, `retention`, `fidelity`) to `buildSettingsUpdatePayload`:

- `library`: direct spread (all simple key-value).
- `scoring`: direct spread (all rate values).
- `acquisition`: direct spread (boolean + integer).
- `retention`: direct spread (three integers).
- `fidelity`: direct spread (four integers + four rates).

### 7. Update `SettingsLibraryView.vue`

Replace the "Coming soon" card with a sectioned form:

```
Discovery scheduling        [expanded by default]
  - discoveryCooldownHours
  - discoveryFallbackCooldownHours
  - discoveryBatchSize
  - maxSearchAttempts

Acquisition policy          [expanded by default]
  - autoIgnoreEnabled
  - autoIgnoreCooldownHours

Retention                   [expanded by default]
  - operationRunMaxAgeDays
  - operationRunRetainCountPerType
  - outcomeEventMaxAgeDays

Download scoring weights    [collapsed by default]
  - 8 weight inputs + live sum indicator
  - Reset to defaults button

Fidelity thresholds         [collapsed by default]
  - Spectral analysis sub-group (4 fields)
  - Source trust sub-group (4 fields)
```

The view uses `useSettingsForm` with the namespaces
`['library', 'scoring', 'acquisition', 'retention', 'fidelity']`.

---

## Discovery Scheduling Implementation Plan

> Phase 1 of the Settings Library track. Adds the `library` namespace to the
> backend settings validator, wires the discovery dispatch service to read those
> settings at runtime, adds the frontend section to SettingsLibraryView, and
> covers all changes with tests.

### A) Refactors

These changes restructure existing code without altering behaviour, so the
dispatch service can accept settings dynamically instead of using hardcoded
constructor parameters.

#### A1. Extract hardcoded defaults to a named constant map

`DISCOVERY_DISPATCH_DEFAULTS_EXTRACTION_DESIGN.md` completes the extraction.
The three private constants and the imported max-search-attempts constant are
replaced by a single exported, frozen `DEFAULT_DISCOVERY_SETTINGS` map. No
behavioural change.

#### A2. Accept `loadSettingsFn` as a constructor dependency

`DISCOVERY_DISPATCH_SETTINGS_INJECTION_DESIGN.md` completes the injection. The
factory function now accepts `loadSettingsFn = loadSettings` as a constructor
parameter, and `library-module.js` passes the real `loadSettings` through. No
behavioural change — the parameter is accepted but not yet consumed.

#### A3. Add a resolver helper following the `resolveAcquisitionSettings` pattern

`DISCOVERY_SETTINGS_RESOLVER_DESIGN.md` completes the resolver. A pure,
exported `resolveDiscoverySettings` function projects the `library` settings
namespace into the dispatch-service shape (converting hours to milliseconds),
falling back to `DEFAULT_DISCOVERY_SETTINGS` for missing or invalid keys.

### B) Code Changes

These changes alter existing files to consume the new settings at runtime.

#### B1 + B2. Read settings at the start of each dispatch cycle and parameterize `buildNextZeroCandidateSchedule`

`DISCOVERY_DISPATCH_SETTINGS_CONSUMPTION_DESIGN.md` completes both B1 and B2.
The dispatch cycle now resolves settings from `loadSettingsFn` with graceful
fallback to `DEFAULT_DISCOVERY_SETTINGS` on transient DB failures. The
`buildNextZeroCandidateSchedule` helper is parameterized with all four
settings-derived values (`automaticCooldownMs`, `fallbackCooldownMs`,
`dispatchBatchSize`, `maxSearchAttempts`), eliminating closure and constant
references. The `MAX_DISCOVERY_SEARCH_ATTEMPTS` import is removed from the
dispatch service (it remains in `library-discovery-search-query.js`).

#### B3. Wire `loadSettingsFn` through `library-module.js`

`DISCOVERY_DISPATCH_MODULE_WIRING_DESIGN.md` confirms the wiring is complete.
The A2 phase already added `loadSettingsFn: loadSettings` at
`library-module.js:112` with the import at line 21. No additional changes
needed.

#### B4. Add `library` namespace to the settings validator

`SETTINGS_VALIDATOR_LIBRARY_NAMESPACE_DESIGN.md` completes the validator
addition. The `library` namespace is appended to `settingDefinitions` after
`fidelity` with four integer fields using `normalizeIntegerSetting` with
range bounds (1–168 for cooldowns, 1–50 for batch size, 1–10 for max attempts).
This automatically makes `getDefaultSettings()` include `library` and makes
`normalizeSettingsPatch()` accept and validate `library` updates.

#### B5. Add `library` namespace to `settings-form.js` payload builder

`SETTINGS_FORM_LIBRARY_PAYLOAD_DESIGN.md` completes the payload builder
addition. The `library` namespace is added as a shallow spread
`{ ...form.library }` after `paths` in the payload object, matching the
`security`/`system` pattern for simple key-value namespaces.

### C) New Code

These are new logic additions that don't fit into refactors or code changes.

#### C1. Discovery settings resolver (part of dispatch service)

Covered in A3 above — the `resolveDiscoverySettings` helper is new logic
within the existing dispatch service file.

#### C2. SettingsLibraryView "Discovery scheduling" section

`SETTINGS_LIBRARY_VIEW_DISCOVERY_SCHEDULING_DESIGN.md` completes the frontend
view. The "Coming soon" placeholder is replaced with a functional form using
`useSettingsForm()`. A single card contains the "Discovery scheduling" section
with four number inputs in two side-by-side pairs (cooldowns and
batch/attempts). The `form.library` namespace is added to the shared composable
with defaults matching the server validator (B4).

### D) New Files

#### D1. `test/server/library-discovery-dispatch-settings.test.js`

`DISCOVERY_DISPATCH_SETTINGS_TEST_DESIGN.md` completes the dedicated test file.
13 new tests in 4 groups: `DEFAULT_DISCOVERY_SETTINGS` constant assertions,
`resolveDiscoverySettings` pure resolver unit tests (8), `loadSettingsFn`
injection integration tests (3), and graceful fallback test (1).

#### D2. `test/client/settings-library-view-contract.test.js`

`SETTINGS_LIBRARY_VIEW_CONTRACT_TEST_DESIGN.md` completes the contract test.
8 tests in 4 groups: composable integration (1), state branches (2), form field
wiring (3), and save bar (2).

### E) Test Enhancements

#### E1. Extend `test/server/settings-validator.test.js`

`SETTINGS_VALIDATOR_LIBRARY_TEST_DESIGN.md` confirms E1 is fully satisfied.
B4 already added 6 library tests covering all E1 requirements. E1 adds 1
boundary acceptance test (exact max values) for a total of 7 library tests.

#### E2. Extend `test/client/settings-form.test.js`

`SETTINGS_FORM_LIBRARY_TEST_DESIGN.md` confirms E2 is fully satisfied.
B5 added 1 dedicated library payload test plus updated 2 existing test fixtures
to include library defaults. No additional tests needed.

#### E3. Extend existing dispatch service tests

`DISPATCH_SERVICE_TEST_EXTENSION_DESIGN.md` confirms E3 is fully satisfied.
All 19 existing tests pass without `loadSettingsFn` injection (backward compat
via catch-block fallback). D1's 4 injection tests cover custom settings flow.
No additional tests needed.

---

## Files

| File | Role |
| --- | --- |
| `src/server/validators/settings-validator.js` | Add `library` namespace definition with four normalize functions. |
| `src/server/library/library-discovery-dispatch-service.js` | Accept `loadSettingsFn`, add `resolveDiscoverySettings`, read settings per cycle with graceful fallback, parameterize `buildNextZeroCandidateSchedule`. |
| `src/server/library/library-module.js` | Pass `loadSettingsFn` to dispatch service factory. |
| `src/client/lib/settings-form.js` | Add `library` spread to `buildSettingsUpdatePayload`. |
| `src/client/views/SettingsLibraryView.vue` | Add "Discovery scheduling" section with four fields. |
| `test/server/library-discovery-dispatch-settings.test.js` | New: resolver, settings consumption, backward compatibility. |
| `test/client/settings-library-view-contract.test.js` | New: section visibility, field wiring. |
| `test/server/settings-validator.test.js` | Extend: `library` namespace validation cases. |
| `test/client/settings-form.test.js` | Extend: `library` payload building cases. |
| `test/server/library-discovery-dispatch-service.test.js` | Extend: settings injection backward compatibility. |

## Security

- All settings endpoints already require admin authentication. No new endpoints
  are introduced — the existing `PUT /api/v1/settings` endpoint handles all
  namespace updates.
- Scoring weight validation prevents zero-weight injection (minimum 0.01 floor)
  and enforces a valid sum, preventing an operator from accidentally disabling
  all scoring.
- Retention reduction is a destructive operation (deletes historical data). The
  UI surfaces a helper-text warning, but no additional confirmation gate is
  needed because the backend retention cleanup is a scheduled policy, not an
  immediate delete.

## Validation

- `node --test test/server/settings-validator.test.js` — existing plus new
  `library` cases.
- `node --test test/server/library-discovery-dispatch-settings.test.js` — new
  resolver and consumption tests.
- `node --test test/server/library-discovery-dispatch-service.test.js` —
  extended backward compatibility.
- `node --test test/client/settings-form.test.js` — payload building for
  `library` namespace.
- `node --test test/client/settings-library-view-contract.test.js` — new
  contract assertions.
- `npm run lint` — server and client lint.
- `npm run build` — full build.
- `node scripts/check-copyright.js` — GPL headers on new files.

## Future Design Areas

1. **Reconciliation thresholds as settings.** Currently `matchedTrackCount >=
   expectedTrackCount` is hardcoded. A `reconciliation.matchThreshold` rate
   setting (default 1.0) would allow operators to classify releases as
   "complete" at 90% or 95% coverage instead of requiring 100%.
2. **Organize naming template as settings.** The `Artist/Album (Year)/NN -
   Title.ext` template is hardcoded in `libraryNamingService`. Exposing template
   variables would let operators customize folder structure.
3. **Discovery schedule calendar.** Rather than just cooldown timers, a
   day-of-week / time-of-day schedule would let operators run discovery during
   off-peak hours.
4. **Per-format scoring profiles.** Instead of one global set of weights,
   operators could define named scoring profiles and assign them per monitored
   artist or per format preference.

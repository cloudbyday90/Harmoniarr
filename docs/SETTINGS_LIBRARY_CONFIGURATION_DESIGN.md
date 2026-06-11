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

## Download Scoring Implementation Plan

> Phase 2 of the Settings Library track. Surfaces the eight scoring weights from
> `download-result-scoring.js` as a `scoring` settings namespace, wires the import
> candidate service to read those weights at runtime, adds the frontend collapsed
> section to SettingsLibraryView, and covers all changes with tests.

### Architecture Context

The scoring system ranks download candidates across 8 dimensions using weighted
averaging. Each dimension produces a 0–100 score; weights sum to 1.0 to produce
a composite. Currently the 8 weights are hardcoded in `DEFAULT_SCORERS` inside
`download-result-scoring.js`.

**Key injection point:** `scoreDownloadResult` accepts a `scorers` parameter
(array of `{name, weight, fn}`) defaulting to `DEFAULT_SCORERS`. The import
candidate service calls `scoreDownloadResultFn({...})` at
`import-candidate-service.js:801` without passing `scorers`.

**Wiring chain:**

```
import-candidate-module.js:113
  → createImportCandidateService({...})
    → import-candidate-service.js:801
      → scoreDownloadResultFn({candidate, ...})
        → download-result-scoring.js scoreDownloadResult({..., scorers = DEFAULT_SCORERS})
```

**Difference from Phase 1:** The scoring function is a pure function (not a
long-lived service). The injection happens in `import-candidate-service.js`,
not `library-discovery-dispatch-service.js`. The wiring point is
`import-candidate-module.js:113`, not `library-module.js`.

**New validator challenge:** The `scoring` namespace has a **cross-field sum
constraint** — all 8 weights must sum to 1.0 (±0.02 tolerance). No existing
namespace has a constraint that spans multiple fields. This requires a custom
namespace-level normalize function instead of per-field normalizers.

### A) Refactors

These changes restructure existing code without altering behaviour, so the
import candidate service can accept scoring weights dynamically instead of using
hardcoded defaults.

#### A1. Extract scoring weight defaults to a named constant map

`SCORING_WEIGHT_DEFAULTS_EXTRACTION_DESIGN.md` completes the extraction. The
8 weight values are extracted from `DEFAULT_SCORERS` into a separate exported,
frozen `DEFAULT_SCORING_WEIGHTS` map. A `buildScorersFromWeights(weights)`
helper pairs weights with scorer functions. `DEFAULT_SCORERS` is rebuilt from
the new constant. No behavioural change.

#### A2. Accept `loadSettingsFn` as a constructor dependency in import-candidate-service

`SCORING_SETTINGS_INJECTION_DESIGN.md` completes the injection. The
`createImportCandidateService` factory now accepts `loadSettingsFn = loadSettings`
as a constructor parameter, and `import-candidate-module.js` passes the real
`loadSettings` through. No behavioural change — the parameter is accepted but
not yet consumed.

#### A3. Add `resolveScoringSettings` resolver

`SCORING_SETTINGS_RESOLVER_DESIGN.md` completes the resolver. A pure, exported
`resolveScoringSettings` function projects the `scoring` settings namespace into
a `scorers` array via `buildScorersFromWeights`, falling back to
`DEFAULT_SCORING_WEIGHTS` for missing or invalid individual weights. No sum
constraint in the resolver — the validator (B3) enforces that at persistence.

### B) Code Changes

These changes alter existing files to consume the new scoring settings at
runtime.

#### B1. Read scoring settings per ingestion call

`SCORING_SETTINGS_CONSUMPTION_DESIGN.md` details the design. The scoring loop
in `ingestSlskdSearchResponses` reads scoring settings once per call via the
injected `loadSettingsFn`, resolves through `resolveScoringSettings` (A3), and
passes the `scorers` array to `scoreDownloadResultFn`. Four changes:

1. Import `resolveScoringSettings` from `download-result-scoring.js`.
2. Rename `_loadSettingsFn` → `loadSettingsFn` in factory params (A2 underscore
   no longer accurate — parameter is now consumed).
3. Add settings resolution before scoring loop with try/catch fallback to
   `resolveScoringSettings(undefined)` (produces fully-defaulted scorers).
4. Pass `scorers: effectiveScorers` to `scoreDownloadResultFn`.

Zero behavioural change when settings are absent — the resolver produces
identical scorers to the current hardcoded `DEFAULT_SCORERS`.

#### B2. Wire `loadSettingsFn` through `import-candidate-module.js`

`SCORING_SETTINGS_MODULE_WIRING_DESIGN.md` confirms this step is satisfied.
A2 implemented both the factory parameter and the module wiring together. The
wiring at `import-candidate-module.js:117` (`loadSettingsFn: loadSettings`) with
the corresponding import at line 65 was verified during B1 implementation.
No additional code changes needed.

#### B3. Add `scoring` namespace to the settings validator

`SCORING_NAMESPACE_VALIDATOR_DESIGN.md` details the design. Four decisions:

1. **Per-field validation**: 8 weight fields, each using `normalizeRateSetting`
   with `{min: 0.01, max: 1.0}`. Defaults imported from
   `DEFAULT_SCORING_WEIGHTS` (single source of truth).
2. **Cross-field constraint**: New `namespaceValidators` map (separate from
   `settingDefinitions`). The `scoring` validator checks
   `Math.abs(sum - 1.0) < 0.0001` when all 8 fields are present in the patch.
   Partial patches skip the sum check (per-field validation is the security
   boundary; the scoring algorithm normalizes by `totalWeight`).
3. **Extension point**: `namespaceValidators` is the first cross-field
   validation mechanism in the settings system. Future namespaces can add
   entries without touching `settingDefinitions` or `getDefaultSettings`.
4. **`normalizeSettingsPatch` change**: After per-field processing, group
   updates by namespace and call `namespaceValidators[ns]?.(updates)`.

#### B4. Add `scoring` namespace to `settings-form.js` payload builder

`SCORING_SETTINGS_PAYLOAD_BUILDER_DESIGN.md` details the design. Three changes:

1. `settings-form.js`: Add `scoring: { ...form.scoring }` after `library`.
2. `useSettingsForm.js`: Add `scoring` form defaults (8 weight fields matching
   `DEFAULT_SCORING_WEIGHTS` values — duplicated to avoid client→server import).
3. `useSettingsForm.js`: Add `Object.assign(form.scoring,
   payload.settings.scoring)` in `applySettings`.

Pattern matches `library` exactly. B5 is collapsed into B4 (payload builder and
composable are inseparable — the form can't send what the composable doesn't
initialize).

### C) New Code

#### C1. Scoring settings resolver (part of download-result-scoring.js)

Covered in A3 — the `resolveScoringSettings` helper is new logic within the
existing scoring file.

#### C2. SettingsLibraryView "Download scoring weights" section

`SCORING_SETTINGS_FRONTEND_DESIGN.md` details the design. A separate `hx-card`
after the Discovery card with:

1. **Header**: "Download scoring weights" title with "(advanced)" subtitle.
2. **8 weight inputs** in 4 `hx-form-row` pairs, each with `v-model.number`,
   `type="number"`, `min="0.01"`, `max="1"`, `step="0.01"`.
3. **Live sum indicator**: Computed `scoringSum` with green/danger coloring.
4. **Reset to defaults button**: Restores all 8 weights to `DEFAULT_SCORING_WEIGHTS` values.

### D) New Files

#### D1. `test/server/scoring-settings.test.js`

`SCORING_SETTINGS_TEST_DESIGN.md` details the design. Dedicated test file
covering frozen defaults, resolver unit tests, builder verification, injection
integration tests, and graceful fallback. ~16 tests following the Phase 1
`library-discovery-dispatch-settings.test.js` pattern.

#### D2. Extend `test/client/settings-library-view-contract.test.js`

Add contract tests for the scoring section:

- The "Download scoring weights" section is present in the form branch
- All 8 fields are wired to `form.scoring.*`
- The sum indicator element is present
- The "Reset to defaults" button is present
- The section renders in a collapsed state (if applicable)

### E) Test Enhancements

#### E1. Extend `test/server/settings-validator.test.js`

Add test cases for the `scoring` namespace:

- `normalizeSettingsPatch` accepts all 8 scoring weights in range
- `normalizeSettingsPatch` rejects a weight below 0.01
- `normalizeSettingsPatch` rejects a weight above 1.0
- `normalizeSettingsPatch` rejects non-numeric weight value
- `normalizeSettingsPatch` accepts weights that sum to 1.0
- `normalizeSettingsPatch` rejects weights that do not sum to 1.0 (above tolerance)
- `normalizeSettingsPatch` accepts weights that sum within 0.02 tolerance
- `getDefaultSettings` includes `scoring` with all 8 defaults

#### E2. Extend `test/client/settings-form.test.js`

Add test cases for the `scoring` namespace in `buildSettingsUpdatePayload`:

- Payload includes `scoring` spread when `form.scoring` is present
- `scoring.weightFormatTier` is passed through as-is
- All 8 scoring fields are included in the payload

#### E3. Extend existing import candidate service tests

`SCORING_SETTINGS_INJECTION_TEST_DESIGN.md` details the design. Three tests
added to `test/server/import-candidate-service.test.js`:

1. Custom `loadSettingsFn` returns scoring weights → `scorers` arg has those weights.
2. `loadSettingsFn` returns no scoring namespace → `scorers` arg has default weights.
3. `loadSettingsFn` throws → `scorers` arg has default weights.

---

## Acquisition Policy Implementation Plan

> Phase 3 of the Settings Library track. Surfaces the existing `acquisition` settings
> namespace (2 fields: auto-ignore toggle + cooldown hours) as a card in
> `SettingsLibraryView.vue`. No backend changes needed — the validator, resolver,
> and consumption path are all complete.

### Architecture Context

The `acquisition` namespace already exists with full backend support:

1. **Validator** (`settings-validator.js:282-293`): `autoIgnoreEnabled` (boolean,
   default false) + `autoIgnoreCooldownHours` (integer, 0–8760, default 24).
2. **Resolver** (`source-user-ignore-service.js:24-32`): `resolveAcquisitionSettings`
   projects the raw namespace with fallbacks.
3. **Consumption** (`source-user-ignore-service.js:151`): `evaluateAutoIgnoreForUser`
   reads via injected `loadSettingsFn`, resolves, checks enabled flag, passes to
   `evaluateAutoIgnoreApplication`.
4. **Existing UI** (`ActivityIgnoredView.vue:294-339`): Already surfaces both fields
   in a separate "Auto-apply" card with independent load/save.

**Dual-surface design:** Both `ActivityIgnoredView` and `SettingsLibraryView` will
write to the same `acquisition` namespace. This is safe because both use the same
validated `updateSettings()` API. The Activity view provides context-aware config
(while managing the ignore list); Settings Library provides centralized config.

**No backend work needed:** No refactors, no new resolvers, no injection wiring, no
validator changes. Phase 3 is purely frontend surfacing.

### A) Payload Builder + Composable

These changes add the `acquisition` namespace to the client-side form pipeline.

#### A1. Add `acquisition` spread to `buildSettingsUpdatePayload`

`ACQUISITION_SETTINGS_PAYLOAD_BUILDER_DESIGN.md` completes the payload builder
addition. The `acquisition` namespace is added as a shallow spread
`{ ...form.acquisition }` after `scoring` in the payload object, matching the
`security`/`system`/`library`/`scoring` pattern. The first test fixture was updated
to include `acquisition` in both input and expected output. All 7 tests pass, 0 lint
warnings.

#### A2. Add `acquisition` form defaults to `useSettingsForm.js` composable

`ACQUISITION_SETTINGS_COMPOSABLE_DESIGN.md` completes the composable wiring. Two
changes:

1. Added `acquisition: { autoIgnoreEnabled: false, autoIgnoreCooldownHours: 24 }`
   defaults after `scoring` in the `form` reactive (matching server validator
   defaults at `settings-validator.js:282-293`).
2. Added `Object.assign(form.acquisition, payload.settings.acquisition)` in
   `applySettings` after the `scoring` spread.

Defaults are duplicated (not imported from server) to maintain the client/server
module boundary. All 7 form tests + 14 contract tests pass, 0 lint warnings.

### B) View

#### B1. SettingsLibraryView "Acquisition policy" card

`ACQUISITION_SETTINGS_VIEW_CARD_DESIGN.md` completes the frontend view. A new
`hx-card` between the Discovery and Scoring cards with:

1. **Header**: "Acquisition policy" title, descriptive subtitle.
2. **Toggle**: `cfg-check` checkbox bound to `form.acquisition.autoIgnoreEnabled`.
3. **Cooldown input**: Number input with `:disabled="!form.acquisition.autoIgnoreEnabled"`
   binding, `min="0"`, `max="8760"`, `step="1"`.
4. **Helper text**: Explains auto-ignore behavior and cooldown range.

Uses `:disabled` (not `v-if`) per parent design doc specification — the cooldown
value remains visible and persists in the form for pre-configuration. Native
`<input type="checkbox">` provides built-in accessibility per WAI-ARIA practices.
21/21 tests pass, 0 lint warnings.

### C) Tests

#### C1. Extend `test/client/settings-library-view-contract.test.js`

`ACQUISITION_SETTINGS_CONTRACT_TEST_DESIGN.md` completes the contract tests. 5 new
tests added between Discovery and Scoring sections:

1. Card presence (title + subtitle).
2. Toggle wiring (`form.acquisition.autoIgnoreEnabled`).
3. Cooldown wiring + input constraints (`min="0" max="8760" step="1"`).
4. Disabled binding (`:disabled="!form.acquisition.autoIgnoreEnabled"`).
5. Cooldown field label (`hx-field-label`).

19/19 tests pass (14 existing + 5 new), 0 lint warnings.

#### C2. Extend `test/client/settings-form.test.js`

`ACQUISITION_SETTINGS_PAYLOAD_TEST_DESIGN.md` completes the payload tests. 2 new
tests added after the scoring test:

1. Custom acquisition values (`true`, `48`) pass through correctly.
2. Default acquisition values from `createAcquisitionForm()` pass through correctly.

Both use `assert.deepEqual(payload.acquisition, {...})` namespace-slice pattern.
9/9 form tests pass, 19/19 contract tests pass, 0 lint warnings.

---

## Retention Implementation Plan

> Phase 4 of the Settings Library track. Surfaces the existing `retention` settings
> namespace (3 fields: operation run max age, retain count per type, outcome event
> max age) as a card in `SettingsLibraryView.vue`. No backend changes needed.

### Architecture Context

The `retention` namespace already exists with full backend support:

1. **Validator** (`settings-validator.js:294-313`): Three integer fields with ranges
   (7–3650, 10–1000, 30–3650) and defaults (90, 50, 180).
2. **Resolver** (`ledger-retention-policy.js:53-70`): `resolveLedgerRetentionPolicy`
   with `clampInteger` fallbacks and `ledgerRetentionBounds`.
3. **Consumption** (`ledger-retention-service.js`): Scheduled background cleanup
   that resolves retention policy from settings, computes ISO cutoffs, and deletes
   expired records.
4. **Security posture**: Minimum retention floors enforced by the resolver
   (defense-in-depth). Even if validation is bypassed, values are clamped.

**No backend work needed.** Phase 4 is purely frontend surfacing, following the
exact same pattern as Phase 3 (acquisition).

### A) Payload Builder + Composable

#### A1. Add `retention` spread to `buildSettingsUpdatePayload`

`RETENTION_SETTINGS_FRONTEND_DESIGN.md` details the design. Add
`retention: { ...form.retention }` to the payload object in `settings-form.js`
after `acquisition`.

#### A2. Add `retention` form defaults to `useSettingsForm.js` composable

`RETENTION_SETTINGS_FRONTEND_DESIGN.md` details the design. Two changes:

1. Add `retention` defaults to the `form` reactive: `{ operationRunMaxAgeDays: 90,
   operationRunRetainCountPerType: 50, outcomeEventMaxAgeDays: 180 }`.
2. Add `Object.assign(form.retention, payload.settings.retention)` to
   `applySettings`.

Defaults duplicated (not imported from server) to maintain the client/server module
boundary.

### B) View

#### B1. SettingsLibraryView "Retention" card

`RETENTION_SETTINGS_FRONTEND_DESIGN.md` details the design. A new `hx-card`
between the Acquisition and Scoring cards with:

1. **Header**: "Retention" title, warning subtitle about data deletion.
2. **Operation runs pair**: `hx-form-row` with `operationRunMaxAgeDays` and
   `operationRunRetainCountPerType`.
3. **Outcome events single**: `outcomeEventMaxAgeDays` field.
4. **Warning**: Explicit text about permanent data deletion on next cleanup cycle.

### C) Tests

#### C1. Extend `test/client/settings-library-view-contract.test.js`

`RETENTION_SETTINGS_TEST_DESIGN.md` details the design. 5 contract tests:

1. Card presence (title + warning subtitle).
2. Field wiring (3 fields).
3. Input constraints (min/max/step for each field).
4. Warning text present.
5. Field labels (3 labels).

#### C2. Extend `test/client/settings-form.test.js`

`RETENTION_SETTINGS_TEST_DESIGN.md` details the design. 2 payload tests:

1. Custom retention values pass through.
2. Default retention values pass through.

---

## Files

| File | Role |
| --- | --- |
| `src/server/validators/settings-validator.js` | Add `library` namespace definition with four normalize functions. |
| `src/server/library/library-discovery-dispatch-service.js` | Accept `loadSettingsFn`, add `resolveDiscoverySettings`, read settings per cycle with graceful fallback, parameterize `buildNextZeroCandidateSchedule`. |
| `src/server/library/library-module.js` | Pass `loadSettingsFn` to dispatch service factory. |
| `src/client/lib/settings-form.js` | Add `library` spread to `buildSettingsUpdatePayload`. |
| `src/client/views/SettingsLibraryView.vue` | Add "Discovery scheduling", "Acquisition policy" sections. |
| `src/client/composables/useSettingsForm.js` | Add `acquisition` form defaults + apply spread. |
| `src/client/lib/settings-form.js` | Add `acquisition` spread to payload builder. |
| `test/server/library-discovery-dispatch-settings.test.js` | New: resolver, settings consumption, backward compatibility. |
| `test/client/settings-library-view-contract.test.js` | New: section visibility, field wiring, acquisition tests. |
| `test/server/settings-validator.test.js` | Extend: `library` namespace validation cases. |
| `test/client/settings-form.test.js` | Extend: `library` + `acquisition` payload building cases. |
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

# Acquisition Settings Frontend Design

> Phase 3, step A3 of the Settings Library track. Surfaces the existing `acquisition`
> settings namespace (auto-ignore policy) as a card in `SettingsLibraryView.vue`.

## Problem

The `acquisition` namespace (2 fields) already exists in the validator, database, and
API. The backend resolver (`resolveAcquisitionSettings` in
`source-user-ignore-service.js:24-32`) and consumption path are complete. The operator
needs a UI in the Library settings view to configure these fields alongside the other
library-related settings (discovery scheduling, scoring, retention, fidelity).

**Important context:** `ActivityIgnoredView.vue` already surfaces the same 2 fields
in a separate "Auto-apply" card (lines 294–339). That view uses its own independent
load/save cycle (`loadAutoApply` / `handleSaveAutoApply`) reading from
`fetchSettings()` and writing to `updateSettings({ acquisition: { ... } })`. The
Settings Library view will create a second entry point for the same data. Both views
will read/write the same `acquisition` namespace through the shared settings API.
This is intentional — the Activity Ignored view provides context-aware configuration
(while managing the ignore list), while Settings Library provides centralized
configuration (all library settings in one place).

## Research

### Existing consumption patterns

The `acquisition` namespace is already:

1. **Validated** in `settings-validator.js:282-293`:
   - `autoIgnoreEnabled`: boolean, default `false`
   - `autoIgnoreCooldownHours`: integer, min 0 max 8760, default `24`
2. **Resolved** in `source-user-ignore-service.js:24-32`:
   - `resolveAcquisitionSettings(settings)` projects raw namespace with fallbacks
3. **Consumed** in `evaluateAutoIgnoreForUser` (line 151):
   - Reads via injected `loadSettingsFn`, resolves, checks `autoIgnoreEnabled`,
   - passes settings to `evaluateAutoIgnoreApplication`
4. **Surfaced** in `ActivityIgnoredView.vue:294-339`:
   - Toggle + cooldown input with independent save
   - No `:disabled` binding on cooldown when toggle is off (both always editable)

### Harmoniarr UI conventions

- `.hx-card` + `.hx-card-header` + `.hx-card-body` for card sections.
- `.cfg-check` + `<input type="checkbox" v-model="...">` for boolean toggles
  (used in SettingsConnectionsView, SettingsMediaStorageView, SettingsGeneralView).
- `.hx-form-row` for horizontal field pairs.
- `.hx-field` + `.hx-field-label` + `.hx-input` for individual fields.
- `.cfg-field-hint` for helper text below inputs.

### Toggle+field pattern

The `ActivityIgnoredView.vue` auto-apply card uses a flex-row label pattern for the
toggle:

```html
<label class="hx-field" style="flex-direction: row; align-items: center; gap: var(--hx-space-2)">
  <input v-model="autoApply.enabled" type="checkbox" />
  <span class="hx-field-label" style="margin: 0">Enable automatic ignore</span>
</label>
```

The Settings General view uses the `.cfg-check` class for boolean toggles:

```html
<label class="cfg-check">
  <input type="checkbox" v-model="form.security.secureCookies" />
  Secure cookies
</label>
```

Both are established patterns. For the Library settings view, the `.cfg-check` pattern
matches the other settings views more closely, but the toggle needs a descriptive
label. The ActivityIgnoredView's flex-row label pattern is more appropriate here
because the toggle controls whether the cooldown input is relevant — it benefits from
a clear, standalone label.

## Options Considered

### Decision 1: Disable cooldown when toggle is off

| Option | Pros | Cons |
|---|---|---|
| **A — Disable cooldown when `autoIgnoreEnabled` is false** | Clear UX signal; prevents confusion about inactive settings | Extra `:disabled` binding; cooldown value still persists (valid) |
| **B — Always-enabled cooldown (match ActivityIgnoredView)** | Simpler; consistent with existing surface | Cooldown value is irrelevant when feature is off; operator may be confused |

**Chosen: A.** The parent design doc (`SETTINGS_LIBRARY_CONFIGURATION_DESIGN.md`
section 3) explicitly states "The cooldown input is disabled when `autoIgnoreEnabled`
is false." This provides clear progressive disclosure — the cooldown only becomes
relevant when auto-ignore is enabled. The `ActivityIgnoredView` chose B for its
context (inline with ignore management); the Settings Library view should be more
guarded.

### Decision 2: Card placement

| Option | Pros | Cons |
|---|---|---|
| **A — Between Discovery and Scoring cards** | Logical ordering: scheduling → acquisition → scoring → retention → fidelity | Interleaves "top-level" and "advanced" cards |
| **B — After Scoring card (before Retention)** | Groups "top-level" cards (Discovery, Acquisition) then "advanced" (Scoring, Retention, Fidelity) | Splits acquisition from discovery which are related |

**Chosen: A.** The parent design doc section 7 specifies: Discovery → Acquisition →
Retention → Scoring → Fidelity. Acquisition policy directly follows discovery
scheduling in the operator's mental model (discovery finds candidates, acquisition
filters them).

### Decision 3: Toggle pattern

| Option | Pros | Cons |
|---|---|---|
| **A — `.cfg-check` pattern** | Matches other settings views (General, Connections) | Doesn't clearly separate label from toggle |
| **B — Flex-row label pattern (ActivityIgnoredView)** | Clear toggle+label; visually distinct | Slightly more markup |

**Chosen: A.** The `.cfg-check` pattern is used consistently across all settings views.
The toggle label "Automatically ignore low-reputation source users" is descriptive
enough. Consistency across the Settings workspace outweighs the ActivityIgnoredView's
different context.

## Final Recommendation

Add a third `<article class="hx-card">` between the Discovery and Scoring cards in the
form, with:

1. **Header**: "Acquisition policy" title, descriptive subtitle explaining auto-ignore.
2. **Toggle**: `<label class="cfg-check">` with `v-model="form.acquisition.autoIgnoreEnabled"`
   and label "Automatically ignore low-reputation source users".
3. **Cooldown input**: `hx-form-row` with a single `hx-field` containing `v-model.number`,
   `type="number"`, `min="0"`, `max="8760"`, `step="1"`, with
   `:disabled="!form.acquisition.autoIgnoreEnabled"` binding.
4. **Helper text**: Explains cooldown behavior and range.

### Composable changes (`useSettingsForm.js`)

Add `acquisition` form defaults matching the server validator:

```js
acquisition: {
  autoIgnoreEnabled: false,
  autoIgnoreCooldownHours: 24,
},
```

Add to `applySettings`:
```js
Object.assign(form.acquisition, payload.settings.acquisition);
```

### Payload builder changes (`settings-form.js`)

Add `acquisition` spread to `buildSettingsUpdatePayload`:
```js
acquisition: { ...form.acquisition },
```

### Field specifications

| Key | Label | Type | Min | Max | Step | Default | Disabled when |
|---|---|---|---|---|---|---|---|
| `autoIgnoreEnabled` | (cfg-check label) | checkbox | — | — | — | false | — |
| `autoIgnoreCooldownHours` | Cooldown (hours) | number | 0 | 8760 | 1 | 24 | `!autoIgnoreEnabled` |

### Toggle label text

"Automatically ignore low-reputation source users" — matches the card subtitle and
the ActivityIgnoredView description.

### Helper text

- Toggle: "When enabled, peers flagged by the reputation heuristic are added to the
  ignore list automatically after a cooldown period."
- Cooldown: "Minimum hours between auto-ignore evaluations for the same peer. A longer
  cooldown reduces noise but delays ignoring problematic peers. Default is 24 hours.
  Range: 0–8760 (1 year)."

## Files

| File | Change |
|---|---|
| `src/client/views/SettingsLibraryView.vue` | Add acquisition card between Discovery and Scoring |
| `src/client/composables/useSettingsForm.js` | Add `acquisition` defaults + `applySettings` spread |
| `src/client/lib/settings-form.js` | Add `acquisition` spread to payload builder |
| `test/client/settings-library-view-contract.test.js` | Add acquisition contract tests |
| `test/client/settings-form.test.js` | Add acquisition payload test |

## Security

- The toggle and cooldown are both validated server-side by the `acquisition` namespace
  in `settings-validator.js`. Client constraints are UX-only.
- The cooldown input is disabled when auto-ignore is off, preventing accidental
  configuration of inactive settings.
- The settings API already requires admin authentication. No new endpoints.

## Dual-surface consideration

Both `ActivityIgnoredView` and `SettingsLibraryView` will write to the same
`acquisition` namespace. This is safe because:

1. Both use the same `updateSettings()` API, which goes through
   `normalizeSettingsPatch` (validator).
2. The last write wins — standard settings behavior.
3. The `ActivityIgnoredView` saves only the `acquisition` namespace; the
   `SettingsLibraryView` saves all library namespaces together. There is no partial
   overwrite risk because `normalizeSettingsPatch` processes namespaces independently.

## Outcome

The acquisition policy card gives operators a centralized place to configure auto-ignore
behavior alongside other library settings. The `:disabled` binding on the cooldown input
provides clear progressive disclosure. The dual-surface design (ActivityIgnoredView +
SettingsLibraryView) is safe because both use the same validated API.

## Validation

- `node --test test/client/settings-library-view-contract.test.js` — all existing +
  new acquisition contract tests pass.
- `node --test test/client/settings-form.test.js` — payload includes `acquisition`.
- `npx eslint src/client/views/SettingsLibraryView.vue --max-warnings 0` — no lint
  errors.

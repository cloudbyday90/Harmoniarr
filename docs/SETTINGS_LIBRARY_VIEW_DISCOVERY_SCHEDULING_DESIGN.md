# Settings Library View Discovery Scheduling Design

> Phase C2 of the Settings Library track. This document covers replacing the
> "Coming soon" placeholder in `SettingsLibraryView.vue` with a functional
> discovery scheduling section, and adding the `library` namespace to the
> shared settings form composable.

## Problem

The Settings workspace has a Library tab that currently renders a static
"Coming soon" card. Phases A1–B5 built the entire backend pipeline (defaults
extraction, settings injection, resolver, dispatch consumption, validator,
form payload), but the frontend view still has no form fields.

C2 replaces the placeholder with a functional "Discovery scheduling" section
containing four integer input fields that persist through the settings API.

## Research Baseline

### Settings view architecture

All settings views follow the same pattern (observed in `SettingsGeneralView.vue`
and `SettingsMediaStorageView.vue`):

1. **Composable**: `useSettingsForm()` returns a shared `form` reactive with
   all namespaces, plus `loadSettings`, `saveSettings`, loading/saving/error
   state refs.
2. **Template**: Three states — loading card, error card, `<form>` with fields.
   A `<div class="cfg-save-bar">` at the bottom with save button and messages.
3. **Lifecycle**: `onMounted(() => { void loadSettings(); })` triggers the
   initial fetch.

### CSS class conventions

| Class | Purpose |
| --- | --- |
| `cfg-page` | Root wrapper |
| `hx-card` / `hx-card-header` / `hx-card-body` | Card structure |
| `hx-card-title` / `hx-card-subtitle` | Card heading |
| `cfg-group` / `cfg-group-title` | Field group with border |
| `hx-field` / `hx-field-label` | Individual field |
| `hx-input` | Input styling |
| `cfg-field-hint` | Hint text below field |
| `hx-form-row` | Side-by-side field row |
| `cfg-save-bar` / `cfg-save-msg` | Save button bar |

### Number input pattern

From `SettingsMediaStorageView.vue`:
```html
<input class="hx-input" v-model.number="form.artwork.dailyQuotaLimit"
       type="number" min="1" max="100000" step="1" />
```

The `v-model.number` modifier ensures Vue converts the input to a number. The
`min`/`max` attributes provide browser-native validation and match the server
validator bounds.

### `useSettingsForm.js` form structure

The composable initializes a `reactive({})` at line 36 with all namespaces
hardcoded (artwork, security, system, paths, slskd, providers). The
`applySettings` function (line 106) uses `Object.assign(form.NS, ...)`
to merge server responses into the form.

There is currently **no `form.library`** namespace. C2 adds it.

### OWASP: Client-side input constraints

OWASP recommends that client-side input constraints (HTML `min`/`max`/`step`
attributes) serve as usability aids, not security controls. Server-side
validation is the authoritative gate. The settings architecture follows this:
the browser provides immediate feedback on invalid ranges, while the server
validator (B4) enforces the actual constraints.

## Options Considered

### Decision 1: Scope — Discovery scheduling only vs all 5 sections

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Discovery scheduling only** | Focused scope; matches C2 definition | View is sparse until other sections are added |
| **B — All 5 sections** | Complete view in one pass | Large change; scoring/fidelity are complex |

**Chosen: Option A.** Only the 4 discovery scheduling fields. Future sections
(acquisition, retention, scoring, fidelity) will be added in subsequent phases.

### Decision 2: Layout — Single card vs two-column

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Single card** | Simple; matches SettingsGeneralView pattern | Less visually dense |
| **B — Two-column** | Matches SettingsMediaStorageView pattern | Wasted space with one section |

**Chosen: Option A.** Single card layout. Add two-column when more sections
arrive.

### Decision 3: Field layout — Stacked vs side-by-side pairs

| Option | Pros | Cons |
| --- | --- | --- |
| **A — All 4 fields stacked** | Simple; each field gets full width | Taller form |
| **B — Two `hx-form-row` pairs** | Compact; related fields side-by-side | Narrower inputs on mobile |

**Chosen: Option B.** Pair cooldown fields together and batch/attempts together
using `hx-form-row`, matching the `SettingsMediaStorageView` pattern for
related fields.

## Final Recommendation

### 1. Add `form.library` to `useSettingsForm.js`

Add after the `system` namespace in the form reactive:

```js
library: {
  discoveryCooldownHours: 6,
  discoveryFallbackCooldownHours: 2,
  discoveryBatchSize: 5,
  maxSearchAttempts: 3,
},
```

Add to `applySettings`:

```js
Object.assign(form.library, payload.settings.library);
```

### 2. Replace `SettingsLibraryView.vue`

Follow the `SettingsGeneralView` pattern:

- `<script setup>`: destructure `useSettingsForm()`, call `loadSettings` on
  mount.
- `<template>`: loading state, error state, `<form>` with discovery scheduling
  card.
- Card contains two `hx-form-row` pairs:
  - Automatic cooldown / Fallback cooldown (side-by-side)
  - Batch size / Max search attempts (side-by-side)
- Standard `cfg-save-bar` at bottom.

### 3. Input field specifications

| Field | v-model | type | min | max | step |
| --- | --- | --- | --- | --- | --- |
| Automatic cooldown (hours) | `form.library.discoveryCooldownHours` | number | 1 | 168 | 1 |
| Fallback cooldown (hours) | `form.library.discoveryFallbackCooldownHours` | number | 1 | 168 | 1 |
| Batch size | `form.library.discoveryBatchSize` | number | 1 | 50 | 1 |
| Max search attempts | `form.library.maxSearchAttempts` | number | 1 | 10 | 1 |

## Files

| File | Role |
| --- | --- |
| `src/client/composables/useSettingsForm.js` | Add `form.library` namespace and `applySettings` handling. |
| `src/client/views/SettingsLibraryView.vue` | Replace placeholder with functional form view. |

## Security

- All input fields use `type="number"` with `min`/`max` attributes matching the
  server validator bounds. These are usability constraints, not security
  controls.
- Server-side validation (B4) is the authoritative gate — `normalizeIntegerSetting`
  rejects non-integers and out-of-range values.
- The settings API endpoint requires admin authentication.
- No secrets, no URLs, no SQL, no file paths in the `library` namespace.

## Outcome

After C2, operators can navigate to Settings → Library and adjust discovery
scheduling parameters. Changes persist through the settings API, validated by
the server, and applied by the dispatch service on the next heartbeat cycle.

The view is structured to accommodate future sections (acquisition, retention,
scoring, fidelity) by adding more cards or field groups.

## Validation

- `npm run lint` — no lint errors.
- `npm run build:server` — server build succeeds.
- Manual: navigate to Settings → Library, verify fields display with correct
  defaults, adjust values, save, reload, verify persistence.

# Acquisition Settings View Card Design

> Phase 3, step B1 of the Settings Library track. Adds the "Acquisition policy"
> card to `SettingsLibraryView.vue` with a boolean toggle and a conditionally
> disabled cooldown input.

## Problem

Steps A1 (payload builder) and A2 (composable defaults) established the data
pipeline for the `acquisition` namespace. The operator now needs a visible card in
the Library settings view with:

1. A boolean toggle for enabling auto-ignore.
2. A cooldown hours input that is disabled when auto-ignore is off.
3. Descriptive labels and helper text.

## Research

### Vue.js: Checkbox form binding

From the Vue.js Guide ("Form Input Bindings"):

> For single checkboxes, `v-model` can bind to a boolean value. The checkbox will
> be checked if the bound property is true, and unchecked if it's false.

And for the `:disabled` pattern:

> Use `v-bind` to conditionally include boolean attributes like `disabled`. The
> attribute is included if the bound value is truthy.

Applied: `v-model="form.acquisition.autoIgnoreEnabled"` produces a boolean.
`:disabled="!form.acquisition.autoIgnoreEnabled"` disables the cooldown input
when the toggle is off.

### WAI-ARIA: Checkbox accessibility

From the WAI-ARIA Authoring Practices Guide ("Checkbox Pattern"):

- Native `<input type="checkbox">` elements provide built-in accessibility
  (keyboard support via Space, screen reader announcements via `aria-checked`).
- The guide recommends using native HTML checkboxes over custom ARIA checkbox
  widgets when possible, as they require no additional JavaScript for keyboard
  interaction.

Applied: Using native `<input type="checkbox">` with `v-model` is the most
accessible approach. No custom ARIA roles needed.

### Existing codebase patterns

Three relevant toggle+dependent-field patterns exist in the codebase:

**Pattern A: `v-if` conditional rendering** (`SettingsMediaStorageView.vue:162-166`):
```html
<label class="cfg-check">
  <input type="checkbox" v-model="form.artwork.fetchEnabled" />
  <span>Download cover art from the internet</span>
</label>
<div class="hx-field" v-if="form.artwork.fetchEnabled">
  <!-- dependent fields shown only when enabled -->
</div>
```
Dependent fields are **removed from the DOM** when the toggle is off. Progressive
disclosure — the operator doesn't see irrelevant options.

**Pattern B: `:disabled` binding** (`SettingsConnectionsView.vue:111`):
```html
<input class="hx-input" v-model="form.slskd.apiKey" type="password"
  :disabled="form.slskd.clearApiKey" />
```
The field stays visible but is greyed out and non-interactive. The value is still
in the form and sent in the payload.

**Pattern C: Always-enabled** (`ActivityIgnoredView.vue:314-326`):
The cooldown input is always visible and always enabled (only disabled during
load/save operations). No conditional based on the toggle state.

### Design system conventions

From the `harmoniarr-ui` skill and existing settings views:

- `.hx-card` + `.hx-card-header` + `.hx-card-body` for card sections.
- `.cfg-check` + `<input type="checkbox" v-model="...">` + `<span>label</span>` for boolean toggles.
- `.hx-field` + `.hx-field-label` + `.hx-input` for labeled inputs.
- `.cfg-field-hint` for helper text below inputs.
- `.hx-form-row` for horizontal field pairs.

## Options Considered

### Decision 1: Disable vs hide the cooldown when toggle is off

| Option | Pros | Cons |
|---|---|---|
| **A — `:disabled="!form.acquisition.autoIgnoreEnabled"`** | Field stays visible (operator sees the configured value); parent design doc explicitly specifies "disabled"; value persists in form and payload (pre-configuration) | Visually greyed out; operator may wonder why it's disabled without reading the toggle |
| **B — `v-if="form.acquisition.autoIgnoreEnabled"` (hide)** | Cleaner progressive disclosure (matches `SettingsMediaStorageView` pattern); no disabled-state confusion | Field disappears — operator can't see the configured cooldown while auto-ignore is off; diverges from parent design doc; value not in DOM (but still in reactive form) |
| **C — Always-enabled (match `ActivityIgnoredView`)** | Simplest; consistent with existing auto-apply surface | Cooldown value is irrelevant when feature is off; parent design doc specifies disabled |

**Chosen: A.** The parent design doc (`SETTINGS_LIBRARY_CONFIGURATION_DESIGN.md`
section 3) explicitly states: "The cooldown input is disabled when
`autoIgnoreEnabled` is false." Using `:disabled` ensures:

1. The operator can always see the configured cooldown value.
2. The value persists in the reactive form and is included in the save payload
   (pre-configuring for when the toggle is turned on).
3. The server validates both fields regardless — the disabled state is UX-only.

### Decision 2: Toggle label pattern

| Option | Pros | Cons |
|---|---|---|
| **A — `.cfg-check` with `<span>` label** | Matches all other settings views (General, Connections, Media Storage); consistent; compact | — |
| **B — Flex-row label (ActivityIgnoredView pattern)** | Clear standalone label | Diverges from settings view convention; more inline styles |

**Chosen: A.** The `.cfg-check` pattern is used consistently across all settings
views. The `ActivityIgnoredView` uses a different pattern because it's not in the
Settings workspace.

### Decision 3: Card placement

| Option | Pros | Cons |
|---|---|---|
| **A — Between Discovery and Scoring cards** | Logical ordering: scheduling → acquisition → scoring; matches parent doc section 7 | — |
| **B — After Scoring card** | Groups "top-level" then "advanced" | Splits acquisition from discovery |

**Chosen: A.** Per parent design doc section 7 ordering: Discovery → Acquisition →
Scoring.

### Decision 4: Cooldown layout

| Option | Pros | Cons |
|---|---|---|
| **A — Full-width single field (no `hx-form-row`)** | Only one field; no need for row pairing; simpler | — |
| **B — `hx-form-row` with one field** | Consistent with Discovery card (uses `hx-form-row` for pairs) | Wasted horizontal space; odd with one field in a row |

**Chosen: A.** The cooldown is a single field. `hx-form-row` is for pairing two
fields side by side. A single field in a row wastes space and looks unbalanced.
The `hx-field` block pattern matches how the Discovery card uses `hx-field` inside
`hx-form-row` — a standalone `hx-field` without a row is standard.

## Final Recommendation

Add a new `<article class="hx-card">` between the Discovery card (ends at line 112)
and the Scoring card (starts at line 114) with:

1. **Header**: "Acquisition policy" title, descriptive subtitle about auto-ignore.
2. **Toggle**: `<label class="cfg-check">` with checkbox bound to
   `form.acquisition.autoIgnoreEnabled` and label text "Automatically ignore
   low-reputation source users".
3. **Helper text**: Explains what auto-ignore does and when it triggers.
4. **Cooldown input**: `<div class="hx-field">` with `v-model.number`,
   `type="number"`, `min="0"`, `max="8760"`, `step="1"`,
   `:disabled="!form.acquisition.autoIgnoreEnabled"`.
5. **Cooldown helper text**: Explains the range and default.

### Card structure

```html
<article class="hx-card">
  <header class="hx-card-header">
    <div>
      <h3 class="hx-card-title">Acquisition policy</h3>
      <p class="hx-card-subtitle">...</p>
    </div>
  </header>
  <div class="hx-card-body">
    <div class="cfg-group" style="padding-top: 0; border-top: none">
      <label class="cfg-check">
        <input type="checkbox" v-model="form.acquisition.autoIgnoreEnabled" />
        <span>Automatically ignore low-reputation source users</span>
      </label>
      <p class="cfg-field-hint">...</p>
      <div class="hx-field">
        <label class="hx-field-label">Cooldown (hours)</label>
        <input class="hx-input" v-model.number="form.acquisition.autoIgnoreCooldownHours"
          type="number" min="0" max="8760" step="1"
          :disabled="!form.acquisition.autoIgnoreEnabled" />
        <p class="cfg-field-hint">...</p>
      </div>
    </div>
  </div>
</article>
```

### Label and helper text

| Element | Text |
|---|---|
| Card title | Acquisition policy |
| Card subtitle | Control how Harmoniarr handles source users with poor delivery records. When enabled, peers flagged by the reputation heuristic are added to the ignore list automatically. |
| Toggle label | Automatically ignore low-reputation source users |
| Toggle hint | When enabled, Harmoniarr evaluates each source user's reputation after recording delivery outcomes. Peers that exceed the failure threshold are added to the ignore list after the cooldown period elapses. |
| Cooldown label | Cooldown (hours) |
| Cooldown hint | Minimum hours between auto-ignore evaluations for the same peer. A longer cooldown reduces noise but delays ignoring problematic peers. Default is 24 hours. Range: 0–8760 (1 year). |

## Files

| File | Change |
|---|---|
| `src/client/views/SettingsLibraryView.vue` | Add Acquisition policy card between Discovery and Scoring |

## Security

- **`:disabled` is UX-only**: The cooldown value is still in the reactive form and
  included in the save payload even when the toggle is off. The server validator
  validates both fields independently. Disabling the input prevents accidental
  changes, not malicious ones.
- **Server-side validation is authoritative**: `settings-validator.js:282-293`
  validates `autoIgnoreEnabled` as boolean and `autoIgnoreCooldownHours` as integer
  (0–8760). Client `min`/`max` attributes are UX guardrails.
- **No secret fields**: No API keys or credentials in this namespace.
- **Native checkbox**: Uses native `<input type="checkbox">` for built-in
  accessibility (keyboard support, screen reader announcements). No custom ARIA
  roles needed per WAI-ARIA practices guide.

## Outcome

The Acquisition policy card was added between the Discovery and Scoring cards in
`SettingsLibraryView.vue` (lines 114–135). The card includes:

1. **Header**: "Acquisition policy" title with descriptive subtitle.
2. **Toggle**: `cfg-check` checkbox bound to `form.acquisition.autoIgnoreEnabled`.
3. **Helper text**: Explains auto-ignore evaluation behavior.
4. **Cooldown input**: Number input with `:disabled="!form.acquisition.autoIgnoreEnabled"`,
   `min="0"`, `max="8760"`, `step="1"`.
5. **Cooldown helper text**: Explains range and default.

The `:disabled` binding follows the parent design doc specification. The
`cfg-check` pattern matches all other settings views. Native `<input type="checkbox">`
provides built-in accessibility per WAI-ARIA practices.

21/21 tests pass (14 contract + 7 form), 0 lint warnings.

## Validation

- `node --test test/client/settings-library-view-contract.test.js` — all existing
  + new acquisition contract tests pass (C1 will add them).
- `npx eslint src/client/views/SettingsLibraryView.vue --max-warnings 0` — no lint
  errors.

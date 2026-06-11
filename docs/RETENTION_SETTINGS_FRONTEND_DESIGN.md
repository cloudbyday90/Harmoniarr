# Retention Settings Frontend Design

> Phase 4 of the Settings Library track. Surfaces the existing `retention` settings
> namespace (3 fields) as a card in `SettingsLibraryView.vue`. No backend changes
> needed — the validator, resolver, and consumption path are all complete.

## Problem

The `retention` namespace (3 fields) already exists in the validator, database, API,
and backend consumption path (`ledger-retention-policy.js` and
`ledger-retention-service.js`). The operator needs a UI in the Library settings view
to configure retention policy. Reducing retention values is a **destructive
operation** — historical data beyond the new cutoff is permanently deleted.

## Research

### Vue.js: Form integer input bindings

From the Vue.js Guide ("Form Input Bindings"):

> The `.number` modifier automatically typecasts user input into a number. This
> modifier is applied automatically when the input type is set to `number`.

Applied: All 3 retention fields use `v-model.number` with `type="number"` and
appropriate `min`/`max`/`step` attributes.

### NN/g: Destructive action UX best practices

From "A UX guide to destructive actions" (Medium/Design Bootcamp, citing NN/g
research on loss aversion and confirmation dialogs):

**Before the action — increase visibility:**

- **Highlight the destructive action**: Use warning-tone styling to draw attention.
- **Improve microcopy**: Use clear, outcome-focused labels that communicate
  consequences.

**During the action — increase friction:**

- **Visualize the outcome**: Ensure the user understands the impacts. Communicate
  if the action is irreversible.
- **Be explicit about what will be lost** if the user continues.

**Assessment heuristics:**

- **Reversibility**: Irreversible actions need more friction (confirmation steps).
- **Complexity**: Actions causing serious long-term damage need confirmation.
- **Frequency**: Infrequent actions benefit from confirmation; frequent actions
  should minimize friction.

Applied to retention: Reducing retention values is **irreversible** (deleted data
cannot be recovered) and **infrequent** (operators rarely change retention). The
appropriate UX response is a **warning helper text** that explicitly states data
will be deleted — not a confirmation dialog. The parent design doc
(`SETTINGS_LIBRARY_CONFIGURATION_DESIGN.md` section 4) specifies:

> The UI surfaces a helper-text warning, but no additional confirmation gate is
> needed because the backend retention cleanup is a scheduled policy, not an
> immediate delete.

This is the correct threshold: the cleanup is a scheduled policy (not triggered on
save), which provides a natural "digital fuse" — the operator can increase the value
again before the next cleanup cycle runs.

### NN/g: Form design — structure and grouping

From "4 Principles to Reduce Cognitive Load in Forms" (NN/g, July 2025):

- **Group related fields**: Grouping related questions into sections makes forms
  feel more manageable.
- **Add clear, descriptive headings**: Section headings provide a helpful preview
  and reduce cognitive load by establishing context.
- **Use helpful constraints**: Proactive constraints (min/max on inputs) prevent
  users from making costly mistakes.

Applied: The 3 retention fields are grouped into a single `cfg-group` with a clear
heading. Input `min`/`max` attributes match the server validator ranges, providing
client-side constraints that prevent obviously invalid values.

### WAI-ARIA: Describing inputs with `aria-describedby`

From the Vue.js accessibility guide and WAI-ARIA practices:

> Use `aria-describedby` to provide additional context or criteria for an input
> field by linking to a descriptive paragraph.

Applied: The warning helper text should be visually distinct (using
`style="color: var(--hx-warning)"` or similar) but does not need
`aria-describedby` linking since it's a static hint below the section heading, not
a per-field description.

### OWASP: Data retention and deletion

From the OWASP Multi-Tenant Security Cheat Sheet:

> Establish clear data retention and deletion policies. Enforce policies for data
> retention and deletion.

The backend `ledger-retention-policy.js` already enforces minimum retention floors
via `clampInteger` with `ledgerRetentionBounds`. Even if an operator sets a value
below the minimum, the resolver clamps it to the safe floor. The UI warning is an
additional UX layer, not a security boundary.

### Existing codebase patterns

**Retention backend** (`ledger-retention-policy.js`):

- `resolveLedgerRetentionPolicy(settings)` — resolver with clamping and fallbacks.
- `ledgerRetentionBounds` — frozen defaults and bounds (matching validator ranges).
- `resolveRetentionCutoffIso(maxAgeDays, now)` — converts max-age to ISO cutoff.

The resolver is already complete and tested. Phase 4 is purely frontend surfacing.

**Acquisition card pattern** (Phase 3, just completed):

- `hx-card` + `hx-card-header` + `hx-card-body`.
- `cfg-group` with `padding-top: 0; border-top: none` for first group.
- `hx-field` + `hx-field-label` + `hx-input` for individual fields.
- `cfg-field-hint` for helper text.
- `hx-form-row` for horizontal field pairs.

**Discovery card pattern** (Phase 1): 4 fields in 2 `hx-form-row` pairs.

Retention has 3 fields. The natural grouping is 2 fields in one row
(operation run fields) + 1 field in a second row (outcome events).

## Options Considered

### Decision 1: Destructive operation warning

| Option | Pros | Cons |
|---|---|---|
| **A — Warning helper text in card subtitle** | Non-intrusive; matches parent design doc; always visible; no extra click | Operator may gloss over it |
| **B — Warning helper text + `hx-pill` badge "caution"** | Visual prominence; matches scoring's "advanced" badge pattern | Adds visual noise |
| **C — Confirmation dialog on save when retention decreased** | Maximum safety; matches NN/g guidance for irreversible actions | Parent design doc explicitly says "no additional confirmation gate"; over-engineering for a scheduled policy |

**Chosen: A.** The parent design doc section 4 explicitly states "no additional
confirmation gate is needed." A warning in the card subtitle that explicitly states
"data will be permanently deleted" is the right level of friction. The backend's
scheduled cleanup provides a natural "digital fuse" — the operator can increase the
value again before the next cycle.

### Decision 2: Field layout

| Option | Pros | Cons |
|---|---|---|
| **A — 2 rows: pair + single** | Operation run fields (max age + retain count) are logically paired; outcome events is a separate concern | Slightly uneven rows |
| **B — 3 singles (no `hx-form-row`)** | Uniform; simple | Wastes horizontal space; doesn't leverage the pairing pattern |
| **C — Single row of 3** | Compact | Labels won't fit on mobile; violates single-column research |

**Chosen: A.** `operationRunMaxAgeDays` and `operationRunRetainCountPerType` are
both about operation runs — they form a natural pair. `outcomeEventMaxAgeDays` is a
different data type (outcome events) and belongs in its own row.

### Decision 3: Card placement

| Option | Pros | Cons |
|---|---|---|
| **A — After Acquisition card, before Scoring card** | Matches parent doc section 7 ordering (Discovery → Acquisition → Retention → Scoring → Fidelity) | — |
| **B — After Scoring card** | Groups "advanced" cards together | Breaks parent doc ordering |

**Chosen: A.** Per parent design doc section 7 ordering.

### Decision 4: Warning text location

| Option | Pros | Cons |
|---|---|---|
| **A — In the card subtitle** | Always visible; precedes all fields; matches acquisition pattern | May be long for a subtitle |
| **B — As a `cfg-field-hint` after the section heading** | More room for text; separate from subtitle | Could be confused with per-field hints |

**Chosen: A.** The warning is the most important piece of information in the card —
it should be in the subtitle, visible before the operator starts changing values.
The text will be concise: "Control how long Harmoniarr retains historical operation
data. Reducing these values will permanently delete older records on the next cleanup
cycle."

## Final Recommendation

Add a new `<article class="hx-card">` after the Acquisition card and before the
Scoring card with:

1. **Header**: "Retention" title, warning subtitle about data deletion.
2. **Operation runs group**: `cfg-group` with `hx-form-row` pair:
   - `operationRunMaxAgeDays` (integer, 7–3650, default 90)
   - `operationRunRetainCountPerType` (integer, 10–1000, default 50)
3. **Outcome events group**: `cfg-group` with single field:
   - `outcomeEventMaxAgeDays` (integer, 30–3650, default 180)

### Composable changes (`useSettingsForm.js`)

Add `retention` form defaults:
```js
retention: {
  operationRunMaxAgeDays: 90,
  operationRunRetainCountPerType: 50,
  outcomeEventMaxAgeDays: 180,
},
```

Add to `applySettings`:
```js
Object.assign(form.retention, payload.settings.retention);
```

### Payload builder changes (`settings-form.js`)

Add `retention` spread:
```js
retention: { ...form.retention },
```

### Field specifications

| Key | Label | Type | Min | Max | Step | Default |
|---|---|---|---|---|---|---|
| `operationRunMaxAgeDays` | Operation run max age (days) | number | 7 | 3650 | 1 | 90 |
| `operationRunRetainCountPerType` | Retain count per type | number | 10 | 1000 | 1 | 50 |
| `outcomeEventMaxAgeDays` | Outcome event max age (days) | number | 30 | 3650 | 1 | 180 |

### Label and helper text

| Element | Text |
|---|---|
| Card title | Retention |
| Card subtitle | Control how long Harmoniarr retains historical operation data. Reducing these values will permanently delete older records on the next cleanup cycle. |
| `operationRunMaxAgeDays` label | Operation run max age (days) |
| `operationRunMaxAgeDays` hint | Operation runs older than this are eligible for cleanup. Default is 90 days. Range: 7–3650. |
| `operationRunRetainCountPerType` label | Retain count per type |
| `operationRunRetainCountPerType` hint | Maximum operation runs to keep per type, regardless of age. Default is 50. Range: 10–1000. |
| `outcomeEventMaxAgeDays` label | Outcome event max age (days) |
| `outcomeEventMaxAgeDays` hint | Delivery outcome events older than this are eligible for cleanup. Default is 180 days. Range: 30–3650. |

## Files

| File | Change |
|---|---|
| `src/client/views/SettingsLibraryView.vue` | Add Retention card between Acquisition and Scoring |
| `src/client/composables/useSettingsForm.js` | Add `retention` defaults + `applySettings` spread |
| `src/client/lib/settings-form.js` | Add `retention` spread to payload builder |
| `test/client/settings-library-view-contract.test.js` | Add retention contract tests |
| `test/client/settings-form.test.js` | Add retention payload tests |

## Security

- **Destructive operation warning**: The card subtitle explicitly warns that reducing
  values permanently deletes data. This follows NN/g guidance for making outcomes
  "crystal clear before anything happens."
- **Server-side clamping**: `ledger-retention-policy.js` applies `clampInteger` with
  minimum floors (7, 10, 30 days). Even if a client sends values below the minimum,
  the resolver clamps to safe floors. The UI `min` attributes are UX guardrails.
- **Scheduled policy**: Retention cleanup is a scheduled background job, not
  triggered on save. This provides a natural "digital fuse" — the operator can
  increase values again before the next cleanup cycle.
- **No confirmation dialog needed**: Per parent design doc section 4 — the backend
  cleanup is a scheduled policy, not an immediate delete.

## Outcome

(To be filled after implementation.)

## Validation

- `node --test test/client/settings-library-view-contract.test.js` — all tests pass.
- `node --test test/client/settings-form.test.js` — all tests pass.
- `npx eslint src/client/views/SettingsLibraryView.vue --max-warnings 0` — no lint
  errors.

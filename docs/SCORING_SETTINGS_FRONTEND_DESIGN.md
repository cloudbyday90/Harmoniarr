# Scoring Settings Frontend Design

> Phase 2, step C2 of the Settings Library track. This document covers adding a
> "Download scoring weights" card to `SettingsLibraryView.vue` with 8 weight
> inputs, a live sum indicator, and a reset-to-defaults button.

## Problem

The backend pipeline (A1–B4) can read, validate, and persist scoring weights,
but the operator has no UI to configure them. The Settings Library view needs a
scoring section that:

1. Shows 8 weight inputs with proper constraints.
2. Displays a live sum indicator so operators can verify weights total 1.0.
3. Provides a one-click reset to defaults.

## Research

### Vue.js best practices (as of May 2026)

- `v-model.number` with `type="number"` for numeric inputs (Vue.js guide:
  "automatically typecasts user input into a number").
- Semantic forms: `<form>`, `<label>`, `<input>` for accessibility.
- `v-model` is applied automatically when `type="number"` is set.

### Harmoniarr UI conventions

From the `harmoniarr-ui` skill:
- `.hx-card` + `.hx-card-header` + `.hx-card-body` for card sections.
- `.hx-form-row` for horizontal field pairs.
- `.hx-field` + `.hx-field-label` + `.hx-input` for individual fields.
- `.cfg-group` + `.cfg-group-title` for sectioned content within a card.
- `.cfg-field-hint` for helper text below inputs.

### Existing pattern

The Discovery scheduling card uses:
- `<article class="hx-card">` with header + body
- Two `cfg-group` sections (Cooldown timers, Search limits)
- `hx-form-row` pairs with `v-model.number` inputs
- `min`, `max`, `step` HTML attributes matching validator ranges

## Options Considered

### Decision 1: Card structure

| Option | Pros | Cons |
|---|---|---|
| **A — Separate `hx-card` after Discovery** | Visual separation; distinct concern; follows pattern | More vertical space |
| **B — `cfg-group` inside the Discovery card** | Compact | Conceptually different feature mixed in |

**Chosen: A.** Scoring is a distinct concern from scheduling.

### Decision 2: Sum indicator

| Option | Pros | Cons |
|---|---|---|
| **A — Computed `scoringSum` + conditional class** | Live reactive feedback; matches design spec | Extra computed property |
| **B — No indicator (server rejects)** | Simpler | Poor UX |

**Chosen: A.** The parent design doc explicitly calls for a live sum indicator
with green/red coloring.

### Decision 3: Reset to defaults

| Option | Pros | Cons |
|---|---|---|
| **A — `resetScoringDefaults()` function** | One-click restore | Extra function |
| **B — No reset** | No code | Requires page reload |

**Chosen: A.** Inline function that assigns default values to `form.scoring`.

### Decision 4: Input layout

| Option | Pros | Cons |
|---|---|---|
| **A — 4 rows of 2 columns (`hx-form-row`)** | Matches Discovery layout; consistent | Tall but standard |
| **B — 2 rows of 4 columns** | Compact | Labels won't fit on mobile |
| **C — Grouped rows** | Semantic grouping | More markup for unclear benefit |

**Chosen: A.** 4 rows of 2 columns, ordered by importance.

## Final Recommendation

Add a second `<article class="hx-card">` after the Discovery card in the form,
with:

1. **Header**: "Download scoring weights" title, "(advanced)" badge in subtitle,
   descriptive text explaining what weights control.
2. **4 `hx-form-row` pairs** (8 total fields), each with `v-model.number`,
   `type="number"`, `min="0.01"`, `max="1"`, `step="0.01"`:
   - Format tier / Candidate track match
   - Audio depth / Duration
   - Format consistency / Track count
   - Peer delivery / Uploader reputation
3. **Sum indicator row**: Computed `scoringSum` displayed with conditional
   coloring (green if ±0.0001 of 1.0, danger otherwise).
4. **Reset button**: `<button type="button">` that calls `resetScoringDefaults()`.
5. **Script**: Add `computed` import, `scoringSum` computed, `resetScoringDefaults`
   function, and `SCORING_WEIGHT_DEFAULTS` constant.

### Weight labels

| Key | Label | Hint |
|---|---|---|
| `weightFormatTier` | Format tier | How much the file format (FLAC vs MP3) matters |
| `weightCandidateTrackMatch` | Track match | How much matching expected track titles matters |
| `weightAudioDepth` | Audio depth | How much audio bit depth/sample rate matters |
| `weightDuration` | Duration | How much matching expected album duration matters |
| `weightFormatConsistency` | Format consistency | How much uniform file formats across the candidate matters |
| `weightTrackCount` | Track count | How much matching expected track count matters |
| `weightPeerDelivery` | Peer delivery | How much the uploader's connection quality matters |
| `weightUploaderReputation` | Uploader reputation | How much the uploader's historical reliability matters |

## Files

| File | Change |
|---|---|
| `src/client/views/SettingsLibraryView.vue` | Add scoring card, computed, reset function |
| `test/client/settings-library-view-contract.test.js` | Add scoring contract tests |

## Security

- All inputs use `type="number"` with `min` and `max` constraints matching the
  server validator (0.01–1.0). This provides client-side guardrails.
- Server-side validation (B3) is the authoritative boundary. Client constraints
  are UX-only.
- The reset button restores hardcoded default values — no external data source.
- `v-model.number` ensures values are numeric before submission.

## Outcome

The scoring section provides operators with a clear, accessible interface for
configuring download scoring weights. The live sum indicator prevents accidental
non-1.0 submissions. The reset button provides a safe escape hatch.

## Validation

- `node --test test/client/settings-library-view-contract.test.js` — all
  existing + new scoring contract tests pass.
- `npx eslint src/client/views/SettingsLibraryView.vue --max-warnings 0`
  — no lint errors.

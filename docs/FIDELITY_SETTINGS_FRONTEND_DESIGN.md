# Fidelity Settings Frontend Design

> Phase 5 of the Settings Library track. Surfaces the existing `fidelity` settings
> namespace (9 fields: 4 spectral analysis integers + 3 source trust integers + 2
> source trust rates) as a card in `SettingsLibraryView.vue`. No backend changes
> needed.

## Research

### Progressive disclosure (NN/g)

NN/g research recommends deferring advanced or rarely-used features behind
progressive disclosure. Fidelity thresholds are expert-level settings that most
operators never change. The card is marked "(advanced)" with an `hx-pill` badge
(matching the Scoring card pattern) but remains always visible (no `v-if`
collapse), consistent with the Phase 2 scoring implementation.

### Vue input binding for mixed types

Integer fields use `v-model.number` with `type="number"`, `step="100"` (spectral
Hz values are large enough that step=1 would be tedious). Rate fields use
`step="0.01"`. Both use `min`/`max` HTML attributes matching the server
validator ranges as a first-pass UX guard.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Card visibility | Always visible, "(advanced)" badge | Matches Scoring card; no collapse mechanism in existing codebase |
| Spectral step | `step="100"` | Hz values range 4000–192000; step=1 is impractical |
| Rate step | `step="0.01"` | Matches scoring weight pattern |
| Layout | 2 sub-groups: "Spectral analysis" (2 pairs) + "Source trust" (2 pairs + 1 single) | Logical grouping per parent doc section 5 |
| Field order within trust sub-group | Watch criteria first, then healthy criteria | Users configure "when to watch" before "when to trust" |

## Implementation

### A1. Payload builder (`settings-form.js`)

Added `fidelity: { ...form.fidelity }` after `retention` in the payload object.
Shallow spread matches `security`/`system`/`library`/`scoring`/`acquisition`/`retention`
pattern. Server `normalizeSettingsPatch` allowlist is the authoritative security
boundary.

### A2. Composable (`useSettingsForm.js`)

Two changes:

1. Added `fidelity` defaults to the `form` reactive (9 fields matching server
   validator defaults at `settings-validator.js:379-434`).
2. Added `Object.assign(form.fidelity, payload.settings.fidelity)` to
   `applySettings` after the `retention` spread.

Defaults duplicated (not imported from server) to maintain the client/server
module boundary.

### B1. View card (`SettingsLibraryView.vue`)

New `hx-card` after the Scoring card (before the save bar) with:

1. **Header**: "Fidelity thresholds" title with `(advanced)` `hx-pill` badge.
2. **Spectral analysis sub-group**: 4 integer fields in 2 `hx-form-row` pairs.
3. **Source trust sub-group**: 5 fields (3 integers + 2 rates) in 2 pairs + 1
   single.

#### Spectral analysis fields

| Field | Label | Min | Max | Step | Default |
| --- | --- | --- | --- | --- | --- |
| `spectralAuthenticMinCutoffHz` | Authentic cutoff (Hz) | 10000 | 24000 | 100 | 20000 |
| `spectralSuspiciousMinCutoffHz` | Suspicious cutoff (Hz) | 8000 | 24000 | 100 | 19000 |
| `spectralTranscodeMidCutoffHz` | Transcode cutoff (Hz) | 4000 | 24000 | 100 | 16000 |
| `spectralMinSampleRateHz` | Min sample rate (Hz) | 8000 | 192000 | 100 | 44100 |

#### Source trust fields

| Field | Label | Min | Max | Step | Default |
| --- | --- | --- | --- | --- | --- |
| `trustWatchFailureCount` | Watch failure count | 1 | 100 | 1 | 3 |
| `trustWatchMaxSuccessRate` | Watch max success rate | 0 | 1 | 0.01 | 0.5 |
| `trustWatchEvidenceCount` | Watch evidence count | 1 | 1000 | 1 | 3 |
| `trustHealthyEvidenceCount` | Healthy evidence count | 1 | 1000 | 1 | 5 |
| `trustHealthyMinSuccessRate` | Healthy min success rate | 0 | 1 | 0.01 | 0.8 |

## Outcome

42 tests pass (13 form + 29 contract), 0 lint warnings. The Fidelity thresholds
card is the final card in the Library settings view, completing the 5-phase
Settings Library Configuration track.

Quality review (`FIDELITY_SETTINGS_QUALITY_REVIEW_DESIGN.md`) applied two
improvements: added "Reset to defaults" button (R1) matching scoring card
pattern, and fixed single-field `hx-form-row` inconsistency (R2).

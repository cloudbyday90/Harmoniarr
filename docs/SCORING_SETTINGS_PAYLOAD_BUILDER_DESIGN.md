# Scoring Settings Payload Builder Design

> Phase 2, step B4 of the Settings Library track. This document covers adding
> the `scoring` namespace to the settings payload builder (`settings-form.js`)
> and composable (`useSettingsForm.js`).

## Problem

The payload builder (`buildSettingsUpdatePayload`) constructs the PATCH request
body from form state. It currently includes `library: { ...form.library }` but
has no `scoring` entry. The composable initializes form defaults and applies
server responses but has no `scoring` section.

## Research

No external research needed — this is a mechanical addition following the
established `library` namespace pattern. The OWASP-compliant validation is
handled server-side by the validator (B3). The payload builder is a thin
serialization layer.

## Options Considered

### Decision 1: Spread pattern in payload builder

| Option | Pros | Cons |
|---|---|---|
| **A — `scoring: { ...form.scoring }`** | Matches `library` pattern; no transformation | None |
| **B — Explicit per-field** | Verbose control | 8 unnecessary lines |

**Chosen: A.** The `library` namespace uses `{ ...form.library }` (line 106).
The `scoring` namespace is identical — 8 numeric fields with no transformation.

### Decision 2: Composable form defaults

| Option | Pros | Cons |
|---|---|---|
| **A — Import `DEFAULT_SCORING_WEIGHTS` from server module** | Single source of truth | Couples client bundle to server module |
| **B — Duplicate defaults in composable** | No client→server import | Drift risk |

**Chosen: B.** The composable is client-side. Importing from
`src/server/library/download-result-scoring.js` would pull server-side code
into the client bundle. The form defaults are overwritten by `applySettings`
when the API responds, so drift is cosmetic and caught immediately at runtime.
The authoritative defaults live in `getDefaultSettings()` (B3) which the API
returns.

### Decision 3: Apply server settings in composable

| Option | Pros | Cons |
|---|---|---|
| **A — `Object.assign(form.scoring, payload.settings.scoring)`** | Matches `library` pattern (line 120) | None |

**Chosen: A.**

## Final Recommendation

Three changes:

1. **`settings-form.js`**: Add `scoring: { ...form.scoring }` to the payload
   object in `buildSettingsUpdatePayload`, after the `library` entry.

2. **`useSettingsForm.js`**: Add `scoring` to the reactive form defaults with
   the 8 weight fields matching `DEFAULT_SCORING_WEIGHTS` values.

3. **`useSettingsForm.js`**: Add `Object.assign(form.scoring,
   payload.settings.scoring)` in `applySettings`, after the library assignment.

### Code sketches

```js
// settings-form.js — in buildSettingsUpdatePayload, after library:
scoring: { ...form.scoring },

// useSettingsForm.js — in form defaults, after library:
scoring: {
  weightFormatTier: 0.25,
  weightCandidateTrackMatch: 0.20,
  weightAudioDepth: 0.12,
  weightDuration: 0.12,
  weightFormatConsistency: 0.10,
  weightTrackCount: 0.08,
  weightPeerDelivery: 0.08,
  weightUploaderReputation: 0.05,
},

// useSettingsForm.js — in applySettings, after library:
Object.assign(form.scoring, payload.settings.scoring);
```

## Files

| File | Change |
|---|---|
| `src/client/lib/settings-form.js` | Add `scoring` spread to payload |
| `src/client/composables/useSettingsForm.js` | Add `scoring` form defaults + apply |

## Security

The payload builder is a serialization layer. All validation happens server-side
in the validator (B3). The builder passes form values through unchanged — no
sanitization needed at this layer.

## Outcome

The `scoring` namespace flows through the full client pipeline: form defaults →
payload builder → PATCH request → server validator → database. The pattern
matches `library` exactly.

## Validation

- `node --test test/client/settings-form.test.js` — all existing tests pass
  plus new scoring payload test.
- `npx eslint src/client/lib/settings-form.js
  src/client/composables/useSettingsForm.js --max-warnings 0` — no lint errors.

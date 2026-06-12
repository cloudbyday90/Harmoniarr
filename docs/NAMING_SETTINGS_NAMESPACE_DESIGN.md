# Naming Settings Namespace Design (R2)

> Adds a `naming` settings namespace to the existing settings infrastructure,
> enabling operators to configure file/folder naming templates through the
> standard settings API, validator, form builder, and composable pipeline.

## Research Sources

| Source | Topic | Key Takeaway |
| --- | --- | --- |
| OWASP Input Validation Cheat Sheet | Allowlist > denylist; validate type/length/range; syntactic + semantic validation | Templates need syntactic validation (string type, non-empty) AND semantic validation (no path traversal vectors) |
| OWASP Path Traversal Prevention | Normalize after interpolation; reject path separators in input; allowlist tokens | Validator must reject `/`, `\`, `..` in template strings before persistence |
| Node.js Best Practices (goldbergyoni) | Schema validation on every inbound request; fail fast; centralize validation | `normalizeSettingsPatch` already follows this pattern — extend with `naming` namespace |
| Secure by Design: Node.js API Security Patterns (2025) | Validate inputs relentlessly; centralize validation; fail fast on malformed input | Each template string goes through its own normalize function that rejects dangerous patterns |
| Existing Harmoniarr patterns | `settingDefinitions` map with `defaultValue` + `normalize()` per field | Follow exact same pattern for `naming` namespace |

## Existing Infrastructure Patterns

### Settings Validator (`settings-validator.js`)

The validator uses a `settingDefinitions` map where each namespace contains
setting definitions with `defaultValue` and `normalize(value)`:

```js
const settingDefinitions = {
  fidelity: {
    spectralAuthenticMinCutoffHz: {
      defaultValue: 20000,
      normalize(value) { return normalizeIntegerSetting('fidelity.spectralAuthenticMinCutoffHz', value, { min: 10000, max: 24000 }); },
    },
  },
};
```

The `normalizeSettingsPatch(input)` function:
1. Validates input is a non-null object
2. Validates namespace exists in `settingDefinitions`
3. Validates each setting key exists in the namespace
4. Calls `definition.normalize(rawValue)` on each value
5. Runs cross-field namespace validators (e.g., scoring weight sum)

Helper functions available:
- `normalizeBooleanSetting(name)` — type check
- `normalizeIntegerSetting(name, value, { min, max })` — integer + range
- `normalizeRateSetting(name, value, { min, max })` — float + range
- `normalizeStringAllowEmpty(name)` — string type, trimmed
- `normalizePathSetting(value)` — absolute path string

None of these fit template strings. We need a new helper.

### Settings Form (`settings-form.js`)

The `buildSettingsUpdatePayload(form)` function constructs the API payload:
- Simple namespaces use `{ ...form.namespace }` spread
- Complex namespaces (artwork, paths) have custom transforms
- Each namespace is a separate key in the payload object

### Composable (`useSettingsForm.js`)

The composable has:
- Default values in the reactive `form` object (duplicated from server to avoid coupling)
- `applySettings(payload)` that uses `Object.assign(form.namespace, ...)` to hydrate from server
- `saveSettings()` that calls `buildSettingsUpdatePayload(form)` and submits

### Tests

Two test files:
- `settings-form.test.js` — payload builder tests with `createXxxForm()` helper functions
- `settings-library-view-contract.test.js` — source-level regex contract tests on the Vue template

## Options Considered

### Option A — Reuse `validateTemplate` from naming-template-engine.js (recommended)

Import the `validateTemplate` function from the template engine module and call
it inside each `normalize` function for naming settings.

```js
import { DEFAULT_NAMING_TEMPLATES, validateTemplate } from '../library/library-naming-template-engine.js';

naming: {
  artistFolderFormat: {
    defaultValue: DEFAULT_NAMING_TEMPLATES.artistFolderFormat,
    normalize(value) {
      const { valid, reason } = validateTemplate(value);
      if (!valid) throw createSettingsValidationError(`naming.artistFolderFormat: ${reason}`);
      return value;
    },
  },
}
```

| Pros | Cons |
| --- | --- |
| Single source of truth for template validation | Creates dependency from validator → template engine |
| `validateTemplate` already rejects `/`, `\`, `..` | Must add type check (non-string) since `validateTemplate` handles it differently |
| Consistent error messages | Template engine module must be loaded at validator import time |

### Option B — Inline validation in normalize functions

Write the validation logic directly in each `normalize` function without importing
the template engine.

| Pros | Cons |
| --- | --- |
| No cross-module dependency | Duplicated validation logic (DRY violation) |
| Validator remains self-contained | Two places to update when validation rules change |

### Option C — Create a `normalizeTemplateSetting` helper in the validator

Write a reusable helper function within the validator module that encapsulates
template string validation.

| Pros | Cons |
| --- | --- |
| No cross-module dependency | Duplicates logic already in `validateTemplate` |
| Follows existing `normalizeXxxSetting` pattern | Must keep in sync with template engine |

## Final Recommendation Stack

### R2-A: Import `validateTemplate` from template engine (accepted)

Option A is the right choice. The `validateTemplate` function from the template
engine already implements exactly the validation we need:
- Type check (must be string)
- Empty check
- Path separator rejection (`/`, `\`)
- Parent directory rejection (`..`)

The dependency is clean: the template engine is a pure function module with no
side effects, no database access, no framework dependencies. Importing it from
the validator is a standard practice — the validator already imports from
`download-result-scoring.js` for scoring defaults, so this pattern is established.

### R2-B: Single `normalizeTemplateSetting` wrapper (accepted)

Create a single wrapper function `normalizeTemplateSetting(settingName, value)`
that:
1. Calls `validateTemplate(value)` for structural validation
2. Trims whitespace from the template string
3. Wraps errors in `createSettingsValidationError` with the setting name prefix

This avoids repeating the same normalize function body 4 times.

### R2-C: Import defaults from template engine (accepted)

Import `DEFAULT_NAMING_TEMPLATES` from the template engine for `defaultValue`
in each setting definition. This ensures the validator's defaults always match
the template engine's defaults — single source of truth.

### R2-D: Simple spread in payload builder (accepted)

The `naming` namespace has 4 string fields with no transformation needed
(no comma-separated parsing, no object normalization). Use simple spread:
```js
naming: { ...form.naming },
```

### R2-E: Composable defaults duplicated from template engine (accepted)

The composable duplicates default values rather than importing from the server.
This follows the established pattern (fidelity, scoring, etc.) and avoids
client→server module coupling. The defaults are simple strings that are unlikely
to diverge — and if they do, the server validator will catch mismatches.

### R2-F: Namespace validator for template syntax (accepted)

Add a cross-field `namespaceValidators.naming` that checks each template
contains at least one `{Token}` pattern. This ensures operators don't save
templates with zero tokens (which would produce the same filename for every
file in a category).

Wait — this is overly restrictive for artist folder format (`{ArtistName}` is
the only meaningful token, but what if an operator wants just a fixed name?).
Actually, the template engine already handles this: templates without tokens
resolve to their literal text. A namespace validator is unnecessary complexity.
**Rejected** — the per-field `validateTemplate` is sufficient.

## Security Analysis

| Threat | Mitigation |
| --- | --- |
| Path traversal via template containing `/` or `\` | `validateTemplate` rejects at persistence (normalize) |
| Path traversal via template containing `..` | `validateTemplate` rejects at persistence (normalize) |
| XSS via template values rendered in frontend | Vue's template engine auto-escapes; templates are displayed in `<input>` fields |
| Template injection producing arbitrary filesystem paths | Multi-layer: validator rejects separators + `sanitizeStem` strips after interpolation + containment check in organize service |
| Overly long template strings | PostgreSQL TEXT column has no practical limit; individual tokens support `:NN` truncation |
| Empty template producing unnamed files | `validateTemplate` rejects empty strings |

## API

### Settings validator additions

```js
// In settingDefinitions:
naming: {
  artistFolderFormat: {
    defaultValue: DEFAULT_NAMING_TEMPLATES.artistFolderFormat,
    normalize(value) { return normalizeTemplateSetting('naming.artistFolderFormat', value); },
  },
  albumFolderFormat: {
    defaultValue: DEFAULT_NAMING_TEMPLATES.albumFolderFormat,
    normalize(value) { return normalizeTemplateSetting('naming.albumFolderFormat', value); },
  },
  trackFilenameFormat: {
    defaultValue: DEFAULT_NAMING_TEMPLATES.trackFilenameFormat,
    normalize(value) { return normalizeTemplateSetting('naming.trackFilenameFormat', value); },
  },
  multiDiscTrackFilenameFormat: {
    defaultValue: DEFAULT_NAMING_TEMPLATES.multiDiscTrackFilenameFormat,
    normalize(value) { return normalizeTemplateSetting('naming.multiDiscTrackFilenameFormat', value); },
  },
}
```

### New helper function

```js
function normalizeTemplateSetting(settingName, value) {
  const { valid, reason } = validateTemplate(value);
  if (!valid) {
    throw createSettingsValidationError(`${settingName}: ${reason}`);
  }
  return typeof value === 'string' ? value.trim() : value;
}
```

### Payload builder addition

```js
naming: { ...form.naming },
```

### Composable form defaults

```js
naming: {
  artistFolderFormat: '{ArtistName}',
  albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
  trackFilenameFormat: '{TrackNumber} - {SongTitle}',
  multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
},
```

### Composable apply

```js
Object.assign(form.naming, payload.settings.naming);
```

## Modified Files

| File | Change |
| --- | --- |
| `src/server/validators/settings-validator.js` | Import `validateTemplate` + `DEFAULT_NAMING_TEMPLATES`; add `naming` namespace; add `normalizeTemplateSetting` helper |
| `src/client/lib/settings-form.js` | Add `naming: { ...form.naming }` to payload |
| `src/client/composables/useSettingsForm.js` | Add `naming` defaults + `Object.assign(form.naming, ...)` in apply |
| `test/server/settings-validator.test.js` | Add naming validation tests (accept valid, reject path separators, reject empty, reject `..`, defaults check) |
| `test/client/settings-form.test.js` | Add `createNamingForm()` helper + 2 payload tests (custom values + defaults) |

## Outcome

Follows the exact patterns established by fidelity, retention, scoring, and
acquisition namespaces. Template validation delegates to the existing
`validateTemplate` function from the template engine, maintaining a single source
of truth. No new dependencies beyond the already-implemented template engine.
Security is multi-layered: validator rejects path traversal vectors at
persistence, `sanitizeStem` strips after interpolation, and containment checks
in the organize service validate resolved paths.

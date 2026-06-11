# Acquisition Settings Payload Builder Design

> Phase 3, step A1 of the Settings Library track. Adds the `acquisition` namespace
> spread to `buildSettingsUpdatePayload` in `settings-form.js`.

## Problem

The `buildSettingsUpdatePayload` function in `settings-form.js` maps flat reactive
form state to the structured API payload. It currently includes `library` and
`scoring` spreads but not `acquisition`. Without this spread, the settings save
payload omits acquisition values even if the form has them.

## Research

### MDN: Spread syntax and prototype pollution

MDN documents that spread syntax (`{...obj}`) creates a shallow copy of an object's
own enumerable properties. From the MDN "Spread syntax" documentation:

> The spread syntax copies own enumerable properties from the provided object.

MDN's "Prototype pollution during object merging" article warns that `Object.assign()`
and spread can carry `__proto__` keys when merging **untrusted** JSON input:

```js
const options = JSON.parse('{"__proto__": {"test": "value"}}');
const withDefaults = Object.assign({ mode: "cors" }, options);
// Prototype polluted
```

**Relevance to this change:** The `form.acquisition` object is a Vue `reactive()`
created by `useSettingsForm.js` with two known keys (`autoIgnoreEnabled`,
`autoIgnoreCooldownHours`). It is **not** parsed from user-supplied JSON. The spread
carries only the properties the composable initialized. Prototype pollution risk is
mitigated at the source — the reactive object cannot have `__proto__` injected
through `v-model` bindings.

### OWASP: Mass assignment prevention

The OWASP Mass Assignment Cheat Sheet recommends an **allowlist** approach at the
persistence boundary — explicitly defining which fields can be updated:

> Use an allowlist approach by explicitly defining fields. Avoid using denylists or
> wildcard field definitions that could inadvertently expose sensitive model
> attributes.

**Relevance to this change:** The server-side `normalizeSettingsPatch` in
`settings-validator.js:609-649` already implements a strict allowlist:

1. Line 616: Unknown namespaces → throw
2. Line 626: Unknown setting keys → throw
3. Line 633: Every value passes through `definition.normalize()` (type + range validation)

This is the authoritative security boundary. The client-side spread is structural
only — even if a malicious client sends extra keys, the server rejects them.

### Existing codebase pattern

Four namespaces already use the shallow spread pattern:

```js
security: { ...form.security },
system: { ...form.system },
library: { ...form.library },
scoring: { ...form.scoring },
```

The `artwork` namespace uses explicit key listing because it transforms text fields
(`derivativeSizesText` → `derivativeSizes` array, `providerOrderText` →
`providerOrder` array). The `slskd` namespace uses explicit key listing because it
conditionally includes secret fields (`apiKey`, `clearApiKey`).

The `acquisition` namespace has no transformations and no secrets — two simple
fields (boolean + integer). It matches the spread pattern exactly.

## Options Considered

### Decision 1: Spread vs explicit key listing

| Option | Pros | Cons |
|---|---|---|
| **A — Shallow spread: `{ ...form.acquisition }`** | Matches `security`, `system`, `library`, `scoring` pattern; minimal code; automatic field inclusion when composable adds new fields | No explicit field-level audit trail in payload builder |
| **B — Explicit key listing: `{ autoIgnoreEnabled: form.acquisition.autoIgnoreEnabled, autoIgnoreCooldownHours: form.acquisition.autoIgnoreCooldownHours }`** | Field-level audit trail; matches `artwork` and `slskd` pattern; prevents accidental inclusion of new fields | Verbose for 2 fields; divergence from `library`/`scoring`/`security`/`system` pattern; requires updating when new fields are added |
| **C — Helper function: `buildNamespaceSpread(form.acquisition, ['autoIgnoreEnabled', 'autoIgnoreCooldownHours'])`** | Allowlist enforcement at payload level; reusable for future namespaces | Over-engineering for 2 fields; no existing pattern for this in the codebase; server allowlist is the authoritative boundary |

**Chosen: A.** The `acquisition` namespace has only 2 simple fields with no
transformations. The shallow spread matches the established pattern for `library`,
`scoring`, `security`, and `system`. The server-side allowlist in
`normalizeSettingsPatch` is the authoritative security boundary — the client payload
builder does not need to duplicate allowlist enforcement.

### Decision 2: Placement order in payload object

| Option | Pros | Cons |
|---|---|---|
| **A — After `scoring`, before `slskd`** | Alphabetical-ish; matches current file order | Separates `acquisition` from related `library` namespace |
| **B — After `library`, before `paths`** | Groups library-related namespaces together; logical grouping | Breaks alphabetical-ish order; requires moving `scoring` too or having them split |

**Chosen: A.** The payload object order does not affect functionality (server
processes namespaces independently by name). Maintaining the current insertion-order
convention (append after the last spread namespace) minimizes diff noise. The
`acquisition` spread goes after `scoring` at line 107.

## Final Recommendation

Add one line to `buildSettingsUpdatePayload`:

```js
acquisition: { ...form.acquisition },
```

Placed after the `scoring` spread (line 107) and before the `slskd` section
(line 108). This:

1. Follows the established spread pattern for simple namespaces.
2. Carries only the two known fields from the composable reactive object.
3. Is safe against prototype pollution (reactive source, not parsed JSON).
4. Is safe against mass assignment (server allowlist is authoritative).
5. Requires no test changes yet — the payload test (C2) will be added in a later step.

## Files

| File | Change |
|---|---|
| `src/client/lib/settings-form.js` | Add `acquisition` spread at line 108 |

## Security

- **Prototype pollution**: The `form.acquisition` object is a Vue `reactive()` with
  two known keys initialized by `useSettingsForm.js`. It cannot carry `__proto__`
  or `constructor` keys from `v-model` bindings. Spread copies only own enumerable
  properties.
- **Mass assignment**: The server-side `normalizeSettingsPatch` (lines 616-628)
  enforces a strict allowlist — unknown namespaces and unknown keys are rejected.
  Client payload structure is not a security boundary.
- **Field types**: `autoIgnoreEnabled` is a boolean (from checkbox `v-model`);
  `autoIgnoreCooldownHours` is a number (from `v-model.number` input). Both pass
  through the spread as-is and are validated server-side by their respective
  `normalize` functions.

## Outcome

The `acquisition` namespace is included in the settings save payload via a single
shallow spread line, matching the established pattern for `library`, `scoring`,
`security`, and `system`.

**Changes made:**

1. `src/client/lib/settings-form.js:108`: Added `acquisition: { ...form.acquisition }`
   after `scoring` spread.
2. `test/client/settings-form.test.js:52-57`: Added `createAcquisitionForm()` helper
   and updated the deep-equal test fixture to include `acquisition` in both input and
   expected output (test must reflect the full payload shape).

All 7 tests pass, 0 lint warnings.

## Validation

- `npx eslint src/client/lib/settings-form.js --max-warnings 0` — no lint errors.
- `node --test test/client/settings-form.test.js` — all existing tests pass (new
  acquisition test will be added in step C2).

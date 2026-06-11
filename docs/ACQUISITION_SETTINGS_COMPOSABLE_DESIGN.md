# Acquisition Settings Composable Design

> Phase 3, step A2 of the Settings Library track. Adds `acquisition` form defaults
> to the `useSettingsForm.js` composable and wires the `applySettings` function to
> hydrate the acquisition namespace from the API response.

## Problem

The `useSettingsForm` composable initializes a reactive `form` object with defaults
for each settings namespace. When settings are loaded from the API, `applySettings`
spreads the server response into each form slice. The `acquisition` namespace is
missing from both the defaults and the apply logic, so:

1. The form has no `acquisition` slice for `v-model` bindings to attach to.
2. Loading settings from the API doesn't hydrate `form.acquisition`.

## Research

### Vue.js: Reactive state with `reactive()`

From the Vue.js Guide ("Reactivity Fundamentals"):

> `reactive()` makes an object itself reactive. The conversion is deep, meaning
> nested objects are also automatically wrapped as reactive proxies.

This means `form.acquisition` becomes a reactive proxy as soon as it's defined as a
nested property of the `reactive()` call. Adding a new namespace is a declarative
addition to the initial object — no special registration needed.

### Vue.js: `Object.assign` for reactive mutation

From the Vue.js Guide ("Reactivity Fundamentals"):

> A proxy returned by `reactive()` is not strictly equal to the original object.
> Only the proxy is reactive. It is a best practice to exclusively use the proxied
> versions of state to ensure reactivity.

`Object.assign(form.acquisition, payload.settings.acquisition)` works correctly
because:

1. `form.acquisition` is a reactive proxy (created by `reactive()`).
2. `Object.assign` mutates the proxy's properties in-place, triggering Vue's
   reactivity tracking.
3. The server payload values overwrite the defaults, and Vue updates any bound
   inputs.

This is the same pattern used for `library`, `scoring`, `security`, `system`, and
`artwork` in the existing codebase.

### Client-server defaults duplication

The composable duplicates defaults from the server validator rather than importing
them. From the Phase 2 design decision (`SCORING_SETTINGS_FRONTEND_DESIGN.md`):

> Defaults are duplicated (not imported from server) to avoid client→server module
> coupling.

This is a deliberate architectural boundary: the client bundle (`src/client/`) must
not import from the server bundle (`src/server/`). The two bundles run in different
environments (browser vs Node.js). Importing server modules in the client would:

1. Break the build (server modules reference `node:` builtins).
2. Create a hidden coupling that makes refactoring harder.
3. Potentially leak server implementation details to the client.

**OWASP consideration:** Duplicating defaults is safe because the server validator is
the authoritative boundary. If client defaults drift from server defaults, the worst
case is a momentary visual discrepancy before the first settings load — the server
always validates and normalizes on save.

### Existing pattern

The composable currently has 8 namespace slices in the `form` reactive:

| Namespace | Defaults source | Apply pattern |
|---|---|---|
| `artwork` | Duplicated (14 fields with transforms) | Spread + text field transforms |
| `security` | Duplicated (4 fields) | `Object.assign` direct |
| `system` | Duplicated (2 fields) | `Object.assign` direct |
| `library` | Duplicated (4 fields) | `Object.assign` direct |
| `scoring` | Duplicated (8 fields) | `Object.assign` direct |
| `paths` | Duplicated (5 fields + arrays) | Spread + array normalization |
| `slskd` | Duplicated (4 fields + secret) | Spread + secret reset |
| `providers` | Duplicated (17 fields + secrets) | Spread + secret resets |

The `acquisition` namespace (2 fields, no transforms, no secrets) matches the
`security`/`system`/`library`/`scoring` pattern exactly.

## Options Considered

### Decision 1: Defaults placement in the form object

| Option | Pros | Cons |
|---|---|---|
| **A — After `scoring`, before `paths`** | Matches the payload builder order (A1); logical grouping of library-related namespaces | Separates `scoring` from `library` by one namespace |
| **B — After `library`, before `scoring`** | Groups `library` and `acquisition` (both are library settings) together | Breaks the order established by Phase 1 and Phase 2 insertion points |

**Chosen: A.** The `form` object order matches the `buildSettingsUpdatePayload`
order established in A1. Consistency between form defaults and payload builder
reduces cognitive overhead.

### Decision 2: Null-safe apply for missing server payload

| Option | Pros | Cons |
|---|---|---|
| **A — `Object.assign(form.acquisition, payload.settings.acquisition)` (no guard)** | Matches existing pattern for `library`, `scoring`, `security`, `system` | If `payload.settings.acquisition` is undefined, `Object.assign` is a no-op (harmless but silent) |
| **B — `Object.assign(form.acquisition, payload.settings.acquisition ?? {})` (null-safe)** | Explicit about undefined payload | Diverges from existing pattern; unnecessary if API always returns all namespaces |

**Chosen: A.** All four existing simple namespaces (`library`, `scoring`, `security`,
`system`) use the unguarded pattern. The `getDefaultSettings()` function in the
server validator ensures all namespaces are always present in the API response.
Adding a null guard here would introduce inconsistency without adding safety.

### Decision 3: Apply placement order

| Option | Pros | Cons |
|---|---|---|
| **A — After `scoring` apply, before `paths` apply** | Matches form defaults and payload builder order | — |
| **B — After `library` apply, before `scoring` apply** | Groups library namespaces | Breaks established order |

**Chosen: A.** Consistency across defaults, apply, and payload builder ordering.

## Final Recommendation

Two changes to `useSettingsForm.js`:

1. **Form defaults** (after `scoring`, before `paths`):
   ```js
   acquisition: {
     autoIgnoreEnabled: false,
     autoIgnoreCooldownHours: 24,
   },
   ```

2. **Apply spread** (after `scoring` apply, before `paths` apply):
   ```js
   Object.assign(form.acquisition, payload.settings.acquisition);
   ```

### Default values

| Field | Default | Server validator default | Match |
|---|---|---|---|
| `autoIgnoreEnabled` | `false` | `false` (line 284) | Yes |
| `autoIgnoreCooldownHours` | `24` | `24` (line 288) | Yes |

## Files

| File | Change |
|---|---|
| `src/client/composables/useSettingsForm.js` | Add `acquisition` defaults + `applySettings` spread |

## Security

- **Defaults are UX-only**: The client defaults provide initial form state before
  the first API load. They are not a security boundary. The server validator
  (`settings-validator.js:282-293`) is the authoritative source of truth for type
  and range validation.
- **No secret fields**: The `acquisition` namespace has no secret fields (unlike
  `slskd.apiKey` or `providers.spotifyClientSecret`). No secret-clearing logic
  needed.
- **`Object.assign` on reactive proxy**: Safe — Vue's reactive proxy intercepts
  property writes. No prototype pollution risk (the API response is JSON-parsed by
  the fetch layer, not merged via `Object.assign` on `Object.prototype`).
- **Client-server coupling boundary**: Defaults are duplicated (not imported) to
  maintain the client/server module boundary. This prevents server-side
  implementation details from leaking into the client bundle.

## Outcome

Two changes applied to `useSettingsForm.js`:

1. **Form defaults** (after `scoring`, before `paths`): Added `acquisition` slice
   with `autoIgnoreEnabled: false` and `autoIgnoreCooldownHours: 24`.
2. **Apply spread** (after `scoring` apply, before `paths` apply): Added
   `Object.assign(form.acquisition, payload.settings.acquisition)`.

All 7 form tests + 14 contract tests pass, 0 lint warnings.

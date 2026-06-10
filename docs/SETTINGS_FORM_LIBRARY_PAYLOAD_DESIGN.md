# Settings Form Library Payload Design

> Phase B5 of the Settings Library track. This document covers adding the
> `library` namespace to the client-side `settings-form.js` payload builder so
> that discovery scheduling fields are included in the settings update API call.

## Problem

Phase B4 added the `library` namespace to the server-side settings validator,
enabling `normalizeSettingsPatch()` to accept and validate library settings.
But the client-side form-to-payload transformer (`buildSettingsUpdatePayload`)
does not include `library` in its output, so the frontend cannot persist
discovery scheduling changes even after the UI is built.

B5 adds the `library` spread to the payload builder, completing the write path
from frontend to database.

## Research Baseline

### Payload builder patterns in `settings-form.js`

`buildSettingsUpdatePayload(form)` (line 79-192) maps flat form state to the
structured API payload. The existing namespace patterns are:

| Namespace | Pattern | Special handling |
| --- | --- | --- |
| `artwork` | Explicit enumeration (lines 81-98) | Two fields parsed from comma-separated text |
| `security` | Shallow spread `{ ...form.security }` (line 99) | None |
| `system` | Shallow spread `{ ...form.system }` (line 100) | None |
| `paths` | Spread + overwrite (lines 101-105) | `downloadMappings` and `userMusicRoots` normalized |
| `slskd` | Explicit + post-hoc secret (lines 106-109, 184-189) | API key with clear/update/preserve logic |
| `providers` | Conditional explicit + secrets (lines 112-182) | Only when `form.providers` exists; 6 secret fields |

The `library` namespace has 4 simple integer fields — no secrets, no
comma-separated text parsing, no special normalization. This matches the
`security`/`system` shallow-spread pattern exactly.

### OWASP: Output encoding for form payloads

OWASP recommends that client-side code should not construct payloads with
unvalidated or unsanitized user input. In this architecture, the payload builder
produces a plain JSON object that is then sent to the server, which applies
its own server-side validation (`normalizeSettingsPatch` from B4). The client
does not perform security-critical validation — it only shapes the form state
into the API's expected structure.

This is a secure pattern: the client shapes, the server validates. Adding a
simple spread for `library` does not introduce any new trust boundary or
validation gap.

## Options Considered

### Decision 1: Spread vs explicit enumeration

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Shallow spread `{ ...form.library }`** | Minimal code; matches `security`/`system` pattern; future fields auto-included | Less explicit about expected fields |
| **B — Explicit enumeration** | Explicit field list; matches `artwork`/`providers` pattern | More code for no benefit — all 4 fields are simple integers |

**Chosen: Option A.** Four simple integer fields with no transformation match
the `security`/`system` spread pattern. The server-side validator (B4) already
performs strict validation — the client's job is shaping, not validating.

### Decision 2: Always included vs conditional

| Option | Pros | Cons |
| --- | --- | --- |
| **A — Always included** | Library settings are core configuration; always present in form | None |
| **B — Conditional (`if (form.library)`)** | Matches `providers` pattern | Unnecessary — library settings are always relevant |

**Chosen: Option A.** The `providers` namespace is conditional because provider
integrations may not be configured. Library discovery settings are core
configuration that always apply.

### Decision 3: Placement in payload object

| Option | Pros | Cons |
| --- | --- | --- |
| **A — After `paths`, before `slskd`** | Groups library config near path config | Minor reordering |
| **B — After `slskd`, before `providers`** | Separates integrations from core | Minor |

**Chosen: Option A.** Placing `library` after `paths` groups the library
configuration logically before the integration settings.

## Final Recommendation

Add a single line to the payload object in `buildSettingsUpdatePayload`:

```js
const payload = {
  artwork: { ... },
  security: { ...form.security },
  system: { ...form.system },
  paths: { ... },
  library: { ...form.library },  // <-- new
  slskd: { ... },
};
```

No new helper functions, no special handling, no conditional logic.

## Files

| File | Role |
| --- | --- |
| `src/client/lib/settings-form.js` | Add `library: { ...form.library }` to payload object. |
| `test/client/settings-form.test.js` | Add test verifying library payload inclusion. |

## Security

- The payload builder only shapes form state into a JSON structure. It does not
  perform validation — that is the server's responsibility (B4).
- No secrets are involved in the `library` namespace.
- No string interpolation, no SQL construction, no URL construction.
- The API endpoint (`PUT /api/v1/settings`) already requires admin
  authentication.

## Outcome

After B5, the complete data flow for discovery scheduling settings is:

1. **Frontend form** captures `form.library.discoveryCooldownHours` (etc.).
2. **Payload builder** spreads `form.library` into the API payload.
3. **API endpoint** calls `normalizeSettingsPatch` (B4) to validate.
4. **Persistence** writes validated values to `app_settings` via parameterized
   SQL.
5. **Dispatch cycle** calls `loadSettingsFn()` → `resolveDiscoverySettings()`
   (B1/A3) → uses settings-derived values.

## Validation

- `node --test test/client/settings-form.test.js` — existing + new test cases.
- `npm run lint` — no lint errors.
- `npm run build:server` — server build succeeds.

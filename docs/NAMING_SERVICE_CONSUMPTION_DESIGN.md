# Naming Service Template Consumption Design (R3)

> Integrates the template engine into `library-naming-service.js` so that builder
> functions resolve naming templates from operator settings instead of hardcoded
> patterns. Follows the existing `loadSettingsFn` dependency injection pattern.

## Research Sources

| Source | Topic | Key Takeaway |
| --- | --- | --- |
| OneUptime: DI in Node.js (Jan 2026) | Constructor injection with factory functions; depend on abstractions not implementations; keep composition root separate | Naming service should receive `loadSettingsFn` as a destructured factory parameter with module-level import as default |
| GeeksforGeeks: Top Node.js Design Patterns (2025) | Factory pattern hides implementation logic; enhances flexibility and loose coupling | `createLibraryNamingService({ loadSettingsFn })` follows this pattern |
| Node.js Best Practices (goldbergyoni) | Modular service files over singletons; testable via dependency injection | Each service gets its own file; dependencies injected for testability |
| OWASP Secure SDLC / Top 10 (2025) | A03: Software Supply Chain; A05: Injection; validate all inputs | Settings-driven templates are validated at persistence; `sanitizeStem` applied after resolution |
| Existing Harmoniarr pattern | `library-discovery-dispatch-service.js` uses `loadSettingsFn = loadSettings` default | Follow exact same pattern for naming service |

## Existing Patterns in the Codebase

### `loadSettingsFn` injection (from `library-discovery-dispatch-service.js`)

The service imports `loadSettings` at module level, then uses it as the default
parameter value in the factory function:

```js
import { loadSettings } from '../settings.js';

export function createLibraryDiscoveryDispatchService({
  loadSettingsFn = loadSettings,
  // ... other deps
} = {}) {
  // Usage: const settings = await loadSettingsFn();
}
```

The module file (`library-module.js`) explicitly injects it at wiring time:

```js
libraryDiscoveryDispatchService = createLibraryDiscoveryDispatchService({
  loadSettingsFn: loadSettings,
  // ...
}),
```

### Naming service current state

`createLibraryNamingService()` takes **no parameters**. It has 3 builder functions
with hardcoded patterns:

| Builder | Hardcoded Pattern | Called By |
| --- | --- | --- |
| `buildArtistFolderName` | `sanitizeStem(artistName)` | `library-organize-preview-service.js:114` |
| `buildAlbumFolderName` | `sanitizeStem(albumTitle) + " (" + year + ")"` | `library-organize-preview-service.js:115` |
| `buildTrackFilename` | `formatTrackNumber(NN) + " - " + sanitizeStem(title) + ext` | `library-organize-preview-service.js:120` |

The naming service is currently instantiated as a default parameter in the
organize preview service:

```js
// library-organize-preview-service.js:260
export function createLibraryOrganizePreviewService({
  libraryNamingService = createLibraryNamingService(),
  // ...
} = {}) {
```

### Call context objects

The organize preview service passes these objects to the builders:

```js
// Artist folder
{ artistName: row.artistName }

// Album folder
{ albumTitle, releaseDate: row.releaseDate }

// Track filename
{ discNumber: row.mediumPosition, extension: row.extension,
  isMultiDisc: row.mediumCount > 1, trackNumber: row.trackPosition,
  trackTitle: row.trackTitle }
```

## Options Considered

### Option A — `loadSettingsFn` with per-call resolution (recommended)

Add `loadSettingsFn` to the naming service factory. Each builder function calls
`loadSettingsFn()` to get current templates, then resolves via template engine.

```js
export function createLibraryNamingService({
  loadSettingsFn = loadSettings,
} = {}) {
  async function resolveNamingTemplates() {
    try {
      const settings = await loadSettingsFn();
      return settings.naming ?? DEFAULT_NAMING_TEMPLATES;
    } catch {
      return DEFAULT_NAMING_TEMPLATES;
    }
  }

  async function buildArtistFolderName({ artistName }) {
    const templates = await resolveNamingTemplates();
    const resolved = resolveTemplate(templates.artistFolderFormat, { ArtistName: artistName });
    return sanitizeLibraryPathSegment(resolved, { fallback: 'Unknown Artist' });
  }
  // ...
}
```

| Pros | Cons |
| --- | --- |
| Settings changes take effect immediately (no restart) | Builder functions become async |
| Follows exact `loadSettingsFn` pattern from dispatch service | All callers must `await` the result |
| Graceful fallback to defaults if settings fail | Slight performance cost per call |
| No caching complexity — settings are always current | |

### Option B — Cached settings with manual refresh

Load settings once at factory time, cache them, and provide a `refresh()` method.

```js
let cachedTemplates = DEFAULT_NAMING_TEMPLATES;
async function refreshTemplates() {
  const settings = await loadSettingsFn();
  cachedTemplates = settings.naming ?? DEFAULT_NAMING_TEMPLATES;
}
```

| Pros | Cons |
| --- | --- |
| Synchronous builder functions (no caller changes) | Stale settings until refresh |
| No performance cost per call | Must wire refresh into settings update flow |
| | More complex state management |
| | Risk of using stale templates after settings change |

### Option C — Hybrid: cache with auto-refresh on each call

Call `loadSettingsFn()` each time but keep builder functions synchronous by
resolving the template synchronously and sanitizing synchronously.

This is impossible because `loadSettingsFn()` is inherently async (it reads from
the database via PostgreSQL). Builder functions must become async.

### Option D — Eager loading at module startup

Load settings at module startup and never refresh. Templates are fixed until
restart.

| Pros | Cons |
| --- | --- |
| Simplest implementation | Requires restart to apply template changes |
| No async builders | Poor operator experience |
| | Doesn't match other settings behavior |

## Final Recommendation Stack

### R3-A: `loadSettingsFn` with per-call resolution (accepted)

Option A. The builder functions become `async`. This is the correct tradeoff
because:

1. It follows the established pattern (`library-discovery-dispatch-service.js`)
2. Settings changes take effect immediately without restart
3. The naming service is only called during organize preview/apply, not on
   every HTTP request — the async overhead is negligible
4. Graceful fallback: if `loadSettingsFn()` throws, use `DEFAULT_NAMING_TEMPLATES`

### R3-B: Template context construction helper (accepted)

Create a `buildTemplateContext(metadata)` helper that maps the raw metadata
fields to template engine token names:

```js
function buildTemplateContext({ artistName, albumTitle, releaseDate, trackNumber, trackTitle, discNumber, discCount }) {
  return {
    ArtistName: artistName ?? '',
    AlbumTitle: albumTitle ?? '',
    ReleaseYear: resolveReleaseYear(releaseDate),
    SongTitle: trackTitle ?? '',
    TrackNumber: formatTrackNumber(trackNumber),
    DiscNumber: discNumber != null ? String(discNumber) : '',
    DiscCount: discCount != null ? String(discCount) : '',
  };
}
```

This maps the naming service's existing parameter shapes to the flat context
object that the template engine expects.

### R3-C: Builder functions become async (accepted)

All three builder functions become async. The organize preview service already
operates in an async context, so this requires minimal caller changes:

```js
// Before (sync)
const folderName = libraryNamingService.buildArtistFolderName({ artistName });

// After (async)
const folderName = await libraryNamingService.buildArtistFolderName({ artistName });
```

The organize preview service's `buildProposedPath` function (line ~97) is already
async, so adding `await` to the builder calls is straightforward.

### R3-D: Wire through organize preview service (accepted)

The naming service is created as a default parameter in the organize preview
service. We add `loadSettingsFn` to the naming service factory, then update the
organize preview service to either:

1. Accept `libraryNamingService` as a parameter (already does) and pass the
   injected service from `library-module.js`, OR
2. Create the naming service internally with the `loadSettingsFn` default

Option 1 is better — it follows the DI principle of constructing dependencies
at the composition root. The `library-module.js` should create the naming service
and inject it into the organize preview service.

### R3-E: Graceful fallback (accepted)

If `loadSettingsFn()` throws or returns no `naming` namespace, the builder
functions fall back to `DEFAULT_NAMING_TEMPLATES`. This ensures:

- The naming service works during first boot before settings exist
- The naming service works if the database is temporarily unavailable
- Existing behavior is preserved when no custom templates are configured

### R3-F: `resolveNamingSettings` helper (accepted)

Extract a `resolveNamingSettings(settings)` function that:

1. Checks `settings.naming` exists
2. Validates all 4 template keys are present
3. Falls back to `DEFAULT_NAMING_TEMPLATES` for any missing keys

This keeps the fallback logic testable independently.

## Security Analysis

| Threat | Mitigation |
| --- | --- |
| Malicious template from database | Templates validated at persistence by `normalizeTemplateSetting` (R2) |
| Path traversal via token values | `sanitizeStem` strips `/\` after resolution |
| Path traversal via template literals | `validateTemplate` rejects `/`, `\`, `..` at persistence |
| Missing template key (null/undefined) | `resolveNamingSettings` falls back to defaults |
| Settings load failure | try/catch with fallback to `DEFAULT_NAMING_TEMPLATES` |

## Modified Files

| File | Change |
| --- | --- |
| `src/server/library/library-naming-service.js` | Add `loadSettingsFn` parameter; import template engine; builders become async; add `buildTemplateContext` + `resolveNamingSettings` helpers |
| `src/server/library/library-organize-preview-service.js` | Add `await` to builder calls (3 call sites) |
| `src/server/library/library-module.js` | Import naming service; create instance with `loadSettingsFn`; inject into organize preview service |
| `test/server/library-naming-service.test.js` | Update existing tests for async builders; add template resolution tests |

## API Changes

### `createLibraryNamingService` factory signature

```js
// Before
export function createLibraryNamingService() {

// After
export function createLibraryNamingService({
  loadSettingsFn = loadSettings,
} = {}) {
```

### Builder function signatures (become async)

```js
// Before (sync)
function buildArtistFolderName({ artistName }) { ... }

// After (async)
async function buildArtistFolderName({ artistName }) { ... }
```

Return types unchanged — still return `string`.

## Outcome

The naming service gains `loadSettingsFn` injection following the established
`library-discovery-dispatch-service` pattern. Builder functions become async
and resolve templates from operator settings with graceful fallback to defaults.
The organize preview service awaits the now-async builders. The module file
wires the dependency at the composition root.

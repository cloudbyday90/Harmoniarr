# Settings Naming Template Design

> Exposes the hardcoded file/folder naming patterns in `library-naming-service.js`
> as configurable template strings via a new `naming` settings namespace.
> Operators can customize how imported and organized files are named.

## Problem

The naming service (`library-naming-service.js`) uses three hardcoded builder
functions to produce library paths:

| Builder | Current Output | Lines |
| --- | --- | --- |
| `buildArtistFolderName` | `{sanitized(artistName)}` | 130-132 |
| `buildAlbumFolderName` | `{sanitized(albumTitle)} ({year})` | 134-139 |
| `buildTrackFilename` | `{NN} - {sanitized(trackTitle)}.ext` (single-disc) or `{D}-{NN} - {sanitized(trackTitle)}.ext` (multi-disc) | 141-156 |

These produce the standard `Artist/Album (Year)/NN - Title.ext` layout. Operators
who want different conventions (e.g., `Artist - Album [Year]/NN - Title.ext`,
or including quality/codec in the album folder) must edit the source code.

Meanwhile, the `harmoniarr.md` spec (lines 2967-3028) already defines a planned
token set and template syntax using `{TokenName}` placeholders.

## Research Baseline

### Lidarr naming system (Servarr Wiki)

Lidarr uses 4 configurable templates:

1. **Standard Track Format** — filename for single-disc tracks
2. **Multi-Disc Track Format** — filename for multi-disc tracks
3. **Artist Folder Format** — top-level folder name
4. **Album Folder Format** — subfolder name under artist

Key features:
- Tokens wrapped in `{}` — e.g., `{Artist Name}`, `{Album Title}`, `{track:00}`
- Truncation syntax: `{Album Title:150}` caps at N characters
- Conditional formatting: `{ (Album Disambiguation)}` renders nothing if token is empty
- Leading "The" variants: `{Artist NameThe}` → `Beatles, The`
- "Clean" variants: `{Artist CleanName}` — illegal chars removed
- Community convention: always include year in album folder for disambiguation
- Warning: changing naming after library population triggers mass rename

### OWASP Path Traversal Prevention

Template strings that produce filesystem paths are a high-risk attack surface.
OWASP guidance:

- **Sanitize after interpolation** — never trust token values
- **Normalize paths** — resolve `..`, `/`, `\`, null bytes
- **Validate containment** — ensure resolved path stays within library root
- **Allowlist tokens** — only resolve known, defined token names
- **Reject path separators in template literals** — `/`, `\`, `..` in template
  text must be rejected or stripped

The existing `sanitizeStem` function (lines 93-102) already handles reserved
characters (`<>:"/\|?*`), control characters, whitespace collapse, and Windows
reserved device names. The template engine must apply this sanitization to each
resolved segment.

### Harmoniarr planned token set (`harmoniarr.md:3003-3027`)

```
{ArtistName}              {AlbumArtistName}
{AlbumTitle}              {ReleaseTitle}
{ReleaseYear}             {ReleaseDate}
{ReleaseCountry}          {ReleaseFormat}    {Edition}
{DiscNumber}              {DiscCount}
{TrackNumber}             {TrackNumber:00}
{SongTitle}
{Quality}                 {AudioCodec}       {AudioChannels}
{Bitrate}                 {SampleRate}
{MusicBrainzArtistId}     {MusicBrainzReleaseGroupId}
{MusicBrainzReleaseId}    {MusicBrainzRecordingId}
```

### Existing sanitization pipeline

The naming service already has a comprehensive sanitization pipeline:

1. `normalizeText` — NFC Unicode normalization
2. `replaceControlCharacters` — strips codepoints <= 0x1F
3. `sanitizeStem` — removes `<>:"/\|?*`, collapses whitespace, trims edge chars
4. `protectReservedDeviceName` — appends `_` to Windows reserved names (CON, PRN, etc.)

This pipeline must be applied to every segment produced by template resolution.

## Options Considered

### Option A — String template with `{Token}` syntax (recommended)

Template strings using `{TokenName}` placeholders, matching the Lidarr convention
and the existing `harmoniarr.md` spec.

| Pros | Cons |
| --- | --- |
| Matches Lidarr convention (familiar to operators) | Requires template parser |
| Matches existing harmoniarr.md spec | Must handle `{TokenName:NN}` truncation |
| Tokens are self-documenting | Security: must sanitize after interpolation |
| Preview-friendly — tokens resolve to real values | More complex validator |

### Option B — Lambda/function-based templates

Store JavaScript functions that produce paths from metadata objects.

| Pros | Cons |
| --- | --- |
| Maximum flexibility | Security nightmare — arbitrary code execution |
| No parser needed | Cannot serialize to database |
| | Cannot preview in UI without sandboxing |

### Option C — Fixed format strings with positional args

Like `printf` — `%1$s - %2$s%3$s` with ordered arguments.

| Pros | Cons |
| --- | --- |
| Simple parser | Not self-documenting |
| No security risk from template syntax | Cannot reorder or conditionally include tokens |
| | Cannot preview — operators can't see what %1 means |

### Option D — No templates, just toggle switches

Expose boolean toggles like "include year in album folder", "zero-pad track
numbers", etc.

| Pros | Cons |
| --- | --- |
| Simple to implement and validate | Limited expressiveness |
| No security surface | Cannot express `{Quality}` in album folder |
| | Doesn't match spec or competitor UX |

## Final Recommendation Stack

### R1. `{Token}` template syntax (accepted)

Use `{TokenName}` placeholders with optional `{:NN}` truncation suffix.
4 template strings in a new `naming` settings namespace.

### R2. Token set — Phase 1 (core) + Phase 2 (extended) (accepted)

**Phase 1** — tokens available from the current metadata pipeline without
additional database queries:

| Token | Source | Available In |
| --- | --- | --- |
| `{ArtistName}` | artist name from metadata | Artist folder, album folder, track filename |
| `{AlbumTitle}` | release group or release title | Album folder, track filename |
| `{ReleaseYear}` | 4-digit year from release date | Album folder, track filename |
| `{TrackNumber}` | track position (unpadded) | Track filename |
| `{TrackNumber:00}` | track position (zero-padded to 2 digits) | Track filename |
| `{SongTitle}` | track title | Track filename |
| `{DiscNumber}` | medium position | Track filename |
| `{DiscCount}` | total medium count | Track filename |

**Phase 2** (future) — tokens requiring additional metadata or analysis:

`{AlbumArtistName}`, `{ReleaseTitle}`, `{ReleaseDate}`, `{ReleaseCountry}`,
`{ReleaseFormat}`, `{Edition}`, `{Quality}`, `{AudioCodec}`, `{AudioChannels}`,
`{Bitrate}`, `{SampleRate}`, `{MusicBrainzArtistId}`,
`{MusicBrainzReleaseGroupId}`, `{MusicBrainzReleaseId}`,
`{MusicBrainzRecordingId}`

### R3. 4 template strings (accepted)

Matching Lidarr's 4-template model:

| Setting | Default | Applied To |
| --- | --- | --- |
| `artistFolderFormat` | `{ArtistName}` | Artist folder name |
| `albumFolderFormat` | `{AlbumTitle} ({ReleaseYear})` | Album subfolder name |
| `trackFilenameFormat` | `{TrackNumber:00} - {SongTitle}` | Track filename (single-disc) |
| `multiDiscTrackFilenameFormat` | `{DiscNumber}-{TrackNumber:00} - {SongTitle}` | Track filename (multi-disc) |

### R4. Template engine as a separate module (accepted)

Create `library-naming-template-engine.js` — a pure function module that:
1. Parses template strings into token references
2. Resolves tokens from a metadata context object
3. Applies `sanitizeStem` to each resolved segment
4. Returns the final path segment string

This keeps the template engine testable independently of the naming service.

### R5. Security — multi-layer defense (accepted)

1. **Token allowlist**: Only resolve known token names. Unknown `{Foo}` renders
   as literal `{Foo}` (not stripped, not resolved — visible in preview so
   operators see their typo).
2. **Post-interpolation sanitization**: Apply `sanitizeStem` to every segment.
   This strips `/`, `\`, `..`, control characters, and Windows reserved names.
3. **Path separator rejection in validator**: The settings validator rejects
   template strings containing `/`, `\`, or `..` — these are path separators
   that don't belong in individual segment templates.
4. **Containment check**: The organize preview service already validates that
   proposed paths stay within the library root (`blocked_outside_root`).
5. **No template in root path**: The library root path is configured separately
   in `paths.music`. Templates only produce relative segment names.

### R6. Extension appended automatically (accepted)

Track filename templates do NOT include the file extension. The naming service
appends the extension after template resolution, matching current behavior
(`normalizeFileExtension`).

---

## Architecture

### New files

| File | Role |
| --- | --- |
| `src/server/library/library-naming-template-engine.js` | Pure template parser + resolver |
| `test/server/library-naming-template-engine.test.js` | Template engine tests |

### Modified files

| File | Change |
| --- | --- |
| `src/server/validators/settings-validator.js` | Add `naming` namespace (4 string fields) |
| `src/server/library/library-naming-service.js` | Accept templates via `loadSettingsFn` |
| `src/server/library/library-module.js` | Wire `loadSettingsFn` to naming service |
| `src/client/lib/settings-form.js` | Add `naming` spread to payload builder |
| `src/client/composables/useSettingsForm.js` | Add `naming` form defaults + apply |
| `src/client/views/SettingsLibraryView.vue` | Add "Naming templates" card |
| `test/client/settings-form.test.js` | Add naming payload tests |
| `test/client/settings-library-view-contract.test.js` | Add naming contract tests |
| `test/server/settings-validator.test.js` | Add naming validation tests |

### Token resolution context

The template engine receives a flat context object with available tokens:

```js
// Artist folder context
{ ArtistName: 'Radiohead' }

// Album folder context
{ ArtistName: 'Radiohead', AlbumTitle: 'OK Computer', ReleaseYear: '1997' }

// Track filename context (single-disc)
{
  ArtistName: 'Radiohead', AlbumTitle: 'OK Computer', ReleaseYear: '1997',
  TrackNumber: 1, SongTitle: 'Airbag', DiscNumber: 1, DiscCount: 1,
}

// Track filename context (multi-disc)
{
  ArtistName: 'Radiohead', AlbumTitle: 'In Rainbows', ReleaseYear: '2007',
  TrackNumber: 1, SongTitle: '15 Step', DiscNumber: 1, DiscCount: 2,
}
```

### Template engine API

```js
export function createNamingTemplateEngine() {
  function resolveTemplate(template, context) { ... }
  function validateTemplate(template) { ... }
  function listAvailableTokens() { ... }
  return { listAvailableTokens, resolveTemplate, validateTemplate };
}
```

### Settings validator — `naming` namespace

| Setting | Type | Default | Validation |
| --- | --- | --- | --- |
| `artistFolderFormat` | string | `{ArtistName}` | Non-empty, no `/`, `\`, or `..` |
| `albumFolderFormat` | string | `{AlbumTitle} ({ReleaseYear})` | Non-empty, no `/`, `\`, or `..` |
| `trackFilenameFormat` | string | `{TrackNumber:00} - {SongTitle}` | Non-empty, no `/`, `\`, or `..` |
| `multiDiscTrackFilenameFormat` | string | `{DiscNumber}-{TrackNumber:00} - {SongTitle}` | Non-empty, no `/`, `\`, or `..` |

### Naming service consumption

The naming service factory gains `loadSettingsFn` and resolves templates per call:

```
createLibraryNamingService({ loadSettingsFn = loadSettings })
  → resolveNamingTemplates(settings)
  → for each build call: use template or fallback to hardcoded default
```

Graceful fallback: if `loadSettingsFn` throws or returns no `naming` namespace,
use the hardcoded defaults (identical to current behavior).

### Frontend — "Naming templates" card

A new card in `SettingsLibraryView.vue` with:

1. **4 template input fields** — one per setting, with monospace font
2. **Token reference** — collapsible list of available tokens with descriptions
3. **Live preview** — example output for each template (resolved with sample data)
4. **Reset to defaults** button

---

## Implementation Phases

### Phase 1 — Template engine + defaults extraction

- Extract hardcoded defaults to `DEFAULT_NAMING_TEMPLATES` constant
- Create `library-naming-template-engine.js` (parser, resolver, validator)
- Test the template engine exhaustively

### Phase 2 — Settings namespace + validator

- Add `naming` namespace to `settings-validator.js`
- Add naming payload builder + composable defaults
- Add naming contract tests

### Phase 3 — Naming service consumption

- Wire `loadSettingsFn` to naming service
- Resolver helper: `resolveNamingSettings(settings)`
- Graceful fallback on settings failure

### Phase 4 — Frontend card

- "Naming templates" card in `SettingsLibraryView.vue`
- Token reference section
- Live preview section
- Reset to defaults button

---

## Security

### Attack surface analysis

The template strings are operator-controlled settings persisted in the database.
An admin-level operator (the only role that can modify settings) could craft a
malicious template. Defense layers:

| Layer | Protection |
| --- | --- |
| Validator | Rejects `/`, `\`, `..` in templates — prevents path separators |
| Template engine | Token allowlist — unknown tokens rendered as literals, not resolved |
| Sanitization | `sanitizeStem` strips reserved characters from resolved values |
| Containment | Organize preview validates paths stay within library root |
| Auth | Settings endpoint requires admin role |

### Threat: Path traversal via token values

Token values come from MusicBrainz metadata (artist names, album titles). These
could theoretically contain `/` or `..`. The `sanitizeStem` pipeline already
strips `/\` via `reservedCharacterPattern`, so resolved values are safe.

### Threat: Path traversal via template literals

Template literals between tokens could contain `/` or `..`. The validator
rejects these at persistence time. As defense-in-depth, the template engine
also strips path separators from literal text.

### Threat: Overly long paths

Windows enforces a 260-character path limit. The `:NN` truncation suffix
(let `{AlbumTitle:100}`) caps resolved values. The default templates don't
include truncation, but operators can add it for long-name libraries.

## Validation

After all phases:

- `node --test test/server/library-naming-template-engine.test.js` — new
- `node --test test/server/library-naming-service.test.js` — extended
- `node --test test/server/settings-validator.test.js` — extended
- `node --test test/client/settings-form.test.js` — extended
- `node --test test/client/settings-library-view-contract.test.js` — extended
- `npm run lint:client` — 0 warnings
- `npm run lint:server` — 0 warnings

## Future Enhancements

1. **Phase 2 tokens** — `{Quality}`, `{AudioCodec}`, etc. from file analysis
2. **Conditional tokens** — `{ (Edition)}` renders nothing if empty (Lidarr pattern)
3. **Per-artist template overrides** — different templates for classical vs pop
4. **Template import/export** — share naming conventions between instances
5. **`{ArtistNameThe}` variant** — move leading "The" to end for sorting

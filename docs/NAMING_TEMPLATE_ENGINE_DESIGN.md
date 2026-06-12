# Naming Template Engine Design (R1)

> Implements the `{Token}` template syntax with optional `{:NN}` truncation for
> the naming template system. Pure function module — no dependencies on settings,
> database, or filesystem.

## Research Sources

| Source | Topic | URL |
| --- | --- | --- |
| MDN | `String.prototype.replace()` with regex replacer function | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace |
| Stack Overflow | Token-based string replacement using regex with replacer function | https://stackoverflow.com/questions/377961/ |
| OWASP | Path traversal prevention (validate input, normalize, containment check) | https://owasp.org/www-community/attacks/Path_Traversal |
| Lidarr Naming Guide | Token syntax `{Token Name}`, truncation `{Token Name:150}`, conditional `{ (Token)}` | https://wiki.servarr.com/lidarr/naming-guide |
| Lidarr GitHub | Community token requests — tokens are allowlisted, not extensible by users | https://github.com/Lidarr/Lidarr/issues/5694 |
| OWASP Input Validation | Allowlist > denylist, validate type/length/range/format | https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html |

## Research Findings

### 1. Token Replacement via `String.prototype.replace()` (MDN)

The standard JavaScript pattern for token replacement is:

```js
template.replace(/\{(\w+)\}/g, (match, tokenName) => {
  return context.hasOwnProperty(tokenName) ? context[tokenName] : match;
});
```

Key properties:
- Regex with global flag (`g`) replaces all occurrences in one pass
- Replacer function receives `(match, p1, offset, string)` — `p1` is the captured group
- No intermediate string creation — the engine builds the result incrementally
- Unknown tokens: return the original `match` to leave them as-is (visible to operator)

### 2. OWASP Path Traversal Prevention

For template strings that produce filesystem path segments:

- **Validate input** — only accept known-good patterns (allowlist)
- **Normalize after interpolation** — strip `..`, `/`, `\`, null bytes
- **Surround with your path code** — templates produce relative segments, not absolute paths
- **Reject path separators** in template literals at validation time

### 3. Lidarr Token Syntax

Lidarr uses `{Token Name}` with spaces. Observations:
- Tokens like `{Artist Name}`, `{Album Title}`, `{track:00}`
- Truncation: `{Album Title:150}` — caps at N characters
- Conditional: `{ (Album Disambiguation)}` — renders nothing if empty (including surrounding literal text)
- Cleaned variants: `{Artist CleanName}` — illegal chars removed
- The "The" variants: `{Artist NameThe}` — moves "The" to end

For Harmoniarr, tokens use PascalCase without spaces (`{ArtistName}` not `{Artist Name}`) per the existing `harmoniarr.md` spec. This avoids regex complexity with spaces inside braces.

## Options Considered

### Option A — Single-pass regex replacer (recommended)

Use a single `String.prototype.replace()` call with a regex that captures both
token name and optional truncation suffix:

```js
const TOKEN_PATTERN = /\{(\w+)(?::(\d+))?\}/g;
```

Replacer function resolves token from allowlist context, applies truncation if
specified, and returns the result. Unknown tokens are left as literal text.

| Pros | Cons |
| --- | --- |
| Single pass — no intermediate strings | Must handle edge cases (empty token, zero truncation) |
| Standard JavaScript — no dependencies | Regex must be carefully crafted |
| O(n) where n = template length | |
| Unknown tokens visible as `{Foo}` | |

### Option B — Split-and-join approach

Split the template on `{` and `}`, then map each segment through a resolver:

```js
template.split(/\{|\}/).map(segment => resolve(segment)).join('');
```

| Pros | Cons |
| --- | --- |
| Simple mental model | Multiple passes (split, map, join) |
| Easy to debug | Creates intermediate array |
| | Doesn't preserve unknown tokens easily |

### Option C — Compiled template functions

Parse the template into a function at "compile" time, cache it, and call it with context:

```js
const compiled = compileTemplate('{ArtistName} - {SongTitle}');
compiled({ ArtistName: 'Radiohead', SongTitle: 'Airbag' });
```

| Pros | Cons |
| --- | --- |
| Fast repeated resolution | Over-engineered for 4 templates |
| Caching avoids re-parsing | More complex code |
| | Harder to test individual parts |

## Final Recommendation Stack

### R1-A: Single-pass regex replacer (accepted)

Regex: `/\{(\w+)(?::(\d+))?\}/g`

- Captures token name in group 1: `(\w+)`
- Optionally captures truncation length in group 2: `(?::(\d+))?`
- Global flag replaces all tokens in one pass
- Replacer function: allowlist lookup → truncation → sanitization

### R1-B: Token allowlist map (accepted)

Each context object only contains allowed tokens. Tokens not in the context are
left as literal text (not stripped). This means:

- `{ArtistName}` with context `{ ArtistName: 'Radiohead' }` → `Radiohead`
- `{UnknownToken}` with context `{ ArtistName: 'Radiohead' }` → `{UnknownToken}`
- This is **by design** — operators see their typos in preview, making them easy to fix

### R1-C: Truncation via `:NN` suffix (accepted)

`{AlbumTitle:50}` truncates the resolved value to 50 characters. Behavior:

- `{AlbumTitle:50}` with `AlbumTitle: 'A Very Long Album Title...'` → first 50 chars
- `{AlbumTitle:0}` → empty string (zero-length truncation is valid but produces nothing)
- `{AlbumTitle}` → no truncation, full value

> **Note**: The `:NN` suffix is **character truncation only** — it is NOT zero-padding.
> Numeric formatting (like padding track numbers to 2 digits) is handled by the
> naming service's builder functions before passing values to the template engine.
> Default templates use `{TrackNumber}` without padding suffixes because the calling
> code is expected to pre-format numeric values.

### R1-D: Post-resolution sanitization (accepted)

After token replacement, the result passes through `sanitizeStem()` from the
existing naming service. This ensures:

- Reserved characters (`<>:"/\|?*`) are replaced
- Control characters are stripped
- Whitespace is collapsed
- Windows reserved device names are protected

The template engine does NOT sanitize internally — it delegates to the naming
service's existing sanitization pipeline. This avoids duplicating the sanitization
logic.

### R1-E: Template validation function (accepted)

A `validateTemplate(template)` function checks that a template string is safe
for use as a path segment:

1. Must be a non-empty string
2. Must not contain `/`, `\`, or `..` (path traversal vectors)
3. Must contain at least one `{Token}` or some literal text
4. Returns `{ valid: true }` or `{ valid: false, reason: '...' }`

This is called by the settings validator when persisting template strings.

### R1-F: No conditional tokens (deferred)

Lidarr's conditional format `{ (Album Disambiguation)}` is clever but adds
significant parsing complexity. For Phase 1, operators can achieve similar
results by using separate templates. Conditional tokens can be added in Phase 2
if operators request them.

## API Design

```js
// library-naming-template-engine.js

export const DEFAULT_NAMING_TEMPLATES = Object.freeze({
  artistFolderFormat: '{ArtistName}',
  albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
  trackFilenameFormat: '{TrackNumber} - {SongTitle}',
  multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
});

export const NAMING_TEMPLATE_TOKENS = Object.freeze({
  ArtistName: { description: 'Artist name from metadata', availableIn: ['artist', 'album', 'track'] },
  AlbumTitle: { description: 'Album or release group title', availableIn: ['album', 'track'] },
  ReleaseYear: { description: 'Four-digit release year', availableIn: ['album', 'track'] },
  SongTitle: { description: 'Track title from metadata', availableIn: ['track'] },
  TrackNumber: { description: 'Track position (unpadded)', availableIn: ['track'] },
  DiscNumber: { description: 'Disc/medium position', availableIn: ['track'] },
  DiscCount: { description: 'Total disc/medium count', availableIn: ['track'] },
});

export function resolveTemplate(template, context) { ... }
export function validateTemplate(template) { ... }
export function listAvailableTokens() { ... }
```

## Security

| Threat | Mitigation |
| --- | --- |
| Path traversal via `..` in template literal | `validateTemplate` rejects `..` at persistence |
| Path separators `/`, `\` in template literal | `validateTemplate` rejects them at persistence |
| Path traversal via token values (e.g., artist name containing `../`) | `sanitizeStem` strips `/\` via `reservedCharacterPattern` |
| Null byte injection | `replaceControlCharacters` strips codepoints <= 0x1F |
| Windows reserved device names | `protectReservedDeviceName` appends `_` |
| Overly long paths | `:NN` truncation suffix available for operators |
| Unknown tokens rendered as literals | Not a threat — visible to operator in preview |

## Outcome

Implements a pure-function template engine with no external dependencies.
Token replacement uses standard `String.prototype.replace()` with regex.
Validation rejects path traversal vectors. Post-resolution sanitization
delegated to existing `sanitizeStem` pipeline.

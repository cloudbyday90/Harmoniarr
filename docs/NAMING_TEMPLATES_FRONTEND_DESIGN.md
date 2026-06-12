# Naming Templates Frontend Card Design (R4)

> Adds a "Naming templates" card to `SettingsLibraryView.vue` with 4 template
> input fields, a token reference section, and a reset-to-defaults button.

## Research Sources

| Source | Topic | Key Takeaway |
| --- | --- | --- |
| Vue.js Accessibility Guide | Semantic HTML, ARIA labels, associated text for form inputs | Use `<label class="hx-field-label">` for all inputs; no need for extra ARIA when label is associated |
| WCAG 2.2 (W3C) | 1.3.1 Info and Relationships; 3.3.2 Labels or Instructions | Labels must be programmatically associated with inputs; provide instructions when needed |
| Harmoniarr UI skill | Design system tokens, card pattern, form primitives | Use `.hx-card`, `.hx-card-header`, `.hx-card-body`, `.hx-form-row`, `.hx-field`, `.hx-field-label`, `.hx-input` |
| Lidarr naming UI | Monospace font for template inputs; token reference list below inputs | Template strings should use monospace font so `{Token}` syntax is visually distinct |
| Existing card patterns | Fidelity card as closest analog — groups, hints, reset button | Follow the fidelity card structure exactly: cfg-group sections, cfg-group-title, cfg-field-hint |

## Existing Card Patterns (from fidelity card)

The fidelity card uses this structure:

```html
<article class="hx-card">
  <header class="hx-card-header">
    <div>
      <h3 class="hx-card-title">Title <span class="hx-pill" ...>advanced</span></h3>
      <p class="hx-card-subtitle">Description</p>
    </div>
  </header>
  <div class="hx-card-body">
    <div class="cfg-group" style="padding-top: 0; border-top: none">
      <p class="cfg-group-title">Group name</p>
      <p class="hx-text-muted">Group description</p>
      <div class="hx-form-row">
        <div class="hx-field">
          <label class="hx-field-label">Label</label>
          <input class="hx-input" v-model.number="..." />
          <p class="cfg-field-hint">Hint text</p>
        </div>
      </div>
    </div>
    <div class="cfg-group">...</div>
    <div class="cfg-group">
      <!-- Reset button row -->
      <div class="hx-form-row" style="align-items: center">
        <div class="hx-field"><p class="cfg-group-title">Defaults</p><p class="cfg-field-hint">...</p></div>
        <div class="hx-field" style="text-align: right"><button type="button" class="hx-btn" data-variant="ghost" @click="resetFn">Reset to defaults</button></div>
      </div>
    </div>
  </div>
</article>
```

## Options Considered

### Option A — 4 fields in 2 groups + token reference + reset (recommended)

Split the 4 template fields into 2 groups:
1. **Folder naming** — artist folder format + album folder format
2. **Track naming** — track filename format + multi-disc track filename format

Plus a token reference section with available tokens listed as a compact reference,
and a reset-to-defaults button.

| Pros | Cons |
| --- | --- |
| Logical grouping matches Lidarr's mental model | More vertical space |
| Each group has a clear purpose | Token reference adds complexity |
| Follows existing 2-column form-row pattern | |

### Option B — Single group with all 4 fields

Put all 4 template fields in a single group without subdivision.

| Pros | Cons |
| --- | --- |
| Simpler markup | Less scannable — hard to distinguish folder vs track templates |
| Less vertical space | No logical grouping |

### Option C — Tabbed layout with tabs per template

Use a tab bar to switch between the 4 templates.

| Pros | Cons |
| --- | --- |
| Most compact | Over-engineered for 4 fields |
| Only one visible at a time | Can't see all templates at once |
| | Doesn't match existing card pattern |

## Final Recommendation Stack

### R4-A: 2 groups + token reference + reset (accepted)

Option A. The card follows the fidelity card pattern with:
- **Group 1: Folder naming** — artist folder format + album folder format (2-column row)
- **Group 2: Track naming** — track filename format + multi-disc format (2-column row)
- **Group 3: Token reference** — compact inline listing of available tokens
- **Group 4: Reset** — reset to defaults button row

### R4-B: Monospace font via inline style (accepted)

Template inputs should use the monospace font from the design system:
```html
<input class="hx-input" style="font-family: var(--hx-font-mono)" v-model="..." />
```
This makes `{Token}` syntax visually distinct without adding new CSS classes.

### R4-C: Token reference as compact text (accepted)

Rather than a complex collapsible component, use a simple `cfg-field-hint` paragraph
listing the available tokens:
```
Available tokens: {ArtistName} {AlbumTitle} {ReleaseYear} {SongTitle} {TrackNumber} {DiscNumber} {DiscCount}
```
This matches the existing hint text pattern and requires no new components.

### R4-D: `NAMING_DEFAULTS` constant (accepted)

Add a `NAMING_DEFAULTS` constant in the `<script setup>` block (matching the
existing `SCORING_WEIGHT_DEFAULTS` and `FIDELITY_DEFAULTS` pattern) and a
`resetNamingDefaults()` function.

### R4-E: Card position after Fidelity (accepted)

The naming templates card is placed after the fidelity card and before the
save bar. This follows the logical flow: Discovery → Acquisition → Retention →
Scoring → Fidelity → Naming → Save.

### R4-F: "(advanced)" badge (accepted)

Add the same `<span class="hx-pill" data-tone="info">advanced</span>` badge to
the card title, matching the scoring and fidelity cards.

## Security

| Concern | Mitigation |
| --- | --- |
| XSS via template values in input fields | Vue's `v-model` auto-escapes; input fields display template strings as text |
| Path traversal in template input | Server-side validator (`normalizeTemplateSetting`) rejects `/`, `\`, `..` |
| Token injection | Not applicable — tokens are resolved server-side; client only sends template strings |

## Modified Files

| File | Change |
| --- | --- |
| `src/client/views/SettingsLibraryView.vue` | Add `NAMING_DEFAULTS` constant, `resetNamingDefaults()` function, and naming templates card |
| `test/client/settings-library-view-contract.test.js` | Add contract tests for naming template card presence, field wiring, labels, and reset button |

## Outcome

The naming templates card follows the exact same structure as the fidelity card
— groups with titles, hints, 2-column form rows, monospace inputs, a token
reference section, and a reset-to-defaults button. No new CSS classes needed.
No new components needed.

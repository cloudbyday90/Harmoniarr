# Route Rogue Card Images Through `ArtworkImage`

Status: **Implemented (OperatorArtistCard); deferred (ArtistDetailRelatedArtistCard).**
This document records the design and outcome for proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):
routing the two "rogue" card components that bypassed `ArtworkImage` through the
shared component, extending the full skeleton/fade/cross-fade loading UX.

---

## 1. Purpose

Discovered in Batch U: `OperatorArtistCard` and `ArtistDetailRelatedArtistCard`
rendered their own `<img loading="lazy decoding="async">` directly, bypassing
`ArtworkImage`. They therefore missed the Batch E/O/Q/S skeleton/fade/cross-fade
treatment that every other card artwork gets.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Named slots + fallback content | Vue.js Docs — *Slots § Fallback Content* | Place default content inside `<slot>` tags; the parent overrides with `#name`. Used to make ArtworkImage's error placeholder customizable. |
| Component composition | Vue School — *Complete Guide to Vue Slots* | Named slots with defaults are the right pattern for "child owns behavior, parent customizes a fragment." |

---

## 3. Design

### 3.1 `ArtworkImage` — `#fallback` slot (new)

Added a named `#fallback` slot to ArtworkImage's error-state placeholder. The
default content (the music-note SVG) renders when no slot is provided; cards that
want a custom avatar fallback pass `#fallback`. This lets each card preserve its
distinctive colored-avatar fallback while delegating the loading/skeleton/fade
lifecycle to ArtworkImage.

### 3.2 `OperatorArtistCard` — routed through `ArtworkImage`

Replaced the bare `<img>` + avatar `v-if`/`v-else` in the `#artwork` slot with:

```html
<ArtworkImage :local-src="artwork?.url" :alt="cardArtist.name">
  <template #fallback>
    <div class="operator-artist-card__avatar" :style="..." aria-hidden="true">
      <span class="operator-artist-card__initial">{{ ... }}</span>
    </div>
  </template>
</ArtworkImage>
```

ArtworkImage handles loading/loaded/error + skeleton + fade + cross-fade
(Batches E/O/Q/S). The `#fallback` slot preserves the colored artist-initial
avatar on error. Removed the unused `.operator-artist-card__image` CSS; updated
`.operator-artist-card__avatar` to fill the ArtworkImage container (`width/height:
100%`). The `dominantColor`/`artworkAssetId` props (color theming) still pass to
`ArtistCard` unchanged — they're prop-driven, not img-ref-driven.

### 3.3 `ArtistDetailRelatedArtistCard` — deferred

This card is a compact horizontal list item with a **60px round avatar**
(`border-radius: 50%`, `grid-template-columns: 60px ...`). ArtworkImage's
`.hx-artwork` container is designed for square card artwork (`aspect-ratio: 1/1`,
`border-radius-md`, `overflow: hidden`). Forcing ArtworkImage into the 60px round
avatar shape requires CSS overrides (border-radius, aspect-ratio, explicit
sizing) and the loading UX value is minimal at 60px. **Deferred** — the card
keeps its own `<img decoding="async">`.

---

## 4. Security

- **Component composition + slot.** No script/data-flow/injection change; no
  `v-html`. The slot content is the card's existing avatar markup (unchanged).

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/ArtworkImage.vue` | Added `#fallback` named slot (default: music-note SVG). |
| `src/client/components/home/OperatorArtistCard.vue` | Replaced `<img>` + avatar with `<ArtworkImage>` + `#fallback`; removed unused image CSS; updated avatar to fill. |

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.

---

## 7. Outcome

`OperatorArtistCard` now gets the full ArtworkImage loading lifecycle (skeleton
→ fade-in → cross-fade) and the Batch U `decoding="async"`. The `#fallback` slot
preserves its distinctive colored-avatar error state. `ArtistDetailRelatedArtistCard`
is documented as deferred (layout mismatch, low value). ArtworkImage's new
`#fallback` slot is available for any future card that wants a custom error
placeholder.

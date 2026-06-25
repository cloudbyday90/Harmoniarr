# Cross-Fade Skeleton→Image Handoff

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):
eliminating the brief flash of the container background that occurred when the
skeleton was removed instantly while the image faded in — by keeping the skeleton
**persistent under** the fading image so no background ever shows through.

It refines Batches M/O ([ARTWORK_FADE_IN_DESIGN.md](ARTWORK_FADE_IN_DESIGN.md))
and Q ([ARTWORK_IMAGE_SKELETON_DESIGN.md](ARTWORK_IMAGE_SKELETON_DESIGN.md)).

---

## 1. Purpose

Batches M/O added a fade-in (opacity 0→1, 200ms) on the artwork `<img>` on
`@load`, and Batches E/Q added a solid skeleton during loading. But the skeleton
was removed **instantly** when the image loaded (the loading state ended), while
the image was still mid-fade (opacity ~0.5). For that 200ms window the sunken
container background showed through the semi-transparent image — a brief flash.

---

## 2. Design decision: persistent placeholder, not a literal cross-fade

A literal cross-fade (skeleton opacity 1→0 *while* image opacity 0→1) causes a
"**dip**" at the midpoint: both elements are at ~0.5 opacity, so the background
shows through more at the midpoint than at either end — a visible darkening
flash.

The **better** technique: keep the skeleton **at full opacity under the image**
and only fade the image in over it. The skeleton never changes opacity; the image
fades from transparent to opaque, always with the skeleton fully visible
underneath. No dip, no flash. When the image reaches opacity 1, it fully covers
the skeleton. This is the standard image-loading pattern (placeholder-persists-
under-content).

This required solving a **CSS painting-order** issue: the skeleton `::after`
(positioned) painted *above* the non-positioned `<img>`. If the skeleton
persisted, it would cover the image. The fix: give the image
`position: relative; z-index: 1;` so it paints above the skeleton.

---

## 3. Changes

### 3.1 `ArtworkImage.vue`

- `.hx-artwork__img` gains `position: relative; z-index: 1;` (above the `::after`).
- The skeleton `::after` selector now includes `[data-state='loaded']` (persists
  during loaded, under the image). Shared gradient/inset properties; `loading`
  gets the pulse animation, `loaded` gets `animation: none` (stop pulsing once the
  image is fading in over it).
- The existing reduced-motion guard (loading `::after` → `animation: none`) and
  the Batch O fade transition (`no-preference` only) are unchanged. Under
  reduced-motion, both the skeleton removal and the image appearance are instant
  (no transition) → no flash.

### 3.2 `DiscoverArtistCard.vue`

- `showSkeleton` changed from
  `artworkState === 'image' && !imageLoaded && !imageFailed` to
  `artworkState === 'image' && !imageFailed` — the skeleton now persists during
  the image state regardless of load completion, staying under the fading image.
- The skeleton `<div>` gains `:class="{ 'is-covered': imageLoaded }"`; CSS
  `.discover-artist-card__skeleton.is-covered { animation: none; }` stops the
  pulse once the image has loaded.
- DOM order already places the skeleton before the img (both `position: absolute`)
  → skeleton paints below, image above. No z-index needed.

---

## 4. Security

- **CSS-only** (ArtworkImage) + **computed/template tweak** (DiscoverArtistCard).
  No data-flow, script, or markup-semantics change; no `v-html`.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/ArtworkImage.vue` | img `z-index: 1`; `::after` persists during loaded with `animation: none`. |
| `src/client/components/media/DiscoverArtistCard.vue` | `showSkeleton` persists during image state; `is-covered` class stops the skeleton pulse. |

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.

---

## 7. Outcome

The skeleton→image handoff is now flash-free across the entire card system.
During loading: a prominent pulsing skeleton. On load: the skeleton persists
under the fading image (no background flash, no dip). After the 200ms fade: the
image is opaque, the skeleton is invisible underneath with its animation stopped.
Reduced-motion users get an instant swap (no transition on either layer).

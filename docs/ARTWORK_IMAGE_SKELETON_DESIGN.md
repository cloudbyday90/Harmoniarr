# Prominent Shared Skeleton for `ArtworkImage`

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): replacing
`ArtworkImage`'s faint loading sheen with a prominent solid skeleton so every
card artwork has consistent, visible loading feedback.

It complements Batch O ([ARTWORK_IMAGE_FADE_IN_DESIGN.md](ARTWORK_IMAGE_FADE_IN_DESIGN.md))
and reuses Batch E's skeleton primitive
([DISCOVER_ARTWORK_SKELETONS_DESIGN.md](DISCOVER_ARTWORK_SKELETONS_DESIGN.md)).

---

## 1. Purpose

Batch O hid `ArtworkImage`'s `<img>` (`opacity: 0`) until loaded, leaving the
loading state as just the faint `::after` sheen (`rgba(255,255,255,0.06)` = 6%
white) over an empty box. That sheen was designed to overlay a progressively
painting image; over an empty box it was nearly imperceptible — far subtler than
Batch E's prominent skeleton on `DiscoverArtistCard`. Non-Discover cards
(Release/Request/Artist) therefore had weak, easy-to-miss loading feedback.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Skeleton contrast | W3C WCAG issue #2048 (a11y group discussion) | Skeletons convey a "loading" state; faint ones are missed by low-vision users — a WCAG 1.4.11 (Non-text Contrast) concern. Best practice: make them clearly visible. |
| Authoritative view | Adrian Roselli — *More Accessible Skeletons* (cited in #2048) | Considers low-contrast skeletons a 1.4.11 failure; users in testing missed them and fumbled around the loading page. |
| Reuse | Batch E design | The `hx-skeleton-pulse` keyframes + `surface-muted`/`sunken` gradient are the established prominent skeleton. |

The 6%-white sheen was exactly the failure the research describes; the solid
gradient skeleton is the fix.

---

## 3. Design

A CSS-only change to `ArtworkImage.vue`. The `[data-state='loading']::after`
overlay was changed from the faint sheen to the solid skeleton gradient used by
`.hx-skeleton` (Batch E), animated with the **global** `hx-skeleton-pulse`
keyframes:

```css
.hx-artwork[data-state='loading']::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--hx-bg-surface-muted) 0%,
    var(--hx-bg-surface-sunken) 50%,
    var(--hx-bg-surface-muted) 100%
  );
  background-size: 200% 100%;
  animation: hx-skeleton-pulse 1.4s ease-in-out infinite;
}
```

- The now-unused local `@keyframes hx-artwork-shimmer` was deleted (the global
  `hx-skeleton-pulse` replaces it).
- The existing `prefers-reduced-motion: reduce` guard already targets this
  `::after` (`animation: none`) → reduced-motion users see a static gradient.
- The Batch O fade-in (`opacity 0→1` on `[data-state='loaded']`) and the error
  placeholder state are unchanged.

The `::after` is a solid overlay, so during loading the box reads as a clear
pulsing skeleton (visible to low-vision users); on load the overlay is removed
and the image fades in.

---

## 4. Security

- **CSS-only.** No script, template, data-flow, or markup change; no `v-html`.
- **No new network/auth/query surface.** Purely presentational.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/ArtworkImage.vue` | `::after` sheen → solid skeleton gradient + global `hx-skeleton-pulse`; deleted `@keyframes hx-artwork-shimmer`. |

No new pure helper or test module — declarative CSS over the existing,
already-tested state machine.

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.
- **Recommended confirmation:** a visual check across the card grids that artwork
  shows a prominent pulsing skeleton while loading and a static one under
  reduced motion — not runnable in-env.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Solid skeleton via the existing `::after` | Prominent/visible (WCAG 1.4.11); reuses `hx-skeleton-pulse`; minimal diff | Slightly heavier paint than the faint sheen | **Adopted.** |
| Reuse global `hx-skeleton-pulse` (not a local keyframe) | One skeleton look across the app (Batch E parity) | — | **Adopted.** |

**Final stack.** A CSS-only swap of `ArtworkImage`'s loading overlay from a faint
sheen to the Batch E solid skeleton, reusing the global `hx-skeleton-pulse`
keyframes. Every card artwork now has consistent, visible, motion-respectful
loading feedback — and the handoff still fades in via Batch O.

# Artwork Skeleton→Image Fade-In

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): a smooth
cross-fade from the loading skeleton to the resolved artwork image, completing
the loading-state story begun in Batch E
([DISCOVER_ARTWORK_SKELETONS_DESIGN.md](DISCOVER_ARTWORK_SKELETONS_DESIGN.md)).

---

## 1. Purpose

Batch E gave `DiscoverArtistCard` a `loading` skeleton that shows until the
artwork URL resolves. But the moment the URL resolved, the skeleton was swapped
for the `<img>` as a hard cut — and the image still had to be fetched and painted
after that, so the skeleton often disappeared into a brief blank box before the
image popped in. This batch makes the handoff deliberate: the skeleton stays over
the fetch gap, and the image fades in only once it has actually painted (`@load`).

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Opacity fade & CLS | web-vitals issue #43 (Philip Walton, dryoma) | Opacity fade is CLS-safe **as long as dimensions are reserved** — the artwork box has `aspect-ratio: 1/1` (Batch E), so the fade cannot reflow. |
| Opacity fade & LCP | DebugBear — *opacity animation & LCP* | Opacity-0 elements aren't LCP candidates, but "this doesn't seem to apply to images"; card artwork is not the page LCP element, so the fade is LCP-safe. |
| Idiomatic pattern | web-vitals issue #43 (WP Rocket example) | `img { opacity: 0 } img.loaded { transition: opacity .25s; opacity: 1 }` gated on the load event — exactly the pattern used here. |
| Reduced motion | WCAG 2.2.2 / technique C39 (Batch E) | Wrap the transition in `prefers-reduced-motion: no-preference`; reduced-motion users see an instant swap. |

---

## 3. Design

### 3.1 Paint-lifecycle state — `DiscoverArtistCard.vue`

Two refs track the resolved `<img>` lifecycle, driven by `@load`/`@error` and
reset whenever the URL changes (so a new image re-fades):

- `imageLoaded` — set `true` on `@load`.
- `imageFailed` — set `true` on `@error` (falls back to the avatar instead of a
  perpetual skeleton or broken-image icon — a regression my "skeleton-until-load"
  change would otherwise have introduced).

Three mutually exclusive computeds derive what renders, layered over the Batch E
`artworkState`:

- `showSkeleton` — `loading`, or `image && !loaded && !failed` (covers the fetch
  gap between URL-resolution and paint).
- `showImage` — `image && !failed`.
- `showAvatar` — `initial`, or `failed`.

### 3.2 Overlay cross-fade

The `<img>` overlays the skeleton (both `position: absolute; inset: 0`), so the
image can cross-fade in on top of it. The container `.hx-media-card__artwork`
gained `position: relative` (design-system.css) so the absolute children anchor
to the artwork box, whose `aspect-ratio` already reserves the geometry.

```css
.discover-artist-card__image { position: absolute; inset: 0; …; opacity: 0; }
.discover-artist-card__image.is-loaded { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .discover-artist-card__image { transition: opacity 200ms ease; }
}
```

`:class="{ 'is-loaded': imageLoaded }"` toggles the opacity; the transition only
exists under `no-preference`, so reduced-motion users get an instant appearance.

### 3.3 Avatar fill fix (incidental)

While here, `.discover-artist-card__avatar` (which now also renders on
image-failure) was made `position: absolute; inset: 0;` so it fills the square
and centers the initial — it previously had no dimensions and sat short in the
box (a pre-existing Batch E gap).

### 3.4 No new pure helper

The Batch E proposal floated an optional `resolveImageTransition` helper.
Reduced-motion is handled declaratively by the CSS media query, and the JS is two
booleans — so a helper would add indirection without testable logic. Omitted.

---

## 4. Security

- **No injection surface.** CSS opacity/transition + a boolean paint flag; no
  `v-html`, no engine/user string rendered as markup.
- **No data-flow change.** The artwork URL, alt text, and the Batch E
  `resolveArtworkDisplayState` contract are unchanged.
- **No new network surface.**

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/media/DiscoverArtistCard.vue` | `imageLoaded`/`imageFailed` refs + URL watch; `showSkeleton`/`showImage`/`showAvatar` computeds; overlay artwork slot (`@load`/`@error` fade); CSS (absolute overlay, opacity fade, reduced-motion guard); avatar fill fix. |
| `src/client/design-system.css` | `.hx-media-card__artwork { position: relative }` so absolute children anchor. |
| `test/client/discover-artist-card-contract.test.js` | Updated the pinned import-line assertion to `computed, ref, watch`. |

---

## 6. Validation

- Focused: `node --test test/client/discover-artist-card-contract.test.js
  test/client/artwork-display-state.test.js` → **13/13 pass**.
- Full client suite: `npm run test:client` → **3660 pass, 0 fail** (the contract
  test that pins the component's import line was updated for the new imports).
- Lint: `npm run lint:client` + `npm run lint:test` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- **Recommended confirmation:** a visual check that the skeleton cross-fades into
  the image (and that a broken URL falls back to the avatar) — not runnable in-env.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| `@load`-gated overlay fade | True cross-fade over the fetch gap; CLS/LCP-safe; reduced-motion via CSS | Needs `position: relative` on the container + absolute children | **Adopted.** |
| `@error` → avatar fallback | No perpetual skeleton / broken image on a bad URL | One extra ref | **Adopted.** |
| CSS-declarative reduced-motion (no JS helper) | Simpler; matches Batch E; no untestable indirection | — | **Adopted.** |

**Final stack.** A paint-lifecycle gate (`@load`/`@error` booleans, reset on URL
change), an overlay cross-fade (opacity 0→1, 200ms, `no-preference` only), the
container made a positioning context, and an avatar fill fix. The Batch E
skeleton now hands off to the image with a deliberate fade instead of a hard cut.

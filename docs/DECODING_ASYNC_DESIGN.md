# `decoding="async"` on Artwork Images

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): adding
`decoding="async"` to every artwork `<img>` so the browser avoids blocking other
content during image decode.

---

## 1. Purpose

Card artwork `<img>` elements use `loading="lazy"` (defer fetch until near
viewport) but not `decoding="async"`. Without it, the browser may hold up other
content rendering while it decodes a batch of images that scroll into view
simultaneously — particularly noticeable on large grids (Library, Search). This
batch adds the hint so the browser can present other content without waiting for
decode.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| What it does | Tune The Web (Barry Pollard, web.dev) — *What does the image decoding attribute actually do?* | `decoding="async"` is a **hint** that lets the browser avoid holding up other content during image decode. Not a magic speed-up; the decode time is the same. Most impactful when many images decode at once (scroll-fill). |
| Baseline | MDN — `HTMLImageElement.decoding` | **Baseline, widely available since January 2020** (all modern browsers). |
| No downsides | Tune The Web + WordPress #53232 | For HTML-source images: "no real downsides." WordPress and Next.js add it by default. |
| Pairs with lazy + content-visibility | web.dev | `decoding="async"` pairs with `loading="lazy"` (Batch D) and `content-visibility: auto` (Batch T) — all three defer/expedite different stages (fetch, render, decode). |
| Priority order | Tune The Web | `loading="lazy"` and image size have *much larger* impact; `decoding="async"` is a micro-optimisation. Apply it last, after the bigger wins (which are done). |

---

## 3. Design

Added `decoding="async"` to all 5 artwork `<img>` elements across the client:

| File | Image | Role |
| --- | --- | --- |
| `ArtworkImage.vue` | Card artwork (shared) | Every non-Discover card |
| `DiscoverArtistCard.vue` | Discover card artwork | Discover recommendations + search results |
| `DiscoverRecommendationsPanel.vue` | Monitored-chip avatar | Chip band |
| `OperatorArtistCard.vue` | Operator home card | Operator home grid |
| `ArtistDetailRelatedArtistCard.vue` | Related-artist card | Artist detail sidebar |

One-attribute addition per `<img>`; no script/CSS/behaviour change. Progressive
enhancement (ignored by old browsers). Pairs with `loading="lazy"` (all 5 already
have it) and `content-visibility: auto` (Batch T on `.hx-media-card`).

---

## 4. Security

- **HTML attribute only.** No script, data-flow, or injection change.
- **No new network/auth/query surface.**

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/ArtworkImage.vue` | `decoding="async"` on `<img>`. |
| `src/client/components/media/DiscoverArtistCard.vue` | `decoding="async"` on `<img>`. |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | `decoding="async"` on chip avatar `<img>`. |
| `src/client/components/home/OperatorArtistCard.vue` | `decoding="async"` on `<img>`. |
| `src/client/components/media/ArtistDetailRelatedArtistCard.vue` | `decoding="async"` on `<img>`. |

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.
- Remnant audit: `rg 'loading="lazy"' src/client/components --glob '*.vue'` → **5
  matches**, each now paired with `decoding="async"`.

---

## 7. Outcome

Every artwork `<img>` in the client now carries `decoding="async"` alongside
`loading="lazy"`. The three-stage artwork pipeline is complete: `loading="lazy"`
defers the fetch, `content-visibility: auto` (Batch T) defers the render, and
`decoding="async"` defers the decode's impact on other content. A harmless,
progressive micro-optimisation that completes the performance story for card
artwork.

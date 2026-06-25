# Render Performance: `content-visibility: auto` for Card Grids

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): a CSS-only
progressive enhancement that lets the browser skip rendering off-screen cards
until they near the viewport.

---

## 1. Purpose

Card grids (Library, Search, Missing, MyRequests, Activity, Home, ArtistDetail)
can render dozens of cards at once, each with artwork, metadata, badges, and
action controls. Off-screen cards incur full style/layout/paint cost on initial
load even though the user can't see them yet. This batch applies
`content-visibility: auto` so the browser defers that work until the card
approaches the viewport — a **50%+ reduction** in initial rendering cost (web.dev).

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| How it works | web.dev — *content-visibility* | `auto` enables the browser to skip layout + paint of off-screen elements. Expected **50%+ rendering cost reduction**. Off-screen content stays in the DOM + accessibility tree (searchable, focusable). |
| `contain-intrinsic-size` | web.dev + MDN | Without it, off-screen elements are 0-height → scrollbar jank. Pair with `auto <length>` so the browser remembers the actual rendered size after first paint. |
| Baseline support | MDN — *content-visibility* | **Baseline 2024** — all modern browsers since September 2024. Ignored by older browsers (progressive enhancement). |
| Focused elements | MDN | Focused/selected elements are always "relevant to the user" and rendered on demand — **roving-safe** (Batches D–K). |
| A11y | web.dev + MDN | Content remains in the a11y tree. Elements hidden with `display: none` inside a `content-visibility: auto` container would appear in AT when off-screen — but Harmoniarr cards use `v-if` (no DOM), not `display: none`. No `aria-hidden` needed. |
| INP | web.dev | Reducing rendering work frees the main thread → improves Interaction to Next Paint. |
| Selective application | DebugBear | Apply to below-the-fold content; the browser handles the on/off-screen distinction automatically (no `:nth-child` needed for moderate grid sizes). |

---

## 3. Design

A single CSS addition to the **global `.hx-media-card`** primitive in
`design-system.css`:

```css
.hx-media-card {
  …existing properties…;
  content-visibility: auto;
  contain-intrinsic-size: auto 320px;
}
```

- **`content-visibility: auto`** — the browser applies layout + style + paint
  containment to every card. For off-screen cards, it also adds size containment
  (skips painting + hit-testing). On-screen cards render normally.
- **`contain-intrinsic-size: auto 320px`** — 320px height estimate (artwork
  ~180px + body ~80px + actions ~50px) prevents scrollbar jank before first
  render. The `auto` keyword makes the browser remember the actual rendered
  height after the card scrolls into view once.
- Applied to the card (`<article class="hx-media-card">`), NOT the `<li>` wrapper
  (which is `display: contents` from Batch I — no box to contain).

### Why no `:nth-child(n+12)`

DebugBear recommends skipping the first ~12 cards to avoid even the viewport-
check overhead for above-fold content. For Harmoniarr's grid sizes (8–50 cards
typical), the viewport check is negligible. Applying `content-visibility: auto`
to ALL cards is simpler (one rule, all grids) and the browser correctly renders
above-fold cards without delay.

### Compatibility with prior work

- **Roving tabindex (Batches D–K):** focused cards are always rendered (MDN:
  "relevant to the user"). The composable's `.focus()` triggers render on demand.
- **Skeleton/fade (Batches E/M/O/Q/S):** off-screen cards skip their skeleton
  animation (no wasted paint). When scrolled into view, the skeleton renders +
  the image loads normally.
- **`overflow: hidden` on `.hx-media-card`:** paint containment is compatible
  (both prevent visual overflow).

---

## 4. Security

- **CSS-only.** No script, data-flow, markup, or `v-html` change.
- **No new network/auth/query surface.** Purely a rendering optimization.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/design-system.css` | `.hx-media-card` gains `content-visibility: auto` + `contain-intrinsic-size: auto 320px`. |

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.
- **Recommended confirmation:** a performance comparison (DevTools Performance
  tab) on Library/Search with 50+ cards, measuring initial render time and INP
  before/after — not runnable in-env.

---

## 7. Outcome

Every `.hx-media-card` across the client (Library, Search, Missing, MyRequests,
Activity, Home, ArtistDetail, Discover) now uses `content-visibility: auto`. The
browser skips rendering off-screen cards (estimated 50%+ rendering cost reduction
on large grids), while on-screen and focused cards render normally. Progressive
enhancement (Baseline 2024); roving-safe; a11y-safe; one CSS rule on the shared
primitive.

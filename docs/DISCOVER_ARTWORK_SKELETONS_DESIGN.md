# Discover — Artwork Loading Skeletons & Stable Card Geometry

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): an
explicit loading state for `DiscoverArtistCard` artwork so a slow source reads
as "loading" instead of a misleading finalized avatar, plus reduced-motion
compliance for every shimmer in the client.

It builds on the pagination primitive from
[DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md](DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md)
and the card surface refined in
[DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md).

---

## 1. Purpose

Artwork resolves asynchronously per artist via a batched lookup
(`useDiscoverArtistArtwork`). Before this change, a `DiscoverArtistCard` whose
artwork had not yet resolved showed the **avatar fallback** (the artist's
initial), then visually swapped to the image when it arrived. That read as a
finalized "no artwork" state followed by a pop, making slow sources look broken
and causing a visual flicker across the grid as the batch filled in. There was
no explicit loading affordance.

This batch adds a third display state — `loading` — rendered as a neutral
skeleton that fills the reserved artwork box, and tightens up motion
accessibility across the client.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Accessible skeletons | Adrian Roselli — *More Accessible Skeletons* | `aria-busy` alone is honored by few screen readers; do **not** put `role="status"`/`aria-live` on every skeleton (an N-card grid would announce "loading" N times). Pair the visual skeleton with `aria-hidden="true"` and convey loading at a higher level. |
| Reduced motion | Roselli (ibid.); W3C WCAG 2.2.2 / technique C39 | Wrap shimmer in `prefers-reduced-motion`; only animate when the user has **not** set a reduce preference. Implemented as an opt-out `@media (prefers-reduced-motion: reduce) { animation: none }` guard (same outcome, less churn). |
| Layout stability | web.dev — *Optimize Cumulative Layout Shift* | Reserve space with `aspect-ratio` so the browser computes height before the image downloads. |

**Key decisions derived from the research:**

- **Geometry was already stable.** The artwork container `.hx-media-card__artwork`
  already carries `aspect-ratio: 1 / 1; flex-shrink: 0; overflow: hidden`, so the
  card reserves its square before any image arrives — there was no cumulative
  layout shift to fix. The real problem was the *content swap* (avatar → image),
  which the skeleton resolves by making the loading state explicit and neutral.
- **Per-card skeletons are visual-only (`aria-hidden`).** The Discover panels
  already surface a panel-level "Refreshing" status, which is the correct
  assistive-tech channel. Marking each skeleton `aria-hidden="true"` avoids the
  N-announcement anti-pattern Roselli flags.
- **Motion is honored everywhere.** A research finding: the codebase's existing
  `hx-skeleton-pulse` and `hx-artwork-shimmer` animations had **no**
  reduced-motion guard. This batch adds guards for the new skeleton **and** the
  two existing shimmers, so motion preference is respected client-wide.

---

## 3. Design

Three layers, mirroring the established `lib/` (pure) + component (wiring)
discipline.

### 3.1 Pure state resolver — `src/client/lib/artwork-display-state.js` (new)

`resolveArtworkDisplayState({ url, isResolving })` → `'image' | 'loading' | 'initial'`:

- A non-empty `url` string → `'image'` (a cached URL wins even while a new batch
  is in flight, so a resolved card never skeletons).
- No URL **and** `isResolving === true` (strict boolean) → `'loading'`.
- Otherwise → `'initial'` (avatar). Strict-boolean guard prevents a stale/truthy
  flag from producing a perpetual skeleton.

### 3.2 Card — `DiscoverArtistCard.vue`

New `loading` prop (Boolean, default `false`). An `artworkState` computed calls
the pure helper with `artwork?.url` and `loading`. The artwork slot now has three
branches: `<img>` for `'image'`, a `<div class="discover-artist-card__skeleton"
aria-hidden="true">` for `'loading'`, and the existing avatar for `'initial'`.

The skeleton fills the reserved box (`width/height: 100%`), reuses the global
`hx-skeleton-pulse` keyframes (DRY — no new `@keyframes`), and carries a scoped
`@media (prefers-reduced-motion: reduce) { animation: none }` guard.

### 3.3 Motion compliance — existing animations

- `design-system.css`: added a `prefers-reduced-motion` guard for the shared
  `.hx-skeleton` primitive (benefits every skeleton consumer).
- `ArtworkImage.vue`: added a scoped reduced-motion guard for its
  `hx-artwork-shimmer` (used by non-Discover cards — a consistency win
  discovered during research).

### 3.4 Wiring — container → panels → card

`useDiscoverArtistArtwork` exposes `isResolvingArtistArtwork` (a global flag:
true while any batch is in flight). `DiscoverView` passes
`:artwork-loading="isResolvingArtistArtwork"` to both panels; each panel forwards
`:loading="artworkLoading"` to `DiscoverArtistCard`. Per-card loading is the
logical AND of "no URL yet" (per-card) and "a batch is in flight" (global), so
already-cached cards stay on their image while unresolved cards skeleton.

---

## 4. Security

- **No injection surface.** Display state is a fixed three-value enum derived
  from a URL string and a boolean. No engine- or user-supplied string is
  rendered as markup; no `v-html` is introduced.
- **Client-only.** The skeleton is presentational; no new network, query, auth,
  or data-flow surface. The existing artwork batch contract is unchanged.
- **`aria-hidden` is intentional.** The skeleton conveys no information to
  assistive tech (the panel-level "Refreshing" status does); hiding it prevents
  announcement spam and avoids the `role="alert"`/`aria-live`/`aria-busy` code
  smell Roselli documents.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/artwork-display-state.js` | **New.** Pure `resolveArtworkDisplayState`. |
| `src/client/components/media/DiscoverArtistCard.vue` | `loading` prop; `artworkState` computed; three-branch artwork slot; skeleton CSS + reduced-motion guard. |
| `src/client/components/ArtworkImage.vue` | Scoped reduced-motion guard for `hx-artwork-shimmer`. |
| `src/client/design-system.css` | Reduced-motion guard for the shared `.hx-skeleton` primitive. |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | `artworkLoading` prop forwarded to the card. |
| `src/client/components/media/DiscoverSearchResultsPanel.vue` | `artworkLoading` prop forwarded to the card. |
| `src/client/views/DiscoverView.vue` | Passes `:artwork-loading` to both panels. |
| `test/client/artwork-display-state.test.js` | **New.** 11 tests (state resolution, strict-boolean guard, lifecycle). |

---

## 6. Validation

- Focused: `node --test test/client/artwork-display-state.test.js` → **11/11 pass**.
- Full client suite: `npm run test:client` → **3655 pass, 0 fail**.
- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Pure `resolveArtworkDisplayState` + `loading` prop | State logic 100% unit-testable; strict-boolean guard prevents perpetual skeletons; mirrors `focus-return`/`paginated-list` discipline | One prop threaded through two panels | **Adopted.** |
| Per-card skeleton is `aria-hidden` visual-only | Avoids N "loading" announcements; panel "Refreshing" status is the SR channel | No per-card SR loading text (by design — would be noisy) | **Adopted.** |
| Reuse global `hx-skeleton-pulse` keyframes | DRY; one animation definition | Skeleton visual tied to the shared primitive's look | **Adopted.** |
| Reduced-motion guards on new + existing shimmers | WCAG 2.2.2 / C39 compliance client-wide; low risk | Slightly larger CSS footprint | **Adopted.** |

**Final stack.** Pure state in `lib/artwork-display-state.js` (DOM-free, 11
tests) → three-branch artwork slot in `DiscoverArtistCard` driven by a `loading`
prop → global flag threaded from `DiscoverView` through both panels →
reduced-motion compliance for the new skeleton and the two pre-existing
shimmers. Fixed-enum state, `aria-hidden` visual skeletons, and client-only
presentational logic keep the surface secure.

# Platform-Wide Card-Grid Roving Tabindex

Status: **Implemented (8 of 9 grids).** This document records the design and
outcome for proposal #2 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): extending
Batch D's roving-tabindex keyboard navigation to the shared card grids across the
client, and the prerequisite `ReleaseCard` keyboard-a11y fix that enabled it.

It builds on Batch D ([DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md))
and Batch I ([ARTWORK_GRID_LIST_SEMANTICS_DESIGN.md](ARTWORK_GRID_LIST_SEMANTICS_DESIGN.md)).

---

## 1. Purpose

Batch D added opt-in roving tabindex to the Discover `PaginatedArtworkGrid`, but
the other card grids (Library, Search, Missing, MyRequests, Activity, Home) still
put every card's controls in the natural tab order — keyboard users Tab through
dozens of controls to cross a large grid. This batch extends the win platform-
wide. The enabling discovery: `ReleaseCard`'s "open detail" action was
**mouse-only** (`<article @click>` with no `tabindex`/`role`/keyboard handler) —
a pre-existing a11y bug and a hard blocker for roving. Fixing it was the first
step.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Card primary action | Livefront — *Accessibility Dos and Don'ts for Interactive Cards* (Feb 2025) | Use `<button>` for non-navigation actions (open modal); **never nest interactive elements** — make the primary action and secondary actions **siblings**. |
| Block content in `<button>` | Livefront (ibid.); HTML spec | `<button>` only accepts phrasing content — wrapping block artwork/body in one is invalid. Use a `<div role="button">` fallback (role + tabindex + Enter/Space) when block content is required. |
| Faux-nested controls | Piccalilli — *Accessible faux-nested interactive controls* | Create the *appearance* of nesting with sibling elements + CSS, never nested interactives in the DOM. |
| Roving tabindex | W3C APG — Keyboard Interface Practices (Batch D) | One `tabindex="0"` cell, rest `tabindex="-1"`, arrow keys move focus. |

**Key decision derived from the research:** `ReleaseCard` mirrors `ArtistCard`'s
`.hx-media-card__link-area` pattern, but with a `<div role="button">` (not a
`<button>`, which can't hold the block artwork/body; not an `<a>`, since the
action opens a modal rather than navigating). The actions slot stays a **sibling**
— no nested interactives.

---

## 3. Design

### 3.1 `ReleaseCard` keyboard-a11y refactor — the enabler

The card's artwork + body are now wrapped in a keyboard-accessible primary action:

```html
<article class="hx-media-card">
  <div class="hx-media-card__link-area" role="button" tabindex="0"
       :aria-label="`View details for …`"
       @click="handleDetail" @keydown.enter="handleDetail" @keydown.space.prevent="handleDetail">
    <div class="hx-media-card__artwork">…</div>
    <div class="hx-media-card__body">…</div>
  </div>
  <div class="hx-media-card__actions">…</div>   <!-- sibling, not nested -->
</article>
```

This fixes the mouse-only detail action (now focusable + Enter/Space activated)
and gives `ReleaseCard` the **same roving target** (`.hx-media-card__link-area`)
as `ArtistCard`, so one `cellSelector` serves both. The hardcoded `tabindex="0"`
is the standalone-accessible baseline; the roving composable overrides it to
`0`/`-1` when the grid is roving-enabled.

### 3.2 Centralized focus ring

`.hx-media-card__link-area:focus-visible` moved to the shared `design-system.css`
(the card's own `:focus-visible` never fires because focus lands on the inner
element). `ArtistCard`'s Batch D scoped duplicate was removed. Both card types
now share one focus ring.

### 3.3 `useArtworkGridRoving` — shared composable

A tiny wrapper (`src/client/composables/useArtworkGridRoving.js`) bakes in the
2-D `grid` axis and re-syncs the managed `tabindex` whenever the card count
changes (search results, library data, etc.), so each view avoids repeating the
watch boilerplate. It delegates to Batch D's `useRovingTabindex` / `roving-index.js`.

### 3.4 Grids wired (8)

Each grid's `<ul>` gained a template ref + a `useArtworkGridRoving` call with the
card's `cellSelector`:

| Surface | Card | cellSelector |
| --- | --- | --- |
| SearchView (artists) | ArtistCard | `.hx-media-card__link-area` |
| SearchView (releases) | ReleaseCard | `.hx-media-card__link-area` |
| OperatorHomePanel (cards + discover) | OperatorArtistCard + RouterLink | `.hx-media-card__link-area, .operator-home__discover-card` |
| RequesterHomePanel (cards + discover) | ArtistCard + RouterLink | `.hx-media-card__link-area, .requester-home-discover-card` |
| MyRequestsView | RequestCard | `.request-card` |
| LibraryView | ReleaseCard | `.hx-media-card__link-area` |
| MissingView | ReleaseCard | `.hx-media-card__link-area` |
| ActivityReleasesView (recent + upcoming) | ReleaseCard | `.hx-media-card__link-area` |

The two Home panels use a **union selector** so the trailing "discover/find more"
`RouterLink` is also a roving cell.

### 3.5 Deferred — ArtistDetailView

`ArtistDetailView` renders a `v-for` of release-group **sections**, each its own
`<ul class="hx-artwork-grid">` — a dynamic number of grids. Per-section roving
needs a section-scoped approach (a wrapper component or per-section refs) rather
than a single template ref, so it is left as a focused follow-up rather than a
forced fit.

---

## 4. Security

- **No injection surface.** Roving adds/reads only `tabindex` attributes and
  keyboard primitives; the `ReleaseCard` refactor moves an existing `@click` onto
  a focusable surface. No `v-html`; no engine/user string rendered as markup.
- **Client-only, ref-scoped DOM.** Reads (`querySelectorAll`) and `.focus()`
  operate on elements already in the page. No new network/auth/data surface.
- **`preventDefault` scoped** to recognized roving keys only; Enter/Space/Tab
  bubble normally (Enter activates the focused card's action natively).

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/media/ReleaseCard.vue` | Keyboard-accessible `.hx-media-card__link-area` (`<div role="button">` + Enter/Space); actions become a sibling; scoped layout CSS. |
| `src/client/design-system.css` | Centralized `.hx-media-card__link-area:focus-visible`. |
| `src/client/components/media/ArtistCard.vue` | Removed the now-global scoped focus rule. |
| `src/client/composables/useArtworkGridRoving.js` | **New.** Roving + refresh-on-count wrapper. |
| `src/client/views/SearchView.vue` | 2 grids wired (artists + releases). |
| `src/client/views/LibraryView.vue` | Grid wired. |
| `src/client/views/MissingView.vue` | Grid wired. |
| `src/client/views/MyRequestsView.vue` | Grid wired (`.request-card`). |
| `src/client/views/ActivityReleasesView.vue` | 2 grids wired (recent + upcoming). |
| `src/client/components/home/OperatorHomePanel.vue` | Grid wired (union selector). |
| `src/client/components/home/RequesterHomePanel.vue` | Grid wired (union selector). |

No new pure helper beyond the thin composable wrapper; the roving math is the
Batch D/F-tested `roving-index.js`.

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds (all templates compile).
- Full client suite: `npm run test:client` → **3660 pass, 0 fail**.
- **Recommended confirmation:** a keyboard + axe-core sweep of each surface to
  verify one tab stop per grid, arrow navigation, the visible focus ring, and
  that `ReleaseCard` detail is now Enter/Space activatable (not runnable here).

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| `ReleaseCard` → `<div role="button">` link-area | Fixes mouse-only a11y bug; uniform roving target; valid HTML; no nested interactives | Manual Enter/Space (vs native `<button>`) — necessary because block content can't go in a `<button>` | **Adopted.** |
| `useArtworkGridRoving` wrapper | DRY across 8 views; bakes in grid axis + refresh | One thin indirection layer | **Adopted.** |
| Union `cellSelector` for mixed Home grids | Roves the trailing discover card too | Per-grid selector string | **Adopted.** |
| Defer ArtistDetail per-section grids | Avoids a forced fit on a dynamic multi-grid surface | 1 of 9 grids not yet roving | **Deferred** (documented follow-up). |

**Final stack.** A prerequisite keyboard-a11y refactor of `ReleaseCard`
(uniform `.hx-media-card__link-area` target), a centralized focus ring, a shared
`useArtworkGridRoving` composable, and roving wired into 8 card grids — extending
the Batch D keyboard win across the client. `ArtistDetailView`'s per-section
grids remain as a focused follow-up.

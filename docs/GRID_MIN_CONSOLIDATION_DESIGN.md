# Consolidate `--hx-artwork-grid-min` Overrides

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):
centralizing the scattered `--hx-artwork-grid-min` documentation and removing
dead code.

---

## 1. Purpose

Six card grid views each set their own `--hx-artwork-grid-min` in scoped CSS
(180px, 168px, 168px, 160px, 196px, 160px), plus a per-view `@media
(max-width: 640px)` override to 140px. A global mobile override in
`design-system.css` also set `--hx-artwork-grid-min: 140px` — but it was dead
code (every grid has a scoped class with higher specificity that wins regardless
of the media query). There was no single place to see all the per-view values.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Scoped CSS variable overrides | Chromatic — *Scoped Theming with CSS Variables* | Component-scoped overrides are the correct pattern when values differ per component. Global overrides lose to scoped ones due to specificity. |
| CSS variable cascade | MDN — *CSS Custom Properties* | Custom properties cascade by specificity + source order. A scoped `.search-grid[data-v-xxx]` (0,2,0) beats a global `.hx-artwork-grid` (0,1,0) regardless of media queries. |

---

## 3. Findings

### 3.1 The global mobile override was dead code

The global `@media (max-width: 640px) { .hx-artwork-grid { --hx-artwork-grid-min:
140px } }` (design-system.css) set the variable on `.hx-artwork-grid` (specificity
0,1,0). But every grid view has a scoped class (`.search-grid`,
`.discover-grid`, etc.) on the same `<ul>` with specificity 0,2,0 (the
`[data-v-xxx]` attribute). The scoped desktop value (e.g., 168px) therefore
wins at all viewport sizes — the global mobile override never takes effect.

Each view carries its OWN scoped `@media (max-width: 640px)` override to 140px
(same specificity as the scoped desktop rule, but later in source order → wins
on mobile). That is the structurally required mechanism.

### 3.2 The per-view values are genuinely different

| View | Desktop | Mobile |
| --- | --- | --- |
| PaginatedArtworkGrid (Discover) | 180px | 140px |
| SearchView | 168px | 140px |
| ArtistDetailView | 168px | 140px |
| MyRequestsView | 160px | 140px |
| RequesterHomePanel | 160px | 140px |
| OperatorHomePanel | 196px | 140px |
| (default / unset) | 160px | — |

The desktop values are legitimate per-view customization (different card content
sizes). They cannot be merged into a single value.

---

## 4. Changes

1. **Removed the dead `--hx-artwork-grid-min: 140px`** from the global mobile
   block (kept the `gap: var(--hx-space-3)` override, which IS effective — no
   scoped view overrides gap).
2. **Added a documentation registry** (table comment) in the `.hx-artwork-grid`
   rule listing every per-view desktop value, scoped class, and mobile override —
   one place to see and tune them.
3. **Left the per-view scoped overrides as-is** — they are the correct pattern
   for per-component customization with the required specificity.

---

## 5. Security

- **CSS-only** (dead-code removal + comments). No script, data-flow, markup, or
  behaviour change.

---

## 6. Files changed

| File | Change |
| --- | --- |
| `src/client/design-system.css` | Removed dead global mobile `--hx-artwork-grid-min: 140px`; added per-view value registry comment. |

---

## 7. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.

---

## 8. Outcome

Dead code removed; all `--hx-artwork-grid-min` values are now documented in one
place (the `.hx-artwork-grid` rule). The per-view scoped overrides (the correct
pattern for differing values + required specificity) are preserved and clearly
registered. Future tuning is a documented one-table-reference change.

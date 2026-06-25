# ArtistDetail Per-Section Roving Tabindex

Status: **Implemented.** This document records the design and outcome for
proposal #2 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): adding
roving tabindex to `ArtistDetailView`'s per-section discography grids — the last
card-grid surface, completing the platform-wide roving story.

It builds on Batch J ([CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)),
which deferred this surface, and reuses Batch D's roving infrastructure
([DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md)).

---

## 1. Purpose

`ArtistDetailView` renders the discography as a `v-for` of release-group
**sections** (Albums, Singles, …), each its own `<ul class="hx-artwork-grid">`
of `ReleaseCard`s. Batch J wired roving into every *single*-grid surface but
deferred this one: a dynamic number of grids can't share one template ref, and
Vue requires composables to be called synchronously in a component's setup — so
they can't be looped per-section after mount. This batch solves it with a small
wrapper component so each section becomes its own independent roving composite.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Composable usage rules | Vue.js Docs — *Composables § Usage Restrictions* | "Composables should only be called in `<script setup>`/`setup()`… **synchronously**." → per-section stateful logic requires a **component per section**, not a looped composable. |
| Composable vs renderless component | Vue.js Docs (ibid.) | Use a component when reusing **both logic and visual layout** — exactly the grid+roving case here. |
| Independent composites | W3C APG — Keyboard Interface (roving tabindex) | Each composite widget is its own tab stop; N sections → N independent roving composites (Tab crosses sections, arrows stay within one). |

**Key decision derived from the research:** introduce a wrapper component whose
each instance owns a `useArtworkGridRoving` call in its own synchronous setup.
A scoped slot keeps the parent-scoped card content (operator-policy `<select>`)
where it is.

---

## 3. Design

### 3.1 `ArtistReleaseSectionGrid.vue` (new)

A focused wrapper that renders one section's grid and owns its roving:

```vue
<ul ref="grid" class="hx-artwork-grid" role="list" :aria-label="ariaLabel || undefined">
  <li v-for="(release, index) in releases" :key="release.musicbrainzReleaseGroupId ?? index">
    <slot :release="release" :index="index" />
  </li>
</ul>
```

- Each instance calls `useArtworkGridRoving(() => gridEl.value, { cellSelector:
  '.hx-media-card__link-area', count: () => props.releases.length })` in setup —
  a valid synchronous composable call → an independent roving composite.
- A **scoped slot** (`release`) hands each item back to the parent, so the
  `ReleaseCard` and its rich `#actions` slot (operator-policy `<select>`,
  `policyDraft`, `canEditOperatorPolicy`, …) remain in `ArtistDetailView`'s scope
  — no prop drilling.

### 3.2 `ArtistDetailView` refactor

Each discography section's inline `<ul>/<li>/ReleaseCard` became:

```vue
<ArtistReleaseSectionGrid class="artist-detail-grid" :releases="section.releases" :aria-label="`${section.type}s`">
  <template #default="{ release }">
    <ReleaseCard …>…operator-policy actions…</ReleaseCard>
  </template>
</ArtistReleaseSectionGrid>
```

The `<section>` + heading stay in the view; only the grid moved into the wrapper.

### 3.3 Scoped style preserved via class fallthrough

`artist-detail-grid` is passed as a class; Vue merges it onto the wrapper's root
`<ul>` (which also receives the parent's scope ID), so `ArtistDetailView`'s
existing scoped overrides (`.artist-detail-grid { --hx-artwork-grid-min: 168px }`
and its responsive variant) still apply unchanged.

---

## 4. Security

- **No injection surface.** Roving adds/reads only `tabindex` attributes and
  keyboard primitives; the refactor moves existing markup into a scoped slot. No
  `v-html`; no engine/user string rendered as markup.
- **Client-only, ref-scoped DOM.** Reads and `.focus()` operate on elements
  already in the page. No new network/auth/data surface.
- **`preventDefault` scoped** to recognized roving keys only; Enter/Space/Tab
  bubble normally.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/media/ArtistReleaseSectionGrid.vue` | **New.** Per-section roving grid wrapper (own `useArtworkGridRoving` + scoped slot). |
| `src/client/views/ArtistDetailView.vue` | Discography sections use the wrapper; `ReleaseCard` moved into the scoped slot. |

No new pure helper — the roving math is Batch D/F/J's tested `roving-index.js` via
`useArtworkGridRoving`.

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3660 pass, 0 fail**.
- **Recommended confirmation:** a keyboard sweep of ArtistDetail to verify one
  tab stop per section, arrow navigation within a section, the visible focus
  ring, and that Tab moves between sections (not runnable here).

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Wrapper component per section | Satisfies Vue's synchronous-composable rule; each section an independent composite; reusable | One new component | **Adopted.** |
| Scoped slot for the card | Parent-scoped operator-policy bindings stay put; no prop drilling | Slot indirection | **Adopted.** |
| Class fallthrough for `artist-detail-grid` | Existing scoped `--hx-artwork-grid-min` overrides still apply | Relies on Vue's parent-scope-on-child-root behavior (well-defined) | **Adopted.** |

**Final stack.** A small `ArtistReleaseSectionGrid` wrapper (per-instance roving +
scoped slot) consumed once per discography section. This completes platform-wide
card-grid roving: every card grid in the client (Discover, Search, Library,
Missing, MyRequests, Activity, Home, and now ArtistDetail's sections) is now a
roving-tabindex surface with one tab stop per composite and arrow-key navigation.

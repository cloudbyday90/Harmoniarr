# Discover — Monitored-Chip ARIA Role Semantics

Status: **Implemented.** This document records the design and outcome for
proposal #2 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): restoring
the native `link` role on monitored-artist chips so screen readers announce them
as navigable links rather than generic list items.

It completes the chip-band work begun in Batch F
([DISCOVER_MONITORED_CHIP_ROVING_DESIGN.md](DISCOVER_MONITORED_CHIP_ROVING_DESIGN.md))
and follows the language/semantics discipline established in Batch A
([DISCOVER_REDESIGN_DESIGN.md](DISCOVER_REDESIGN_DESIGN.md)).

---

## 1. Purpose

Each monitored-artist chip was a `RouterLink` (`<a>`) carrying `role="listitem"`
inside a `<div role="list">`. An explicit ARIA role **overrides** an element's
implicit role, so the chip was exposed to the accessibility tree as a *list item*,
not a *link* — the "navigates to artist detail" affordance was suppressed for
screen-reader users. After Batch F made the band keyboard-correct, the role
semantics were the remaining correctness gap.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Don't override interactive roles | W3C — *ARIA in HTML* §3.1 | "Avoid overriding interactive elements with non-interactive roles." Overriding an `<a>`'s `link` role with `listitem` is exactly this anti-pattern. |
| First rule of ARIA | W3C / MDN — *WAI-ARIA Roles* | Use native HTML where a native element exists; `list`→`<ul>`, `listitem`→`<li>`. Native elements provide the semantics for free and never suppress an inner link's role. |
| Lists of links | MDN — *HTML: A good basis for accessibility* | A list of links is marked up `<ul><li><a>`; "better to just use the right element for the right job." |

**Key decision derived from the research:** switch to native `<ul>`/`<li>`/`<a>`.
This fixes *both* defects at once — the link role is restored (the `<a>` keeps
its implicit `link` role), and the list structure is provided natively (`<ul>`
= `list`, `<li>` = `listitem`) with no ARIA role attributes at all.

---

## 3. Design

### 3.1 Markup — `DiscoverRecommendationsPanel.vue`

The chip-band container changed from `<div role="list">` to a native `<ul>`, and
each `RouterLink` is now wrapped in a `<li>`. The `role="listitem"` attribute was
**removed** from the link. `:aria-label` stays on the `<ul>` (the list's
accessible name) and the link keeps its own `:aria-label` (e.g. "View
Radiohead"), now correctly announced as a link.

Before → after (abridged):

```html
<!-- before -->
<div role="list" :aria-label="...">
  <RouterLink class="discover-monitored-chip" role="listitem" ...>…</RouterLink>
</div>

<!-- after -->
<ul :aria-label="...">
  <li><RouterLink class="discover-monitored-chip" ...>…</RouterLink></li>
</ul>
```

### 3.2 CSS

A standard `<ul>` reset (`list-style: none; margin: 0; padding: 0;`) was added to
`.discover-monitored-list`. The `<li>` becomes the flex item; all chip visual
styles remain on `.discover-monitored-chip` (the link) and are unchanged, so the
rendered layout is identical. No `<li>`-specific CSS is required — blockification
of the `<li>` as a flex item plus the inherited `list-style: none` yields the
same wrapping row of pill chips.

### 3.3 Batch D/F/C integration preserved

- **Batch F roving** targets `.discover-monitored-chip` (the link) via
  `cellSelector`; `querySelectorAll` finds the links through the `<li>` wrapper,
  so tabindex sync and arrow-key focus are unaffected.
- **Batch C focus-return** (`setChipRef` / `focusMonitoredArtistChip`) holds a
  `ref` on the `RouterLink`; unchanged.
- The composable's `focusin` listener still anchors roving to a focused link.

---

## 4. Security

- **No injection surface.** This is a pure markup + CSS semantic refactor. No
  engine- or user-supplied string is rendered as markup; no `v-html`.
- **No data-flow change.** The chip view models, routes, and aria labels are
  unchanged; only the element/role structure differs.
- **No new scripts or network surface.**

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | Chip band: `<div role="list">`→`<ul>`, wrap links in `<li>`, remove `role="listitem"`; `<ul>` reset in scoped CSS. |

No new pure helper or test module — the change is DOM/semantics only, validated
by build (per the established discipline for component-only changes; recommended
confirmation with axe-core / a screen reader).

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3660 pass, 0 fail** (no count
  change — no new pure logic).
- **Recommended confirmation:** an axe-core pass or screen-reader check on the
  Discover view to confirm chips now announce as "link" within a list (not
  available in this environment).

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Native `<ul>`/`<li>`/`<a>` (drop role overrides) | Restores `link` role + correct list semantics; W3C/MDN-endorsed; removes the override anti-pattern | `<ul>` reset + `<li>` wrappers (small CSS/markup churn) | **Adopted.** |
| Keep `<div role="list">` + `<div role="listitem">` wrappers | Links keep `link` role | Still uses ARIA where native exists; rejected by first-rule-of-ARIA | Rejected. |
| Drop `role="listitem"` only | Minimal diff | `list` without `listitem` children is an ownership mismatch | Rejected. |

**Final stack.** One template refactor (`<ul>`/`<li>`/`<a>`, no role overrides)
plus a standard `<ul>` reset. The chip band is now semantically correct end-to-
end: native list structure, links announced as links, and the Batch C/D/F
keyboard and focus behavior fully preserved.

### Related findings (not addressed here)

A `role="listitem"` audit found two other usages, intentionally left unchanged:
- `DiscoverView.vue` count strip — `<span role="listitem">`. Spans have no
  implicit role, so the attribute *adds* list semantics rather than suppressing
  one (harmless; a separate native-`<ul>` cleanup could be done later).
- `ArtistDetailView.vue`, `LibraryView.vue` — non-Discover surfaces; out of scope.

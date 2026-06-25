# Generalize Artwork Fade-In to `ArtworkImage`

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): moving
the Batch M `@load`-gated fade-in into the shared `ArtworkImage.vue` so every
card artwork gets the same deliberate handoff.

It generalizes Batch M ([ARTWORK_FADE_IN_DESIGN.md](ARTWORK_FADE_IN_DESIGN.md)),
which applied the fade only to `DiscoverArtistCard`.

---

## 1. Purpose

Batch M gave `DiscoverArtistCard` a smooth skeleton→image fade-in, but the other
card types (`ReleaseCard`, `RequestCard`, `ArtistCard` default artwork) render
artwork through the shared `ArtworkImage.vue`. `ArtworkImage` shimmers until load
but did **not** fade the image in — so the image progressively painted under the
sheen and then the sheen vanished as a hard cut. This batch applies the same
deliberate fade platform-wide in a single shared-component change.

---

## 2. Research (verified sources)

The core findings were established in Batch M and re-confirmed here.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Reduced motion | MDN — `prefers-reduced-motion` | Baseline since Jan 2020; scope the transition to `no-preference` (WCAG 2.2.2 / C39). |
| Opacity fade & CLS | web-vitals #43 (Batch M) | CLS-safe when dimensions are reserved — `ArtworkImage`'s container has `aspect-ratio: 1/1`. |
| Opacity fade & LCP | DebugBear (Batch M) | LCP-safe for images; card artwork is not the page LCP element. |

---

## 3. Design

### 3.1 A CSS-only change — `ArtworkImage.vue`

`ArtworkImage` already has the whole mechanism the fade needs:

- a state machine (`loading` → `loaded` → `error`) driven by `@load`/`@error`;
- the current state exposed as `data-state` on the `.hx-artwork` container;
- `position: relative` + `aspect-ratio: 1/1` (a positioning context with reserved
  geometry);
- a `prefers-reduced-motion: reduce` guard for its loading shimmer (Batch E).

So the fade is purely declarative CSS — no template, script, or helper change:

```css
.hx-artwork__img { …; opacity: 0; }
.hx-artwork[data-state='loaded'] .hx-artwork__img { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .hx-artwork__img { transition: opacity 200ms ease; }
}
```

While `loading`, the `<img>` is invisible (no progressive-paint flicker); the
existing `::after` sheen overlays the reserved box. On `@load` (`state='loaded'`)
the image fades in over ~200ms; reduced-motion users get an instant appearance.

### 3.2 Why no JS / helper

Batch M floated an optional `resolveImageTransition` helper. `ArtworkImage`
already tracks `loaded` in its state machine and exposes it via `data-state`, so
the CSS can react directly — a helper would add indirection without testable
logic. Omitted, as in Batch M.

### 3.3 Scope of effect

Covers every card that renders artwork through `ArtworkImage`: `ReleaseCard`
(Library, Missing, Search releases, Activity, ArtistDetail sections),
`RequestCard` (MyRequests), and `ArtistCard`'s default artwork slot (Search
artists). `DiscoverArtistCard` keeps its own Batch M fade (it owns its artwork
slot and does not use `ArtworkImage`), so there is no double-application.

---

## 4. Security

- **CSS-only.** No script, template, data-flow, or markup change; no `v-html`.
- **No new network/auth/query surface.** The fade is presentational; the image
  `src`/`alt` and lazy-loading are unchanged.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/ArtworkImage.vue` | `<img>` `opacity: 0 → 1` on `[data-state='loaded']`; transition scoped to `prefers-reduced-motion: no-preference`. |

No new pure helper or test module — the change is declarative CSS over the
existing, already-tested state machine.

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3673 pass, 0 fail**.
- **Recommended confirmation:** a visual check across Search/Library/Missing/
  MyRequests/ArtistDetail that card artwork fades in on load (and that the sheen
  still shows during loading) — not runnable in-env.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| `data-state`-driven CSS fade (no JS) | Zero JS; reuses the existing state machine; one shared-component change covers all non-Discover cards | The loading sheen now overlays an empty box (faint) — a minor cosmetic note | **Adopted.** |
| Keep the existing sheen | No churn to the loading indicator | Loading feedback is subtler than Batch M's prominent skeleton | **Adopted** (a stronger shared skeleton is a possible follow-up). |

**Final stack.** A CSS-only opacity fade attached to `ArtworkImage`'s existing
`data-state` machine, scoped to `no-preference`. The Batch M deliberate handoff
is now consistent across the entire card system — Discover, Search, Library,
Missing, MyRequests, Activity, and ArtistDetail.

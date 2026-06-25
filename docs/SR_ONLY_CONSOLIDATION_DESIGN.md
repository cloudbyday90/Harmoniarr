# Consolidate `sr-only` Variants onto the Global Utility

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): replacing
four component-scoped `sr-only` duplicates with the single global `.sr-only`
utility introduced in Batch P.

---

## 1. Purpose

Batch P added a global `.sr-only` utility (`design-system.css`) for the
typeahead live region, but four components still carried their own scoped
re-implementations of the same clip pattern: `library-sr-only` (LibraryView),
`rdm-sr-only` (ReleaseDetailModal), `rjt-sr-only` (RequestJourneyTimeline), and
RequestCard's own scoped `.sr-only`. Each was a near-duplicate; three lacked the
modern `clip-path: inset(50%)` and one (`rdm-sr-only`) was a minimal variant
missing margin/padding/border resets. This batch consolidates them onto the one
global utility — one source of truth, the canonical pattern.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Visually-hidden pattern | WebAIM — *Invisible Content for Screen Reader Users* | The clip/`clip-path` pattern is the recommended technique; one shared utility avoids per-site drift. |
| Single utility / copypasta drift | Ben Myers — *The Web Needs a Native .visually-hidden* | `.sr-only`/`.visually-hidden` copypasta drifts over time; `clip-path: inset(50%)` is the modern canonical addition that older snippets miss — consolidate to one vetted copy. |

---

## 3. Design

For each of the four components: swap the variant class name → `sr-only` in the
template, and delete the scoped definition. The global `.sr-only`
(`design-system.css`, Batch P) — which carries the full canonical pattern
including `clip-path: inset(50%)` — applies to scoped components' elements
(global CSS is not scoped, so it matches regardless of the component's `data-v`
attribute).

| Component | Template change | Style deletion | Notes |
| --- | --- | --- | --- |
| `LibraryView` | `library-sr-only` → `sr-only` | `.library-sr-only {}` | Gains `clip-path` |
| `ReleaseDetailModal` | `rdm-sr-only` → `sr-only` | `.rdm-sr-only {}` | Gains `clip-path` + margin/padding/border resets |
| `RequestJourneyTimeline` | `rjt-sr-only` → `sr-only` | `.rjt-sr-only {}` | Gains `clip-path` |
| `RequestCard` | (already `sr-only`) | scoped `.sr-only {}` + comment | Global takes over |

**No behavior regression:** all variants were `position: absolute` clip patterns
that visually hide while remaining in the accessibility tree; the consolidated
global does the same, with the modern `clip-path` and complete resets (a
robustness improvement, not a change in hiding behavior).

---

## 4. Security

- **CSS-only.** Class-name swaps + rule deletions; no markup semantics, script,
  data-flow, or `v-html` change.
- **No new network/auth/query surface.**

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/views/LibraryView.vue` | `library-sr-only` → `sr-only`; deleted `.library-sr-only`. |
| `src/client/components/media/ReleaseDetailModal.vue` | `rdm-sr-only` → `sr-only`; deleted `.rdm-sr-only`. |
| `src/client/components/RequestJourneyTimeline.vue` | `rjt-sr-only` → `sr-only`; deleted `.rjt-sr-only`. |
| `src/client/components/media/RequestCard.vue` | Deleted the scoped `.sr-only` + its comment. |

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail**.
- Remnant audit: `rg 'library-sr-only|rdm-sr-only|rjt-sr-only' src/client` → **0
  matches**; `rg '\.sr-only\s*\{' src/client --glob '*.vue'` → **0** scoped defs
  (only the global in `design-system.css` remains).

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Consolidate onto the global `.sr-only` | One source of truth; canonical `clip-path`; no drift | Mechanical rename across four files | **Adopted.** |
| Keep per-component variants | No rename churn | Duplicated CSS; three missing `clip-path`; drift risk | Rejected. |

**Final stack.** Four class-name swaps and four definition deletions, leaving the
Batch P global `.sr-only` as the single screen-reader-only utility across the
client.

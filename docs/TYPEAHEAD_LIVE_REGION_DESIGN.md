# Typeahead Result Announcement (Live Region)

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): a
screen-reader live region that announces completed typeahead searches, making
the Batch N live search accessible to assistive-tech users.

---

## 1. Purpose

Batch N made Discover search update results live as the operator types, but the
result-count change was not announced to screen-reader users — the count strip
sits in a `role="list"` (not a live region). This batch adds a dedicated
`role="status"` live region that speaks the outcome of each completed search
("12 artists found", "No artists found", or the error), while staying quiet
mid-flight to avoid per-keystroke spam.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Live regions | MDN — *ARIA live regions* | `aria-live="polite"` for search-result updates; **start empty**, announce on change; add `role="status"` + a redundant `aria-live="polite"` for compatibility; `aria-atomic="true"` so the full message speaks each time. |
| Status role | W3C WCAG 2.2 — ARIA22 (`role="status`) | `role="status"` carries an implicit polite live region for status messages. |
| Best practice | a11y-collective — *Complete Guide to ARIA Live Regions* | Keep announcements short; don't announce every tiny change (avoid spam); use a visually-hidden region. |

---

## 3. Design

### 3.1 Pure wording — `src/client/lib/search-status-message.js` (new)

`buildSearchStatusMessage({ count, isSearching, hasSearched, searchError })` →
the text to announce. It is **quiet** (returns `''`) while a search is in flight
or before any search has run, so the live region announces only on completion —
no per-keystroke spam. On a completed search it returns `"N artists found"` (with
`"1 artist found"` singularisation), `"No artists found"`, or the provided error
string. Fully unit-tested.

### 3.2 Global `.sr-only` utility — `design-system.css`

Added the standard clip-pattern `.sr-only` (position/clip/1px) as a shared
utility. Previously each component defined its own scoped copy
(`library-sr-only`, `rdm-sr-only`, `rjt-sr-only`, RequestCard's `.sr-only`); this
gives the live region (and future uses) a single source.

### 3.3 Live region — `DiscoverView.vue`

A visually-hidden `<p class="sr-only" role="status" aria-live="polite"
aria-atomic="true">` bound to a `searchStatusMessage` computed (which calls the
helper with the live `results`/`isSearching`/`hasSearched`/`searchError`, passing
the already-sanitised `formatDiscoverSearchError` output for errors). Because the
region starts empty and only changes on completion, screen readers speak once per
settled search.

### 3.4 Single announcement source — demote the Batch B "searching" card

The Batch B searching card carried `role="status" aria-live="polite"
aria-busy="true"`. For a *typeahead* that would re-announce "Searching…" on every
debounced search — spam. It was demoted to a plain visual `<article>` (no
live-region role), so the new region is the sole announcement source. The
in-flight state is still conveyed to AT by the search input's dynamic
`aria-label` ("Searching for an artist", Batch N) and the submit button's
`aria-busy`; the demoted card remains readable if navigated to, just not
auto-announced.

---

## 4. Security

- **No injection surface.** The message is text-interpolated (`{{ }}`) from a
  count + fixed strings + the already-sanitised `formatDiscoverSearchError`
  output. No `v-html`; no raw error detail reaches the DOM.
- **No data-flow change.** The region reads existing reactive state
  (`results`/`isSearching`/`hasSearched`/`searchError`); no new network/auth/query
  surface.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/search-status-message.js` | **New.** Pure `buildSearchStatusMessage`. |
| `src/client/design-system.css` | Global `.sr-only` utility. |
| `src/client/views/DiscoverView.vue` | `searchStatusMessage` computed; sr-only `role="status"` live region; Batch B searching card demoted to a plain visual article. |
| `test/client/search-status-message.test.js` | **New.** 11 tests (quiet states, counts, singular, error, lifecycle walk). |

---

## 6. Validation

- Focused: `node --test test/client/search-status-message.test.js` → **11/11 pass**.
- Full client suite: `npm run test:client` → **3684 pass, 0 fail** (+11 new).
- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- **Recommended confirmation:** a screen-reader pass (NVDA/VoiceOver) confirming
  "N artists found" / "No artists found" is spoken once per settled typeahead
  search and that mid-flight typing stays quiet — not runnable in-env.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Dedicated `role="status"` region, quiet mid-flight | Announces only completions; no typeahead spam; tested wording | One extra live region | **Adopted.** |
| Demote the Batch B searching card | Single announcement source; removes typeahead "Searching…" spam | Loses the card's auto-announce (in-flight state still conveyed via input `aria-label`/`aria-busy`) | **Adopted.** |
| Global `.sr-only` utility | DRY; replaces per-component duplicates | Slightly broader global CSS | **Adopted.** |

**Final stack.** A pure, tested status-message helper, a shared `.sr-only`
utility, a single `role="status"` live region bound to completed-search outcomes,
and a demoted searching card so the region is the sole announcement source. The
Batch N typeahead is now screen-reader-accessible.

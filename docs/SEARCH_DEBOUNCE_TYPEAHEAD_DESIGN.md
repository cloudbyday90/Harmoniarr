# Search Debounce & Typeahead

Status: **Implemented.** This document records the design and outcome for
proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): a
debounced, rate-capped, cancellable typeahead for Discover artist search,
keeping the explicit press-enter submit as a fallback.

---

## 1. Purpose

Discover search was submit-only: the operator typed a full query and pressed
enter. There was no incremental feedback, and rapid resubmissions could fire
overlapping upstream requests. This batch makes search feel live — dispatching
after a quiet typing period — while being a good MusicBrainz citizen (rate cap)
and race-free (a newer search always supersedes an in-flight one).

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Rate limit | MusicBrainz — *API / Rate Limiting* | ~1 request/second per source IP; violations block **all** requests until the rate drops. The search proxies through Harmoniarr's backend (`/api/v1/metadata/musicbrainz/artists/search`), so the client must debounce + min-interval (the backend IP is shared). |
| Cancellation | AbortController + the existing `isAbortError` helper | An aborted fetch is an *intentional cancellation*, not a failure — it must not set an error or reset the loading flag for the superseding search. |
| Debounce vs throttle | Standard live-search pattern | Debounce (quiet period) for the live feel + a minimum interval between dispatches for the rate cap; the gating rules are pure/testable. |

---

## 3. Design

Layered so the gating logic is pure and unit-tested, and only timing/state lives
in the composable.

### 3.1 Pure gating — `src/client/lib/search-dispatch.js` (new)

`resolveSearchDispatch({ query, lastQuery, minLength, minIntervalMs, elapsedMs })`
→ `{ dispatch, reason, deferMs }`. Three gates, in order:

1. **min-length** — trimmed query must meet `minLength` (default 2; avoids
   half-typed noise).
2. **de-dupe** — trimmed query must differ from the last *dispatched* query.
3. **rate-limit** — at least `minIntervalMs` since the last dispatch; when this
   fails, `deferMs` tells the caller how long to wait before re-evaluating.

Returns a `reason` (`ok` / `short` / `unchanged` / `rate-limited`) so the
composable knows whether to defer (rate-limited) or drop (short/unchanged).

### 3.2 Cancellable fetch — `metadata-api.js`

`searchMusicBrainzArtists({ query, limit, signal })` now forwards an optional
`AbortSignal` to `apiRequest`, enabling in-flight cancellation.

### 3.3 Abort-aware core — `useDiscoverSearch.runSearch({ signal })`

`runSearch` forwards the signal to `searchArtists`. An abort is treated as a
cancellation: a stale (aborted) result is discarded, no error is set, and only
the still-current (non-aborted) search resets `isSearching`. The existing
clear-results / panel-state-machine behavior is preserved.

### 3.4 Debounce layer — `src/client/composables/useDebouncedSearch.js` (new)

Wraps `useDiscoverSearch`. Watches the shared `query` ref and, on each keystroke,
re-arms a `quietMs` (350ms) debounce. When it elapses, it calls
`resolveSearchDispatch`; on `ok` it dispatches (aborting any in-flight search via
a fresh `AbortController`), on `rate-limited` it defers by `deferMs`, otherwise it
drops. `minIntervalMs` (1000ms) enforces the MusicBrainz rate cap.

`submit()` is the press-enter fallback: it clears the debounce and dispatches
immediately, bypassing the rate cap (the user asked explicitly) but still
honoring `minLength`. Timers and the controller are cleaned up on unmount.

### 3.5 Wiring

`DiscoverView` calls `useDiscoverSearch()`, passes it to `useDebouncedSearch`,
and binds `@submit` to the composable's `submit`. `DiscoverSearchBar`'s input is
no longer disabled while searching (so typing continues), and the submit button
stays actionable (it cancels the debounce and searches immediately). The
`isSearching` flag still drives the "Searching..." affordance and `aria-busy`.

---

## 4. Security

- **Client-only timing.** Debounce/min-interval are in-memory; no new network,
  query, auth, or data surface.
- **Signal is request-scoped.** The `AbortSignal` only cancels the proxied fetch
  to Harmoniarr's backend; it carries no credentials or payload.
- **AbortError handled.** A cancellation never surfaces as a user-facing error
  (`isAbortError` short-circuits the error path), so no internal service names or
  stack detail leak from a cancelled request.
- **No injection surface.** The query is trimmed and forwarded unchanged to the
  existing backend route; no `v-html` or new rendering of user input.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/search-dispatch.js` | **New.** Pure `resolveSearchDispatch`. |
| `src/client/lib/metadata-api.js` | `searchMusicBrainzArtists` accepts/forwards `signal`. |
| `src/client/composables/useDiscoverSearch.js` | `runSearch({ signal })`; abort = cancellation (no error, conditional `isSearching` reset). |
| `src/client/composables/useDebouncedSearch.js` | **New.** Debounce + min-interval + AbortController + `submit`. |
| `src/client/views/DiscoverView.vue` | Wires `useDebouncedSearch`; `@submit` → `submit`. |
| `src/client/components/media/DiscoverSearchBar.vue` | Input stays enabled while searching; submit stays actionable; dynamic `aria-label`. |
| `test/client/search-dispatch.test.js` | **New.** 13 tests (gates, ordering, robustness). |
| `test/client/useDiscoverSearch.test.js` | Updated the call-args assertion for the new `signal`. |

---

## 6. Validation

- Focused: `node --test test/client/search-dispatch.test.js
  test/client/useDiscoverSearch.test.js` → **18/18 pass**.
- Full client suite: `npm run test:client` → **3673 pass, 0 fail** (+13 new).
- Lint: `npm run lint:client` + `npm run lint:test` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- **Recommended confirmation:** a manual check that typing dispatches a search
  after a pause, that a newer query supersedes an in-flight one, and that the
  rate cap defers rapid re-searches — not runnable in-env.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Pure `resolveSearchDispatch` + composable for timing | Gating fully unit-tested; clear separation | One thin indirection layer | **Adopted.** |
| Debounce + min-interval (not debounce-only) | Respects MusicBrainz 1 req/s; race-free | Slightly slower re-search within the rate window (by design) | **Adopted.** |
| AbortController cancellation | Newer search always wins; no error on cancel | `searchMusicBrainzArtists` gained a `signal` param | **Adopted.** |
| Keep submit fallback + clear-results UX | Press-enter still works; panel-state machine undisturbed | Brief "Searching…" flash per dispatch (intentional feedback) | **Adopted.** |

**Final stack.** A pure gating helper (13 tests), an abort-aware `runSearch`, a
debounce/rate-cap/cancel composable, a cancellable backend call, and minimal
view/bar wiring. Discover search now responds as the operator types — debounced,
rate-capped, and race-free — with the explicit submit preserved.

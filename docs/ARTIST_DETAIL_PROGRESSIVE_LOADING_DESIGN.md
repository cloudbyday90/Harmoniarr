# Artist Detail Progressive Loading Design

Status: Implemented
Date: 2026-08-29
Owner: Client experience + metadata architecture

## Decision

Render the Artist Detail profile shell immediately when the route already
contains an artist name, and isolate the loading state to the Discography
section. Retain the existing request sequence and server-side stale-while-
revalidate (SWR) cache unchanged.

The screen will therefore show the known artist identity and stable page
structure while the client resolves local metadata, the operator projection,
and, only when needed, the cached release catalogue. The Discography card is
the only region marked busy. It gives a plain-language update and a fixed-size
skeleton instead of replacing the whole page with a generic progress card.

## Problem

The existing Artist Detail view conditionally replaced every section with
"Loading artist detail…" while the composable's combined request completed.
That behavior hid a fast fresh or stale SWR response behind unrelated local or
operator work. It made the page appear uncached even when the application had
correctly returned a cached Discography response.

The prior browser evidence proves the durable server cache's cold, fresh, and
stale paths. This increment addresses the remaining presentation boundary; it
does not change cache policy, TTLs, provider traffic, browser cache headers,
or the authenticated API contract.

## Standards and research review

Reviewed against current primary guidance on 2026-08-29:

- [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires application waiting states displayed without a context change to be
  programmatically determinable. A short, scoped status allows assistive
  technology to report progress without moving focus.
- [W3C Technique ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
  identifies `role="status"` with explicit `aria-atomic="true"` as a suitable
  pattern for a complete, polite status update. The loading component uses that
  pattern and keeps decorative skeletons outside the accessibility tree.
- W3C's [understanding guidance for status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions that live regions can become overly chatty. This design has one
  status for the one unresolved region; it does not announce cache phase,
  provider status, artwork, or every release row.
- [Vue conditional-rendering guidance](https://vuejs.org/guide/essentials/conditional)
  confirms that `v-if` creates and destroys blocks. The previous top-level
  branch destroyed the completed profile shell; this design reserves `v-if`
  for the unresolved Discography content instead.

## Design

### Loading model

```text
Route name hint ──> Artist Profile shell (immediate, stable)
                              │
Existing local/operator/discography path ──> Discography busy region
                              │
                              └──> Discography data, empty state, or error
```

- The profile shell uses the route's existing `name` hint where available.
- While the composed detail load is active, the overview says `Loading` rather
  than making an unsupported availability claim.
- The Discography card receives `aria-busy="true"` and renders the new
  `ArtistDetailDiscographyLoadingState` component. Its skeleton uses existing
  `hx-skeleton` tokens and fixed widths, reserving space without animation or
  layout shift.
- When the request completes, the normal Discography success, empty, and error
  states remain mutually exclusive. Related artists remain a lower-priority
  enhancement, unchanged.

### Request and security boundaries

- Do not parallelize the provider-backed Discography call with local and
  operator requests. That would reduce one waterfall but can create redundant
  catalogue reads for locally complete artists and contend with the existing
  shared provider budget.
- Do not add a browser cache, client persistence, public diagnostics route,
  cache labels, or timing disclosure. The durable PostgreSQL cache and
  authenticated API response policy remain authoritative.
- The new browser fixture delay is test-only, respects abort signals, and has a
  zero-delay default. It carries no credentials or production configuration.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep the page-wide loading card | Minimal code | Hides already-known context and makes a cache hit appear slow | Reject |
| Start all Artist Detail requests together | May reduce a sequential wait | Adds avoidable provider work and can compete with Discography's intentional priority | Reject |
| Add browser/session cache or cache-state UI | May appear immediate | Duplicates cache authority, risks stale user-visible state, and adds non-actionable technical language | Reject |
| Keep fetch order; render a profile shell and section-scoped status | Honest progress, stable layout, no extra requests, accessible announcement | The section still waits for the real request when it is cold | Adopt |

## Open pull request review

GitHub currently lists three open Dependabot PRs. None can be applied locally
without regressing current main:

| PR | Proposed change | Current main | Decision |
| --- | --- | --- | --- |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `docker/build-push-action` 7.1 → 7.2 | 7.3 | Superseded |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `docker/metadata-action` 6.0 → 6.1 | 6.2 | Superseded |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Node 24.19 Alpine → Node 26.7 Alpine | Project runtime policy is Node 24 LTS (`>=24.15 <25`) | Incompatible major-runtime change |

No open PR is merged or copied into this increment. The review is preserved so
the next compatible PR can be taken on its own merits.

## Final recommendation stack

1. Keep server-side SWR and the current provider-request prioritization.
2. Keep the Artist Detail route name hint and always render it as useful
   identity context during a load.
3. Scope progress to the unresolved Discography region using a quiet,
   semantic status and `aria-busy`.
4. Guard this behavior with a real-browser regression that delays only the
   test fixture's local lookup, then proves the profile shell remains visible.
5. Reconsider request parallelism only if measurement shows the remaining
   local/operator sequence is a material bottleneck after this correction.

## Next item

Measure the real local/operator leg using the existing browser timing harness.
If it repeatedly dominates a fresh or stale Discography response, introduce a
deduplicated, bounded orchestration change with a controlled regression test;
otherwise retain the current provider-priority sequence.

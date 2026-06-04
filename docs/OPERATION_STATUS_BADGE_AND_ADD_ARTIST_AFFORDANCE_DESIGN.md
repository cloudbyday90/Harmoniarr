<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

# Operation Status Badge & Unified Add-to-Monitored Flow — Design (Phase 8)

This phase closes two consistency gaps surfaced during the prior UI-architecture
passes:

1. **`OperationStatusBadge` primitive** — the operation/run status pill was
   hand-assembled (`hx-pill` + tone + label) at four call sites across the queue
   table, the job-detail panel, and the activity queue. Drift in tone/label
   wiring was a latent risk.
2. **Unified add-to-monitored flow** — Discover used the modern `+` →
   `AddArtistModal` policy dialog, while Search still used a legacy one-tap
   `monitorArtist()` toggle. Two affordances, two mutation entry points, one
   intent.

## Research

- **Tooling note:** Tavily MCP remains **down** this session (`Invalid API key`).
  Research was corroborated via the live GitHub MCP tools against
  [`vuejs/docs`](https://github.com/vuejs/docs) (official style guide).
- **Vue style-guide alignment:**
  - *Strongly Recommended — base/presentational components* favour small,
    single-purpose, prop-driven components. A status pill rendered identically in
    several places is the canonical case for a shared presentational primitive.
  - *Essential — component data / single responsibility* and *Strongly
    Recommended — tightly coupled component logic into composables* support
    lifting the add-dialog orchestration (open / candidate / submit / error) into
    a reusable composable rather than duplicating it per view.
  - *data-down / events-up*: the badge takes `status` down and renders; the add
    dialog raises `submit`/`close` events and the host view supplies a per-surface
    `onAdded` hook. No shared mutable state leaks across surfaces.

## Design

### 1. `OperationStatusBadge.vue`

A presentational base component (`src/client/components/OperationStatusBadge.vue`)
that is the single source of truth for rendering an operation/run status pill.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `status` | `String` | `null` | The raw status token. |
| `variant` | `String` | `'run'` | Vocabulary selector; validated to `run` \| `queue`. |
| `unknownLabel` | `String` | `'Unknown'` | Fallback label for unmapped/empty status (e.g. `Never run`). |

Internally it selects the correct **existing** lib helpers — keeping a single
mapping authority:

- `variant="run"` → `formatOperationRunStatusTone` + `getOperationRunStatusLabel`
  (lifecycle states: completed/running/pending/cancelled/failed).
- `variant="queue"` → `formatQueueRunStatusTone` + `formatQueueRunStatusLabel`
  (extended queue states: succeeded/in_progress/claimed/queued/...).

It renders the design-system primitive `<span class="hx-pill" :data-tone>` and
emits a neutral pill (no `data-tone`) when the tone helper returns nothing — which
preserves the prior `Never run` and unknown-status appearance exactly.

**Adopted at four sites:** `OperationsView.vue` (job-queue row + recent-runs
subtable), `OperationJobDetailPanel.vue` (status hero), `ActivityQueueView.vue`
(queue row). Now-unused helper imports were pruned at each site.

### 2. `useAddArtistModal.js`

A composable (`src/client/composables/useAddArtistModal.js`) that owns the
add-dialog lifecycle previously inlined in `DiscoverView`:

- State: `addArtistModalOpen`, `addArtistCandidate`, `addArtistErrorMessage`,
  `addArtistPolicyDefaults`, `lastAddedArtistId`.
- Actions: `openAddArtistModal(artist, isAlreadyAdded?)`,
  `closeAddArtistModal()`, `submitAddArtist(policyForm, { onAdded })`.
- It drives the **one** mutation path — `useArtistMonitoring().addArtistWithPolicy`
  (import → policy draft save) — and persists policy defaults via
  `add-artist-policy.js`. A pre-instantiated `monitoring` instance can be injected
  so a single `useArtistMonitoring()` is shared with the host view (and stubbed in
  tests).
- Surface-specific follow-up is delegated through the `onAdded(artist, result)`
  hook and the `isAlreadyAdded` predicate, so the composable stays
  presentation-agnostic.

**Adopted at two surfaces:**

- `DiscoverView.vue` — refactored onto the composable (Discover keeps its
  taste-graph `onAdded`: `addSeed` + `loadMonitoredArtists`, and its seed-chip
  focus-return). The `isAddedArtist` predicate (seed **or** monitored) is passed
  through the open wrapper.
- `SearchView.vue` — the legacy one-tap `monitorArtist` affordance was replaced
  by the same `AddArtistModal` policy dialog. The artist card's existing
  `@monitor` event now opens the policy dialog; artwork for the dialog is resolved
  from the existing batch-resolve cache. Search and Discover now share one
  affordance and one mutation entry point.

Artist-detail's full policy-editing card is intentionally **out of scope** — it is
a distinct editing surface (toggle + per-release overrides), not a quick add.

## Security

Both changes are client-only and presentational:

- **No new endpoints or data flows.** The status badge renders static, already
  fetched data; its SVG/markup contain no `v-html`.
- **Consolidating to one mutation path is a security/auditability improvement.**
  Search now flows through the same `addArtistWithPolicy` (import +
  `saveOperatorArtistDraft`) that Discover already used, governed by the existing
  request/CSRF and role handling — there is one place to audit add-to-monitored
  mutations, not two.
- No change to admin-gating, cancel/retry, or any server contract.

## Files changed

| File | Change |
| --- | --- |
| `src/client/components/OperationStatusBadge.vue` | **New** presentational badge primitive. |
| `src/client/composables/useAddArtistModal.js` | **New** shared add-dialog orchestration composable. |
| `src/client/views/OperationsView.vue` | Use badge at two sites; prune helper imports. |
| `src/client/components/OperationJobDetailPanel.vue` | Use badge for the status hero; prune imports. |
| `src/client/views/ActivityQueueView.vue` | Use badge for queue rows; prune imports. |
| `src/client/views/DiscoverView.vue` | Adopt `useAddArtistModal`; remove inlined dialog logic. |
| `src/client/views/SearchView.vue` | Replace one-tap monitor with the shared policy dialog. |
| `test/client/operation-status-badge-contract.test.js` | **New** contract test. |
| `test/client/use-add-artist-modal-contract.test.js` | **New** composable + adoption contract test. |

## Validation

- `npx eslint` on all changed client files — clean.
- New contract suites — 8/8 pass.
- `node scripts/check-copyright.js`, `npm run check:test-hygiene`, full `npm test`.

## Pros / Cons & Final Recommendation

### 1. Status badge — `variant`-driven primitive vs inline pills

| | Pros | Cons |
| --- | --- | --- |
| **Shared `OperationStatusBadge` (chosen)** | One render authority; guaranteed tone/label parity; tiny call sites; trivially testable | One more component file; a `variant` prop to remember |
| Inline pills (status quo) | No new file | Four drift-prone copies; visual divergence risk |

**Recommendation:** shared primitive. Mapping logic stays in the lib; the
component only *selects* the right pair, so there is no duplication of business
rules.

### 2. Add flow — shared composable (Discover + Search) vs leaving divergent

| | Pros | Cons |
| --- | --- | --- |
| **`useAddArtistModal`, Discover + Search (chosen)** | One affordance, one mutation path, one place to audit; matches the documented recommendation model; small blast radius (only Search's isolated `@monitor` handler changes) | Search gains a confirmation step it did not have (intended per the model) |
| Converge artist-detail too | Maximal uniformity | Artist-detail is a full editor, not a quick add — forcing it through the modal would regress that surface |
| Leave divergent | Zero change | Two affordances, two mutation entry points; ongoing drift |

**Recommendation:** shared composable for Discover + Search; leave artist-detail's
editor as-is.

### Final recommendation stack (Phase 8)

- **Primitive:** `OperationStatusBadge.vue` (`status` + `variant` `run`/`queue`).
- **Orchestration:** `useAddArtistModal.js` injected with a shared
  `useArtistMonitoring()` instance; `onAdded` hook per surface.
- **Mutation authority (unchanged):** `addArtistWithPolicy` → import +
  `saveOperatorArtistDraft`.
- **Tests:** static contract tests + behavioural composable tests with a
  monitoring stub.

## Three future areas (design perspective)

1. **Ledger & ignore-list lifecycle** *(carried forward)* — retention, export, and
   backup/restore semantics for the operation ledger and the artist ignore list;
   define pruning windows and an audit-friendly export.
2. **Unified empty-state & affordance audit** — sweep remaining ad-hoc `+`/CTA
   buttons (home panels, requests, releases) so every "add/act" affordance shares
   one accessible pattern (label, idle/pending/done states) the way status now
   shares one badge.
3. **Toast / feedback convention consolidation** — the add flow, request flow, and
   monitoring all emit toasts with slightly different copy/severity rules; define a
   single feedback contract (success vs error persistence, dedupe, action links)
   and route all surfaces through it.

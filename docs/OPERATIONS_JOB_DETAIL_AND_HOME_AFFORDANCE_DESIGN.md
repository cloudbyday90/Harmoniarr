# Operations Job Detail & Home Affordance Design

> Phase 7 of the frontend craftsmanship programme. Two changes shipped together in
> one redesign pass: (1) extracting the ~175-line inline "Job detail" panel out of
> `OperationsView.vue` into a dedicated presentational child component, and
> (2) fixing the Operator Home "add artists" affordance so the in-grid tile reads as
> an action instead of a fake monitored artist. Both changes are client-only and
> introduce no new data flows.

## 1. Research (May 2026)

The Tavily research MCP remained unavailable this phase (the endpoint returned
`Invalid API key`), so corroboration was gathered through the GitHub code/repository
search MCP against the **official Vue documentation** (`vuejs/docs`). The findings
directly shaped both changes:

- **Tightly-coupled component naming** — the Vue Style Guide (Priority B,
  *"Tightly coupled component names"*) states that a child component that only makes
  sense inside one parent should carry the parent name as a **prefix**. This
  validates naming the extraction `OperationJobDetailPanel` (and keeps it
  alphabetically adjacent to the existing `OperationRunDrilldownPanel`, the
  in-repo precedent for this exact split).
- **Props down / events up** — the Style Guide (Priority D, *"Implicit parent-child
  communication"*) is explicit that components should communicate via **props down
  and events up**, never by mutating props or reaching into `$parent`. The new panel
  therefore receives plain data props and emits intent events
  (`request-cancel` / `request-retry`); all mutation/orchestration stays in the
  parent view.
- **Detailed prop definitions** — the Style Guide (Priority A, *"Use detailed prop
  definitions"*) requires committed props to declare at least a type. Every prop on
  the new panel is declared with an explicit `type` and `default`.
- **Component-scoped styling / test the public interface** — the panel reuses the
  existing global `ops-*` and `operations-insight-*` classes (already defined in
  `design-system.css`/`styles.css`), and the contract test asserts the **public
  interface** (props + emits + delegation), in line with the Style Guide's testing
  guidance to "test what a component does, not how it does it."

Because the in-repo `RequesterHomePanel.vue` already implements the correct
"find more artists" tail-card pattern (a dashed tile with an inline SVG glyph and a
single line of copy), the Home fix is a **convergence on an existing, validated
pattern** rather than a net-new design.

## 2. Design

### 2.1 `OperationJobDetailPanel` extraction

The inline `#operation-run-detail-panel` `<article>` (~175 template lines) moved
verbatim into `src/client/components/OperationJobDetailPanel.vue`. The move was done
**behaviour-preserving first**: the markup, global class names, and presentation
helpers are identical, so the rendered output is unchanged.

**Contract**

| Direction | Name | Type | Purpose |
|---|---|---|---|
| prop | `run` | `Object \| null` | Selected run projection (was `selectedRun`) |
| prop | `detail` | `Object \| null` | Run detail incl. `auditEvents` (was `selectedRunDetail`) |
| prop | `isLoading` | `Boolean` | Detail/timeline fetch in flight |
| prop | `isCancelling` | `Boolean` | Cancel mutation in flight |
| prop | `isRetrying` | `Boolean` | Retry mutation in flight |
| prop | `cancellationError` | `String` | Cancel error strip text |
| prop | `retryError` | `String` | Retry error strip text |
| prop | `detailError` | `String` | Detail-load error strip text |
| emit | `request-cancel` | — | Operator asked to cancel the run |
| emit | `request-retry` | — | Operator asked to retry the run |

**Responsibility split** — the panel is fully presentational. It derives its own
read-only view state from `run` (the `canCancel`, `canRetry`, `workflowTarget`,
`lease`, `summaryEntries`, and raw-JSON fallback computeds all moved into the child),
which shrinks the parent's surface area. The parent `OperationsView.vue` keeps every
piece of orchestration: run selection, history polling, route sync, and the
cancel/retry mutations (`handleRequestCancellation` / `handleRequestRetry`) that the
panel now triggers purely by emitting intent.

This removed five computeds, two helper functions, and eleven now-unused imports from
`OperationsView.vue`, and deleted the inline 175-line block — a measurable reduction
in the view's cognitive load.

**Redesign touches (low-risk, layered after the pure move)**

- Cancel/Retry buttons gained `:title` affordances describing the action or the
  in-flight reason, improving discoverability for operators.
- The loading line gained `aria-live="polite"` / `aria-busy="true"` so assistive
  tech announces the detail-fetch state.
- The state-adaptive insight grid (error-led when a run failed, "what happened" when
  it succeeded, always "what to do next") is preserved and now lives in a focused
  component where it can evolve independently.

### 2.2 Operator Home add-artists affordance

The Home screen intentionally keeps **two** add-artist affordances, now clearly
differentiated by role:

- **Header button** (`Add artists`, `data-variant="primary"`) — the deliberate,
  top-level action.
- **In-grid tail tile** (`Add more artists`) — the in-context "add more" affordance
  that sits at the end of the monitored-artist grid.

The bug was that the tile rendered `buildDiscoverAvatarStyle('discover-more', 'Add')`
plus `buildDiscoverArtistInitial(...)`, which painted a **filled, coloured avatar
with the letter "A"** — visually indistinguishable from a real monitored artist named
"A". The fix replaces that with a **neutral dashed tile containing a `+` glyph**
(matching the `hx-artwork--dashed` treatment already used by `RequesterHomePanel`),
a single `Add more artists` title, and a quiet `Search Discover` meta line. On hover
/ focus the dashed outline and glyph adopt the accent colour so the tile reads
unmistakably as an action. The two now-unused `discover-presentation` imports were
removed.

## 3. Security

Both changes are **client-only and presentational**:

- No new endpoints, requests, or data flows are introduced.
- The cancel/retry mutations remain in `OperationsView.vue` and continue to flow
  through the existing `useOperationHistory` composable, preserving the current
  admin-gating and CSRF protections on those operations. The child can only *ask*
  for those actions via emitted events; it never performs them.
- The `+` glyph is a static inline SVG (no external asset, no `v-html`), so there is
  no injection surface.

## 4. Files changed

- **New** `src/client/components/OperationJobDetailPanel.vue` — extracted
  presentational panel (GPL header, detailed props, declared emits).
- `src/client/views/OperationsView.vue` — delegates to `<OperationJobDetailPanel>`;
  removed inline block, five computeds, two helpers, and unused imports.
- `src/client/components/home/OperatorHomePanel.vue` — dashed `+` action tile; removed
  `discover-presentation` imports; scoped style update for the glyph + hover/focus.
- **New** `test/client/operation-job-detail-panel-contract.test.js` — asserts the
  panel contract, the view delegation, and the Home tile fix.
- **New** `docs/OPERATIONS_JOB_DETAIL_AND_HOME_AFFORDANCE_DESIGN.md` — this document.

## 5. Validation

- `npx eslint` on all three changed SFCs — clean.
- `node --test test/client/operation-job-detail-panel-contract.test.js` — 3/3 pass.
- `node scripts/check-copyright.js`, `npm run check:test-hygiene`, and the full
  `npm test` suite — see commit evidence.
- No migration or schema-snapshot change (client-only).

## 6. Pros / cons and final recommendation stack

**Job detail panel**

| Option | Pros | Cons |
|---|---|---|
| **Extract `OperationJobDetailPanel` (chosen)** | Style-guide aligned; ~175 lines out of the view; reusable + independently testable; thinner parent | One new file |
| Keep inline, restyle only | No new file | View stays bloated; no reuse/testability |

**Home affordance**

| Option | Pros | Cons |
|---|---|---|
| **Neutral dashed `+` tile (chosen)** | Reads unambiguously as an action; matches in-repo `RequesterHomePanel` precedent; keeps in-context "add more" | Minor style work |
| Remove the in-grid tile | Simplest | Loses the convenient end-of-grid affordance |
| Keep colour, change letter | Trivial | Still looks like a fake artist — the actual bug |

**Final recommendation stack:** extract the presentational `OperationJobDetailPanel`
(data-down/events-up, detailed props, global classes reused, contract-tested) and
converge the Home tile on the existing dashed-glyph action pattern. Both ship together
with zero new data flows and the existing mutation security intact.

## 7. Three high-value future areas

1. **Shared operation-status presentation primitive.** The status pill + tone +
   label trio (`formatOperationRunStatusTone` / `getOperationRunStatusLabel`) is
   repeated across the queue table, the new panel, and the drilldown. A small
   `OperationStatusBadge` primitive would centralise tone/label mapping and guarantee
   visual consistency.
2. **Unified "add to monitored" flow.** Home, Discover, and artist-detail each have
   their own add-artist entry points. A single shared composable/flow (with one
   consistent affordance and confirmation/feedback) would remove drift like the tile
   bug fixed here and make the monitored-set mutation auditable in one place.
3. **Ledger & ignore-list lifecycle (carried forward).** Retention, export, and
   backup/restore semantics for the completed-measurement ledger and operator ignore
   lists remain undesigned. As these grow they need a documented retention policy and
   an export path for portability and audits.

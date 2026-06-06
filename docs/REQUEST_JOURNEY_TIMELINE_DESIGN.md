# Request Journey Timeline Design

> Phase 12 of the request-experience hardening track. One design document per
> phase; this document covers the unified request journey timeline only.

## Problem

`RequestDetailView` (`/app/requests/:id`) answers many questions — who requested
it, the raw fulfillment status, per-candidate import steppers — but it never
answers the one question a requester actually asks: **"where is my request right
now?"**

The existing per-candidate stepper (`buildPipelineSteps`) starts at the
candidate "Discovered" stage. That has three gaps:

1. It requires a candidate to already exist, so a freshly submitted request
   (requested → searching) shows nothing.
2. With multiple candidates it renders multiple, separate steppers — there is no
   single aggregated answer.
3. It never surfaces the request lifecycle endpoints: the initial
   "Requested" event or the final "in your library" confirmation.

## Research

Tavily MCP was unavailable this phase (invalid API key), so accessibility
guidance was grounded directly against the W3C source repositories
(`w3c/aria-practices` and `w3c/aria`) via the GitHub repo research tool.

Findings from the WAI-ARIA Authoring Practices Guide (APG):

- **There is no dedicated "stepper" / "progress tracker" pattern.** A read-only
  status spine is built from existing primitives, not a composite widget.
- **Ordered sequence → semantic ordered list.** Use `<ol>`/`<li>`; the order is
  meaningful and should be conveyed structurally.
- **Active step → `aria-current="step"`.** `aria-current` is a global state and
  `"step"` is its defined token for "a step within a process." The APG
  breadcrumb pattern (and its test suite) enforce that **exactly one** element in
  the set carries `aria-current`.
- **Quantitative progress → `progressbar` role.** `aria-valuenow` with implicit
  `aria-valuemin=0` / `aria-valuemax=100`, `aria-valuetext` for a human string,
  and the value omitted when indeterminate. Phase 13 added the requester-safe
  persisted projection documented in
  `REQUEST_TRANSFER_PROGRESS_READ_MODEL_DESIGN.md`; Phase 14 renders that value
  in the Downloading stage as documented in
  `REQUEST_DOWNLOADING_PROGRESS_BAR_DESIGN.md`.
- **Status changes → polite live region.** Announce stage transitions with
  `aria-live="polite"` / `role="status"`.
- Because the journey is **non-interactive** (it only reports state), no keyboard
  widget semantics are required.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A — extend `buildPipelineSteps`** | Reuses an existing helper | It is inherently per-candidate; cannot express request-level stages or aggregate across candidates; pollutes a tested helper |
| **B — add a `journey` field to the server detail read model** | One canonical source of truth | New backend surface and migration risk for a purely presentational concern; the constituent data is already on the client |
| **C — pure client derivation lib + presentational component (chosen)** | Pure and unit-testable; composes existing read models; zero backend change; APG-correct a11y; mirrors the established pure-lib + presentational-component convention | Adds one lib and one component |

## Final recommendation

**Option C.** A pure derivation library composes a single canonical journey from
read models the client already loads, and a presentational component renders it
with APG-correct semantics. No backend, route, or schema changes.

### Canonical stages

`Requested → Finding sources → Downloading → Importing → In your library`

Each stage resolves to one status: `complete`, `active`, `pending`, `failed`,
`skipped`, or `cancelled`. Terminal request states are handled explicitly:

- `already_exists` → searching complete, download/import **skipped**, library
  **complete**.
- `failed` with no candidates → searching **failed**.
- `cancelled` → the first unreached stage is marked **cancelled**.
- Per-candidate `execution` / `apply` run snapshots drive download/import
  active / complete / failed transitions; the most-progressed candidate wins
  when several are linked.

Exactly one stage is the "current" stage for `aria-current="step"`: the first
active stage, else the first failed/cancelled stage, else the last completed
stage.

## Files

| File | Role |
| --- | --- |
| `src/client/lib/request-journey.js` | Pure, framework-free derivation: `JOURNEY_STAGE`, `STAGE_STATUS`, `journeyStatusLabel`, `journeyStatusTone`, `resolveCurrentStageKey`, `buildRequestJourney`. |
| `src/client/components/RequestJourneyTimeline.vue` | Presentational `<ol>` timeline; `aria-current="step"` on the active step; polite live region; design-token styling. |
| `src/client/components/RequestStageProgressBar.vue` | Phase 14 APG progressbar for Downloading-stage persisted transfer progress. |
| `src/client/views/RequestDetailView.vue` | Wires the timeline in after the stat grid, composed from `mediaRequest` + `pipelineCandidates`. |
| `test/client/request-journey.test.js` | Pure unit tests across every state. |
| `test/client/request-journey-timeline-contract.test.js` | a11y / wiring contract assertions. |

## Security

- Client-only, read-only composition of read models that already flow through
  authenticated and authorized routes. No new endpoints, no new persistence.
- All rendering is text interpolation; no `v-html` is used, so there is no XSS
  injection surface (OWASP A03). Stage detail strings are static, not
  user-controlled.
- No secrets, tokens, or PII are introduced or logged.

## Validation

- `node --test test/client/request-journey.test.js test/client/request-journey-timeline-contract.test.js` — 21 passing.
- `npm test` — lint + test hygiene + node test suite (integration tests skip
  without a container runtime, as expected).
- `node scripts/check-copyright.js` — GPL headers present on all new files.

## Phase 14 Update

`REQUEST_DOWNLOADING_PROGRESS_BAR_DESIGN.md` completes the first previously
listed future area. The Downloading stage now consumes
`candidate.transferProgress`, selects the active progress-driving candidate in
the pure journey library, and renders determinate or indeterminate progress
without adding percentage ticks to the live region announcement.

`REQUEST_PROGRESS_FRESHNESS_POLICY_DESIGN.md` extends that progress model with
fresh, stale, and unknown observation states so the Downloading stage does not
present old persisted progress as a live reading.

`REQUESTER_SAFE_CANDIDATE_LABELS_DESIGN.md` narrows requester-facing pipeline
candidate labels to generic `Source N` text and moves peer/folder minimization
to the server projection boundary, while preserving full operator diagnostics
in Activity and admin/operator views.

## Future areas

1. **Per-request scoped downloads & transfer actions.** The existing
   `ActivityDownloadsView` is admin-global and read-only. A requester-scoped
   view (cancel / retry / re-queue a specific transfer) would let the journey's
   Downloading stage become actionable.
2. **Analyze-stage visibility.** Make the Importing stage explain *why* it is
   waiting — match confidence, tag reconciliation, transcode/validation
   progress — instead of a single "Importing" label, and reflect a future
   ClamAV quarantine gate (staging → scan → clean/quarantine) as an explicit
   sub-step.
3. **Requester-safe preview and apply-preview contracts.** Decide whether
   `/api/v1/import-candidates/:id/preview` and `/apply-preview` should stay
   admin-only or receive separate requester-safe projections aligned with the
   request journey.

## Phase 17 update

`REQUESTER_SAFE_IMPORT_CANDIDATE_DETAIL_CONTRACT_DESIGN.md` completes the
requester-safe import-candidate list/detail contract. Owned requester reads now
return minimal `Source` summaries while admin import review keeps full
diagnostics.

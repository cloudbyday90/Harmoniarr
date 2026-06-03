# Source-User Spectral Sidecar & Delivered-Quality Trend Design

> **Status:** Implemented. This document covers two paired enhancements to the source-user
> trust system: (1) an asynchronous **spectral-cutoff DSP sidecar** that performs the heavy
> half of fake-FLAC detection off the apply path, and (2) a **per-peer delivered-quality
> trend visualization** on the source-user detail panel. Both were proposed as future areas
> in [SOURCE_USER_TRUST_OPERATOR_QUALITY_DESIGN.md §7](SOURCE_USER_TRUST_OPERATOR_QUALITY_DESIGN.md#7-three-more-high-value-design-areas).

---

## 1. Research (current best practices, May 2026)

Tavily search was unavailable this cycle; primary research was conducted through the GitHub
MCP (`github_repo`, `search_code`, `get_file_contents`) against authoritative source
implementations. No URLs were assumed.

| Topic | Source / finding | How it shaped the design |
| --- | --- | --- |
| Spectral cutoff measurement | FFmpeg `af_aspectralstats` (`libavfilter/af_aspectralstats.c`) exposes a per-frame **`rolloff`** metric defined as the frequency below which 85% of the spectrum's cumulative energy lies. | We drive analysis entirely through a single `ffmpeg -af aspectralstats=measure=rolloff` pass rather than hand-rolling an FFT, keeping the heavy work inside a hardened, well-tested binary. |
| 85%-rolloff is energy-biased low | Because `rolloff` is an 85%-energy threshold, quiet/dark frames report a low cutoff even for authentic lossless. The **brightest** frame best reveals the true brick-wall ceiling. | The classifier estimates the cutoff as the **maximum** rolloff across sampled frames, not the mean — this avoids false transcode verdicts on dynamic material. |
| Cutoff → source-bitrate thresholds | `Guillain-RDCDE/FLAC_Detective` lossy-encoder fingerprints: ~16 kHz ⇒ 128 kbps, ~19 kHz ⇒ 192 kbps, ~20 kHz ⇒ 256 kbps, ~20.5 kHz ⇒ 320 kbps; genuine lossless extends to/above Nyquist (≈22.05 kHz at 44.1 kHz). | Banded verdicts in `classifySpectralCutoff`: ≥20 kHz authentic, 19–20 kHz suspicious (no penalty), 16–19 kHz and <16 kHz confirmed transcode (penalized), with descending quality weights. |
| Async job claiming under concurrency | `pg-boss` and similar PostgreSQL-backed queues use `SELECT … FOR UPDATE SKIP LOCKED` to let multiple workers claim disjoint rows without lock contention. | The job store claims with `FOR UPDATE SKIP LOCKED`, so post-apply drains are safe to overlap and never double-process a track. |
| Back-pressure | Standard producer/consumer guidance: bound the queue and shed load at enqueue time rather than letting an unbounded backlog accumulate. | Enqueue is a single atomic `INSERT … SELECT … WHERE (pending+active) < cap`, so the cap is enforced inside the database with no read-modify-write race. |
| Sparkline rendering | Common Vue/SVG sparkline practice: render a single `<path>` over a normalized coordinate space, invert y (SVG origin is top-left), and mark the latest point. | `buildSparklinePath` / `buildSparklineEndpoint` are pure functions producing an SVG `d` string and endpoint coordinate, fully unit-tested without a DOM. |

---

## 2. Design

### 2.1 Spectral-cutoff DSP sidecar (Item 1)

```
apply worker ── enqueueForAppliedCandidate ──▶ source_user_spectral_jobs (pending)
      │                                                   │
      └── (best-effort, post-apply) ── processPendingSpectralJobs ──┐
                                                                    ▼
                                       claim (FOR UPDATE SKIP LOCKED)
                                                                    ▼
                                   ffmpeg aspectralstats → cutoffHz (max rolloff)
                                                                    ▼
                                   classifySpectralCutoff → verdict + weight
                                                                    ▼
                       penalize? ── yes ──▶ recordSourceUserOutcomeEvidence
                                                (eventType 'spectral_analysis',
                                                 outcome 'failure',
                                                 qualityLabel 'spectral_transcode_confirmed')
                                                                    ▼
                                            completeSpectralJob (done)
```

- **Queue store** — `src/server/activity/source-user-spectral-job-store.js`. Table
  `source_user_spectral_jobs` (migration `20260628_000002_source_user_spectral_jobs.sql`).
  States `pending → active → done|failed`. Enqueue is atomic and capped (`maxBacklog`,
  default 500). Claims use `FOR UPDATE SKIP LOCKED` with a hard clamp (≤50/claim). Failures
  requeue to `pending` until `maxAttempts`, then settle `failed`. Stale `active` rows can be
  requeued (`requeueStaleActiveJobs`) and old terminal rows pruned (`pruneSpectralJobs`).
- **Pure classifier** — `src/server/media/media-spectral-analysis.js`.
  `classifySpectralCutoff` is side-effect-free and only renders a verdict when the file
  *claims* lossless (`isDeclaredLossless`) and the sample rate is ≥44.1 kHz; otherwise it
  returns `inconclusive` with full quality weight so unknowns are never punished.
- **Analyzer** — `src/server/media/ffmpeg-spectral-analyzer.js`. Wraps a single bounded
  `ffmpeg` invocation through the shared secure command boundary and parses `rolloff` values
  from metadata output, returning the max as the cutoff estimate.
- **Sidecar service** — `src/server/activity/source-user-spectral-sidecar-service.js`.
  Owns the enqueue filter and the drain loop, counts verdicts, and merges only confirmed
  transcodes into the reputation ledger. Both entry points are total (never throw).

**Wiring.** `import-candidate-module.js` constructs the sidecar (analyzer + store +
existing `recordSourceUserOutcomeEvidenceFn`) and injects `enqueueForAppliedCandidate` and
`processPendingSpectralJobs` into the apply worker. After `markImportCandidateApplied`, the
worker enqueues descriptors for ready lossless files (best-effort, fire-and-forget) and, at
the end of the apply, drains a bounded batch. This keeps a self-contained loop without
touching the startup/heartbeat runtime.

**Merge contract.** A confirmed transcode is recorded as a **distinct** post-hoc evidence
event (`eventType: 'spectral_analysis'`, `outcome: 'failure'`, `qualityLabel:
'spectral_transcode_confirmed'`, `qualityWeight` = the classifier band weight 0.05–0.15). It
augments — never rewrites — the apply-time success, so there is no double counting and the
ledger retains an auditable, separately-typed signal.

### 2.2 Delivered-quality trend visualization (Item 2)

- **Pure projection** — `src/server/activity/source-user-quality-trend.js`.
  `buildQualityTrend` folds recent outcome events into a normalized series plus derived
  flags: `degradedRecently` (prior window healthy, recent window poor), `alwaysPoor`
  (lifetime poor with enough samples and not a recent regression), `trendDirection`, the
  `signalMix` (counts by quality label), and recent/lifetime averages. Legacy weightless
  events fall back to binary success=1 / failure=0 semantics.
- **Detail-service injection** — `source-user-trust-detail-service.js` accepts an optional
  `listRecentOutcomeEventsFn`; when present it attaches `qualityTrend` to the detail payload,
  and tolerates a missing or failing ledger by emitting `null` (backward compatible).
  `activity-module.js` wires it to the existing outcome-ledger store.
- **Presentation** — `src/client/lib/source-user-quality-trend-presentation.js` (pure SVG
  geometry + label/tone formatters) feeds `src/client/components/QualityTrendSparkline.vue`,
  rendered in `SourceUserTrustDetailPanel.vue` only when `detail.qualityTrend` is present.

---

## 3. Security

- **No shell, no interpolation.** The analyzer spawns `ffmpeg` through
  `media-command-service` (`shell:false`, `windowsHide`, binary allowlist). The file path is
  passed as a discrete `argv` element, never concatenated into a command string, eliminating
  command-injection exposure on attacker-influenced filenames.
- **Resource bounds.** Every analysis is capped by `timeoutMs`, `maxBuffer`, and a
  `-t maxAnalysisSeconds` decode ceiling, so a hostile or corrupt file cannot hang or exhaust
  memory in the worker.
- **SQL parameterization.** All store queries are fully parameterized; the back-pressure cap
  is enforced atomically inside a single `INSERT … WHERE (count) < $n` so concurrent
  producers cannot exceed the bound via a read-modify-write race.
- **Fail-safe by construction.** Sidecar entry points and the trend lookup are total — any
  analyzer, store, or ledger error degrades to a skipped job / `null` trend and is surfaced
  via `onWarning`, never propagating into the apply transaction or the detail API.
- **Conservative policing.** Verdicts apply only to self-declared lossless at reliable sample
  rates; everything else is `inconclusive` at full weight, so the feature cannot
  unfairly penalize peers on ambiguous evidence.

---

## 4. Files changed

**Created**
- `src/server/migrations/20260628_000002_source_user_spectral_jobs.sql`
- `src/server/media/media-spectral-analysis.js`
- `src/server/media/ffmpeg-spectral-analyzer.js`
- `src/server/activity/source-user-spectral-job-store.js`
- `src/server/activity/source-user-spectral-sidecar-service.js`
- `src/server/activity/source-user-quality-trend.js`
- `src/client/lib/source-user-quality-trend-presentation.js`
- `src/client/components/QualityTrendSparkline.vue`
- Tests: `test/server/media-spectral-analysis.test.js`,
  `test/server/source-user-spectral-job-store.test.js`,
  `test/server/source-user-spectral-sidecar-service.test.js`,
  `test/server/source-user-quality-trend.test.js`,
  `test/client/source-user-quality-trend-presentation.test.js`

**Modified**
- `src/server/import-candidates/import-candidate-apply-worker.js` (enqueue + bounded drain)
- `src/server/import-candidates/import-candidate-module.js` (sidecar construction + injection)
- `src/server/activity/source-user-trust-detail-service.js` (quality-trend projection)
- `src/server/activity/activity-module.js` (ledger function wiring)
- `src/client/components/SourceUserTrustDetailPanel.vue` (sparkline render)
- `src/server/schema-snapshot.sql` (regenerated, 74 migrations)
- `test/server/source-user-trust-detail-service.test.js` (quality-trend cases)
- `docs/SOURCE_USER_TRUST_OPERATOR_QUALITY_DESIGN.md` (§7 marked implemented)

---

## 5. Validation

- `node --test` across all new/changed test files — 42 cases green.
- Full `npm run test:node` — green.
- `npx eslint` over every changed source and test file — clean.
- `node scripts/check-copyright.js` — passed (852 files).
- `node scripts/check-test-hygiene.js` — passed (573 files).
- `npm run check:schema-snapshot` — current (74 migrations).
- Database-gated checks (`check:schema-anchors`, `validate:database`) require a live Postgres
  and are deferred to CI where credentials are provisioned.

---

## 6. Recommendation stack (pros / cons)

| Decision | Chosen approach | Pros | Cons | Verdict |
| --- | --- | --- | --- | --- |
| DSP engine | `ffmpeg aspectralstats` single pass | Hardened binary, no bespoke FFT, cross-platform | Requires `ffmpeg` on PATH; coarse vs. a tuned FFT | **Adopt** — accuracy is sufficient for cutoff banding |
| Cutoff estimator | **Max** rolloff over frames | Avoids energy-bias false positives on dark material | Single bright artefact could bias high (safe direction) | **Adopt** |
| Scheduling | Enqueue per apply + bounded post-apply drain | Self-contained, no heartbeat surgery, low risk | Jobs may idle between sparse apply runs | **Adopt** — `processPendingSpectralJobs` is heartbeat-ready for later |
| Queue back-pressure | Atomic capped `INSERT … SELECT` | Race-free bound enforced in DB | Sheds newest work when saturated | **Adopt** |
| Merge contract | Distinct `spectral_analysis` failure event | No double counting, auditable, separately typed | Adds an event type to the ledger vocabulary | **Adopt** |
| Trend transport | Optional injected ledger fn on detail service | Backward compatible, fail-safe `null` | Extra query per detail load | **Adopt** — bounded by `qualityTrendEventLimit` |
| Sparkline | Pure SVG geometry + Vue render | DOM-free unit tests, token-themed | Manual path math | **Adopt** |

**Final stack:** FFmpeg `aspectralstats` (max-rolloff) → pure banded classifier → atomically
back-pressured PostgreSQL job queue with `SKIP LOCKED` claiming → sidecar drain wired through
the apply worker → confirmed transcodes merged as distinct ledger evidence; and a pure
quality-trend projection surfaced through an optional, fail-safe detail-service injection and
a DOM-free SVG sparkline component.

---

## 7. Three more high-value design areas

1. **Library-wide retroactive spectral scan + result cache.** Today analysis only runs for
   freshly applied candidates. Add an operator-triggered batch that walks the existing
   library through the same queue, plus a content-addressed result cache (keyed by file hash)
   so re-imports and re-scans skip redundant decodes and historical fakes get re-graded.

2. **Cross-peer collusion / duplicate-source detection.** Correlate identical confirmed-fake
   fingerprints (cutoff signature + hash) across multiple source users to surface rings that
   reshare the same transcode, and an operator-tunable trust-threshold + policy simulator to
   preview how a threshold change would reclassify the current peer population before applying
   it.

3. **Ledger & ignore lifecycle: retention, backup, export.** (Carried forward.) Decide and
   document whether `source_user_outcome_events`, `source_user_spectral_jobs`, and
   `source_user_ignore_entries` participate in backup/restore scopes, add a scheduled prune
   tied to `maxAgeDays`, and define export/redaction semantics so the evidence log, job
   queue, and ignore list have a first-class, governed lifecycle.

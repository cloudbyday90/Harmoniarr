# Source-User Fidelity Governance Design

> Phase 6 of the source-user integrity programme. Promotes the spectral and trust
> classification constants to persisted, operator-tunable admin settings with a
> simulate-before-apply preview, and aggregates the completed-measurement ledger
> into a library-wide fidelity health dashboard. Builds directly on
> `docs/SOURCE_USER_SPECTRAL_SCALE_DESIGN.md` (retroactive scan + cache + collusion +
> trust-threshold simulator).

## 1. Research (May 2026)

The Tavily research MCP was unavailable this phase (the endpoint returned
`Invalid API key`), so corroboration was gathered through the GitHub code/repository
search MCP instead. The findings reaffirm the premise of the existing classifier —
that a **spectral frequency cutoff** is the canonical fingerprint of a lossy→lossless
transcode — and therefore this phase is **governance over an already-validated
signal**, not a change to the DSP itself:

- **`Tealdragon204/nightcore-to-flac-analyzer` (`spectral.py`)** computes the
  85th-percentile **spectral rolloff** (Hz) and an explicit `effective_bandwidth_hz`
  documented as the "highest frequency with significant energy (lossy-transcode
  indicator)" — the same quantity Harmoniarr estimates as `cutoffHz`.
- **`Spek-audio-spectrogram`** confirms the broader practice: a hard frequency
  ceiling in the spectrogram is the visible signature of MP3/AAC encoding, used to
  spot lossy sources masquerading as lossless.

Because the cutoff bands are empirical (16/19/20 kHz boundaries map to ~128/192/256
kbps source encodings) and library populations differ, the high-value move is to let
operators **tune the band edges and the trust-review bars per deployment** and
**preview the impact before committing** — the same simulate-before-apply discipline
already used for the trust-threshold simulator.

## 2. Design

### 2.1 Persisted thresholds (no migration)

The cutoff-to-verdict and trust-review constants are promoted to a new `fidelity`
settings namespace persisted through the existing `app_settings` store and the
existing `PUT /api/v1/settings` contract. **No schema migration is required** and the
schema snapshot stays at version 75.

| Setting key | Default | Bounds |
|---|---|---|
| `spectralAuthenticMinCutoffHz` | 20000 | int 10000–24000 |
| `spectralSuspiciousMinCutoffHz` | 19000 | int 8000–24000 |
| `spectralTranscodeMidCutoffHz` | 16000 | int 4000–24000 |
| `spectralMinSampleRateHz` | 44100 | int 8000–192000 |
| `trustWatchFailureCount` | 3 | int 1–100 |
| `trustWatchMaxSuccessRate` | 0.5 | rate 0–1 |
| `trustWatchEvidenceCount` | 3 | int 1–1000 |
| `trustHealthyEvidenceCount` | 5 | int 1–1000 |
| `trustHealthyMinSuccessRate` | 0.8 | rate 0–1 |

`src/server/fidelity-threshold-settings.js` provides the single, tested translation
layer between this namespace and the in-memory threshold shapes consumed by the live
classifiers and the simulators. `createFidelityThresholdLoaders({ loadSettingsFn })`
returns best-effort `loadSpectralThresholdsFn` / `loadTrustReviewThresholdsFn` loaders
that **fail safe to the shipping defaults** if settings cannot be read, so the live
path can never be wedged into an impossible configuration.

### 2.2 Tunable classifier core

`media-spectral-analysis.js` keeps a frozen `DEFAULT_SPECTRAL_THRESHOLDS` and adds
`resolveSpectralThresholds(input)` (normalises a partial/operator-supplied object,
clamps each cutoff to a sane Hz range, and **enforces a monotonic
`authentic ≥ suspicious ≥ transcodeMid` ordering** so an inverted edge collapses a
tier rather than crossing over) and `buildCutoffBands(thresholds)`.
`classifySpectralCutoff` accepts an optional `thresholds` argument and is fully
backward compatible — passing nothing yields the previous behaviour byte-for-byte.

### 2.3 Simulate-before-apply (live preview)

Two pure simulators run the **same live classifier** over a recent population so a
proposed change can be previewed before persisting:

- `source-user-spectral-threshold-simulator.js` —
  `simulateSpectralThresholdPolicy({ measurements, thresholds, currentThresholds })`
  classifies every measured file under both the **current** (persisted baseline) and
  **proposed** thresholds and returns the verdict distribution, per-transition counts,
  and a changed-count delta. Verdicts: `authentic | suspicious | transcoded | inconclusive`.
- The trust simulator (`source-user-trust-threshold-simulator.js`) gained a
  `currentThresholds` baseline argument so the "current" column reflects the operator's
  persisted bars rather than the shipping defaults.

The service layer (`source-user-spectral-policy-simulation-service.js`) loads the
recent measured population from the insights store and the persisted baseline in
parallel, runs the simulator, and stamps `checkedAt`. It performs no mutation.

### 2.4 Fidelity health dashboard

`source-user-spectral-insights-store.js` is a read-only store over the **completed
spectral-job ledger** (`source_user_spectral_jobs WHERE state = 'done'`), chosen over
the retroactive cache because the jobs carry `declared_codec`, `declared_extension`,
`sample_rate`, `verdict`, `username`, and `updated_at`. It exposes:

- `listRecentSpectralMeasurements({ limit })` — feeds the spectral simulator; maps the
  retroactive-scan sentinel username to `null`.
- `getFidelityHealthAggregates({ trendDays, worstOffenderLimit })` — four parallel
  parameterized reads: verdict distribution, by-codec breakdown, per-source worst
  offenders (sentinel excluded, `HAVING transcoded > 0`), and a daily transcode trend.

`library-fidelity-dashboard-service.js` exposes the pure
`buildFidelityHealthSummary(...)` projection — a **0–100 health score** weighting
authentic measurements fully and suspicious at half over the conclusive population,
plus a transcode-rate percentage — and a fail-safe `getFidelityHealthDashboard(...)`
that returns a zeroed-but-well-formed payload on a fresh (empty) catalog.

### 2.5 Operator surface

`SourceUserIntegrityToolsPanel.vue` gains two cards: a **Library fidelity health**
card (load-on-demand dashboard with health score, verdict table, by-codec and
worst-offender tables) and a **Spectral threshold policy simulator** card (editable
cutoff fields, a read-only *Simulate* preview, and an *Apply thresholds* action that
persists the `fidelity` patch via the existing settings PUT). Presentation logic is
isolated in `src/client/lib/library-fidelity-presentation.js` for unit testing.

## 3. Security

- **Read-only simulators.** Both the spectral and trust simulators are pure what-ifs;
  they never mutate stored verdicts or trust state.
- **Admin gating.** `GET /api/v1/activity/library-fidelity-dashboard` requires an admin
  session; `POST /api/v1/activity/source-user-spectral-policy-simulation` additionally
  requires a *fresh* admin session, CSRF, and the source-user mutation rate limiter.
- **Parameterized SQL + bounded inputs.** Every insights query is fully parameterized;
  `limit ≤ 5000`, `trendDays ≤ 365`, and `worstOffenderLimit ≤ 100` are clamped in the
  store, so a crafted query string cannot widen the scan.
- **Validated settings.** The `fidelity` namespace is bounds-validated on write
  (cutoff Hz ranges, evidence-count ranges, `[0, 1]` success-rate ranges) by the
  settings validator before persistence.
- **Fail-safe live path.** Threshold loaders swallow load failures and return the
  shipping defaults; the dashboard service returns an empty summary on aggregate error.

## 4. Files changed

**Server**
- `src/server/media/media-spectral-analysis.js` — tunable thresholds (`DEFAULT_SPECTRAL_THRESHOLDS`, `resolveSpectralThresholds`, `buildCutoffBands`, optional `thresholds` arg).
- `src/server/validators/settings-validator.js` — `fidelity` namespace + `normalizeRateSetting` helper.
- `src/server/fidelity-threshold-settings.js` *(new)* — settings↔threshold adapters + loaders.
- `src/server/activity/source-user-trust-threshold-simulator.js` — `currentThresholds` baseline.
- `src/server/activity/source-user-trust-service.js` / `…-detail-service.js` — live persisted trust thresholds.
- `src/server/activity/source-user-spectral-threshold-simulator.js` *(new)*.
- `src/server/activity/source-user-spectral-insights-store.js` *(new)*.
- `src/server/activity/source-user-spectral-policy-simulation-service.js` *(new)*.
- `src/server/library/library-fidelity-dashboard-service.js` *(new)*.
- `src/server/activity/source-user-spectral-sidecar-service.js` — live persisted spectral thresholds.
- `src/server/activity/activity-module.js`, `src/server/app.js`, `src/server/routes/activity-routes.js`, `src/server/route-inventory.js` — wiring + two new routes.

**Client**
- `src/client/lib/activity-api.js` — `simulateSourceUserSpectralPolicy`, `fetchLibraryFidelityDashboard`.
- `src/client/lib/library-fidelity-presentation.js` *(new)*.
- `src/client/components/SourceUserIntegrityToolsPanel.vue` — dashboard + spectral simulator cards.

**Tests** — new suites for the spectral simulator, insights store, policy-simulation
service, dashboard service, threshold-settings adapters, and client presentation;
extended suites for the spectral classifier, settings validator, and trust simulator.

## 5. Validation

- `npm test` (lint across server/shared/client/test/scripts + test hygiene + node suite).
- New + changed suites: 61 focused tests green.
- `node scripts/check-copyright.js` — GPL headers on all new files.
- No migration → schema snapshot unchanged at version 75.

## 6. Pros / cons and final recommendation stack

| Decision | Pros | Cons | Verdict |
|---|---|---|---|
| Persist thresholds in existing `app_settings` `fidelity` namespace (no migration) | Reuses the validated settings PUT; no schema churn; snapshot stays at 75 | Thresholds live apart from the cache they grade | **Chosen** |
| Pure simulators reusing the live classifier | Byte-for-byte parity with the live verdict; zero IO; trivially testable | Mirrors the simulator shape twice | **Chosen** |
| Aggregate from `source_user_spectral_jobs` (done) rather than the cache table | Jobs carry codec/sample-rate/verdict/username/updated_at; cache does not | Sentinel rows must be filtered for per-source attribution | **Chosen** |
| Dedicated `fidelity_thresholds` table | Co-locates governance data | Migration + new store + snapshot bump for nine scalars | Rejected (over-engineered) |

**Final recommendation:** ship the `fidelity` settings namespace with monotonic
clamping, the two pure simulators (spectral added, trust extended with a baseline),
the read-only insights store + dashboard service over the done-job ledger, and the
two admin-gated, CSRF-protected, rate-limited routes — exactly as implemented.

## 7. Three more high-value design areas

1. **Ledger & ignore lifecycle: retention, backup, export.** _(Carried forward.)_
   Decide and document whether `source_user_outcome_events`,
   `source_user_spectral_jobs` (and its cache), and `source_user_ignore_entries`
   participate in backup/restore scopes, add a scheduled prune tied to `maxAgeDays`,
   and define export/redaction semantics so the evidence log, job queue, cache, and
   ignore list have a first-class, governed lifecycle.
2. **Automated threshold recommendation from observed distributions.** Rather than
   asking operators to hand-tune cutoff edges, fit the band boundaries to the actual
   measured population (e.g. surface the natural valley between authentic and
   transcoded cutoff clusters) and recommend a threshold set, still gated behind the
   simulate-before-apply preview.
3. **Scheduled background fidelity re-scan cadence + drift alerting.** Promote the
   retroactive scan from a manual trigger to a governed background cadence, track the
   health-score trend over time, and raise an activity alert when the catalog-level
   transcode rate drifts beyond an operator-set tolerance.

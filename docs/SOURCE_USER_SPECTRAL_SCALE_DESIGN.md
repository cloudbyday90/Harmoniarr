# Source-User Spectral Scale: Retroactive Library Scan, Content-Addressed Cache, and Cross-Peer Collusion Detection

> This document covers two design areas carried forward from
> [SOURCE_USER_SPECTRAL_TREND_DESIGN.md](SOURCE_USER_SPECTRAL_TREND_DESIGN.md) §7:
> (1) a **library-wide retroactive spectral scan** backed by a **content-addressed
> measurement cache**, and (2) **cross-peer collusion / duplicate-source detection**
> with a **read-only trust-threshold policy simulator**. Both extend the existing
> spectral DSP sidecar without changing its per-apply hot path.

---

## 1. Research

**Tooling note.** The Tavily MCP web-research endpoint returned `Invalid API key`
for this phase, so external best-practice research was conducted through the GitHub
code-search MCP (`search_code` / repository inspection) against authoritative
open-source implementations rather than assumed URLs.

### 1.1 Content-addressed sampled fingerprints

For the decode cache we needed a file identity that is (a) cheap to compute on large
lossless masters, (b) stable across re-imports, and (c) collision-resistant enough to
key a cache and correlate peers. We evaluated the **imohash** approach
(`kalafut/imohash`, the constant-time sampling hash used by Syncthing-adjacent
tooling), which hashes a small number of fixed-position windows plus the file size
rather than the whole file. Key properties confirmed from the reference
implementation:

- **Size-prefixed digest.** The file size is folded into the hash so two files that
  share sampled bytes but differ in length never collide.
- **Sampling threshold.** Below a threshold the file is hashed in full; above it, only
  head/middle/tail windows are read. This bounds I/O for multi-hundred-MB FLAC/ALAC
  masters to a few tens of KiB.
- **Determinism.** Window positions are a pure function of size, so the same file
  always yields the same digest regardless of host.

We adopted the *shape* of imohash (size prefix + fixed sampled windows) but used
**SHA-256** as the digest rather than imohash's non-cryptographic murmur derivative,
because the same fingerprint also gates a trust/security decision (cross-peer
correlation), where collision resistance matters more than raw speed.

### 1.2 Ring / cluster detection

For grouping peers that reshare an identical confirmed transcode, we evaluated
classic connected-components strategies. **Union-find (disjoint-set) with path
compression and union-by-deterministic-root** is the standard, near-linear approach
for "merge everything that shares an attribute" problems and is trivially pure and
testable (no graph library, no DB recursion). This matches how reference
deduplication and entity-resolution pipelines cluster records sharing a key.

### 1.3 Policy simulation

For previewing the impact of a trust-threshold change we followed the well-established
**"dry-run / what-if" pattern**: classification logic is a pure function of
`(peer evidence, thresholds)`, and the simulator simply re-runs that function over the
current population under candidate thresholds, returning a diff. No state is written.

---

## 2. Design

### 2.1 Content-addressed measurement cache

- **Fingerprint (pure):** `src/server/media/media-content-fingerprint.js`
  - `resolveFingerprintPlan({ sizeBytes, sampleSize, sampleThreshold })` returns a
    `full` plan (single window) when the file is small or not comfortably larger than
    the sample windows, otherwise a `sampled` plan with head/middle/tail windows.
  - `buildContentFingerprint({ sizeBytes, chunks })` → SHA-256 hex over an 8-byte
    big-endian size prefix followed by the sampled chunks.
- **Hasher (I/O):** `src/server/media/file-content-hasher.js` opens the file read-only,
  stats it only when the size is unknown, performs **bounded positional reads** for
  each planned window, and always closes the handle in `finally`.
- **Cache store:** `src/server/activity/source-user-spectral-cache-store.js` —
  `getCachedMeasurement` / `putCachedMeasurement` (UPSERT on `content_hash`) /
  `pruneCache`. Backed by the new `source_user_spectral_cache` table.
- **Sidecar reuse:** the spectral sidecar service derives a `contentHash` (from the
  job or, best-effort, by hashing the file), and on a cache hit reuses the stored
  `cutoffHz` / `frameCount`, marks `servedFromCache = true`, increments
  `summary.cacheHits`, and **skips the ffmpeg decode entirely**. Misses run the
  analyzer and populate the cache.

### 2.2 Retroactive library scan

- **Scan source:** `src/server/library/library-spectral-scan-source.js` lists
  lossless library files (`file_state = 'observed'`, not soft-deleted, trustworthy
  sample rate, no open job) up to a hard cap of 2000.
- **Queue reuse:** `source-user-spectral-job-store.js` gained
  `enqueueRetroactiveLibraryJobs({ files })`, which enqueues under a sentinel username
  `__retroactive_library_scan__` with `origin = 'retroactive'`, deduped one-open-job
  per `library_file_id`, and bounded by the existing backlog cap.
- **Service:** `source-user-spectral-retroactive-service.js` (`scanLibrary({ limit })`)
  composes the scan source and enqueue function, returning
  `{ candidates, enqueued, skipped }`. Fail-safe.
- **Reputation isolation:** retroactive jobs use the sentinel identity and the sidecar
  only merges reputation evidence when `classification.penalize === true` **and**
  `job.origin === 'apply'`, so re-grading the back catalog never mutates a real peer's
  reputation.

### 2.3 Cross-peer collusion detection

- **Shared-fingerprint query:** `listSharedTranscodeFingerprints({ minDistinctUsers,
  limit })` selects confirmed transcodes (`origin = 'apply'`, `verdict = 'transcoded'`,
  `content_hash IS NOT NULL`) grouped by `content_hash` having
  `COUNT(DISTINCT username_key) >= minDistinctUsers`.
- **Detector (pure):** `source-user-collusion-detector.js` runs **union-find** over the
  shared fingerprints to produce deterministic rings:
  `{ rings, ringCount, implicatedUserCount, analyzedFingerprintCount }`.
- **Service:** `source-user-collusion-service.js` (`getCollusionReport`) is fail-safe
  and clamps `minDistinctUsers` to a floor of 2.

### 2.4 Trust-threshold policy simulator

- **Simulator (pure):** `source-user-trust-threshold-simulator.js` —
  `classifyReviewState(peer, thresholds)` and `simulateTrustThresholdPolicy({ peers,
  thresholds })` return current-vs-projected state counts, transitions, and a
  per-peer projection. **Read-only.**
- **Service:** `source-user-policy-simulation-service.js` maps the current source-user
  snapshot to peers and runs the simulator; it never writes.

### 2.5 API & client

- Routes (all admin-gated; mutations also require a fresh admin session, CSRF, and the
  source-user mutation limiter):
  - `GET  /api/v1/activity/source-user-collusion`
  - `POST /api/v1/activity/source-user-trust-policy-simulation`
  - `POST /api/v1/activity/source-user-spectral-rescan`
- Client: `activity-api.js` gains `fetchSourceUserCollusionReport`,
  `simulateSourceUserTrustPolicy`, and `rescanLibrarySpectral`; two pure presentation
  libs and a self-contained `SourceUserIntegrityToolsPanel.vue` render the three tools
  on the source-users view.

### 2.6 Schema

Migration `20260629_000001_spectral_cache_and_retroactive.sql` adds the
`source_user_spectral_cache` table and extends `source_user_spectral_jobs` with
`origin`, `content_hash`, and `library_file_id`, plus a correlation index on
`content_hash` and a partial dedupe index on `library_file_id` for open jobs.

---

## 3. Security & safety

- **Bounded reads.** The hasher only ever reads the planned windows (tens of KiB for
  large files), never the whole file blindly, and always closes the file handle in a
  `finally` block — verified by a dedicated "closes handle even when a read fails"
  test.
- **No degenerate fingerprints.** `normalizeNonNegativeInteger` now explicitly treats
  `null`/`undefined`/`''` as "unknown size" so the hasher stats the file instead of
  silently hashing a zero-length plan. (A real bug caught and fixed during validation:
  `Number(null) === 0` previously skipped the `stat()` and produced a constant,
  content-free digest.)
- **Cryptographic digest for a trust decision.** SHA-256 (not a non-cryptographic
  hash) keys both the cache and the cross-peer correlation, so an attacker cannot
  cheaply craft a colliding fingerprint to poison the cache or evade ring detection.
- **SQL parameterization.** All new queries use bound parameters; no string
  interpolation of identifiers or values.
- **Admin gating + CSRF.** Every new route requires an admin session; the two mutating
  routes additionally require a fresh admin session, a valid CSRF token, and pass
  through the source-user mutation rate limiter.
- **Simulator is read-only.** The policy simulator computes a projection only; it never
  persists threshold changes or reclassifies live peers.
- **Reputation isolation.** Sentinel retroactive jobs are excluded from reputation
  merges, so back-catalog re-grading cannot alter or fabricate peer trust.
- **Fail-safe services.** The retroactive, collusion, and simulation services degrade
  gracefully (empty/`null` results + `onWarning`) rather than throwing into request
  handlers.

---

## 4. Files

**Server (new)**
- `src/server/media/media-content-fingerprint.js`
- `src/server/media/file-content-hasher.js`
- `src/server/activity/source-user-spectral-cache-store.js`
- `src/server/library/library-spectral-scan-source.js`
- `src/server/activity/source-user-spectral-retroactive-service.js`
- `src/server/activity/source-user-collusion-detector.js`
- `src/server/activity/source-user-collusion-service.js`
- `src/server/activity/source-user-trust-threshold-simulator.js`
- `src/server/activity/source-user-policy-simulation-service.js`
- `src/server/migrations/20260629_000001_spectral_cache_and_retroactive.sql`

**Server (modified)**
- `src/server/activity/source-user-spectral-job-store.js` (retroactive enqueue +
  shared-fingerprint query)
- `src/server/activity/source-user-spectral-sidecar-service.js` (cache reuse)
- `src/server/app.js` (spectral analyzer centralization, sidecar wiring)
- `src/server/routes/activity-routes.js` (3 routes)

**Client**
- `src/client/lib/activity-api.js`
- `src/client/lib/source-user-collusion-presentation.js`
- `src/client/lib/source-user-trust-policy-presentation.js`
- `src/client/components/SourceUserIntegrityToolsPanel.vue`
- `src/client/views/ActivityUsersView.vue`

**Tests** — 13 new files covering the fingerprint plan/digest, the I/O hasher, the
cache store, the collusion detector, the threshold simulator, the retroactive /
collusion / policy services, the scan source, the retroactive enqueue and
shared-fingerprint queries, the sidecar cache path, and both client presentation libs.

---

## 5. Validation

- `npx eslint` on all changed/new files — clean.
- `node scripts/check-copyright.js` — all new files carry the GPL header.
- Targeted `node --test` across all 13 new suites — pass (54/54). Validation surfaced
  and fixed the `Number(null) === 0` hasher bug above.
- Schema snapshot regenerated for migration #75 and verified with
  `npm run check:schema-snapshot`.
- Full `npm test` (eslint + test hygiene + node + integration).

---

## 6. Pros / cons and final recommendation stack

| Decision | Option chosen | Pros | Cons | Verdict |
| --- | --- | --- | --- | --- |
| File identity | Size-prefixed **sampled SHA-256** (imohash-shaped) | Constant-time on huge masters; stable across re-imports; cryptographic so safe to gate trust | Sampled windows can't detect mid-file tampering between sampled regions | **Adopt** — full-hash mode for small files covers the common case; windows + size prefix bound the rest |
| Digest function | SHA-256 (not murmur) | Collision-resistant for a security-relevant key | Slower than non-crypto hash | **Adopt** — I/O-bound anyway; correctness > raw speed |
| Decode reuse | Content-addressed cache table | One ffmpeg decode per unique file regardless of peer/library copies; historical re-grades are cheap | Extra table + UPSERT per miss | **Adopt** |
| Retroactive transport | **Reuse the existing job queue** with a sentinel username + `origin` column | No second worker; same backpressure, dedupe, and observability | Sentinel rows in the jobs table need filtering | **Adopt** — sentinel is explicit and reputation-isolated |
| Ring detection | **Union-find (pure)** | Near-linear, deterministic, no graph dep, trivially testable | Whole-component grouping (no edge weighting) | **Adopt** |
| Policy preview | **Read-only simulator** | Zero-risk what-if; pure and fully testable | Doesn't apply changes | **Adopt** — applying remains a separate, explicit admin action |

**Final recommended stack:** size-prefixed **sampled SHA-256 fingerprint** →
**content-addressed measurement cache** → **retroactive scan over the existing job
queue** (sentinel identity, reputation-isolated) → **union-find collusion detection**
over shared confirmed-transcode fingerprints → **read-only trust-threshold policy
simulator**, all behind **admin + fresh-session + CSRF**-gated routes with fail-safe
services.

---

## 7. Three more high-value design areas

1. **Ledger & ignore lifecycle: retention, backup, export.** (Carried forward.) Decide
   and document whether `source_user_outcome_events`, `source_user_spectral_jobs`
   (now including the cache), and `source_user_ignore_entries` participate in
   backup/restore scopes, add a scheduled prune tied to `maxAgeDays` (the cache store
   already exposes `pruneCache`), and define export/redaction semantics so the evidence
   log, job queue, cache, and ignore list have a first-class, governed lifecycle.

2. **Operator-tunable spectral thresholds with live preview.** The cutoff-to-verdict
   thresholds (and the trust thresholds the new simulator previews) are currently
   constants. Promote them to persisted, admin-editable settings with the same
   simulate-before-apply pattern — re-run classification over a recent sample of cached
   measurements and show the projected verdict distribution before committing.

3. **Library-wide fidelity health dashboard.** With retroactive scanning populating the
   cache, aggregate the results into a catalog-level quality dashboard — fidelity
   distribution by codec/source, trend over time, and a worst-offenders list — so the
   spectral signal becomes a library-health KPI rather than a per-peer detail.

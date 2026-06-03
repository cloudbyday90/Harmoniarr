# Acquisition Pipeline — Search → Match → Download → Import

Status: **Design / recommendation.** This document records research, current-state
analysis, options, and a recommended stack for hardening Harmoniarr's
Soulseek-native acquisition loop (exploration item #2). It builds on the pipeline
vision already captured in [harmoniarr.md](harmoniarr.md) ("Soulseek Content
Discovery Strategy", "Practical Discovery Implementation", "Request Lifecycle And
Timing") and the scoring work recorded in
[issue-4-implementation-plan.md](issue-4-implementation-plan.md) (Step 16).

The goal is **not** a green-field rewrite. Harmoniarr already has a working
search → group → score → review → enqueue → import loop. This document identifies
the highest-value, lowest-risk additions that close the gap between the current
implementation and the documented "compare candidates and explain why" target,
while keeping the system secure.

---

## 1. Research (verified sources)

Sources were gathered by reading official/canonical documentation directly (no
assumed URLs). Tavily MCP was unavailable (invalid API key) and the explore
sub-agent's HTTP/2 fetch was refused, so candidate URLs were discovered via a
DuckDuckGo HTML search through the Playwright browser MCP and then read with the
webpage-fetch tool against the upstream sources.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| slskd search filters | `mrusse/soularr` · DeepWiki "Search Settings" (`soularr.py` L244–248) | The slskd search API accepts `searchTimeout`, `filterResponses`, `maximumPeerQueueLength`, and `minimumPeerUploadSpeed`. Filtering at the source removes slow/over-queued peers before they ever become candidates. |
| Filename matching | `mrusse/soularr` · DeepWiki (`soularr.py` L30–85) | Fuzzy filename match via difflib `SequenceMatcher` with a `minimum_filename_match_ratio` (default 0.5) and several normalization passes (strip space/underscore components, prepend album name). |
| Quality buckets | `mrusse/soularr` · DeepWiki ("File Type Configuration") | A **prioritized** allowed-filetype list (`flac 24/192, flac 16/44.1, flac, mp3 320, mp3`) — try formats in order, fall back to extension-only when bit-depth/sample-rate reporting is unreliable. |
| Album→track fallback | `mrusse/soularr` · DeepWiki ("Search Hierarchy") | `search_for_tracks`: search the full album first; on failure, search per-track. Important for multi-disc releases that peers store as separate folders. |
| User/title filtering | `mrusse/soularr` · DeepWiki ("Result Filtering") | `ignored_users` and `title_blacklist` discard known-bad uploaders and junk titles before scoring. |
| slskd auth | `slskd/slskd` · `docs/config.md` ("Authentication", "API Keys") | Token auth via `X-API-Key` header (or JWT). API keys default to `ReadOnly`; the primary key defaults to `Administrator`. CIDR restriction per key. **API keys never expire** — HTTPS is strongly advised; plain HTTP is "NOT RECOMMENDED". |
| slskd events / webhooks | `slskd/slskd` · `docs/config.md` ("Integrations → Webhooks") | slskd can POST `DownloadFileComplete` / `DownloadDirectoryComplete` events. Each event carries `Id` (de-dupe), `Timestamp` (out-of-order detection), `Version` (shape changes), `Type`. This is the push alternative to polling `getDownloads`. |
| slskd RCE caution | `slskd/slskd` · `docs/config.md` ("Integrations → Scripts") | Event payload fields (filenames, usernames) originate from the Soulseek network and **may be hostile**: a filename like `song"; rm -rf /; echo "` is realistic. Parse as JSON; validate/sanitize each field; never interpolate into a shell. |
| slskd retry/transfer model | `slskd/slskd` · `docs/config.md` ("Retry Behavior", "Permissions") | slskd already retries with exponential backoff and resumes partial files; downloaded files are created with the process umask (644 by default). Harmoniarr should not duplicate slskd's transfer retry — it owns *candidate-level* retry/rediscovery. |
| slskd search throttling | `slskd/slskd` · `docs/config.md` ("Throttling") | `response_file_limit` defaults to 500 files per response; large searches are bounded server-side. Our `responseLimit`/`fileLimit` caps should stay within sane ranges. |

**Why these matter here.** Soularr is the de-facto reference for slskd-driven
acquisition, and it is deliberately simple: first-match, no comparison, no
explainability. Harmoniarr's own design docs already commit to *beating* Soularr
by ranking and explaining every viable candidate. The research confirms the four
concrete mechanisms Soularr uses that Harmoniarr has not yet fully adopted —
source-side peer filtering, fuzzy per-track filename matching, prioritized quality
buckets, and album→track fallback — and the slskd docs confirm the secure way to
wire push-based completion events.

---

## 2. Current state (what already exists)

The loop is **largely built** and follows the operation-run worker pattern
(`createOperationRun` → worker with lease/heartbeat/cancellation gate → queue
handler in `operation-queue-handlers.js`).

| Stage | Module(s) | State |
| --- | --- | --- |
| Wanted state | `library/library-wanted-release-*` | Reconciles monitored releases into `library_wanted_releases`. ✅ |
| Discovery projection | `library/library-discovery-request-*` | Materializes release-level `library_discovery_requests` with `ready`/`cooldown`/`blocked` states, `next_search_after`, attempt counters. ✅ |
| Query build | `library/library-discovery-search-query.js` | `buildDiscoverySearchQuery` — escalating attempts: `artist+title+year` → `artist+title` → safe title-only, with format term appended. ✅ |
| Search dispatch | `library/library-discovery-dispatch-service.js` | Claims ready requests (`FOR UPDATE SKIP LOCKED`), calls `slskdService.startSearch`, ingests responses, schedules cooldown/exhaustion. ✅ |
| slskd adapter | `slskd/slskd-service.js`, `integrations/slskd/slskd-client.js` | `startSearch` (query, fileLimit, filterResponses, responseLimit, searchTimeoutMs), `getSearchState`, `getSearchResponses`, `enqueueDownloads`, `getDownloads`, `getDownload`, `getConnectionStatus`, `validateAuthentication`. ✅ |
| Candidate build | `import-candidates/import-candidate-service.js` | `normalizeSlskdResponsesToImportCandidates` groups files by `username + folderPath` into `import_candidates` (+ `import_candidate_files`). ✅ |
| Scoring | `library/download-result-scoring.js` | Seven weighted factors → `compositeScore` + `scoreBreakdown`: format tier (0.30), audio depth (0.15), track count (0.15), duration (0.15), format consistency (0.10), peer delivery (0.10), uploader reputation (0.05). ✅ |
| Review | `import-candidate-routes.js`, review UI | List/hold/reject/select with per-user visibility (`requestOwnership`). ✅ |
| Download enqueue | `import-candidate-execution-*` | `download_enqueue` operation run → `slskdService.enqueueDownloads`; marks `downloading`. ✅ |
| Transfer reconcile | `import-candidate-execution-reconciliation-service.js`, `slskd/slskd-transfer-snapshot-service.js` | Polls `getDownloads`, persists transfer snapshot, handles missing-transfer grace, recovery rediscovery. ✅ |
| Import apply | `import-candidate-apply-*`, `media/*`, `library-organize-*` | Media inspection (ffprobe), lossless-retention, transcode planning/exec, apply → move/link → library scan. ✅ |
| Recovery | `import-candidate-recovery-service.js`, `library-discovery-rediscovery-service.js` | Failed download → next candidate / re-discovery within attempt caps. ✅ |

**State machine:** `import_candidates.status ∈ {pending, held, rejected, selected,
downloading, import_pending, applied, failed}`, transitioned through
`transitionImportCandidateStatus` with `fromStatuses` guards (monotonic, atomic).

---

## 3. Gap analysis (what the research says is missing)

| # | Gap | Evidence | Impact |
| --- | --- | --- | --- |
| **G1** | **No folder browse step.** The adapter cannot `browseUserDirectory`. Discovery matches only on the files a search response happened to return, never the *complete* folder contents. | `harmoniarr.md` "Folder Browse Step" describes it; no `browse*` method exists in `slskd-service.js`. | Partial-album false negatives; can't confirm full tracklists; over-trusts truncated search responses. |
| **G2** | **No per-track fuzzy filename matching.** `scoreTrackCount` compares *counts* only; expected track *titles* are never matched to candidate filenames. | `download-result-scoring.js` has no SequenceMatcher; Soularr's core matcher is exactly this. | Two folders with the right file count score identically even if one has the wrong tracks. No per-track evidence to explain decisions. |
| **G3** | **Search dispatch does not pass peer filters.** `startSearch` supports `searchTimeoutMs`/`filterResponses` but **not** `maximumPeerQueueLength` / `minimumPeerUploadSpeed`, and dispatch never sets them. | `slskd-service.js` `startSearch` signature; Soularr passes both. | Slow / heavily-queued peers become candidates and are only penalized *after* scoring, wasting work and review attention. |
| **G4** | **No album→track fallback search.** Dispatch escalates query *shape* but never switches to per-track queries when album discovery yields zero candidates. | `library-discovery-search-query.js` builds album queries only; Soularr's `search_for_tracks`. | Multi-disc and loosely-shared releases are abandoned after album-query exhaustion. |
| **G5** | **Completion is poll-only.** Transfer state comes from periodic `getDownloads` reconciliation; no ingestion of slskd `DownloadFileComplete` webhooks. | `slskd/config.md` webhooks; no webhook route for slskd events. | Higher latency to `import_pending`; more polling load; no event-id de-dupe path. |
| **G6** | **Uploader trust is implicit.** Reputation is a scoring factor, but there is no explicit ignore/block list or title blacklist applied *before* candidate creation. | Soularr `ignored_users` / `title_blacklist`. | Known-bad uploaders keep reappearing as low-but-present candidates. |

G1 and G2 are the two that materially change *correctness*; G3 is cheap and
high-value; G4–G6 are incremental quality.

---

## 4. Options & recommendation per gap

Each option is scored on value, risk, and fit with the existing operation-run /
DOM-free-`lib` architecture.

### G1 — Folder browse

| Option | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| **A. Add `browseUserDirectory` to the adapter + a "browse promising candidates" pass in dispatch, cached by `username+folder+observedAt` with TTL** | Matches documented design; turns truncated search hits into verified full folders; cache bounds Soulseek traffic | New adapter method, new cache table/store, more slskd calls | **Recommended.** Gate browse behind a plausibility threshold (enough matched files **or** strong folder-name match **or** trusted user) exactly as `harmoniarr.md` prescribes. |
| B. Skip browse; trust search responses | No new code | Permanent partial-album blind spot | Rejected. |
| C. Browse every candidate | Maximum completeness | Hammers peers; violates "be a good Soulseek citizen" | Rejected. |

### G2 — Per-track fuzzy matching

| Option | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| **A. New pure module `lib`/`library/candidate-track-matcher.js` using a self-contained normalized similarity (no new dependency), fed the expected tracklist; emits per-track evidence + an album match summary; a new `candidateTrackMatch` scorer replaces the count-only heuristic's dominance** | DOM-free, fully unit-testable per repo conventions; produces the explainable evidence the review UI needs; no third-party dep | Must thread expected track titles through ingestion; similarity tuning needed | **Recommended.** Implement Levenshtein/`SequenceMatcher`-equivalent ratio in-house (small, pure, tested) rather than adding a fuzzy-match dependency. Keep `minimumFilenameMatchRatio` configurable (default 0.5, per Soularr). |
| B. Add `string-similarity`/`fast-levenshtein` dependency | Less code to write | New supply-chain surface for ~30 lines of pure logic; against "add deps for a concrete boundary only" | Rejected. |
| C. Count + duration only (status quo) | Nothing to build | Can't distinguish right-count/wrong-tracks folders | Rejected. |

### G3 — Source-side peer filters

| Option | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| **A. Extend `startSearch` with validated `maximumPeerQueueLength` / `minimumPeerUploadSpeed`; set conservative defaults in dispatch; expose as settings** | Tiny change; removes junk peers before scoring; mirrors Soularr defaults (`maximum_peer_queue=50`) | slskd-client must forward the params | **Recommended.** Default `minimumPeerUploadSpeed=0` (off) and a generous `maximumPeerQueueLength` so behavior is unchanged unless an operator opts in. |
| B. Filter client-side after responses arrive | No adapter change | Work already wasted; partial — slskd won't have stopped returning them | Fallback only. |

### G4 — Album→track fallback

| Option | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| **A. Add a terminal `track` search mode to the query builder + dispatch: when album attempts exhaust with zero candidates, emit per-expected-track queries gated behind a flag** | Recovers multi-disc/loose releases; reuses existing attempt/cooldown machinery | More searches per wanted item; needs per-track candidate grouping | **Recommended, phased.** Land G1+G2 first (they make track candidates trustworthy), then enable track fallback behind a setting. |
| B. Leave as album-only | Simpler | Abandons a real class of releases | Deferred, not rejected. |

### G5 — slskd completion webhooks

| Option | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| **A. Add an authenticated `POST /api/v1/integrations/slskd/events` ingestion route (shared-secret/API-key header, event-`Id` de-dupe via existing idempotency store, `Version`/`Timestamp` aware) that nudges reconciliation; keep polling as the safety net** | Lower latency to import; less polling; de-dupe built in; reuses idempotency cleanup heartbeat | Must treat every field as hostile (G-research RCE note); needs auth + replay defense | **Recommended as an enhancement** *after* G1–G3. Webhook is an accelerator, **never** the source of truth — polling reconciliation stays authoritative. |
| B. Stay poll-only | No new attack surface | Latency + load | Acceptable interim. |

### G6 — Explicit uploader/title filters

| Option | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| **A. Pre-candidate ignore-user + title-blacklist filter (pure predicate), surfaced in settings, applied in `normalizeSlskdResponsesToImportCandidates`** | Stops known-bad uploaders at the source; pure + testable | Another settings surface | **Recommended, low priority.** slskd's own `blacklisted` group can also enforce this at the daemon; document both layers. |

---

## 5. Final recommended stack

Phased so each phase is independently shippable, test-backed, and reversible.

**Phase 1 — Match correctness (highest value).**
- `library/candidate-track-matcher.js` — **new, pure.** Normalized per-track
  fuzzy matching against the expected tracklist → per-track evidence
  (`expectedTrackId`, `matchedFilename`, `score`, `unique`) + album summary
  (matched/missing/extra/duplicate, avg/min score). Fully unit-tested with
  `node --test`.
- Wire expected track titles through `ingestSlskdSearchResponses`; add a
  `candidateTrackMatch` scorer to `download-result-scoring.js` and rebalance
  weights (track *coverage by title* should outrank raw count).
- Add validated `maximumPeerQueueLength` / `minimumPeerUploadSpeed` to
  `startSearch` + the slskd client; default to no-op values (G3).

**Phase 2 — Folder browse (completeness).**
- `slskd-service.js` `browseUserDirectory({ username, directory })` + client
  forwarding, with normalized path separators and raw-payload preservation.
- A browse cache store (`username + folder_path + observed_at`, TTL) and a
  plausibility-gated browse pass in dispatch (G1). Matcher now runs against
  *full* folder contents.

**Phase 3 — Resilience & reach (incremental).**
- Album→track fallback search mode behind a setting (G4).
- Authenticated, de-duplicated slskd webhook ingestion as a polling accelerator
  (G5).
- Pre-candidate ignore-user / title-blacklist predicate (G6).

**Architecture invariants kept throughout.**
- All decision logic lands in DOM-free pure modules under `lib/` or
  `library/`, unit-tested with the native Node runner (no jsdom).
- All new background work uses the existing operation-run pattern (run store →
  worker with lease/heartbeat + `maintenanceLockOperationPauseService`
  cancellation gate → queue handler keyed by an `operationRunRegistry` descriptor).
- The candidate state machine and `transitionImportCandidateStatus` guards are
  reused; no new opportunistic status writes.
- Text and image embedding selection/test paths are untouched (per standing
  requirement).

---

## 6. Security

This pipeline ingests data from an **untrusted P2P network**, so every new
surface is treated as hostile input.

- **Outbound SSRF.** All slskd calls go through the existing slskd client and
  outbound-URL policy; the browse method must reuse the same boundary — no new
  ad-hoc fetch. slskd's base URL stays operator-configured and policy-checked.
- **Path traversal on import.** Remote folder/filenames (e.g. `../../etc`) come
  straight from peers. Browse and candidate normalization must keep splitting on
  both separators and never let a remote path escape the configured downloads /
  library roots; apply continues to go through the validated
  media-filesystem mutation plan.
- **Webhook hardening (Phase 3).** Authenticate with a shared secret / API-key
  header; constant-time compare; de-dupe on event `Id` via the idempotency store;
  honor `Version`/`Timestamp`; rate-limit the route; **parse JSON and validate
  every field** — never interpolate filenames/usernames into a shell or SQL
  string (slskd's own docs flag the `song"; rm -rf /; echo "` class of attack).
  The webhook only *nudges* reconciliation; it cannot directly mutate library
  state.
- **slskd credentials.** API key in the `X-API-Key` header over HTTPS; the key is
  an admin-equivalent secret and must be redacted in logs/snapshots by the
  existing control-plane redaction service. Document CIDR restriction and HTTPS
  as deployment guidance.
- **Fixed-enum UI.** Confidence tiers and match labels render from a fixed
  enumeration; raw scores/filenames are never injected as markup (no `v-html`).
- **Resource bounds.** Keep `fileLimit`/`responseLimit` within slskd's throttling
  envelope; browse is plausibility-gated and TTL-cached to avoid hammering peers
  or our own DB.

---

## 7. Validation plan

- Pure modules (`candidate-track-matcher`, scorer changes, query-builder track
  mode, filter predicates) → `node --test` unit coverage including hostile
  filenames, multi-disc layouts, and non-finite/edge inputs.
- Adapter changes → service tests with a stubbed slskd client asserting the new
  params are forwarded and validated.
- `npm test` (lint + `check:test-hygiene` + `test:node`) green; `eslint` clean on
  every changed file; `node scripts/check-copyright.js` compliant for any new
  source files.
- Walkthrough rebuild (`compose.walkthrough.yaml`) for an end-to-end manual pass
  once Phase 1 lands.

---

## 8. Three more high-value design areas to explore

1. **Explainable candidate-comparison review surface.** The matcher in Phase 1
   produces rich per-track evidence; the review UI still presents candidates as a
   flat list. Design a ranked **comparison table** (rank, confidence tier, user,
   folder, format bucket, track coverage, avg match, missing/extra, queue/speed,
   trust) with an expandable per-candidate detail (expected vs matched filenames,
   score-factor breakdown, originating query). This is what fulfils the
   `harmoniarr.md` promise that "the UI should make the score explainable."

2. **Confidence-gated automation policy.** Today every candidate needs manual
   review. Once per-track matching proves reliable, design a policy layer that
   auto-selects `high`-confidence candidates (configurable threshold, per-artist
   or global), keeps `medium` in manual review, and hides `low` — with a full
   audit trail and an easy "undo / always review this artist" escape hatch. This
   is the bridge from "manual-assisted" to "hands-off like Soularr, but safer."

3. **Source-user trust & outcome ledger.** Reputation is currently a thin
   scoring factor. Design a durable per-uploader ledger (successes, failures,
   stalls, remote-queue timeouts, avg realized speed, last-seen) that feeds both
   scoring and browse-gating, plus explicit operator prefer/ignore/block actions.
   Pairs naturally with G6 and gives the scorer real historical signal instead of
   a near-constant default.

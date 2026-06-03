# Acquisition Pipeline — Phase 2: Folder Browse (Completeness)

Status: **Implemented.** This document records the design and outcome for
**Phase 2 (Folder browse — completeness)** of the roadmap defined in
[ACQUISITION_PIPELINE_DESIGN.md](ACQUISITION_PIPELINE_DESIGN.md):

1. A new slskd **single-folder browse adapter**
   (`browseUserDirectory`) on the client and service, which fetches a peer's
   *complete* folder listing rather than relying on the (often truncated) search
   response.
2. A **pure plausibility gate** (`candidate-browse-planning.js`) that decides
   which candidates are worth a browse, so we never browse indiscriminately.
3. A **best-effort enrichment coordinator**
   (`candidate-browse-enrichment-service.js`) that browses plausible candidates,
   re-normalizes the full folder contents, and swaps in the richer candidate
   before scoring — so the Phase 1 track matcher runs against the *complete*
   folder.
4. A **TTL browse cache** (`slskd_browse_cache` table + store) so repeated
   discovery passes do not re-hit the same remote peer folder.

It builds directly on Phase 1: the enriched, fuller candidate flows into the same
`scoreDownloadResult` composite (including the `candidateTrackMatch` scorer), so
completeness and match correctness compound.

---

## 1. Research (verified sources)

Research was gathered by reading source directly from canonical repositories (no
assumed URLs). Tavily MCP was unavailable (invalid API key), so sources were read
through the GitHub MCP `get_file_contents` / `search_code` / `github_repo` APIs
against the upstream repositories that publish the authoritative implementations.

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Browse vs. single-folder endpoints | `slskd/slskd` · `src/slskd/Users/API/Controllers/UsersController.cs` | `GET /api/v0/users/{username}/browse` returns the peer's **entire** share (`IEnumerable<Directory>`, heavyweight, has a `BrowseTracker` progress endpoint). `POST /api/v0/users/{username}/directory` with body `{ "directory": "<full path>" }` returns a **single** `Directory` listing — lighter and a better Soulseek "good citizen." We use the single-folder endpoint. |
| Endpoint failure semantics | `slskd/slskd` · `UsersController.cs` (`Directory` action) | Returns **400** when `directory` is empty/null, **404** when the user is blacklisted (`Users.IsBlacklisted`) or offline (`UserOfflineException`), and is forbidden for relay agents. Drives our validation + best-effort error handling. |
| `Directory` / `File` models | `mgmt`/`jpdillingham` Soulseek.NET · `src/Directory.cs`, `src/File.cs` | `Directory = { Name, FileCount, Files }` where **`Name` is the full folder path**, but each `File.Filename` is the **leaf name only** (not a full path) — the inverse of search-response files. |
| Full-path reconstruction proof | `slskd/slskd` · web UI `Browse.js` | The official UI reconstructs each file's path as `` `${dir.name}${sep}${f.filename}` `` where `sep` is `\` if the directory name contains `\`, else `/`. We replicate this exactly so downstream path-splitting recovers the correct folder. |
| Good-citizen / rate posture | `slskd/slskd` · `docs/config.md` (Soulseek network section) | Browsing peers is a network-courtesy-sensitive operation; per-folder fetches + caching + plausibility gating keep our footprint minimal. |

**Why this matters here.** A slskd *search response* can be truncated (per-peer
file caps, response limits), so a folder that actually contains a complete album
may surface only a few files. Scoring that partial view under-counts coverage and
can wrongly reject a good source. Browsing the candidate's folder yields the
**authoritative, complete** file list, letting the Phase 1 matcher judge the real
album — but browse is heavier than search, so we gate it tightly.

**Critical implementation fact.** Because browse/`directory` files are
**leaf-only** while our normalizer (`splitRemotePath`) expects a **full** remote
path, the service reconstructs `` `${directory.name}${sep}${leaf}` `` before
normalization. Getting this wrong would collapse every file into an empty folder
path and silently corrupt grouping.

---

## 2. Design

### 2.1 Browse adapter — `slskd-client.js` + `slskd-service.js`

- **Client** (`integrations/slskd/slskd-client.js`): a new
  `browseUserDirectory({ directory, username })` validates both fields (throwing
  `slskd_misconfigured` when blank) and `POST`s to
  `users/{encodeURIComponent(username)}/directory` with body `{ directory }`,
  reusing the existing `requestJson` transport (timeouts, redirect-`error`,
  allowed-host enforcement, API-key auth — no ad-hoc `fetch`).
- **Service** (`slskd/slskd-service.js`): a new `browseUserDirectory` validates
  `username` (`normalizeSearchId`) and `directory` (new
  `normalizeBrowseDirectoryPath`, max 1024 chars), wraps the client call in
  `observeSlskdProviderCall` (provider-health accounting), and maps the response:
  - `joinRemotePath(folderName, leaf)` — picks `/` only for pure-posix names,
    otherwise `\`; trims trailing separators; joins leaf onto the folder path.
  - `normalizeBrowsedDirectory(directory)` — reconstructs each file's full path,
    drops non-string/blank filenames, and reuses the **same** `normalizeSearchFile`
    shape as search responses.
  - Returns `{ username, directory, directoryCount, fileCount, directories, files }`
    with `files` flattened across all returned directories.

### 2.2 Pure plausibility gate — `candidate-browse-planning.js`

A DOM-free, dependency-free module that decides *whether* to browse, reusing
Phase 1's `normalizeMatchText` + `sequenceMatchRatio` and the exported
`AUDIO_EXTENSIONS` set.

- `shouldBrowseCandidate({ candidate, albumTitle, expectedTrackCount, trustedUsernames, config })`
  returns `{ browse, reason }`:
  - **`already_complete`** — if the expected track count is known and the
    candidate already has that many *unlocked audio* files, browsing adds nothing.
  - **`folder_name_match`** — the candidate folder's basename fuzzy-matches the
    album title at ≥ `minFolderNameRatio` (default `0.6`).
  - **`trusted_uploader`** — the uploader is in the trusted set.
  - **`partial_coverage`** — coverage is known and the candidate has a promising
    partial set (≥ `ceil(expected × minPartialCoverage)`, default `0.4`, but
    `< expected`).
  - Otherwise **`not_plausible`** (or `no_candidate` for invalid input).
- `selectBrowsedCandidate({ original, browsed })` — adopts the browsed candidate
  **only when it strictly reveals more files**; browse can legitimately return
  fewer/stale entries, in which case the original is kept.

### 2.3 Enrichment coordinator — `candidate-browse-enrichment-service.js`

`enrichCandidatesWithBrowse({ candidates, albumTitle, expectedTrackCount, trustedUsernames, formatPreferences, requestOwnership, searchId })`:

- Gates each candidate via `shouldBrowseCandidate`; non-plausible candidates pass
  through untouched.
- Enforces `maxBrowsePerIngest` (default `10`) so a single ingest cannot trigger
  unbounded remote browses.
- **Cache-aware fetch** (`loadFolderFiles`): consults `browseCacheStore` for a
  fresh entry (`observed_at >= now − cacheTtlMs`, default 6h) before calling
  `browseUserDirectoryFn`; on a miss it browses and upserts the result.
- Re-normalizes the browsed files through the **same** ingest normalizer
  (`normalizeSlskdResponsesToImportCandidates` with
  `responses: [{ username, files }]`), finds the folder-matching candidate, and
  applies `selectBrowsedCandidate`.
- Stamps `normalizedPayload.browseEnrichment = { usedBrowse, reason,
  originalFileCount, browsedFileCount }` for downstream explainability.
- **Best-effort:** any browse/normalize error for a candidate is caught and the
  original candidate is kept (browse never blocks ingestion).

### 2.4 TTL browse cache — `slskd_browse_cache` + store

- Migration `20260626_010000_slskd_browse_cache.sql`: table keyed
  `UNIQUE (username, directory)` with `file_count`, `payload JSONB`,
  `observed_at`, standard `id/created_at/updated_at`, non-blank/`>= 0` check
  constraints, and an `observed_at` index for pruning.
- `slskd-browse-cache-store.js`: `getFreshBrowse` (returns a row only when
  `observed_at >= freshAfter`; skips the query for blank keys), `upsertBrowse`
  (`ON CONFLICT (username, directory) DO UPDATE … observed_at = NOW()`), and
  `pruneExpiredBrowse({ olderThan })` for retention cleanup.

### 2.5 Wiring

- `import-candidate-service.createImportCandidateService` accepts an optional
  `browseEnrichmentService`. Inside `ingestSlskdSearchResponses`, **after**
  normalization and reputation lookup but **before** scoring, it calls
  `enrichCandidatesWithBrowse` (best-effort try/catch → original candidates) and
  scores/persists the enriched set. Trusted uploaders are derived from the
  reputation index (`trustState === 'trusted'`).
- `import-candidate-module.js` constructs the cache store + enrichment service
  (only when `slskdService.browseUserDirectory` exists) and threads it into the
  service.

---

## 3. Security

- **SSRF / transport boundary.** Browse reuses the existing slskd client
  transport only — allowed-host enforcement, `redirect: 'error'`, request
  timeouts, and API-key auth all apply. No ad-hoc `fetch`, no caller-supplied
  URLs; only a username path segment (URL-encoded) and a JSON body.
- **Path traversal / untrusted peer paths.** Folder names and leaf filenames are
  attacker-controlled. They are treated as opaque strings: `joinRemotePath` and
  the planning `folderBasename` split on both `/` and `\` and **never** resolve
  `..` or touch the filesystem. A hostile `..\..\etc\Album` contributes only its
  last segment to plausibility scoring.
- **Resource bounds (DoS resistance).** Browse is gated by plausibility, capped
  per ingest (`maxBrowsePerIngest`), and served from a TTL cache — bounding both
  remote calls and the work done per candidate. The directory path is length-
  capped (1024) and blank-rejected at the service boundary.
- **SQL safety.** The cache store uses parameterized queries exclusively;
  `payload` is JSON-serialized, never string-interpolated. Check constraints
  reject blank keys and negative counts at the database boundary.
- **Fail-safe.** Enrichment is strictly best-effort: browse failures (offline,
  blacklisted, relay-forbidden, timeout) degrade to the original search-response
  candidate rather than failing discovery ingestion.
- **No HTML/embedding surface.** No rendering changes and no `v-html`; matching
  is purely lexical. Text and image embedding paths are untouched (separation
  preserved).

---

## 4. Files changed

| File | Change |
| --- | --- |
| `src/server/integrations/slskd/slskd-client.js` | **New** `browseUserDirectory` (POST `users/{username}/directory`) + export. |
| `src/server/slskd/slskd-service.js` | **New** `browseUserDirectory` with leaf→full-path reconstruction (`joinRemotePath`, `normalizeBrowsedDirectory`) and `normalizeBrowseDirectoryPath` validator; exported. |
| `src/server/slskd/slskd-browse-cache-store.js` | **New.** TTL cache store: `getFreshBrowse`, `upsertBrowse`, `pruneExpiredBrowse`. |
| `src/server/migrations/20260626_010000_slskd_browse_cache.sql` | **New.** `slskd_browse_cache` table (unique `(username, directory)`, JSONB payload, `observed_at` index, check constraints). |
| `src/server/schema-snapshot.sql` | Regenerated to include the new migration. |
| `src/server/library/candidate-browse-planning.js` | **New.** Pure plausibility gate (`shouldBrowseCandidate`) + selector (`selectBrowsedCandidate`). |
| `src/server/library/candidate-browse-enrichment-service.js` | **New.** Best-effort, cache-aware browse enrichment coordinator. |
| `src/server/library/candidate-track-matcher.js` | Exported `AUDIO_EXTENSIONS` for reuse by the planning gate. |
| `src/server/import-candidates/import-candidate-service.js` | Optional `browseEnrichmentService`; enrich candidates after normalize / before scoring; `deriveTrustedUsernames` from reputation index. |
| `src/server/import-candidates/import-candidate-module.js` | Construct cache store + enrichment service (guarded on `slskdService.browseUserDirectory`) and thread into the service. |
| `test/server/candidate-browse-planning.test.js` | **New.** Gate decisions, locked-file handling, hostile/path-traversal inputs, selector. |
| `test/server/candidate-browse-enrichment-service.test.js` | **New.** Swap-in, keep-original, best-effort failure, per-ingest cap, cache hit/miss. |
| `test/server/slskd-browse-cache-store.test.js` | **New.** Fake-pool TTL/`freshAfter`, ON CONFLICT upsert, prune, blank-key skips. |
| `test/server/slskd-service.test.js` | Added browse cases: leaf→full-path reconstruction, posix separator, validation, non-string filenames. |
| `test/server/slskd-client.test.js` | Added browse forwarding + blank-input rejection cases. |

---

## 5. Validation

- `node --test test/server/candidate-browse-planning.test.js` — pass.
- `node --test test/server/candidate-browse-enrichment-service.test.js` — pass.
- `node --test test/server/slskd-browse-cache-store.test.js` — pass.
- `node --test test/server/slskd-service.test.js` / `slskd-client.test.js` /
  `import-candidate-service.test.js` — pass.
- `node scripts/check-schema-snapshot.js`, `check-migration-filenames.js`,
  `check-migration-id-policy.js` — pass.
- `node scripts/check-copyright.js` — pass (826 files).
- `npm test` (lint + test hygiene + full node suite) — **2377 tests green.**

---

## 6. Pros / cons & final stack

| Option | Pros | Cons |
| --- | --- | --- |
| **Single-folder `POST /directory` + plausibility gate + TTL cache (chosen)** | Authoritative complete folder listing; minimal network footprint; bounded per ingest; best-effort (never blocks ingestion); reuses Phase 1 matcher + ingest normalizer. | Slightly more moving parts (gate, coordinator, cache, migration). |
| Full `GET /browse` of each peer | One call yields the whole share. | Heavyweight on the peer and us; needs progress polling; poor Soulseek citizenship; wasteful when we only need one folder. |
| Browse every candidate unconditionally | Simplest control flow. | Unbounded remote load; trivially abusable by hostile peers; high latency on large result sets. |
| Status quo (search response only) | No new work. | Truncated responses under-count coverage and wrongly reject complete albums — the exact failure Phase 2 targets. |
| Cache in-process memory only | No schema change. | Lost on restart; not shared across workers; no retention controls. |

**Final stack.** A single-folder slskd browse adapter
(`POST users/{username}/directory`) reusing the hardened client transport, with
leaf→full-path reconstruction matching the official slskd UI; a pure,
dependency-free plausibility gate (`folder_name_match` / `trusted_uploader` /
`partial_coverage`, skipping `already_complete`) reusing the Phase 1 fuzzy
matcher; a best-effort, per-ingest-capped enrichment coordinator that
re-normalizes complete folder contents through the existing ingest path and only
adopts strictly-richer results; and a Postgres TTL cache
(`slskd_browse_cache`) to keep the network footprint courteous. All remote peer
input is treated as bounded, opaque, non-executed, parameterized data.

---

## 7. Three more high-value design areas

1. **Album → per-track targeted fallback search.** When a browsed folder is still
   short of the expected tracklist (`coverageRatio < 1`), issue narrow per-missing-
   track searches (title + artist) and stitch the best per-track sources into a
   synthesized multi-source candidate — turning "almost complete" folders into
   complete albums.
2. **slskd transfer-completion webhooks / event reconciliation.** Subscribe to
   slskd download lifecycle events (or poll the transfers API on a schedule) to
   reconcile enqueued downloads against actual completion, feeding real
   success/failure outcomes back into the source-user trust ledger and closing the
   prediction→delivery loop.
3. **Uploader/title denylist & quality heuristics.** A configurable denylist of
   uploaders and filename/title patterns (e.g. known re-encode tags, "preview",
   archive bundles) applied during the plausibility gate, plus lightweight audio-
   property heuristics (bit depth / sample rate consistency across a folder) to
   pre-reject mislabeled or transcoded "lossless" sources before they are scored.

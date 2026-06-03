# Acquisition Pipeline — Phase 1: Match Correctness

Status: **Implemented.** This document records the design and outcome for
**Phase 1 (Match correctness — highest value)** of the roadmap defined in
[ACQUISITION_PIPELINE_DESIGN.md](ACQUISITION_PIPELINE_DESIGN.md):

1. A pure, dependency-free **per-track filename matcher**
   (`candidate-track-matcher.js`).
2. A new **`candidateTrackMatch` scorer** wired into download-result scoring,
   with a rebalanced weight set.
3. Validated **peer-quality search filters** (`maximumPeerQueueLength`,
   `minimumPeerUploadSpeed`) plumbed through `startSearch` (default no-op).
4. End-to-end **expected-tracklist wiring** from release metadata through the
   discovery dispatch path into ingestion and scoring.

It builds on the acquisition pipeline roadmap and reuses the existing import
candidate state machine, operation-run conventions, and the download-result
scoring composite.

---

## 1. Research (verified sources)

Research was gathered by reading source directly from canonical repositories (no
assumed URLs). Tavily MCP was unavailable (invalid API key), so sources were read
through the GitHub MCP `get_file_contents` API against the upstream repositories
that publish the authoritative implementations.

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Album/track fuzzy matching precedent | `mrusse/soularr` · `soularr.py` (`album_match`, `check_ratio`) | Soularr builds `title + "." + filetype` and compares against the slskd filename with `difflib.SequenceMatcher(None, a, b).ratio()`, with fallback strategies (truncate slskd filename to the last *N* words; prepend the album name) and a configurable `minimum_match_ratio`; an album matches only when **every** expected track clears the threshold. |
| Ratio algorithm of record | `python/cpython` · `Lib/difflib.py` (`SequenceMatcher`) | `ratio() = 2.0 * matches / (len(a) + len(b))`; `find_longest_match` builds a `b2j` index and a `j2len` DP row; `get_matching_blocks` uses an explicit queue (not recursion). Re-implemented in-house for short strings (no junk/autojunk needed). |
| slskd search peer filters | `slskd/slskd` · `docs/config.md` (searches / filtering) | slskd's search API accepts `maximumPeerQueueLength` and `minimumPeerUploadSpeed` to drop responses from saturated/slow peers before they ever reach the client. |

**Why these clauses matter here.** Filename text from Soulseek peers is fully
attacker-controlled and frequently mislabeled. Matching the *expected tracklist*
(from trusted release metadata) against the *candidate folder's filenames* is the
single highest-signal way to reject "right album name, wrong/garbage contents"
candidates before they are surfaced or auto-downloaded. We adopt Soularr's
proven `difflib` ratio approach but make two principled improvements:

- **Unique greedy assignment.** Each candidate file is consumed by at most one
  track, so per-track evidence is unambiguous (Soularr allows one file to satisfy
  many tracks).
- **Variant-aware comparison.** The matcher scores both the raw normalized
  filename and a leading-track-number-stripped variant (candidate side only) and
  takes the max — so `07 100 Years.flac` still matches the title `100 Years`.

---

## 2. Design

### 2.1 Pure per-track matcher — `candidate-track-matcher.js`

A new DOM-free, dependency-free module in `src/server/library/` holding all
matching logic so it is fully unit-testable with the native Node runner.

- `sequenceMatchRatio(a, b)` — an in-house, allocation-light port of CPython's
  `SequenceMatcher.ratio()` (`find_longest_match` + queue-based
  `get_matching_blocks`). Verified to match difflib on parity fixtures
  (`"abcd"/"bcde"` → `0.75`, `"abxcd"/"abcd"` → `8/9`).
- `normalizeMatchText(value)` — NFKD decomposition, diacritic strip, lowercase,
  `[^a-z0-9]+` → single space, trim. Hostile/non-text inputs return `""`.
- `matchExpectedTracklist({ expectedTrackTitles, candidateFilenames, albumTitle,
  minimumRatio })` — scores every (track, audio-file) pair, performs unique
  greedy assignment (sort by ratio desc, then track index, then file index;
  threshold `≥ minimumRatio`), and returns a structured summary
  (`coverageRatio`, `averageMatchRatio`, `minimumMatchedRatio`,
  `unmatchedTrackTitles`, `audioFileCount`, `extraFileCount`, and a `perTrack[]`
  evidence array). Returns `null` when there is no expected tracklist.
- `scoreTracklistMatch(summary)` → `0–100`: `coverage * 100 * (0.6 + 0.4 * avg)`;
  `0` when nothing matched; neutral `50` when `summary` is `null` (no tracklist
  available — manual searches).
- `buildReleaseTracklistExpectations(trackRows)` →
  `{ expectedTrackTitles, expectedTrackCount, expectedDurationSeconds }` from
  metadata track rows (tolerant of `length_ms` / `recording_length_ms`).

`DEFAULT_MINIMUM_MATCH_RATIO = 0.5` mirrors Soularr's conservative default.

### 2.2 Scorer integration & weight rebalance — `download-result-scoring.js`

- New `scoreCandidateTrackMatch({ expectedTrackTitles, albumTitle, files,
  minimumRatio })` extracts filenames from each candidate file
  (`file.filename` → `file.name` fallback), runs the matcher, and returns
  `{ name: 'candidateTrackMatch', score, summary }`.
- `scoreDownloadResult` gained `expectedTrackTitles`, `albumTitle`, and
  `minimumTrackMatchRatio` inputs, returns the `trackMatchSummary`, and only
  feeds the `candidateTrackMatch` input when a non-empty expected tracklist is
  present — otherwise the input is `null`, the scorer is skipped, and the
  remaining weights renormalize (same precedent as `uploaderReputation`). This
  keeps manual-search scoring undiluted.
- Default weights rebalanced to sum to `1.00`:

  | Scorer | Weight |
  | --- | --- |
  | `formatTier` | 0.25 |
  | `candidateTrackMatch` | 0.20 |
  | `audioDepth` | 0.12 |
  | `duration` | 0.12 |
  | `formatConsistency` | 0.10 |
  | `trackCount` | 0.08 |
  | `peerDelivery` | 0.08 |
  | `uploaderReputation` | 0.05 |

  `candidateTrackMatch` (0.20) deliberately outweighs the coarse `trackCount`
  (0.08) signal it supersedes.

### 2.3 Peer-quality search filters — `slskd-service.js`

`startSearch` now accepts `maximumPeerQueueLength` and `minimumPeerUploadSpeed`,
each validated by `normalizeInteger` and forwarded to the slskd client:

- `maximumPeerQueueLength` — fallback `1000000`, range `[0, 1000000]`.
- `minimumPeerUploadSpeed` — fallback `0`, range `[0, 1000000000]`.

Defaults are a deliberate **no-op** (do not drop any peer) so behavior is
unchanged until a caller opts in; the slskd client already forwarded these
fields.

### 2.4 Expected-tracklist wiring (end-to-end)

- `import-candidate-service.ingestSlskdSearchResponses` accepts `albumTitle` and
  `expectedTrackTitles`, threads them into `scoreDownloadResult`, and persists
  `candidate.normalizedPayload.trackMatchSummary` when scoring produces one.
- `library-discovery-dispatch-service` gained an injected
  `getReleaseTracklistExpectationsFn`. In the dispatch loop it resolves
  expectations best-effort (try/catch → `null`, never blocking a search) and
  passes `expectedTrackTitles`, `albumTitle`, `expectedTrackCount`, and
  `expectedDurationSeconds` into ingestion.
- `library-module` provides the production resolver:
  `async ({ metadataReleaseId }) =>
  buildReleaseTracklistExpectations(await listMetadataTracksByReleaseId(metadataReleaseId))`.
  This also lights up the previously inert `trackCount` and `duration` scorers in
  the automatic path.

---

## 3. Security

- **Untrusted P2P input.** All filename text originates from remote Soulseek
  peers. It is never executed, never interpolated into SQL (parameterized stores
  unchanged), and never rendered as HTML (fixed-enum UI, no `v-html`). The
  matcher treats every string as opaque data.
- **Bounded compute (DoS resistance).** Hard caps prevent a malicious peer from
  forcing pathological `O(n·m)` work: `MAX_COMPARE_LENGTH = 300` (per string),
  `MAX_EXPECTED_TRACKS = 200`, `MAX_CANDIDATE_FILES = 400`. Inputs beyond the caps
  are truncated/sliced, not rejected.
- **Path handling.** `basename`/extension parsing is string-only (splits on `/`
  and `\\`); no filesystem access, `path.resolve`, or traversal occurs. A hostile
  `../../etc/passwd.mp3` is just text to compare.
- **Fail-safe wiring.** The tracklist resolver is best-effort; a metadata lookup
  error degrades to `null` expectations (neutral scoring) rather than failing the
  discovery search.
- **Peer filters default to no-op**, so the new knobs cannot unexpectedly starve
  results until explicitly configured.
- **Embedding separation preserved.** No text/image embedding paths are touched;
  matching is purely lexical.

---

## 4. Files changed

| File | Change |
| --- | --- |
| `src/server/library/candidate-track-matcher.js` | **New.** Pure difflib-equivalent per-track matcher, scorer, and expectations builder. |
| `src/server/library/download-result-scoring.js` | Added `scoreCandidateTrackMatch`; rebalanced default weights; threaded `expectedTrackTitles`/`albumTitle`/`minimumTrackMatchRatio`; returns `trackMatchSummary`. |
| `src/server/slskd/slskd-service.js` | `startSearch` validates/forwards `maximumPeerQueueLength` and `minimumPeerUploadSpeed`. |
| `src/server/import-candidates/import-candidate-service.js` | `ingestSlskdSearchResponses` threads `albumTitle`/`expectedTrackTitles`; persists `trackMatchSummary`. |
| `src/server/library/library-discovery-dispatch-service.js` | Injected `getReleaseTracklistExpectationsFn`; resolves expectations best-effort and passes them into ingestion. |
| `src/server/library/library-module.js` | Wired the production tracklist resolver (`listMetadataTracksByReleaseId` + `buildReleaseTracklistExpectations`). |
| `test/server/candidate-track-matcher.test.js` | **New.** 30 cases: difflib parity, normalization, matching, scoring, expectations, hostile-input bounds. |
| `test/server/download-result-scoring.test.js` | Added scorer + tracklist-aware `scoreDownloadResult` cases; updated rebalanced-weight assertion. |
| `test/server/slskd-service.test.js` | Added peer-filter forwarding/default and validation cases. |
| `test/server/library-discovery-dispatch-service.test.js` | Added tracklist-threading cases; updated ingest-argument expectation. |

---

## 5. Validation

- `node --test test/server/candidate-track-matcher.test.js` — 30 pass.
- `node --test test/server/download-result-scoring.test.js` — 49 pass.
- `node --test test/server/slskd-service.test.js` — 13 pass.
- `node --test test/server/library-discovery-dispatch-service.test.js`,
  `import-candidate-service.test.js`, `library-module.test.js` — pass.
- `npm test` (lint + test hygiene + node suite) and
  `node scripts/check-copyright.js` — green.

---

## 6. Pros / cons & final stack

| Option | Pros | Cons |
| --- | --- | --- |
| **In-house difflib port (chosen)** | No new dependency; deterministic; fully unit-tested; bounded for hostile input; tailored normalization. | We maintain the ratio algorithm ourselves (mitigated by parity tests against CPython). |
| Add a fuzzy-match npm dependency | Less code to own. | New supply-chain surface for a ~100-line algorithm; weaker control over bounds/normalization; violates "add deps only at a concrete boundary." |
| Coarse `trackCount`/`duration` only (status quo) | Simplest. | Cannot detect mislabeled/garbage folders; the core failure mode the pipeline must catch. |
| Soularr-style "all tracks must match or reject" | Strict. | Brittle for partial/upgrade scenarios; we prefer a graded `coverage × quality` score that downstream policy can threshold. |

**Final stack.** A pure, dependency-free `candidate-track-matcher.js` that
re-implements CPython's `SequenceMatcher.ratio()` (parity-tested) with unique
greedy per-track assignment and variant-aware normalization; a `candidateTrackMatch`
composite scorer weighted at `0.20` (renormalizing away on manual searches);
validated no-op-default peer filters on `startSearch`; and end-to-end tracklist
wiring from release metadata through dispatch into ingestion and persistence. All
remote text is treated as bounded, opaque, non-executed data.

---

## 7. Three more high-value design areas

1. **Explainable candidate-comparison review surface.** Render the persisted
   `trackMatchSummary.perTrack[]` evidence (matched filename + ratio, unmatched
   titles, extra files) in the import-candidate review UI so a human can see
   *why* a candidate scored as it did and override with confidence — using the
   fixed-enum/no-`v-html` component conventions.
2. **Confidence-gated automation policy.** Introduce a per-user/library policy
   that only auto-enqueues a candidate when `coverageRatio` and
   `minimumMatchedRatio` clear configurable thresholds (and a minimum format
   tier), routing weaker matches to manual review instead of silently grabbing
   them.
3. **Source-user trust & outcome ledger.** Persist per-uploader success/failure
   outcomes (completed vs. failed/aborted downloads) to evolve
   `uploaderReputation` from a stub into a real, decaying trust signal — closing
   the loop between match prediction and actual delivery quality.

# Acquisition Pipeline — Phase 3: Resilience & Reach

Status: **Implemented.** This document records the design and outcome for
**Phase 3 (Resilience & reach)** of the roadmap defined in
[ACQUISITION_PIPELINE_DESIGN.md](ACQUISITION_PIPELINE_DESIGN.md). It delivers three
independent capabilities that broaden acquisition reach and harden the pipeline
against partial sources, duplicate signals, and unwanted peers:

1. **G4 — Album → per-track fallback search.** When album-level discovery is
   exhausted with zero candidates, optionally fan out to bounded *per-track*
   searches so single tracks can still be recovered when no peer shares the
   complete album.
2. **G5 — Authenticated, de-duplicated slskd webhook ingestion.** An
   operator-enabled webhook endpoint that lets slskd *nudge* reconciliation the
   moment a download completes, accelerating the existing polling loop **without
   replacing it** as the authoritative source of truth.
3. **G6 — Pre-candidate ignore-user / title-blacklist filtering.** A pure
   predicate that drops responses from ignored uploaders and removes files whose
   remote path matches a blacklisted term, **before** any import candidate is
   created.

All three build on Phases 1–2: G4 reuses the discovery query builder and the
Phase 1 track matcher; G6 sits in front of the same `ingestSlskdSearchResponses`
normalizer that Phase 2 enriches; G5 nudges the existing import-candidate
execution reconciliation service.

---

## 1. Research (verified sources)

Research was gathered by reading source directly from canonical repositories — no
assumed URLs. The **Tavily MCP was unavailable** (invalid API key), so all
external facts were read through the **GitHub MCP** (`github_repo` /
`get_file_contents` / `search_code`) against the upstream projects that publish
the authoritative implementations, current as of the work date (2026).

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| slskd webhook delivery | `slskd/slskd` · `docs/config.md` (Webhooks/Events section, ~L1061–L1130) | User-defined webhooks **POST event JSON** to a configured URL. There is **no built-in HMAC signing**; authentication is by **operator-configured custom headers** (e.g. `X-API-Key`, `Authorization: Bearer`). We therefore authenticate with a shared-secret header compared in constant time. |
| Event envelope | `slskd/slskd` · webhook `Event` model / `docs/config.md` | Every event carries `Id` (UUID, for **de-duplication**), `Timestamp` (UTC ISO, may arrive **out of order**), `Version` (shape evolution), and `Type`. `DownloadFileComplete` and `DownloadDirectoryComplete` are the actionable completion events. |
| Retry semantics | `slskd/slskd` · `WebhookService` | The sender treats **every** delivery as retryable, so duplicate deliveries are expected by design → the receiver **must** dedupe on `Id`. |
| Hostile field values | `slskd/slskd` · Scripts/RCE guidance (`song"; rm -rf /; echo "`) | `remoteFilename` / `username` originate from the **Soulseek network and are hostile**. We deliberately **do not** propagate them out of the validator; reconciliation re-reads authoritative slskd transfer state instead. |
| Album → per-track fallback | `mrusse/soularr` · `search_for_album` / `try_multi_enqueue` | When no full-album match exists, soularr falls back to **per-medium / per-track** searching. We mirror this as a bounded per-track fan-out gated behind a flag. |
| Ignore-user / title blacklist | `mrusse/soularr` · `album_match` (`username not in ignored_users`), `is_blacklisted(title)` | Ignored uploaders are excluded and titles are matched by **case-insensitive substring** against a blacklist **before** candidate creation. We replicate both as a pure pre-ingest filter. |

**Why webhooks must not become authoritative.** slskd retries every webhook and
delivers timestamps out of order, and the payload's peer-supplied fields are
untrusted. A webhook is therefore treated strictly as a **low-latency hint**: it
authenticates, de-duplicates, and then *nudges* the same reconciliation pass the
heartbeat already runs. If every webhook were dropped, correctness would be
unchanged — only latency would increase. This keeps polling the single source of
truth.

---

## 2. Design

### 2.1 G4 — Album → per-track fallback (`library-discovery-track-fallback-query.js` + dispatch wiring)

- A **pure query builder** (`buildPerTrackDiscoveryQueries`) combines
  `artist + trackTitle + formatTerm`, normalizes via the existing
  `normalizeFallbackQuery`, deduplicates on a lowercased key, and **bounds** the
  output to `MAX_TRACK_FALLBACK_QUERIES = 30`. `hasSafeTrackSearchShape` requires
  a normalized title length ≥ 3 so junk/punctuation-only titles never become
  searches.
- The dispatch service grows two opt-in constructor params:
  `enableTrackFallback` (default **false**) and `trackFallbackMaxQueries`. Only
  when album discovery reaches the **exhausted, zero-candidate** branch does it
  call `dispatchTrackFallbackSearches`, which runs one `slskdService.startSearch`
  + `importCandidateService.ingestSlskdSearchResponses` per track
  (`expectedTrackCount: 1`, `mode: 'track_fallback'`). Each query is wrapped in
  its own `try/catch` so one failure never aborts the batch.
- The exhaustion reason code becomes `discovery_track_fallback_exhausted` when
  fallback queries actually ran, otherwise it stays
  `discovery_search_attempts_exhausted` — preserving existing behaviour exactly
  when the flag is off.
- Enabled via `HARMONIARR_ENABLE_TRACK_FALLBACK=true`, plumbed through
  `createLibraryModule`.

### 2.2 G5 — slskd webhook ingestion (`slskd-webhook-event.js`, `slskd-webhook-ingestion-service.js`, `slskd-webhook-routes.js`)

- **Validator** (`parseSlskdWebhookEvent`) — a pure function that reads fields in
  both casings (`id`/`Id`, `type`/`Type`, …), rejects missing/oversized
  (> 200 char) or control-character `id`/`type` with
  `createApiError(400, 'slskd_webhook_invalid_payload')`, maps actionable types
  (`downloadfilecomplete` → `download_file_complete`,
  `downloaddirectorycomplete` → `download_directory_complete`), marks unknown
  types non-actionable (`unsupported_event_type`), and marks events older than
  the skew window non-actionable (`stale_event`). It **never** surfaces
  `remoteFilename`/`username`.
- **Ingestion service** (`createSlskdWebhookIngestionService`) — verifies the
  shared secret in **constant time** (`crypto.timingSafeEqual`, length-safe),
  returns **503** `slskd_webhook_not_configured` when no secret is set
  (disabled-by-default), **401** `slskd_webhook_unauthorized` on mismatch, then
  de-duplicates on `event.id` through the **existing control-plane idempotency
  store** (scope `slskd_webhook_event`). On a first, actionable event it fires a
  **fire-and-forget** reconciliation nudge; replays and non-actionable events
  acknowledge without nudging. Always responds **202** with
  `{ accepted, actionable, eventType, reason, deduplicated }`.
- **Route** (`registerSlskdWebhookRoutes`) — mounted at **`/webhooks/slskd`**
  (deliberately **outside `/api`**, mirroring the Plex webhook, to bypass the
  `Accept: application/json`-enforcing contract middleware and JSON body parser).
  Reads the **raw body** (256 KiB cap → 413), requires
  `Content-Type: application/json` (415), rejects malformed JSON (400), reads the
  secret from `x-harmoniarr-webhook-secret` **or** `Authorization: Bearer`, and is
  rate-limited (120 req/min bucket).
- Enabled via `HARMONIARR_SLSKD_WEBHOOK_SECRET`.

### 2.3 G6 — Pre-candidate source filter (`candidate-source-filter.js` + ingest wiring)

- A **pure module** exposing `normalizeIgnoredUsernames` (Set of lowercased
  names, bounded 1000), `normalizeBlacklistTerms` (deduped lowercased array,
  bounded 1000), `isUsernameIgnored`, `matchBlacklistedTerm` (case-insensitive
  substring), and `filterSlskdResponsesForCandidates`.
- The filter **drops** responses from ignored uploaders entirely, **removes**
  blacklisted files from `files`/`lockedFiles`, and **drops** responses left
  empty — returning a summary
  (`{ blacklistedFileCount, ignoredUserResponseCount, emptyResponseCount }`).
  With no filters configured it is a **structural no-op** (returns the original
  reference), so the hot path is untouched.
- Wired into `normalizeSlskdResponsesToImportCandidates` /
  `ingestSlskdSearchResponses` via two new defaulted-`null` params
  (`blacklistedTitleTerms`, `ignoredUsernames`), applied **before** any candidate
  is built.

---

## 3. Security

| Concern | Mitigation |
| --- | --- |
| No HMAC from slskd | Operator shared-secret header compared with `crypto.timingSafeEqual`; length mismatch handled without a timing leak. |
| Disabled by default | Endpoint returns **503** until `HARMONIARR_SLSKD_WEBHOOK_SECRET` is configured; no implicit trust. |
| Duplicate / retried deliveries | De-duplication on `event.id` via the existing TTL idempotency store; replays acknowledge but do not re-nudge. |
| Replay of stale events | Timestamp staleness window (default 24 h) marks old events non-actionable. |
| Hostile peer values (RCE-style filenames, injection) | `remoteFilename`/`username` are **never** propagated; only an opaque type/id/timestamp descriptor leaves the validator. No shell/SQL interpolation anywhere. Reconciliation re-reads authoritative state. |
| Resource exhaustion | 256 KiB raw-body cap (413), strict `application/json` requirement (415), and a per-route rate limiter. |
| Unbounded fan-out (G4) | Per-track queries are deduped and hard-capped at 30; each runs in isolation. |
| Unbounded filter inputs (G6) | Ignored-username and blacklist inputs are bounded at 1000 entries and tolerate malformed/hostile input without throwing. |
| Nudge failure isolation (G5) | Reconciliation nudge is fire-and-forget with a swallowed catch; a failing nudge can never reject the webhook or block acknowledgement. |

---

## 4. Files changed

**New source**
- `src/server/library/library-discovery-track-fallback-query.js` (G4 query builder)
- `src/server/library/candidate-source-filter.js` (G6 filter)
- `src/server/integrations/slskd/slskd-webhook-event.js` (G5 validator)
- `src/server/integrations/slskd/slskd-webhook-ingestion-service.js` (G5 service)
- `src/server/routes/slskd-webhook-routes.js` (G5 route)

**Modified source**
- `src/server/library/library-discovery-dispatch-service.js` (G4 fallback dispatch)
- `src/server/library/library-module.js` (G4 flag wiring)
- `src/server/import-candidates/import-candidate-service.js` (G6 filter wiring)
- `src/server/app.js` (G5 service construction + route mount)

**New tests**
- `test/server/library-discovery-track-fallback-query.test.js`
- `test/server/candidate-source-filter.test.js`
- `test/server/slskd-webhook-event.test.js`
- `test/server/slskd-webhook-ingestion-service.test.js`
- `test/server/slskd-webhook-routes.test.js`

**Modified tests**
- `test/server/library-discovery-dispatch-service.test.js` (+2 fallback cases)

---

## 5. Validation

- Full `npm test` green: **3424** node tests + **199** script tests + **28**
  integration tests, **0 failures**.
- `node scripts/check-copyright.js` — **passed** (831 files; all new sources carry
  the GPL header).
- ESLint clean on all changed/new files.
- No new migration required: G5 reuses the existing control-plane idempotency
  table, so the schema snapshot is unchanged.

---

## 6. Pros / cons and final stack

### Option A — Webhook *replaces* polling
- **Pros:** Lowest latency; simplest mental model.
- **Cons:** slskd delivers out-of-order, retried, hostile payloads with no
  signing; a missed or spoofed webhook would corrupt state. Unacceptable for a
  source of truth.

### Option B — Webhook as an authenticated *nudge*, polling authoritative (chosen)
- **Pros:** Latency benefit of push with the correctness of pull; webhook can be
  dropped entirely with zero correctness impact; constant-time auth + dedupe +
  staleness defend the surface; reuses the existing idempotency + reconciliation
  machinery.
- **Cons:** Slightly more moving parts (secret config); nudge is best-effort.

### Option C — No webhook (polling only)
- **Pros:** Smallest attack surface; nothing to configure.
- **Cons:** Completion latency bounded by the heartbeat interval.

### Per-track fallback (G4)
- **Pros:** Recovers singles when no peer shares the full album; bounded and
  opt-in.
- **Cons:** More searches per exhausted request (mitigated by the cap and the
  flag).

### Pre-candidate filter (G6)
- **Pros:** Cuts noise and unwanted peers before any work; pure and no-op when
  unconfigured.
- **Cons:** Filter inputs are not yet surfaced from user settings (see future
  work).

**Final stack.** Ship **Option B** for G5 (authenticated, de-duplicated,
staleness-guarded webhook that only *nudges* the authoritative polling
reconciliation), **opt-in bounded per-track fallback** for G4
(`HARMONIARR_ENABLE_TRACK_FALLBACK`), and the **pure pre-ingest source filter**
for G6 — all disabled-by-default / no-op until explicitly configured, so existing
behaviour is preserved bit-for-bit until an operator turns them on.

---

## 7. Three more high-value design areas

1. **Settings-surfaced acquisition policy.** Promote G4's fallback toggle, G6's
   ignored-users / title-blacklist, and G5's webhook secret from environment
   variables into the authenticated settings surface (with validation, audit, and
   per-user/global scoping), so operators manage them in-app instead of via env.
2. **Search budget & rate governor.** A shared, persisted token-bucket governor
   across album discovery, per-track fallback, and folder browse, so the
   combined Soulseek footprint stays within a configurable courtesy budget and
   degrades gracefully under load rather than fanning out unbounded.
3. **Source-user trust & outcome ledger.** A durable per-uploader ledger of
   completion/failure/quality outcomes that feeds both the reputation scorer and
   an *automatic* ignore suggestion — turning G6's manual blacklist into a
   learned, explainable trust signal.

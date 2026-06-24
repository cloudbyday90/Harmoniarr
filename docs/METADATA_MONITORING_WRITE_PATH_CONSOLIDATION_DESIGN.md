# Metadata Monitoring Write-Path Consolidation Design

Status: Implemented
Date: 2026-06-23
Owner: Backend architecture + product architecture

## Purpose

This document records the design and implementation outcome for retiring the
legacy `metadata_artist_monitoring` **write** path and consolidating artist
monitoring onto the canonical operator-scoped save surface. With the prior read
batches complete, this removes the last writer to the legacy table from the
product surface and eliminates the dual-write divergence.

## Official Source Review

The review used current official sources available in June 2026. URLs were
resolved through web search rather than assumed:

- RFC 9745 (`Deprecation` header) / RFC 8594 (`Sunset` header): API deprecation signaling
- HTTP 410 Gone semantics for retired resources: https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
- API deprecation/sunset guidance (OneUptime, Zuplo learning center): use
  `Deprecation`/`Sunset`/`Link` headers during transition, then 410 Gone with a
  successor pointer after retirement — never a silent 404
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Node.js / Express CSRF + mutation-route best practices (StackHawk, shattered.io):
  state-changing routes require CSRF tokens plus a fresh authenticated session;
  scope from the session, not the request body

Relevant takeaways applied:

- Retiring a mutation route should give a clear, machine-actionable signal
  pointing to the successor, not a silent 404. The codebase already has a
  `sendRetiredRouteResponse` helper used for the retired monitored-list route;
  this batch reuses it.
- The replacement mutation route keeps the same security posture (fresh
  authenticated session + CSRF) as the retired one, so no auth escalation or
  relaxation is introduced.
- Read-before-write transition detection (compare prior `isMonitored` to the
  new patch) is the safe way to fire "artist newly monitored" side effects
  exactly once, idempotent across retries.

## Problem

The legacy monitoring mutation path was:

- Client: `MetadataArtistSummary.vue` "Monitor artist / Unmonitor artist" toggle →
  `useMetadataArtistWorkflow.updateArtistMonitoring` →
  `updateMetadataArtistMonitoring` (`PUT /api/v1/metadata/artists/:id/monitoring`).
- Server: `metadata-monitoring-service.updateArtistMonitoring` →
  `metadata-monitoring-store.upsertArtistMonitoring` (writes
  `metadata_artist_monitoring` only).

That created three issues:

1. **Dual-write divergence.** After the read batches, the artist payload reads
   canonical (operator-aggregate) monitoring, but this toggle *wrote* the legacy
   table. The library browser's monitor action therefore did not persist across
   a reload (the canonical read never saw the legacy write).
2. **Last product-facing writer to the legacy table.** As long as this path
   existed, `metadata_artist_monitoring` could not be retired.
3. **Inconsistent side effects.** The legacy path fired an `artist_monitored`
   activity event and a household push notification (`onArtistMonitoredFn`).
   The canonical operator-save path (`saveOperatorArtist`, used by the artist
   detail page) fired *neither*. So monitoring via the primary surface was
   silent, while the secondary library-browser surface was not.

A naive rewire of the toggle to `saveOperatorArtist` was unsafe:
`saveOperatorArtist` is a **full-draft replace** (it calls
`replaceOperatorArtistReleaseGroupSelections` and
`replaceOperatorArtistTrackOverrides`). The library browser's base payload does
not carry the operator's release-group selections or track overrides, so a
minimal monitoring patch from that surface would silently **wipe** them.

## Scope boundaries

- The artist detail page (`ArtistDetailView`) is the canonical operator-monitoring
  surface (full draft: policy, selections, overrides). This batch makes it the
  *sole* monitoring entry point.
- The legacy `metadata-monitoring-store.js` is **retained**: its snapshot methods
  (`listArtistMonitoringSnapshot`, `replaceArtistMonitoringSnapshot`) still back
  backup/restore, and `getArtistMonitoring` is left in place for the (already
  dead) refresh-scheduler fallback shim, which is removed in a separate pass.
- No schema migration. No change to auth, CSRF, or rate-limit posture.
- The library browser keeps its rich read-only metadata display; only the
  standalone monitoring *mutation* moves.

## Options Considered

### Option A: Rewire The Toggle To Fetch Projection + Full-Draft Save

Pros:

- Preserves one-click monitoring from the library browser.

Cons:

- The library browser would have to load the operator projection and duplicate
  the artist-detail draft logic (`createOperatorArtistDetailDraft` /
  `buildOperatorArtistSaveDraft`) in a second surface.
- The toggle label reads the aggregate `monitoring.isMonitored` from the base
  payload, which is "any operator monitors", not "the current operator
  monitors" — so the label is wrong for operator-scoped semantics without also
  adopting the operator projection for display.
- Code-smell: two surfaces managing operator monitoring.

Decision: rejected.

### Option B: Add A Server-Side Monitoring-Only Patch Endpoint

Pros:

- Keeps the toggle; non-destructive (server preserves selections/overrides).

Cons:

- Adds a new endpoint and a read-modify-write path with TOCTOU surface,
  increasing API surface and complexity for a secondary affordance.
- Still leaves two monitoring surfaces.

Decision: rejected.

### Option C: Keep The Legacy `PUT /monitoring` Route As A Server-Side Adapter To `saveOperatorArtist`

Pros:

- No client change.

Cons:

- Keeps a legacy route alive as an adapter (smell), with read-modify-write
  TOCTOU risk inside the adapter.
- Does not consolidate to a single surface.

Decision: rejected.

### Option D: Retire The Library-Browser Toggle; Make Monitoring Canonical On The Artist Detail Page; Move Side Effects To `saveOperatorArtist`

Pros:

- Single canonical monitoring surface; no duplicated draft logic.
- Eliminates the destructive-replace hazard and the dual-write divergence.
- Removes the last product-facing legacy writer, unblocking table retirement.
- Preserves *and* corrects the monitor side effects (activity event + household
  notification) by firing them on the canonical path's unmonitored→monitored
  transition.

Cons:

- Removes one-click monitoring from the library browser (replaced with a
  "Manage monitoring" link to the artist detail page).
- Touches the critical `saveOperatorArtist` service (additive only: post-commit
  side-effect fire, mirroring the existing refresh trigger).

Decision: accepted.

## Final Recommendation Stack

1. Side effects on the canonical save path
   - `saveOperatorArtist` accepts `onArtistMonitoredFn` and
     `recordActivityEventFn` (already threaded through the module).
   - The existing-monitoring read (`fetchExistingMonitoringTimestamps`) is
     extended to also return the prior `isMonitored` (`wasMonitored`).
   - After a committed save, when `!wasMonitored && normalizedMonitoringPatch.isMonitored === true`,
     fire the `artist_monitored` activity event and the household notification,
     exactly once, idempotent across the save retry loop (fired only after the
     final successful commit, like the existing `startMetadataArtistRefresh`
     trigger).

2. Retire the legacy write path
   - `PUT /api/v1/metadata/artists/:id/monitoring` returns a retired-route
     response pointing to `PUT /api/v1/metadata/artists/:id/operator`
     (reusing `sendRetiredRouteResponse`).
   - `metadata-monitoring-service.js` is removed entirely (its
     `getArtistMonitoring` was already dead; `updateArtistMonitoring` was its
     only live consumer).
   - `metadata-monitoring-store.upsertArtistMonitoring` is removed (no callers
     remain).
   - `metadata-module.js` stops creating/exporting the monitoring service and
     passes `onArtistMonitoredFn` + `recordActivityEventFn` to the save service.

3. Client consolidation
   - `MetadataArtistSummary.vue`: the "Monitor artist" `<button>` becomes a
     `RouterLink` to the artist detail page ("Manage monitoring"). The
     `update-monitoring` emit and `isUpdatingMonitoring` prop are removed.
   - `useMetadataArtistWorkflow.js`: `updateArtistMonitoring`,
     `isUpdatingArtistMonitoring`, and the `updateArtistMonitoringRequest`
     injection are removed.
   - `metadata-api.js`: `updateMetadataArtistMonitoring` is removed.
   - `metadata-artist-presentation.js`: `buildNextMonitoringPatch` is removed.
   - `MetadataView.vue`: the `@update-monitoring` binding is removed.

4. Route inventory
   - The retired route entry is updated/removed to match the registrar output.

5. Security and posture
   - The replacement route (`PUT /operator`) already requires a fresh
     authenticated session + CSRF, identical to the retired route — no auth
     change.
   - No new injection surface; no schema migration; no change to data flow
     beyond redirecting the mutation to the canonical service.
   - Side effects fire only after a committed transaction and only on a genuine
     transition, so they cannot fire on a rolled-back or no-op save.

## Implementation Outcome

Implemented files:

- `src/server/metadata/operator-artist-save-service.js` (transition side effects)
- `src/server/metadata/metadata-module.js` (wiring)
- `src/server/routes/metadata-routes.js` (retire route)
- `src/server/route-inventory.js` (inventory)
- `src/client/components/MetadataArtistSummary.vue` (toggle → link)
- `src/client/views/MetadataView.vue` (drop binding)
- `src/client/composables/useMetadataArtistWorkflow.js` (drop method)
- `src/client/lib/metadata-api.js` (drop function)
- `src/client/lib/metadata-artist-presentation.js` (drop helper)
- Removed: `src/server/metadata/metadata-monitoring-service.js`
- Removed: `test/server/metadata-monitoring-service.test.js`

Behavioral outcome:

- The library browser no longer writes `metadata_artist_monitoring`; the only
  product-facing monitoring mutation is the operator-scoped save.
- Monitoring an artist (via the artist detail page) now records the
  `artist_monitored` activity event and broadcasts the household notification on
  the unmonitored→monitored transition, fixing the prior inconsistency.
- The retired `PUT /monitoring` route returns a clear retired response pointing
  to the operator-save endpoint.
- `metadata-monitoring-store.upsertArtistMonitoring` is gone; the store retains
  only the snapshot (backup/restore) and read methods.

Validation performed:

- `node --test test/server/operator-artist-save-service.test.js`
- `npm run test:server`
- `npm run lint:server` / `npm run lint:test` / `npm run lint:client`
- `npm run check:esm`
- `npm run build:server` / `npm run build:client`
- `git diff --check`

## Remaining Cleanup

`metadata_artist_monitoring` is still present for compatibility. Remaining
live legacy surface is now **backup/restore only**:

- backup/restore policy for refresh cadence and the legacy monitoring snapshot.
- Remove the now-dead `metadata-monitoring-store.getArtistMonitoring` and the
  refresh-scheduler legacy fallback shim (`metadata-refresh-scheduler-service.js`)
  in a focused pass.
- After backup/restore is migrated, drop `metadata_artist_monitoring` entirely.

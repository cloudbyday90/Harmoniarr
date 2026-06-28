# Library Discovery Dispatch Handoff Observability Design

Status: Implemented
Date: 2026-06-27
Owner: Library automation + operator UX

## Purpose

After metadata refresh and artist reconciliation create wanted releases,
operators need to understand the next handoff: discovery requests must be
dispatched to Soulseek search before Import Review candidates or Downloader
activity appear.

This design adds operator-visible dispatch state and a safe manual dispatch
control to the Wanted surface.

## Research Sources

Official sources reviewed directly:

- slskd configuration documentation:
  https://github.com/slskd/slskd/blob/master/docs/config.md
- slskd relay/controller documentation:
  https://github.com/slskd/slskd/blob/master/docs/relay.md
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP API Security 2023 API5 Broken Function Level Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/
- OWASP REST Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

Relevant findings as of June 2026:

- slskd supports API-key automation through configured `web.authentication`
  keys and the `X-API-Key` request header.
- slskd role choice matters; write-capable automation should use an explicitly
  scoped configured key, not a browser login credential.
- State-changing app routes must remain POST-only, CSRF-protected, and
  role-gated.
- Operator-only job triggers are function-level authorization boundaries and
  should not be exposed to requester sessions.

## Problem

The canonical release materialization fix proved the desired-state pipeline now
creates ready discovery work:

- wanted releases exist
- discovery requests exist
- operator reconciliation resolves canonical releases

However, the visible Downloader page can still show no active transfers until a
discovery dispatch run actually searches slskd and import candidates are
created. Without a handoff view, operators have to infer this from Background
Jobs or database state.

## Options

### Option A: Rely On Background Jobs Only

Operators can open Background Jobs, run Library discovery, and inspect operation
detail there.

Pros:

- No new UI.
- Existing operation-run contract remains the only job trigger surface.

Cons:

- Too indirect when the operator is looking at Wanted releases.
- Does not explain why Downloader is still idle.
- Requires knowing that "Library discovery" is the next step.

### Option B: Add A Downloader Trigger

Put a run button on Downloader.

Pros:

- Close to the observed symptom.

Cons:

- Misleading: Downloader observes transfer state; discovery dispatch is the
  upstream search step.
- Encourages coupling provider queue display to discovery orchestration.

### Option C: Add Wanted-Surface Dispatch Handoff

Wanted shows dispatch counts, latest dispatch run state, and a manual run
button when queued work exists.

Pros:

- Closest to the actual handoff from wanted state to search dispatch.
- Reuses existing protected `POST /api/v1/library/discovery-runs`.
- Keeps Downloader as transfer-observation UI.
- Makes ready/cooldown/blocked states explicit.

Cons:

- Adds one more card to the Wanted surface.
- Does not replace full operation-run detail for diagnostics.

## Recommendation Stack

Use Option C.

Implementation stack:

- `GET /api/v1/library/discovery-summary` remains the read model.
- `POST /api/v1/library/discovery-runs` remains the only manual dispatch
  trigger.
- `useLibraryDiscoverySummary` owns polling, stale-data preservation,
  revalidation, and the manual start mutation.
- `ActivityWantedView` renders the dispatch handoff panel next to wanted
  release state.
- `library-status-presentation.js` owns pure handoff copy and start-readiness
  logic.

Security posture:

- The manual trigger remains fresh-admin-session and CSRF protected.
- The client API helper now sends the CSRF token for discovery runs.
- Requesters can read their wanted state but cannot start operator dispatch
  work through this admin-gated route.
- No provider secrets are exposed in the UI.
- slskd credentials remain configured through encrypted settings and sent
  server-to-server only.

## Implemented Behavior

Wanted now shows a `Discovery dispatch` card:

- explains that wanted releases must be searched before Import Review or
  Downloader activity appears
- shows queue counts for `Ready`, `Cooling down`, and `Blocked`
- shows latest dispatch run status and result counts when available
- enables `Run discovery now` only when queued work exists and no discovery run
  is pending or running
- preserves stale dispatch state on refresh failures

The library API helper for `startLibraryDiscoveryRun()` now includes CSRF.

## Validation

Focused validation:

- `node --test test/client/useLibraryDiscoverySummary.test.js test/client/library-api.test.js test/client/library-status-presentation.test.js`
- `node --test test/server/library-discovery-summary-service.test.js test/server/library-routes.test.js`
- `npm run lint:client`
- `npm run build:client`
- `npm run lint:test`


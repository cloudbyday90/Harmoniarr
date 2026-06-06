# Downloader Queue Read Model And Health Contract Design

Date: 2026-06-06

## Scope

Create a Harmoniarr-owned Downloader read model for the dedicated Downloader
page instead of having the client consume the upstream slskd downloads response
directly.

This phase is intentionally read-only:

- add a dedicated `/api/v1/downloader/queue` API contract
- keep backend access admin-only, matching the existing slskd downloads route
- normalize transfer rows, progress, state labels, and queue health on the
  server
- keep transfer mutation actions out of scope
- avoid schema changes; this is a live provider-backed projection

## Official Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified online rather than inferred.

- Microsoft Azure Architecture Center's CQRS guidance recommends separating
  read and write models and describes read models as DTOs or projections
  optimized for the presentation layer:
  https://learn.microsoft.com/ka-ge/azure/architecture/patterns/cqrs
- Microsoft Azure Architecture Center's Materialized View pattern recommends
  query-shaped views when source data is not ideally formatted for required
  queries, but warns to account for update timing and consistency:
  https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view
- RFC 9110 defines a successful GET response as a representation of the target
  resource as observed at message origination time:
  https://httpwg.org/specs/rfc9110.html
- OWASP API3:2023 warns that APIs often expose every object property and
  recommends preventing access to sensitive object properties:
  https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP API4:2023 warns that APIs must bound resource consumption for requests
  that require network, CPU, memory, storage, or provider resources:
  https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- slskd's official configuration docs describe transfer retry and queue-limit
  behavior as slskd-owned transfer behavior:
  https://github.com/slskd/slskd/blob/master/docs/config.md

## Current Problem

The dedicated Downloader page is now the native top-level operator surface, but
it still reads `/api/v1/slskd/downloads` directly and derives state in the
browser.

That creates four issues:

- the UI is coupled to the provider grouping shape
- queue health is recomputed client-side instead of owned by the platform
- future action eligibility has no stable place to live
- security review has to reason about raw provider properties instead of a
  documented allowlisted DTO

## Options

### Option A: Keep The Direct slskd Downloads API

Pros:

- smallest implementation
- no new route or service
- preserves existing page behavior

Cons:

- page remains coupled to upstream response structure
- queue health and labels stay in frontend-only helpers
- no stable contract for future action eligibility
- raw provider rows are harder to minimize and audit

### Option B: Add A Live Harmoniarr Read Model

Pros:

- creates a stable platform contract without adding persistence
- keeps provider-specific grouping and state parsing server-side
- gives the UI explicit `queueHealth`, normalized `transfers`, and future
  `actionEligibility`
- matches CQRS guidance without overbuilding separate storage
- bounds returned rows and keeps sensitive exception details out of the DTO

Cons:

- still performs a live slskd read on page polling
- queue health is an observation, not a durable history
- adds a new route and service boundary

### Option C: Build A Persisted Downloader Read Store First

Pros:

- best long-term source for history, stale state, and diagnostics
- can survive slskd outages with last-known observations
- can support action audit and deep troubleshooting later

Cons:

- requires schema, write cadence, retention policy, and reconciliation design
- duplicates some existing import-candidate transfer snapshots before the
  product contract is mature
- delays the immediate API contract decoupling

### Option D: Reuse Import-Candidate Execution Summary

Pros:

- reuses existing persisted transfer snapshot logic
- already understands candidate-linked transfer progress

Cons:

- only covers transfers that Harmoniarr enqueued through import execution
- misses global slskd queue state and unrelated active downloads
- mixes import review workflow state with Downloader page ownership

## Final Recommendation Stack

Use Option B for this phase.

Recommended stack:

- Route: `GET /api/v1/downloader/queue`.
- Access: admin-only, same as `/api/v1/slskd/downloads`.
- Backend shape: `downloader.queueHealth`, `downloader.transfers`,
  `downloader.sourceGroups`, and `downloader.observedAt`.
- Provider dependency: call the existing slskd service `getDownloads` method;
  do not call the low-level integration client from the route.
- State normalization: map raw slskd states into `active`, `queued`,
  `completed`, `failed`, and `other` classifications with display labels and
  UI tones.
- Progress normalization: provide `percentComplete`, `bytesTransferred`, and
  `size` per row, clamped and nullable.
- Resource posture: cap returned transfer rows and expose a `truncated` flag.
- Security posture: omit raw exception text and mutation controls; expose future
  action eligibility as disabled until action contracts are designed.
- Client posture: make the Downloader page consume only the Harmoniarr-owned
  contract.

## Implemented Outcome

- Added a modular downloader server area with:
  - `downloader-transfer-policy.js`
  - `downloader-queue-read-model-service.js`
  - `downloader-module.js`
- Added `GET /api/v1/downloader/queue`.
- Added the route to the server route inventory.
- Updated the Downloader page to call the new read model.
- Kept `/api/v1/slskd/downloads` available as the lower-level admin provider
  route for existing integrations and tests.

## Contract Sketch

```json
{
  "ok": true,
  "downloader": {
    "provider": "slskd",
    "observedAt": "2026-06-06T12:00:00.000Z",
    "includeRemoved": false,
    "truncated": false,
    "queueHealth": {
      "status": "busy",
      "message": "2 transfers are active and 1 is queued.",
      "counts": {
        "total": 3,
        "active": 2,
        "queued": 1,
        "completed": 0,
        "failed": 0,
        "other": 0
      },
      "progress": {
        "percentComplete": 42,
        "bytesTransferred": 420,
        "size": 1000
      }
    },
    "sourceGroups": [],
    "transfers": []
  }
}
```

## Security

- The new endpoint is read-only and admin-only.
- No CSRF token is required because GET does not mutate state.
- The route does not expose raw slskd exception text.
- The contract uses allowlisted fields and does not spread provider objects.
- The service caps returned rows to reduce provider-response amplification.
- slskd provider errors are normalized to the same public error posture used by
  the existing slskd routes.
- No requester-visible route, projection, or UI link is added.

## Validation

Validation for this phase:

- `node --test test/server/downloader-queue-read-model-service.test.js`
- `node --test test/server/downloader-routes.test.js`
- `node --test test/server/downloader-module.test.js`
- `node --test test/server/route-inventory.test.js`
- `node --test test/client/app-shell-presentation.test.js`
- `npm run lint:server`
- `npm run lint:client`
- `npm run build:client`
- `npm test`
- `npm run build`

## Next High-Value Design Areas

1. **Downloader action eligibility and operator controls.** Design cancel,
   retry, clear, and pause/resume controls with fresh-session, CSRF,
   idempotency, rate limits, and audit events.
2. **Requester-scoped transfer actions.** Design requester-owned cancel, retry,
   and requeue behavior with per-request authorization and safe labels.
3. **Downloader detail drawer and diagnostics panel.** Add a focused transfer
   detail surface for queue position, retry attempts, stale observations,
   request/candidate linkage, and recommended next action.

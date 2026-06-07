# Downloader Action Eligibility And Operator Controls Design

Date: 2026-06-07

## Scope

Add the first safe mutation controls to the dedicated Downloader page.

This phase covers:

- server-owned per-transfer action eligibility in the Downloader read model
- admin-only transfer action routes for supported provider mutations
- operator controls in the Downloader detail drawer
- a queue-level Clear Completed action
- audit events, fresh-session checks, CSRF checks, and mutation rate limits

This phase deliberately does not add requester-visible transfer actions, pause,
resume, or retry mutations. Those actions need separate provider contracts and
request ownership rules.

## Official Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified online rather than inferred.

- OWASP CSRF Prevention Cheat Sheet recommends CSRF tokens for state-changing
  requests, backend validation of those tokens, and avoiding state-changing
  GET requests:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Mass Assignment Cheat Sheet recommends allowlisting fields rather than
  automatically binding all request parameters to internal objects:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- OWASP API1:2023 Broken Object Level Authorization requires object-level
  authorization checks for endpoints that receive object identifiers:
  https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP API4:2023 Unrestricted Resource Consumption warns that APIs need
  appropriate limits for records, operations, memory, execution time, and
  provider-backed resource use:
  https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- RFC 9110 defines DELETE as removing the association between the target
  resource and its current functionality, allows `204 No Content` when the
  action succeeds and no response body is needed, and warns that DELETE request
  bodies have no generally defined semantics:
  https://httpwg.org/specs/rfc9110.html
- WCAG 2.2 Target Size guidance supports comfortably operable controls,
  especially for compact action surfaces:
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- slskd's official transfer API source exposes
  `DELETE /api/v0/transfers/downloads/{username}/{id}` to cancel a download,
  a `remove=true` query option to remove the tracked download after
  cancellation, and
  `DELETE /api/v0/transfers/downloads/all/completed` to remove completed
  downloads. No stable pause, resume, or retry transfer mutation endpoint was
  identified in the official source for this phase:
  https://github.com/slskd/slskd/blob/master/src/slskd/Transfers/API/Controllers/TransfersController.cs
- slskd's official configuration docs describe daemon-owned retry and partial
  resume behavior, including automatic retry delay and maximum retry delay
  settings:
  https://github.com/slskd/slskd/blob/master/docs/config.md

## Current Problem

The Downloader page and detail drawer can show live transfer state and
diagnostics, but all action eligibility is still a placeholder. Operators can
see that a transfer is active, completed, or failed, but cannot safely take the
provider-supported actions from the Harmoniarr UI.

The missing contract creates four risks:

- UI controls could drift ahead of provider capability
- destructive actions could run from stale row state
- request bodies could overpost unsupported fields
- mutation routes could miss fresh-session, CSRF, rate-limit, and audit
  controls

## Options

### Option A: Keep All Actions Disabled

Pros:

- lowest implementation risk
- no new mutation route surface
- no provider mutation failures to normalize

Cons:

- operators must leave Harmoniarr for basic queue operations
- the detail drawer keeps showing placeholders
- the Downloader page remains an observation-only console

### Option B: Add Eligibility Only, Without Mutations

Pros:

- documents future controls in the read model
- lets UI render disabled action reasons
- no destructive backend behavior

Cons:

- still no operator utility
- doubles the work because eligibility and mutation checks must be revisited
  later
- does not validate CSRF, audit, or rate-limit posture for downloader actions

### Option C: Add Supported Cancel, Remove, And Clear Completed Actions

Pros:

- matches official slskd mutation endpoints
- keeps unsupported retry, pause, and resume actions disabled with explicit
  reasons
- rechecks current provider state before mutation
- keeps route handlers thin and puts action policy in a service
- uses fresh-session, CSRF, rate limits, and audit events for destructive work

Cons:

- still live-provider-backed; action eligibility can change between polls
- remove is provider-level queue removal, not filesystem deletion
- queue-level clear completed is broad and intentionally admin-only

### Option D: Add Retry, Pause, And Resume Now

Pros:

- closer to a complete downloader control panel
- could reduce operator trips to the provider UI

Cons:

- no stable official provider mutation contract was identified for these
  actions during research
- retry behavior is already daemon-owned in slskd configuration
- likely to create brittle or simulated behavior that conflicts with provider
  retry/resume policy

## Final Recommendation Stack

Use Option C for this phase.

Recommended stack:

- Read model: include per-transfer `actionEligibility.actions[]` with stable
  `code`, `label`, `enabled`, `reason`, `destructive`,
  `requiresFreshSession`, and state context.
- Supported transfer actions:
  - `cancel` for active and queued transfers
  - `remove` for completed and failed transfers
- Supported queue action:
  - `clear_completed` for provider-tracked completed downloads, including
    completed failed outcomes as defined by slskd
- Unsupported transfer actions:
  - keep `retry`, `pause`, and `resume` disabled with explicit provider-contract
    reasons
- Server policy: re-read the current transfer through slskd before executing
  any transfer action and reject stale/disallowed state with `409`.
- Routes:
  - `POST /api/v1/downloader/transfers/:username/:id/actions`
  - `POST /api/v1/downloader/actions/clear-completed`
- Security:
  - require fresh admin session
  - validate CSRF
  - apply a downloader mutation rate limiter
  - allowlist request body fields to `action`
  - do not use GET for mutations
  - record audit events for transfer and queue actions
- UI:
  - render action controls inside the detail drawer from server-owned
    eligibility
  - expose Clear Completed in the Downloader page header
  - disable controls while an action is pending

## Implemented Outcome

- Added `src/server/downloader/downloader-action-service.js`.
- Extended `downloader-transfer-policy.js` with state-aware action eligibility.
- Extended the slskd client and service with:
  - `cancelDownload({ username, id, remove })`
  - `clearCompletedDownloads()`
- Added admin-only mutation routes under `/api/v1/downloader`.
- Added downloader mutation rate limiting in app composition.
- Added route inventory entries for the new mutation routes.
- Updated the Downloader detail drawer with operator controls.
- Updated the Downloader page with Clear Completed.
- Added focused server and client contract tests for the service, routes, slskd
  adapter, API client, drawer, module wiring, and route inventory.

## Contract Sketch

Read model eligibility:

```json
{
  "actionEligibility": {
    "canCancel": true,
    "canRemove": false,
    "canRetry": false,
    "reason": "cancel_available",
    "actions": [{
      "code": "cancel",
      "label": "Cancel transfer",
      "enabled": true,
      "reason": "transfer_can_be_cancelled",
      "destructive": true,
      "requiresFreshSession": true,
      "state": "active"
    }]
  }
}
```

Transfer action request:

```http
POST /api/v1/downloader/transfers/source-user/transfer-1/actions
Content-Type: application/json
X-CSRF-Token: <token>
```

```json
{
  "action": "cancel"
}
```

Success response:

```json
{
  "ok": true,
  "downloaderAction": {
    "action": "cancel",
    "id": "transfer-1",
    "ok": true,
    "provider": "slskd",
    "sourceUser": "source-user",
    "state": {
      "code": "active",
      "label": "Downloading"
    }
  }
}
```

## Security

- Mutations are admin-only and require a fresh admin session.
- CSRF is required for both mutation routes.
- The route body is allowlisted to a single `action` string.
- The service rejects unsupported action codes with `400` and disallowed current
  transfer states with `409`.
- The service re-reads provider state before mutation so stale UI rows cannot
  authorize a destructive action.
- The DELETE provider body is not used; remove intent is encoded with the
  official `remove=true` query contract.
- Mutation routes have a dedicated rate-limit bucket.
- Audit events record actor, transfer ID, source user, provider, action, and
  observed state without raw provider exception text.
- Requester-visible routes are not added in this phase.

## Validation

Validation for this phase:

- `node --test test/server/slskd-client.test.js`
- `node --test test/server/slskd-service.test.js`
- `node --test test/server/downloader-action-service.test.js`
- `node --test test/server/downloader-queue-read-model-service.test.js`
- `node --test test/server/downloader-routes.test.js`
- `node --test test/server/downloader-module.test.js`
- `node --test test/server/route-inventory.test.js`
- `node --test test/server/app.test.js`
- `node --test test/client/downloader-api.test.js`
- `node --test test/client/downloader-detail-drawer-contract.test.js`
- `npm run lint:server`
- `npm run lint:client`
- `npm run lint:test`
- `npm run build:client`
- `npm test`
- `npm run build`

## Next High-Value Design Areas

1. **Requester-scoped transfer actions.** Define whether requesters can cancel
   or retry only their own request-linked transfers, with object-level
   authorization, safe labels, idempotency, rate limits, and audit events.
2. **Downloader event history and audit trail.** Persist a durable event stream
   for transfer observations and operator actions so diagnostics can explain
   how a transfer reached its current state.
3. **Transfer-to-request and import-candidate linkage contract.** Connect live
   provider rows to request and import-candidate context without exposing peer
   or path details to unauthorized users.

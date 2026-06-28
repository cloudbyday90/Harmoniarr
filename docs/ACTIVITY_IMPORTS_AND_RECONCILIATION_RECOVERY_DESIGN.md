# Activity Imports And Reconciliation Recovery Design

Status: Implemented
Date: 2026-06-28

## Problem

Two local walkthrough failures exposed gaps in the operational read model:

- `Activity > Imports` could render as a blank page because
  `ActivityImportsView.vue` used shared formatter helpers in the template
  without importing them.
- A monitored artist could remain stuck on `Last reconciliation needs
  attention` after a transient reconciliation failure, with no direct operator
  repair action and no bounded self-healing path.

## Official Source Review

- Playwright best practices and locator guidance: prefer user-visible,
  resilient checks around page behavior and avoid brittle implementation-only
  selectors for browser coverage. Source:
  https://playwright.dev/docs/best-practices and
  https://playwright.dev/docs/locators
- Playwright actionability: actions should wait for visible, stable, enabled
  controls before interacting. Source:
  https://playwright.dev/docs/actionability
- Vue Composition API lifecycle and reactivity guidance: keep reactive state
  explicit and update UI from authoritative data after async mutations. Source:
  https://vuejs.org/api/composition-api-lifecycle.html
- OWASP REST Security Cheat Sheet: mutation endpoints must enforce
  authentication, authorization, and server-side validation. Source:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: do not log or expose sensitive secrets; record
  bounded operational context. Source:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## Options Considered

### Option A: Only Fix The Imports View

Pros:

- Lowest-risk change.
- Directly resolves the blank Imports tab.

Cons:

- Leaves failed artist reconciliation as an operator dead end.
- Does not address the walkthrough expectation that transient workflow failures
  should recover after the underlying bug/configuration is fixed.

### Option B: Add Only A Manual Retry Button

Pros:

- Clear operator control.
- Keeps read paths pure.

Cons:

- Requires the operator to discover Artist Detail and click retry for failures
  that the system can safely requeue.
- Home cards still appear stuck until manual action.

### Option C: Bounded Automatic Recovery Plus Manual Retry

Pros:

- Failed reconciliation runs become self-healing when a latest saved snapshot
  exists and no active run is pending or running.
- Automatic recovery is bounded: runs triggered by `failure_recovery` are not
  automatically retried again if they fail.
- Artist Detail gets an explicit retry action for operator-directed repair.
- Uses the existing operation-run queue, audit event path, CSRF protection, and
  operator-scoped reconciliation service.

Cons:

- The monitored-artist projection read path can enqueue a recovery run as a
  best-effort side effect.
- Requires careful guard tests to prevent a persistent failure loop.

## Final Recommendation Stack

Use Option C.

Implementation choices:

- Keep `ActivityImportsView` on existing shared presentation helpers:
  `import-candidate-presentation.js` and `operation-run-presentation.js`.
- Add `operator-artist-reconciliation-recovery-service.js` as a small modular
  ESM service that decides whether a failed run is eligible for one automatic
  recovery attempt.
- Wire recovery into `operator-artist-projection-service.js` so Home and Artist
  Detail read models move from failed to queued when recovery is accepted.
- Add `POST /api/v1/metadata/artists/:artistId/operator/reconciliation` for
  explicit operator retry, protected by fresh session and CSRF.
- Add an Artist Detail `Retry reconciliation` button only when the operator
  projection is monitored, failed, and no pending/running run already exists.

## Security Notes

- The retry endpoint is operator-scoped through the authenticated `appUserId`.
- The mutation requires fresh session and CSRF checks.
- Recovery evidence uses operation-run summaries and audit events without
  serializing provider credentials, raw provider payloads, or filesystem
  secrets.
- Automatic recovery is bounded by trigger source to avoid alert storms and
  repeated background work for persistent failures.

## Outcome

- `Activity > Imports` now renders loading, empty, error, and table states
  using imported formatter helpers.
- Failed artist reconciliation can self-heal once by queueing a
  `failure_recovery` run from the latest saved snapshot.
- Operators can manually retry failed reconciliation from Artist Detail without
  changing and resaving policy.
- Focused client, server, and route tests cover the formatter imports, retry API
  contract, route payload, recovery guard, and projection recovery behavior.

## Next Recommended Item

Add browser verification for the automatic reconciliation recovery and manual
retry flow:

- seed a monitored artist with a failed latest reconciliation run and a saved
  snapshot
- open Home and verify the card moves to queued after projection recovery
- open Artist Detail with recovery disabled or already failed and verify
  `Retry reconciliation` queues a run and refreshes status
- verify `Activity > Imports` renders an empty state rather than a blank page


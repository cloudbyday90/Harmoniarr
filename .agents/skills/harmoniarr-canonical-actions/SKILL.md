---
name: harmoniarr-canonical-actions
description: Complete or review Harmoniarr user actions across canonical UI, decision ownership, durable commands, and status refresh. Use for Missing Music search, match, download, quality, or library-add actions and recovery handoffs; ordinary styling does not need this workflow.
---

# Harmoniarr Canonical Actions

Close a visible user journey without duplicating its underlying operation
infrastructure. Locate the paths below from the active Harmoniarr repository;
they are repository paths, not files bundled with this skill.

## Establish the current surface

Read `src/client/router.js` and the rendered component before trusting a plan
or an unused presentation helper. Missing Music uses `/app/missing` and
`/app/missing/:decisionId`; legacy Music Queue routes redirect there. A next-step
label is not proof that its command exists or that its detail stays fresh.

Trace one concrete state through the visible control, API helper, route,
service, persistence or worker, and refreshed public projection. Read nearby
tests and newer outcome records; old unchecked tasks may already be complete.
Choose the smallest useful state/action slice supported by that evidence.

## Preserve actor, target, and shared work

- The actor is the authenticated person performing the command. The target
  owns the selected wanted release or request. They differ for administrator
  household actions.
- Resolve targets through `src/server/missing-music/missing-music-decision-target-service.js`;
  a browser-supplied user ID is not an authorization assertion. Preserve own
  scope for non-administrators and read-only disabled-account history.
- Derive UI permission and command eligibility from the same domain policy.
  The service and write boundary must still recheck current eligibility;
  hiding a button does not authorize the endpoint.
- Metadata, physical library files, and discovery by canonical release can be
  shared. Target ownership does not imply a separate provider operation for
  every user. Check both the scoped intent and intentional shared side effects.
- A direct decision lookup must not depend on finding it in the first page of
  a retained list API.

## Extend the owning command

Use narrow ESM policy/service factories under `src/server/missing-music/`, thin
adapters under `src/server/routes/`, and existing service/store transaction
boundaries. Register route changes in `src/server/route-inventory.js`.

Delegate to existing acquisition, library, import, and operation services.
Preserve maintenance locks, state conflicts, quality checks, and filesystem
gates. Use the existing durable idempotency mechanism for retryable mutations;
distinguish replay, an already queued intent, and newly created work.

Inspect the write boundary when another account can be disabled, a worker can
advance state, or cancellation can race the command. Reuse transaction and
locking patterns where those races affect correctness. A durable intent can
commit before immediate dispatch succeeds: report that state truthfully and
avoid repeating committed work to repair optional follow-up failures.

Return a bounded public action projection. Keep provider bodies, filesystem
paths, raw database errors, and implementation evidence in protected
diagnostics. Describe queued work without promising completed downloads.

## Keep UI state and commands coherent

Keep pure copy/permission presentation separate from composables that own
requests, timers, cancellation, and mutation feedback. Share a per-decision
single-flight gate for competing commands. Retain the mutation key when a
transport failure leaves the result uncertain; reset it when intent changes.

Invalidate reads and feedback when route identity changes or the component
unmounts. Dedupe background refresh, retain the current snapshot during
revalidation, and clean up polling/visibility listeners. A page Refresh must
refresh the detail it displays. Background updates preserve keyboard focus;
user-command results use accessible status/error feedback.

## Prove the completed journey

Test the owning boundaries: state eligibility and safe projection, actor versus
target, disabled/out-of-scope decisions, same-key replay, active-work conflicts,
and durable-state races where applicable. Add real PostgreSQL proof when SQL
or transactions own the invariant, and browser proof when rendered actions,
refresh, or keyboard behavior are part of the change.

Follow the repository validation scripts for the affected paths. When design
and outcome documents are requested, keep rationale/alternatives separate
from executed results. Distinguish controlled fixtures, real provider access,
local packaged runtime, published artifact trust, and operator recovery. Name
the next incomplete action supported by findings; do not recreate shipped work.

# Shared PostgreSQL runtime lifetime design

Date: 2026-10-15. Scope: shared PostgreSQL fixture admission and teardown.

## Problem and selected architecture

The shared empty-schema runtime can stop its owned server while an isolated
database's returned release tail is pending. It can also admit another scenario
after cleanup. App and template owners already have lifetime barriers, but direct
shared-runtime consumers lack that same outer contract.

Reuse `createFixtureRuntimeLifetime` inside the shared ESM database runtime.
Register the full operation synchronously through its run method, before queued
work starts. Put per-call validation, diagnostics and both schema delegates inside
that admitted operation. Cleanup synchronously seals the lifetime, drains all
registered promises with allSettled, then performs existing template/server release.
Keep the existing cached, observed cleanup promise and failure precedence.

This composes the established small module without creating a second registry or
expanding the shared lifetime utility's behavior. Template and app barriers remain
at their current owners. The shared barrier includes the actual delegate promise,
not just the user callback, so diagnostics restoration and database release tails
cannot be cut short by server teardown.

## Observable contract

| Boundary | Contract |
| --- | --- |
| Admission | Register before returning the scenario promise; already-admitted queued work still executes after sealing |
| Late work | Reject with fixture_runtime_closed during or after cleanup, before reading per-call options or invoking diagnostics/adapters/callbacks |
| Drainage | Wait for every admitted promise, including successful, Error and null outcomes; one rejection cannot release resources under a sibling |
| Scenario result | Preserve its exact value or rejection on its own returned promise |
| Cleanup result | Preserve one canonical promise and existing template/stop failure; do not re-report unrelated scenario failures as cleanup failures |
| Borrowed server | Drain owned database operations, without gaining server-stop authority |
| Cancellation | A signal/test timeout is not completion; wait for the actual returned operation, without a new force-exit or disposal deadline |

The outer owner must initiate and await cleanup. Awaiting runtime cleanup from
inside one of its own admitted callbacks is a dependency cycle and is unsupported,
as with the existing app/template lifetimes. Hidden detached work that is absent
from the returned promise remains outside this barrier's proof. Workspace
quiescence/identity guards continue to own file deletion independently.

## Efficient evidence plan

Use container-free tests for both schema modes and owned/borrowed sources:
immediate close before queued work starts, two held delegate tails, late refusal,
canonical promise identity and mixed failure/completion behavior. Retain existing
strict-release, stop-failure, app/workspace and template tests.

Two fresh native owners, one per schema mode, each exercise two admitted real
databases: a held query/body that later rejects Error/null and a successful case
with a held final admin-close tail. Verify live queries while closing, no early
container stop, late refusal, unchanged pool bounds, target drops, exact scenario
results and container removal only after the final tail. Register actual native
completion and drain it beyond test-runner cancellation. Include existing native
checkout-context proof because admission now queues the scenario operation.

See [official research/options](POSTGRES_RUNTIME_LIFETIME_RESEARCH_2026_10.md)
and [executed outcome](POSTGRES_RUNTIME_LIFETIME_OUTCOME.md).

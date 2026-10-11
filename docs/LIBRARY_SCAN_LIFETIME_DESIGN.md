# Library scan lifetime design

October 11, 2026. Two controlled baselines reproduce duplicate scan acquisition
during held lease release (2 instead of 1) and fixture completion before a
returned execution promise settles (true instead of false). Follow the
[dispatcher outcome](DISPATCHER_LIFETIME_OUTCOME.md).

## Selected architecture

Reuse the ESM worker task owner for registration before scheduling, full-run
coalescing, terminal admission closure and canonical completion. Preserve queued
acknowledgement timing and return an internal per-run completion handle. Actual
completion covers the filesystem walk, guarded catalogue/tags/matching and
reconciliation callbacks, admitted heartbeat renewal and captured lease release.
Domain outcomes remain distinct from escaping execution/finalizer failures.

Share narrow lease-cleanup logic between apply and scan: drain heartbeat renewal,
then attempt captured lease release even if drainage failed. Preserve an escaping
primary Error/null over cleanup fallout. Normal cancellation, pause, lease-lost
and persisted failure outcomes retain their policies; acquisition errors escape
rather than disappearing into detached work. No lease/guard SQL is rewritten.

Add a narrow application drain for the two concrete owned workers. Drain apply
before sealing/draining scan because apply can enqueue scan work. Attempt scan
drain even after apply failure and preserve the apply error. Both app fixture
entry points already share the adapter; production shutdown uses the same owner
selection after dispatcher/HTTP closure and before pool closure. Preserve worker
receivers and scenario Error/null identity. Other workers remain separate owners.

Standalone scan fixtures retain the real completion handle instead of treating
release observation as final execution completion. Keep their existing callback
observer errors and registered-before-launch startup gate. Actual execution
failure cannot hang behind an observer checkpoint that will never occur.
Legacy injected test doubles without a handle retain their observed callback
boundary; that is not a native execution certificate.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep active marker only until release starts | Small state | Allows duplicate execution during finalization; reject |
| Await entire scan from start | Simple API | Changes durable queued acceptance timing; reject |
| Return completion plus terminal close | Explicit owner | Additive internal capability; select |
| Stop heartbeat timer only | Compatible legacy adapter | Current renewal remains; use actual drain |
| Seal scan before draining apply | Starts closure sooner | Can refuse accepted producer handoffs; reject |
| Drain apply then scan, preserving failures | Retains producer/consumer ordering | Cooperative shutdown latency; select |
| Remove residual 150 ms wait now | Less fixed overhead | Other owners remain unproved; defer |

Stack: durable queue/lease fencing; modular ESM execution ownership; returned
completion; shared renewal/release cleanup; producer-before-consumer application
drain; native pool closure; bounded diagnostics and controlled native gates.
The [research ledger](LIBRARY_SCAN_LIFETIME_RESEARCH_2026_10.md) separates official
contracts from project-specific choices.

## Proof and limits

Prove held final release, duplicate handle identity, late refusal, Error/null
acquisition/finalizer outcomes, renewal before release, release attempted after
drain failure, ordered application drainage after apply failure and fixture
completion beyond release observation. Native gates must retain database,
environment and workspace through the actual worker finalizer. Keep authoritative
catalogue/metadata/lease guards, original deadlines and remaining fixture delay.
No route, schema, test scheduling, release or branch change is planned.

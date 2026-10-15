# PostgreSQL post-start cleanup guard design

Date: 2026-10-15. Scope: the shared fixture runtime after an owned container start.

## Problem and selected change

After start returns its container, the shared runtime reads connection metadata
outside its existing release try/catch. A getter or port string conversion can
throw before cleanup gains control, leaving the acknowledged server unstopped.
Container-ID, evidence-factory and template-preparation failures already enter
the guard; preserve that coverage while moving its start boundary earlier.

Define the existing bounded closeServer callback immediately after the container
is returned, then read all connection metadata inside the existing try block.
On setup failure, use try/await/catch for the stop attempt before rethrowing the
original value. That also handles a synchronously throwing phase observer, which
a promise-only .catch chain cannot contain.

Keep this narrow responsibility in the existing ESM owner. A second service,
new container abstraction or generic cleanup framework would duplicate existing
ownership. Runtime admission/drainage and strict database/template release remain
unchanged. No production service, dependency, schema, deadline or retry changes.

## Contract and authority

| Event | Required result |
| --- | --- |
| Start returns an owned container | Enter guarded setup before reading metadata or constructing evidence/schema runtime |
| Metadata, coercion or later setup throws | Await one stop attempt with the existing deadline; reject with the exact original Error/null |
| Stop or its observer also fails | Preserve the primary setup failure, including synchronous failures; do not retry or claim successful retirement |
| Start itself rejects | Preserve its failure without inventing authority over an unreturned container; Testcontainers owns its partial-start behavior |
| External PostgreSQL setup fails | Never allocate or stop a container; retain borrowed-server ownership boundaries |
| Successful setup | Publish the same runtime contract; its cached cleanup and lifetime barrier own later teardown |

A failed stop is uncertainty, not deletion proof. Diagnostics must not print
connection values to explain metadata failure. This correction does not add
cancellation checkpoints or change the separate parent-server implementation.

## Efficient evidence plan

Use container-free faults for each metadata getter, port coercion, container ID
and evidence construction across both schema modes and Error/null values. Add
held-stop, synchronous-observer, failed-start and borrowed-server controls. Keep
existing template-preparation, runtime cleanup, strict release, lifetime and app
workspace contracts in the focused gate.

Two real PostgreSQL cases, one per schema mode, inject a metadata failure only
after a real server is acknowledged. Hold the owned stop, prove the startup call
is still pending and the exact server remains queryable, then close the test's
observer, release the hold and verify real stop/removal before original failure
returns. A deliberate post-stop adapter rejection tests precedence without
pretending to reproduce a Docker transport incident. Register actual test
completion beyond runner cancellation. Reuse prior native lifetime/stop cases;
no unrelated cold-checkout or scaling matrix is needed for this guard change.

See [official research/options](POSTGRES_STARTUP_GUARD_RESEARCH_2026_10.md)
and [executed outcome](POSTGRES_STARTUP_GUARD_OUTCOME.md).

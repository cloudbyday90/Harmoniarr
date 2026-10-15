# PostgreSQL startup cancellation design

Date: 2026-10-15. Scope: shared fixture acquisition and runtime publication.

## Problem and decision

The prior controlled probe aborted while container.start() was held. Both Error
and null reasons still allowed an empty-schema runtime to be returned, with zero
stop attempts at publication. Entry-only cancellation checks miss acquired work.
Template preparation has its own checkpoints, but the shared owner also needs a
check after the prepared owner returns, including when using a borrowed server.

Keep this responsibility in testing/postgres-integration-runtime.js. Converge
owned and borrowed startup on one guarded publication path. An acknowledged
container installs its existing bounded close callback before cancellation or
metadata checks. After database runtime creation returns, check cancellation
again. On failure, await runtime.cleanup() when that owner exists; otherwise
await only the acquired server's close callback. This is an explicit ownership
transfer, so the outer guard cannot stop the server again after runtime cleanup.

## Contract

| Boundary | Result |
| --- | --- |
| Already aborted at entry | Reject exact reason without acquiring anything |
| Abort while start is pending | Wait for actual start; after successful acknowledgement, stop once before rejecting; do not read metadata or prepare a template |
| Start rejects while aborted | Preserve actual start failure; no authority over an unreturned container |
| Abort during preparation that eventually succeeds | Await the returned runtime's template cleanup and then owned server close; reject exact abort reason |
| Preparation rejects while aborted | Preserve actual preparation failure and await acquired server close; partial template cleanup stays with preparation |
| Borrowed startup cancellation | Release returned fixture template only; never stop the borrowed server |
| Cleanup also fails | Preserve original Error/null, attempt each existing stage once, and do not claim retirement without evidence |
| Abort after successful publication | Caller retains explicit runtime cleanup; no new background disposal listener |

Cancellation is cooperative. Do not race an abort promise against acquisition,
detach cleanup, retry disposal, increase deadlines or treat timeout as quiescence.
Only actual returned operations establish the fixture's completion boundary.
The final check is the synchronous publication decision after the awaited
runtime creation; no async boundary is inserted between that check and return.

## Evidence and security

Use container-free contracts for both schema modes, owned/borrowed paths,
Error/null reasons, held start/preparation/release, actual failure precedence,
one stop and successful post-publication ownership. Observe expected rejection
immediately and release/drain gates in finally blocks.

Use bounded real PostgreSQL 18 controls: abort while actual successful start is
held before acknowledgement; hold stop and prove the server remains queryable
until independent observer close; verify exact retirement. Separately hold an
actual prepared template before returning it to owned and borrowed runtimes,
then cancel and prove template release ordering and borrowed-server survival.
Register actual test completion beyond runner cancellation. Reuse existing
startup/lifetime/cleanup native contracts in one selected serial cohort.

No connection values, database identities or abort payloads enter public outcome
logs. This fixture correction does not establish production cancellation,
whole-CI speed, browser accessibility or diagnosis of previous native timeouts.

See [official research/options](POSTGRES_STARTUP_CANCELLATION_RESEARCH_2026_10.md)
and [executed outcome](POSTGRES_STARTUP_CANCELLATION_OUTCOME.md).

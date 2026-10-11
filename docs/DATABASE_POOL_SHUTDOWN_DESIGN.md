# Database pool shutdown design

October 11, 2026. This follows the [checkout investigation](APP_FIXTURE_CHECKOUT_DIAGNOSTICS_OUTCOME.md).
The shared pool is currently cleared before its native end promise settles.
A late getter can therefore construct a second pool while the original still owns
checked-out clients. A controlled native-client assertion is retained before
implementation; the separate outcome records its result.

## Decision and contract

Extract a small ESM lifecycle factory into `src/server/database-pool-lifecycle.js`.
Keep connection configuration and the existing idle-error handler in
`database.js`. The lifecycle factory owns one pool generation and its closing
promise; it does not issue SQL, change acquisition limits or alter transactions.

Close admission synchronously before calling the concrete pool's `end()`.
Every overlapping close returns the same promise and calls end once.
A getter during closure throws a fixed `database_pool_closing` error with no
connection details. Keep the original pool and closing state until end succeeds.
Success releases that generation and permits existing serial callers to create
a fresh pool. Failure retains the rejected promise and closed admission;
subsequent close returns the original failure instead of silently declaring
cleanup successful or creating another generation. Construction failure leaves
the lifecycle available for a later explicit attempt.

## Alternatives

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Increase fixture sleep | Minimal edit | Timing cannot prove completion; reject |
| Clear reference only after end | Prevents replacement during closure | Needs explicit refusal and shared close/failure ownership; implement together |
| Permanently disable the global pool | Prevents all future access | Breaks intended serial fixture/recovery reuse; reject |
| AsyncLocalStorage admission scope | Could refuse late getters from a sealed invocation | Does not drain already captured pools or arbitrary I/O; defer until owner audit |
| Owned worker completion and admission | Enables real drain before resource removal | Cross-module work; next slice after this bounded repair |

Recommended stack: existing pg Pool and native client release; narrow ESM pool
lifecycle; controlled completion gates; existing phase/checkout diagnostics;
native database coverage and full serial validation. Research and version limits
are in the [separate ledger](DATABASE_POOL_SHUTDOWN_RESEARCH_2026_10.md).

## Boundaries and security

HTTP socket closure is independent of detached application work. A controlled
real HTTP response test holds such work after the server has closed. The
import-candidate apply worker schedules `void runApply` in a microtask and returns
before it settles; stopping a periodic dispatcher likewise does not establish
completion of launched handlers. These are owner-audit inputs, not reproduced
causes of the historical bootstrap failures.

The fixture's 150 ms delay stays in place this round. This change prevents
replacement during an active or failed pool close; it does not fence an old
invocation after successful closure and restart. It does not cancel provider,
filesystem or worker work. Existing error logging is not redesigned; the new
refusal itself contains no endpoint, SQL or credentials. No accessibility or
whole-system security certification is claimed.

## Verification and publication

Prove lazy creation, reuse, reentrant/concurrent close, fixed refusal, restart
after successful drain, and retained synchronous/asynchronous failure identity
including null. Use one native held client to keep end pending, verify it can
finish SQL, then release it and prove a fresh native pool works. Keep a real HTTP
gate showing the remaining detached-work boundary. Preserve unchanged native
timeouts/assertions and per-file isolation. Because the production database
owner changes, run the stable full validation gate once after focused checks.
Operate on main; no release, branch or PR merge.

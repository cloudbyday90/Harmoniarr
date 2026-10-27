# Schema diagnostic deadline design

## Boundary and ownership

The existing CLI and administrator schema summary share
`startDatabaseSchemaDriftInspection`. `schema-diagnostic-task-service.js` owns a
20-second timer, external cancellation listener, monotonic expiry checks, a
bounded caller result and a separate drainage promise. Preparation checks expiry
between manifest, snapshot and contract work, before creating a connection. Late
filesystem completion cannot initiate a database scan.

`schema-observation-connection-service.js` creates one pg client from the same
database connection settings, with a fixed 2-second startup timeout and pipelining
disabled. It never borrows from the application pool. Successful and failed scans
both close this single-use connection; there is no pool generation or second
application/service to deploy.

The observation owner attaches error/end and cancellation listeners before
startup. On cancellation it closes the owned transport and observes the close
promise immediately, then awaits it in cleanup. A late startup delivery cannot
enter SQL. Normal success requires acknowledged ROLLBACK and completed disconnect.
Original Error/null failures survive secondary cleanup failures.

The force-close adapter deliberately isolates one pinned pg 8.23.1 internal
surface: `client.connection.stream.destroy()`. `client.end()` alone can wait for
a graceful startup/idle transport flush. The adapter still awaits `end()`; native
tests verify actual backend and lock retirement. Driver upgrades must requalify
this surface. No shared pool/socket is ended or modified.

## Admission and publication

The administrator service admits one scan per service instance and queues none.
Expiry/cancellation can finish the caller while owned work is still draining.
Admission only reopens after drainage with confirmed connection retirement. A
failed close fences this service instance until restart; it is never treated as
available capacity. Repeated requests
receive the existing busy representation, with no retained result or timestamp.

The GET route passes only a server-created signal, cancels on response close
before `writableFinished`, and suppresses publication to a destroyed response.
Ordinary request completion is not used as an abort signal. Fresh administrator
authorization remains required again before publication. Query parameters cannot
change deadlines, permissions, read limits or repair policy.

The browser owns a 25-second transport timer and abort listener for each explicit
refresh. It races cancellation with fetch, handles late settlement, removes both
timer and listener, clears stale counts on unavailable feedback and allows manual
retry. The persistent polite status, keyboard focus, themes and 44px control
remain governed by the existing component.

## Preserved invariants and limits

No migration, raw snapshot, expected anchor contract, repair, startup admission,
automatic retry, COMMIT or release/tag is added. The observer retains Read
Committed/read-only, the shared HARM/PREP transaction lock and existing local SQL
timeouts. SQL outside the cooperative preparation key remains outside coherence.

The 20-second deadline covers the inspection, including its cleanup. Initial and
publication session lookups remain ordinary application operations; the browser
deadline bounds its wait for the whole request. Timers are subject to event-loop
and OS scheduling. A blocked filesystem operation can outlive caller completion,
but retains admission and cannot progress to SQL after cancellation. Uncertain
cleanup is unavailable, never accepted as a current result.

See [research and tradeoffs](SCHEMA_DIAGNOSTIC_DEADLINES_RESEARCH.md) and
[validation/outcome](SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md).

# Backup SQL interruption design

October 26, 2026. See [research](BACKUP_SQL_CRASH_RESEARCH.md),
[outcome](BACKUP_SQL_CRASH_OUTCOME.md) and [Docker outcome](LOCAL_DOCKER_BACKUP_SQL_CRASH_OUTCOME.md).

The preceding [process-crash matrix](BACKUP_PROCESS_CRASH_OUTCOME.md) stopped
after returned store calls. This qualification extends the existing backup
component to real pending SQL and committed writes whose responses are withheld.
It adds modular ESM testing files, with no production hook, deployed service,
dependency, migration or application-version change.

The finite plan covers nine targets twice: publication intent, temporary-ready,
finalized, catalog insertion and completed; deletion intent, finalized, catalog
deletion and completed. Each target invokes the unchanged store on the actual
ownership session. The child uses packaged server modules. Before dispatch it
acknowledges its owned Node/backend identities through bounded IPC.

For rollback, a fixture trigger waits on a two-integer transaction advisory lock
held by a separate connection. An independent observer verifies a PostgreSQL lock
wait and the exact blocking backend, plus the old committed journal/catalog state.
The runner kills its own Node child and observes process/stdio closure. If the
original backend is still executing, the fixture cancels only that verified
application backend while retaining the blocker. Backend disappearance, zero
remaining advisory locks and unchanged committed SQL prove rollback. Node death
alone is not described as a guaranteed database cancellation.

For response loss, a loopback wire relay passes startup and earlier queries.
After the checkpoint, it consumes all target response bytes without delivering
them to the child. A bounded frame observer sees the expected command completion
and idle ReadyForQuery, with no ErrorResponse. A separate SQL connection verifies
the committed state. The child cannot advance through its real pending pg query.
After SIGKILL, the relay deliberately retains the old backend socket: default
recovery must report ownership busy. Explicit relay closure then precedes observed
backend/lock retirement and recovery in a fresh, direct-connected default process.
This models response loss and delayed session retirement without pretending to
simulate every network failure.

Each new recovery process repeats recovery, checks current bytes, journal phase,
catalog count/identity and terminal-row stability. Missing directories defer
without mkdir; an explicitly separate fixture repair allows abandonment of the
still-unwritten intent. Deletion never recreates an already-deleted catalog row.

The relay listens only on ephemeral 127.0.0.1 inside the networkless disposable
container. It connects only to that container's PostgreSQL loopback port, caps
connections, framing/partial memory and withheld bytes, and never reports payloads,
credentials or cancellation secrets. The observer reads only the backend PID from
variable-length BackendKeyData. Existing plaintext loopback configuration is
verified; this introduces no TLS downgrade. Disposable-only triggers select the
exact filename/table/verb/status through per-session settings. The fixture's
two-integer lock namespace is disjoint from production's bigint lock namespace.
Owned sockets, server, children and SQL sessions retire before file removal; the
shared cleanup helper preserves the original error. Uncertain retirement fails.

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Real lock wait and owned cancellation | Verifies an in-flight statement and rollback externally | Cancellation is an additional controlled server action | Use |
| Wire response withholding and independent SQL observation | Distinguishes committed state from application knowledge; checks old ownership fence | Requires a bounded test-only relay | Use |
| Pause a Promise after query resolution | Cheap and deterministic | The response already arrived; duplicates prior coverage | Retain only as preceding evidence |
| Add a production fault endpoint or proxy | Convenient remote injection | Expands deployed surface and configuration | Do not add |
| Kill database/container during storage work | Exercises a different failure domain | Requires WAL/startup/storage assertions and isolated persistence | Follow-up |

Recommended stack: guarded disposable profile -> finite real store target ->
verified SQL wait or withheld committed response -> owned Node SIGKILL/close ->
observed original-session retirement -> fresh default recovery -> repeated
SQL/file assertions -> verified cleanup. Keep the 120-second native bound and
one frozen bounded fast gate. Rerun the existing process matrix because the shared
runner changed; retain unrelated proof only after exact source/runtime review.

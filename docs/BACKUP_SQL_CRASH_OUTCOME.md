# Backup SQL interruption outcome

October 26, 2026. See [design and tradeoffs](BACKUP_SQL_CRASH_DESIGN.md),
[official-source research](BACKUP_SQL_CRASH_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_SQL_CRASH_OUTCOME.md).

All 18 selected SQL interruption cases pass: nine real backup journal/catalog
mutation targets, each with observed rollback and with an observed committed
write whose wire response never reaches the application. The preceding 19-case
process-crash matrix also passes on the final image. No production defect was
reproduced that required a runtime fix. The changes are modular ESM qualification
helpers/tests; production code, dependencies, schema, application version and
client bundles remain unchanged.

For each rollback case an independent connection observes the real lock wait,
the exact blocker and old committed state. The runner kills its own Node process
and observes SIGKILL/stdio close and PID disappearance. In every observed case,
the original PostgreSQL query remained pending and required explicit cancellation
while its fixture blocker stayed held. Original backend disappearance, zero
advisory locks and unchanged SQL establish rollback. This is process termination
plus controlled server cancellation, not a claim that Node termination always
cancels pending SQL.

For each committed case the bounded loopback fixture consumes the actual target
CommandComplete and idle ReadyForQuery without delivering target response bytes.
An independent connection reads the committed journal/catalog state before the
kill. The retained old backend connection keeps its production session lock:
default recovery returns ownership busy until the relay closes it and the
observer verifies backend/lock retirement. A fresh process then uses default
application recovery over a direct connection, with no injection factories.
Repeated recovery in that new process verifies idempotence.

Complete files recover into one catalog entry, retaining existing catalog identity.
Deletion completes from current absence without recreating an already-deleted row.
Completed intents remain unchanged. A rolled-back initial intent leaves no
operation to recover and preserves any seeded deletion backup. A committed but
unwritten publication intent defers on a missing directory tree; explicit fixture
directory repair is separate from default recovery, which then abandons the intent
with the expected artifact_file_missing code. Current bytes, catalog counts,
terminal phases and repeated results are checked in each case.

The relay and SQL triggers exist only inside a guarded disposable qualification
container. No second deployed application/service or production fault switch was
added. The relay bounds connections, framing/partial buffers and discarded bytes,
passes opaque startup traffic, retains no row/authentication/cancellation-key
payloads in evidence and closes owned sockets/server before fixture removal.
The child runner preserves its environment allowlist, strict identities/envelopes,
32 KiB output budget, observed close requirements and sticky protocol failure.
Its new one-shot dispatch requires a valid acknowledged child; port override is
available only to the explicitly configured SQL fixture runner.

The initial preflight caught an incorrect fixture expectation: unwritten recovery
records artifact_file_missing rather than a null error. A subsequent preflight
and diagnostic replay caught a trigger-scope problem: catalog deletion also
updates the earlier publication journal through its foreign key. The gate now
selects operation type as well as filename/table/verb/status. These failed fixture
attempts, source hashes, diagnostic logs and verified container retirement are
retained. They are not counted as passing runs or production defects. The corrected
preflight passed all 18 cases with the original 120-second test bound.

Focused validation passes 119 backup tests, including process dispatch/lifetime
and protocol framing, split packets, malformed frames, bounded retention and
variable-length cancellation-key handling. The final frozen bounded fast gate
passes 6,088 server, 4,485 client and 700 script tests (11,273 total), zero
failures/skips/cancellations. Lint, Node/migration/schema, ESM/image/topology/hygiene
checks and build pass. The server invocation was
`node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 70 seconds.
This is the equivalent bounded gate, not execution of unchanged
`npm run validate:fast` or a CI performance benchmark.

Both native entries pass on the final no-cache image in fresh networkless,
read-only, two-CPU/3 GiB containers with tmpfs PostgreSQL and file storage.
The SQL entry covers 18 cases; the unchanged preceding entry covers 19, rerun
because they share the child-process runner. All children, original backends,
advisory locks and fixture storage retire. These profiles do not establish a
minimum memory requirement or a simultaneous worst-case workload.

Exact source/runtime comparison retains eight earlier backup native entries,
42 unrelated SQL checks, seven packaged router checks and the prior compressed
JSON/parser/media proof through its verified comparison chain. These are retained
evidence, not new executions. Older metadata-memory and browser histories remain
historical. The actual backup-bind probe separately passes packaged cold private
directory creation, repeated existing-chain checkpoints, readiness, exclusive
publication, inode cleanup, collision preservation and deletion sync, without
live catalog rows. No new manual screen-reader/device acceptance is claimed.

GitHub MCP returned no open PRs during initial and final review; a random PR
implementation or stale-PR cleanup therefore did not apply. No PR was merged.
Dependency audit reports zero advisories at observation time. Work stays on
main, with no branch, release or application-version change.

Recommended stack: existing owned modular backup service -> guarded disposable
SQL wait/response-loss fixtures -> independent committed-state observation ->
owned process and session retirement -> fresh default recovery -> repeated
current-file/catalog assertions -> one frozen fast gate plus selected native
regressions. This gives realistic ambiguity coverage without expanding the
deployed surface. Its costs are fixture complexity and controlled failure points;
the [design](BACKUP_SQL_CRASH_DESIGN.md) compares the alternatives.

Frozen code/test source: 3,564 files,
`6b10e8e756e3c1021b1ef2c7f2da7a395c55a53bdf99999c773e117bdb4b6f62`.
Private candidate/preflight/final evidence and audit:
`.tmp/backup-sql-crash-2026-10-26/`.

Next recommended item: qualify PostgreSQL crash/restart at these journal/catalog
boundaries using an isolated persistent disposable data directory. Observe actual
database shutdown/startup, WAL recovery, old-session retirement and fresh default
backup recovery with explicit committed/rolled-back outcomes. The current tests
keep PostgreSQL running. They do not qualify database/container crashes, a full
HTTP-server rollout, arbitrary in-flight filesystem calls or hardware power loss.

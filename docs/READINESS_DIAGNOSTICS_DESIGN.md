# Bounded readiness diagnostics design

October 26, 2026. Follows [recovery interruption qualification](BACKUP_RECOVERY_INTERRUPTION_OUTCOME.md).
See separate [research](READINESS_DIAGNOSTICS_RESEARCH.md) and [outcome](READINESS_DIAGNOSTICS_OUTCOME.md).

Observe the existing `/healthz` overview work, preserving its required startup,
migration-state and dependency-selection behavior. Add per-request stage observation at
owned service boundaries; overlapping checks must not share an attribution slot.
The observed stage/code identifies where work failed, not the cause of the earlier
unexplained HTTP 500. Do not add retries, cached success, coalescing or a hard race
that abandons database work in this diagnostic change.

The first packaged replacement qualification reproduced a failure at migration
status. Investigation found that the legacy status helper invokes bootstrap DDL,
including replacement of the UUID function on every read. Fifty concurrent calls
on a disposable packaged database produced 33 PostgreSQL `XX000` failures. Use the
new `schema-migration-status-service.js` reader for system overview: list packaged
filenames and SELECT applied filenames through the existing store. Do not create
extensions, functions or tables from this observation path. A missing table remains
a failure; do not conceal it or repair it from a health request. Startup preparation,
checksum validation and the legacy preparation helper remain unchanged. Preserve
`XX000` as a known safe code without inferring a specific internal database cause.

Return a minimal no-store public health response. Remove the database name and
PostgreSQL data path; no repository consumer needs them from this public endpoint.
Keep `ok`, service identity, start time, app port and pending migration count.
Failure responses use a fixed message/code and an opaque diagnostic reference.
Retain existing connection-error-to-503 and explicit status semantics; unexpected
failures remain 500. Never send raw messages, SQL, paths, stacks, headers or users.

The diagnostics service stores at most sixteen closed scalar failure records in
memory, plus the latest completion and saturating counters. Read only known own
error code/status fields without executing getters. Whitelist codes, categories
and stages before retention or logging. Each failure gets a reference for matching
an administrator snapshot with a log record. References suppressed from logs still
exist in the bounded process history.

Emit at most one diagnostic line per fifteen seconds. Once a write reports
backpressure, admit no additional diagnostic writes until drain; retire the owned
listener on close. Admit at most one pending write, observe callback/stream errors,
and await its actual completion before removing listeners. An output error closes
further log admission while process history remains available. Logging failure cannot replace the readiness result or original
Error/null. These bounds apply to diagnostic state/output admission, not all health
request work, stderr transport latency or total process memory.

Track actual health-check completion with the existing worker task lifecycle.
Application-owner shutdown closes admission and waits for admitted checks before
diagnostic/pool cleanup, including after a client disconnects. Preserve required
startup validation as fatal. No extra deployed service or database table is needed.

Expose the safe snapshot through existing administrator Recovery diagnostics and
diagnostic exports. Add no-store to that response. The existing refresh/status
region owns announcements; render an informational panel with at most five rows,
shared labels, wrapping references and explicit process-local history semantics.
The snapshot does not initiate a new health check. Administrator auth and the rest
of Recovery diagnostics still depend on the database, so logs remain useful when
that API cannot be reached.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Instrument current work with bounded history and logs | Attributes a recurrence without weakening current checks | Broad overview can still fail outside the core database check | Implement |
| Read prepared migration state without bootstrap DDL | Removes a reproduced catalog-write race from observation; works in a read-only transaction | Requires the normal startup preparation to have succeeded | Implement |
| Dedicated minimal readiness query | Smaller failure surface and workload | Changes readiness policy before the earlier failure is understood | Defer |
| Raw exception logging/public errors | Easy to implement | Leaks private context and creates unbounded output | Reject |
| New diagnostics daemon or persistent table | Independent history could survive restart | New deployment/retention or database dependency during failure | Reject for this scope |

The opt-in `test/native/readiness-diagnostics.test.js` entry uses the existing
deployment-memory guard. Run on the immutable local image with disposable tmpfs
`/app/data`, `/tmp`, `/run/postgresql` and the four `/data` roots; use the established
3 GiB/2 CPU/256 PID profile, network disabled, UID 1000 and read-only root. Mount
`testing/server`, the test entry and its shared HTTP session helper read-only as
needed; production modules must come from `/app/server-dist` and `/app/shared` in
the image. Never substitute the preserved walkthrough data bind. It checks an
actual PostgreSQL read-only transaction and fifty concurrent healthy HTTP reads,
four native failure sources, bounded diagnostics, access control and query drain.

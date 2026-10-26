# Database preparation serialization research

Researched October 26, 2026 through connected search MCP discovery and official
pages, against PostgreSQL 18 and pinned node-postgres 8.23.1. See the separate
[design](PREPARATION_SERIALIZATION_DESIGN.md) and
[outcome](PREPARATION_SERIALIZATION_OUTCOME.md).

## Evidence and recommendations

PostgreSQL session advisory locks survive transaction boundaries and release
when explicitly unlocked or when the session ends. Repeated acquisitions stack;
transaction advisory locks end with their transaction. Our application inference:
one physical session must own the whole bootstrap/history/write/verification
lifetime, and nested calls must reuse that owner without acquiring again.
Source: [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

The try-lock form returns false immediately on contention. Unlock returns a
boolean acknowledgement. The two-integer namespace is distinct from the bigint
namespace. Harmoniarr reserves HARM/PREP integer keys and refuses competing
preparers before history observation or DDL. These are our policy choices using
the [advisory lock functions](https://www.postgresql.org/docs/18/functions-admin.html).

The lock view exposes owner PID, granted state and key components; two-integer
keys use objsubid 2. Advisory keys are local to a database. Check the captured
session for inherited ownership before acquiring, rather than unknowingly
stacking a leaked acquisition. Source:
[pg_locks](https://www.postgresql.org/docs/18/view-pg-locks.html).

Use one checked-out client and return it only after an acknowledged unlock in
idle state. If acquisition, connection lifetime or unlock becomes uncertain,
destroy the client through release(true). This disposal policy is our inference
from the [pool API](https://node-postgres.com/apis/pool). The public transaction
status is the last ReadyForQuery state; it is not a connection-liveness signal.
Observe error/end events separately. Source:
[client API](https://node-postgres.com/apis/client).

Nonwaiting lock admission avoids a lock wait queue, but does not bound network,
pool acquisition or all schema execution time. Keep existing connection settings;
do not change global/session timeouts merely to obtain a lock. PostgreSQL's
statement, lock and transaction timeouts have different scopes. Source:
[client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html).

Maintain parameterized values, fixed qualified catalog calls and privileged
maintenance boundaries. An advisory lock is cooperation, not authorization or
a sandbox for arbitrary SQL. Old application versions, external SQL and running
application workers do not become participants automatically; continue controlled
maintenance and least privilege. Source:
[OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html).

No UI or markup changes are needed for this backend boundary. Preserve the
existing web accessibility policy and any future command focus/error/status
behavior; manual speech/device acceptance remains separate and deferred.
Source: [W3C WCAG 2.2](https://www.w3.org/TR/wcag/).

## Options, pros and cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Process-local mutex | Simple | Cannot coordinate separate CLI/container processes | Reject |
| Transaction advisory lock | Automatic release | Ends at each migration/snapshot commit | Reject for the outer owner |
| Table/lease row | Durable visible ownership | Needs bootstrap schema; expiry can admit overlapping work; extra recovery protocol | Defer |
| Waiting session lock | Automatic sequential admission | Holds a pool client while waiting; needs wait/cancellation policy | Defer |
| Nonwaiting session lock on one captured client | Works before schema exists and across commits/processes; immediate busy result | Requires connection affinity, explicit retry and careful disposal | Implement |

Recommended stack: captured idle connection → inherited-lock refusal → one
nonwaiting session acquisition → bootstrap/history/SQL preflight and per-migration
transactions → final observation on the same client → acknowledged unlock →
release. On uncertainty, discard and inspect independently; never replay work
to conceal cleanup failure. Keep diagnostic readers outside this write lock.

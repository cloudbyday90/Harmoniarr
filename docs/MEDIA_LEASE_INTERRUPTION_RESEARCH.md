# Media lease interruption research

Consulted October 23, 2026 through Search Service MCP discovery and official page
reads. Node's opened 24.x documentation identifies 24.22.1, matching the project
runtime; an older indexed Node result was not used as current runtime evidence.

| Official source/status | Applicable practice and implementation owner |
| --- | --- |
| [Node 24 AbortSignal](https://r2.nodejs.org/docs/latest-v24.x/api/globals.html), runtime documentation | Carry the original reason, check pre-aborted signals and retire listeners; the step scope owns notification and cleanup. |
| [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | A kill request/exit is earlier than stdio close. The existing command service retains child/capacity ownership through close. |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html), database documentation | Queue SKIP LOCKED reads are not a consistent general authority check. Preserve current lease/run locks and acquisition-fenced writes/releases. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), security guidance | Stop obsolete expensive work while retaining independent queue, deadline, output and container bounds. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement | Keep the lease-loss message fixed and diagnostics numeric; do not publish paths, acquisition tokens or credentials. This application does not establish general standards conformance. |

These sources inform the engineering decision below; none specifies Harmoniarr's
lease interval, schema, cleanup status or recovery policy.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Forward the existing heartbeat outcome | No extra SQL/timer; instance-owned notification; preserves durable fencing | Detection waits for renewal and database scheduling | Implement for inspection/preflight |
| Add fast lease polling to every media command | More frequent observation | Additional contention/reads; still races ownership changes | Defer without workload evidence |
| Trust the signal instead of fenced writes | Fewer checks | Local notification cannot authorize a current write or release | Reject |
| Reject immediately on signal without draining | Fast caller response | Orphans children/siblings and releases ownership early | Reject |
| Continue media after a renewal exception | Tolerates transient faults | Expensive work continues with uncertain authority | Stop these media owners conservatively; retain the original failure, not a fabricated loss result |

Recommended stack: captured acquisition → existing heartbeat observation → sticky
failure signal → step-owned propagation and complete drainage → current fenced
terminal writes where authorized → exact captured release. Keep durable cancel/
pause checks, process/time/output/queue bounds and container limits independent.

# Owned PostgreSQL failure evidence design

October 11, 2026. Follow the [apply lifetime outcome](APPLY_WORKER_LIFETIME_OUTCOME.md):
the earlier full runs contain unexplained SQL socket resets and first-schema
connection timeouts. Inspection after server removal cannot recover evidence
from that failure window. This slice captures new evidence; it does not claim
to reproduce or remediate those historical failures.

## Selected boundaries

Use narrow fixture-only ESM modules for approved record projection, independent
host probing, captured-container readiness, and per-scenario capture ownership.
The default is failure-only; successful scenarios launch no probes. An explicit
off setting launches nothing. Capture once per scenario and await both actual
probe completions before fixture teardown. Publish bounded records without
SQL, error prose, credentials, hosts, ports, database/user names, or container IDs.

Only a newly created Testcontainers PostgreSQL capability with a valid immutable
container ID from the default constructor may be probed automatically. External, reused and unverified
capabilities emit unavailable evidence without new database or Docker requests.
No container lookup by name/prefix, restart, kill, drop, or recovery action is
introduced. Existing cleanup retains its own capability.

The host plane opens one independent, captured-config pg Client to the maintenance
database. It uses short connect/query/statement bounds, a fixed read-only version/
recovery query and awaited native client end. It never checks out from the failing
pool or retries the failed operation. The container plane uses shell-free Docker
argv to run quiet pg_isready with its own one-second limit and a bounded CLI
process. CLI success reports accepting; nonzero exits remain command failures
with a bounded CLI exit code because Docker errors can overlap pg_isready codes.
No PostgreSQL rejection/no-response classification is inferred from those exits.
Readiness is not authentication proof. CLI completion is observed; a sent kill
is not success or proof of remote execution having stopped. The remote readiness
command retains its own one-second limit; this is no server-wide drainage claim.

The temporary-database failure hook runs before pool/backend/database cleanup.
Both app fixture entry points capture schema-preparation failure before their
app-pool cleanup. Those hooks share the same per-scenario capture, preventing
duplicate probes/records. Template clones forward the hook; template source
preparation and parent-owned shared servers remain separate follow-up.
Original Error/null rejection identity wins over probe, sink and cleanup fallout.
Correlation IDs join existing checkout/phase records; monotonic durations describe
observations after the error, not the exact instant or a diagnosis of its cause.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Inspect after the reporter | No fixture changes | Server may already be gone; reject |
| Retry or lengthen the original operation | May hide transient failure | Changes behavior and loses causality; reject |
| Probe through the failing pool | Reuses configuration | Can queue behind the same failure; reject |
| Always-on raw server logging | Broad detail | SQL/secrets, volume and timing overhead; opt-in private investigation only |
| Failure-only independent host plus captured-container readiness | Distinguishes observation planes before teardown | Small failure-path cost; select |
| Automatically restart or terminate unknown resources | May clear symptoms | Violates ownership and destroys evidence; reject |

Stack: owned fixture capabilities; per-scenario failure capture; independent native
pg client; shell-free bounded readiness; approved immutable records; existing
phase/checkout correlation; focused adverse native controls and complete fast
validation. The [research ledger](POSTGRES_FAILURE_EVIDENCE_RESEARCH_2026_10.md)
distinguishes vendor contracts, informative security guidance and W3C source status.

## Validation and limits

Prove original Error/null preservation, no success/off/external/reuse probes,
deduplication, both probes draining when one fails, hostile input privacy, exact
argv and process bounds, client end after failed connect/query, and capture before
pool/database/server cleanup. Native proof uses actual authentication refusal,
connection refusal and backend termination, plus both app entry points. Use
controlled faults rather than weakening assertions or repeating an unexplained
full gate until it happens to pass. No production routes, schema, worker policy,
test scheduling, release, branch or residual fixture wait changes are planned.

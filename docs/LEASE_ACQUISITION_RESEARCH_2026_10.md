# Lease acquisition fencing research

Read-only primary-source research, 9 October 2026 local and UTC. Root reports
clean main 734ee6cdf13123e6b412e294bb499d16b86eed1d. The prior
[closure design](ABANDONED_PREPARATION_DESIGN.md) and
[outcome](ABANDONED_PREPARATION_OUTCOME.md) identify generic lease renewal,
release and stale terminal callbacks as the next bounded ownership gap.
This research does not independently inspect or execute those runtime paths.

A per-acquisition token identifies one successful ownership acquisition.
A stable row ID, lease key, process/owner ID or millisecond timestamp cannot
substitute for it when a later acquisition reuses those values.

## Fresh official evidence

MCP discovery began at 20:50:05 UTC. Official direct reads, canonical version
navigation and targeted excerpts continued through 20:51:41. URLs were returned
by discovery or official numbered navigation. Authority, document version and
consultation time are distinct.

| Primary source | Authority/version | Applicable guidance |
| --- | --- | --- |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Versioned official documentation | Row locks serialize contending returned rows until transaction end. Re-read the updated row after waiting and acquire related objects in a consistent order. |
| [PostgreSQL 18 UPDATE](https://www.postgresql.org/docs/18/sql-update.html) | Versioned official documentation | The WHERE predicate defines eligible updates; RETURNING identifies changed rows. Zero affected rows is not a database error, so the owner must treat it as loss/refusal rather than success. |
| [PostgreSQL 18 clock functions](https://www.postgresql.org/docs/18/functions-datetime.html) | Versioned official documentation | now()/transaction_timestamp() use transaction-start time; clock_timestamp() advances during statements. Final lease expiry checks need refreshed time after waits. |
| [PostgreSQL 18 UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html) | Versioned official documentation | gen_random_uuid() generates random version 4 UUIDs. Mint on acquisition, preserve on renewal; UUID format is not authorization. |
| [PostgreSQL 18 table changes](https://www.postgresql.org/docs/18/ddl-alter.html) and [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html) | Versioned official documentation | Volatile defaults require values for existing rows and can make an additive change lengthy. Consider explicit backfill/default/constraint steps; adding a column is not a zero-lock deployment promise. |
| [OWASP workflow guidance](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Informative, mutable guidance | Validate persisted state transitions and conditional-write results at every sensitive entry point. Local transaction atomicity does not include an external side effect. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative guidance | Validate current object permissions for each request. Token possession, job visibility or a digest does not grant actor authority. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), 9.2.2 | Normative HTTP semantics | Automatically retrying non-idempotent work requires a known safe contract or evidence that the original request was never applied. Lease expiry supplies neither. |
| [WCAG 2.2](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) and [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Normative Recommendation 12 December 2024; informative explanation updated 11 May 2026 | Expose relevant stopped/waiting/outcome status without forcing focus. Losing local ownership must not be described as completed provider cancellation or acquisition. |

Read-only commands observed Node 24.18.1 and npm 12.0.2 at 20:50:05 UTC.
PostgreSQL 18 is the consulted documentation version; no running database version
was probed. Existing exact slskd contracts remain inherited from the
[batch](SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md) and
[legacy](SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md) ledgers.
No provider version, capability or upgrade was queried this round.

## Recommended contract and tradeoffs

These are application-specific inferences, not a standardized lease protocol
or executed implementation proof.

Mint a private random UUID for every successful acquisition, including a
same-key/same-owner reacquisition. Return it in the acquired receipt and preserve
that receipt through heartbeats and callbacks. Renewal preserves the token.
Do not let an old callback fetch the latest row and adopt its replacement token.

Renew/release must conditionally match the captured token, resource key and
appropriate current owner/state. Require a still-active, unreleased and unexpired
lease where the operation needs live ownership. Check the affected row/result;
a missing, malformed, expired or replaced acquisition cannot become success.
Use the same predicate and cooperating locks for operation-run terminal writes
so a refused lease update cannot still complete/fail the replacement owner's run.

Propagate the original receipt through heartbeat factories, operation-run
bridges, workers, cancellation/finalizers and stranded recovery. Stranded
recovery must fence the exact acquisition it observed before releasing or
changing a run; an old expired snapshot cannot retire a newly acquired owner.
Current authority/source/policy checks still apply at their normal boundaries.

Keep additive migration and historical evidence separate. Existing lease rows
need a deliberate backfill/default/constraint plan. Old workers without the new
receipt must fail closed or be drained/restarted by the deployment plan. A
database backfill must not graft a new token into historical immutable
preparation/closure proof. Define versioned reader compatibility explicitly:
retain valid old evidence without giving a tokenless callback current authority.

| Option | Benefit | Cost or gap | Assessment |
| --- | --- | --- | --- |
| Key/owner/timestamp comparisons | Small change | Same-owner reacquisition or timestamp collision can preserve an old match | Insufficient acquisition identity |
| Per-acquisition UUID plus conditional writes and propagation | Distinguishes successive owners without replacing the existing queue | Requires every mutation/bridge to carry and check the captured receipt | Preferred bounded option |
| Global process stop or lease timeout as non-dispatch proof | Operationally simple | Does not establish whether provider work already began | Reject as evidence |
| Database-only token column | Additive schema | Unfenced callbacks can still mutate by key | Incomplete |

Acquisition ownership is a local concurrency boundary. A timeout, stale heartbeat,
cancelled run or failed token CAS cannot certify provider non-dispatch or permit
a replacement POST. Already crossed/unknown transfers retain their existing
causal receipt and uncertainty protocol.

## Minimum evidence and scope limits

Hold acquisition A's heartbeat, release and terminal callback across acquisition B
of the same row/key/owner, including the same millisecond timestamp. Assert that
old writes refuse and B's token, expiry and run state remain unchanged. Exercise
live renewal, missing/malformed tokens, expired renewal, final clock after lock
wait, stranded recovery's observed-token race, cancellation, and delayed native
beforeSend with zero POST before crossing. Preserve may_have_dispatched and lost
response uncertainty.

Use real PostgreSQL for conditional writes, transactions, migration/backfill,
lock waits and run/lease coupling. Service doubles prove argument propagation
only. Update schema snapshots/anchors through their existing workflow and check
private/public projections. No UI interaction change is implied; applicable
status checks stay with the existing visible journey.

Raw search, reads, installed-version outputs and prior-document excerpts:
.tmp/lease-acquisition-2026-10/official-source-discovery-and-reads.json,
SHA-256 e508c613a7344f0dd9e05be56f01fce162f7c6775dce8b441ced8737cf9c8b40.

No source/test edit, runtime test, PostgreSQL operation, Git mutation, provider
mutation, external message, branch, release or merge occurred. This research
does not establish live provider behavior, external exactly-once execution,
actual assistive-technology speech or whole-platform standards conformance.
Fresh PR assessment is separate:
[design](OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_LEASE_ACQUISITION_2026_10_OUTCOME.md).

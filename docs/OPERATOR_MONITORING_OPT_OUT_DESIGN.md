# Operator monitoring opt-out

October 12, 2026, America/New_York. This continues the
[metadata source writer coordination outcome](METADATA_SOURCE_WRITER_COORDINATION_OUTCOME.md).

## Problem and boundary

The shared desired-state planner permits a resolved policy-selected release with
`isMonitored: false`. The scheduler and ordinary Wanted reader already filter
unmonitored artists, but a saved opt-out still queues reconciliation. Publication
rebuilds eligibility with this same planner, so source stability alone does not
enforce the opt-out. First reproduce the saved opt-out through the real save,
queue, worker and PostgreSQL materializer before changing runtime behavior.

Policy-derived automation requires `isMonitored === true`. Add an
`artist_unmonitored` blocker and `unmonitoredBlockedCount` to the existing pure
planner and forward the count into the reconciliation summary. Preserve existing
unresolved, acquired, duplicate, active request and discovery blocker precedence.
The count describes the selected primary blocker, not every possible denial.
Effective selections remain descriptive; eligibility owns the operational gate.

Explicit release selections and the planner's existing track-override exception
retain their broad-policy bypass. This preserves a contract, not permission to
invent consent: the canonical save already rejects selections/overrides while
unmonitored, and manual-selection drafts enable monitoring. Those validations
remain required. Independent saved requests and acquired media are not deleted
or cancelled by this change. Track override polarity and orphan semantics remain
their existing contract and require separate analysis if changed.

## Alternatives and recommendation stack

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Filter only the queue or worker | Small early shortcut | Direct planner, projection and final publication can disagree; less explanation | Reject |
| Gate every selection on monitoring | Simple blanket rule | Changes explicit-selection semantics and conflates broad policy with consent | Reject |
| Gate policy eligibility in the shared planner | One decision reused by execution, Wanted projection and guarded SQL publication; explicit exceptions survive | Missing/non-boolean flags fail closed; fixtures must declare monitoring | Select |
| Cancel existing requests on opt-out | Stronger operational stop | Destructive scope expansion with distinct consent/lifecycle requirements | Defer |

Use saved scoped policy → shared eligibility → transaction-owned current source
and target checks → atomic request/event → returned worker drainage. Keep ESM
factories and existing service/store boundaries; this small policy correction
does not need another singleton or orchestration layer. No migrations, transport
retries, new branches, releases or PR merges are required.

## Evidence plan

Verify false/missing/malformed flags, monitored policy, explicit/partial and
track-override exceptions, and prior blocker precedence in focused tests.
Verify direct Wanted projection and the final guard independently of a caller's
eligible flag. Native cases must save an opt-out, claim the current snapshot run,
await actual completion and close, and inspect durable request/event/discovery
rows. Also force a false eligible flag against unchanged unmonitored source to
prove publication checks semantics, and save explicit monitored consent to prove
the positive path. Existing post-plan save contention and worker lifetime cases
remain affected regression evidence. Use one stable fast gate plus one serial
affected PostgreSQL cohort; record failures separately from final proof.

See [official practices and tradeoffs](OPERATOR_MONITORING_OPT_OUT_RESEARCH_2026_10.md).

# PostgreSQL fixture reset investigation and bounded lifecycle

October 12, 2026. Baseline main: `6e8fb18`. The separate
[research](POSTGRES_FIXTURE_RESET_RESEARCH_2026_10.md) records official guidance;
the outcome will record observed execution without rewriting earlier failures.

## Evidence and scope

Two frozen 19-file cohorts in the preceding track-union outcome each passed
140 of 142 native cases. Connection resets occurred in abandonment and operator
reconciliation fixtures. A subsequent isolated run passed 15/15. Those results
do not establish a network, host-load, PostgreSQL or application root cause.

Source review identifies two independent defects: direct database pools omit
the integration runtime's configured limits, and abandonment checkpoint waits
can outlive their failed operations. Fix these before drawing conclusions from
new cohort measurements. Production pool policy and application services retain
their existing contracts.

## Selected design

Extract one ESM integration pool-policy module, used by both direct database
and application fixtures. Apply explicit runtime policy after environment pool
configuration, preserving the owned database connection. Defaults remain max 2,
10-second checkout, 1-second idle retirement, 25 uses and exit on idle. This is
enforcement of existing policy, not a larger pool or deadline.

Adopt existing scoped gate/work/lifecycle helpers in the abandonment fixture.
Register real worker/closure completion before launch, race readiness against
that completion and cancellation, release every controlled gate, and drain
tracked work before the isolated database callback returns. Preserve original
Error/null failures and all existing assertions.

The first bounded cohort exposed two Wanted lock tests and a recovery parent-lock
test requesting an observation
checkout while both pool clients were held. Build their independently owned,
bounded observer from the scenario's acknowledged database config, refresh the
monitoring snapshot and race polling against actual publication completion.
Observe expected lease rejection immediately; unlock the holder and drain that
publication before teardown. This is a fixture correction, not extra application
pool capacity. Retain the original failed cohort and its healthy server/state
observations. The single-client Wanted proof also uses the owned connection
configuration rather than copying internal pg pool options. A small shared ESM
observer owner drains its admitted read and closes its independent client before
returning. Preserve original failures through close failure and cancellation.

The audit extends that owner to origin-resolution, lease-fencing, file-match and
organize lock fixtures outside the original cohort. Retain their observation and
scenario bounds and assertions; own actual gate/holder/publisher drainage.
Expiry delay SQL uses the held client, not a third pool checkout. Set up the
unscoped origin writer before contenders fill the remaining slot. These native-only
consumer fixes receive separate focused proof without repeating unrelated unit
tests or builds whose source hashes stayed exact.

Extend failure-only evidence with an independent, bounded read of the exact
owned fresh container: running, paused, restarting, OOM flag, exit code and
restart count. Use a fixed Docker inspect format, a two-second child deadline,
512-byte output bound and no shell. Serialize only approved booleans/integers
and sanitized error categories. External/reused/unknown containers and disabled
or cancelled diagnostics launch no probe. A failed probe cannot replace the
scenario failure. The versioned record is observation, not causal classification.

Do not collect raw SQL, connection strings, whole inspect objects, container
logs or host processes. PostgreSQL readiness and a successful independent query
are snapshots, not evidence that a prior failing connection remained healthy.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Longer deadlines, larger pools or retries | Easy apparent green runs | Masks hangs and changes test pressure; no causal proof | Reject |
| Enforce shared policy and own checkpoint drainage | Bounded checkout and original failure visibility | Real contention previously hidden by defaults may surface | Implement |
| Bounded failure-only container state | Separates observed container state from host/query readiness | Cannot explain every reset or historical restart | Implement |
| Raw PostgreSQL/debug logs | More transport/server context | Credentials, SQL and payload exposure; noisy | Defer to an explicitly scoped sanitized design if needed |
| Global parallel native scheduling | Potential speed | Existing global fixture state and failed experiments | Defer |

Stack: shared policy, owned scoped work, three independent failure observations,
controlled adverse tests, focused serial native checks, then one frozen longer
cohort. Retain failed runs separately. Never turn a passing retry into a fixed
reset claim or a speed comparison between different cohorts.

## Verification

Prove direct external/container and template pools use explicit policy despite
ambient conflicts; inspect real pg pool bounds and queued third checkout without
waiting for a timeout. Use a deliberately owned backend termination before an
unreachable checkpoint to prove original failure propagation and cleanup.
Check healthy actual container state and exact non-shell probe arguments,
malformed/hostile output refusal, secret canaries and actual child closure.
Run unchanged abandonment and operator lifetime cases serially, along with the
owning native diagnostic tests. Broaden once the focused checks and fast gate
pass. No release, branch, merge or deployment accompanies this commit.

## Follow-up

If a reset recurs, correlate the original code/phase with all three observations
on the same frozen source. Add a narrowly owned transport/session diagnostic
only when that evidence supports it. Once a clean serial cohort is observed,
pilot the two repaired suites in the existing serial shared-PostgreSQL launcher
after an ownership/cleanup audit and matched-order measurement. Retain fresh
databases and real transactions; promote only a demonstrated saving with unchanged
behavior and diagnostics. Partial track delivery recovery and fulfilled-source
retirement follow that bounded efficiency work; larger unions remain independent.

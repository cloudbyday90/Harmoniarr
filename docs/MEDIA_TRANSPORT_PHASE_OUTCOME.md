# Owned media transport phase outcome

October 14, 2026. Three narrow ESM modules own fixed phase capture, bounded
aggregate observation and post-close publication. The existing Docker transport
labels every returned CLI call without changing argv, timeouts, output limits,
identity/state inspection or retirement. The CLI records optional
`--media-diagnostics on|off` on owned distinct/source workloads; off remains the
default. Per-command media remains the workload default.

## Boundary and validation

An owner stores twelve aggregate rows, capped at ten thousand observations with
explicit clipping. Counters track started/completed/failed/pending work, timed/
untimed completions and duration total/min/max. Held work stays pending; invalid
clocks leave durations unknown. Snapshots copy/freeze rows. Public capture reads
approved values once and excludes paths, IDs, argv, output and error details.
Reports retain at most twelve owner summaries and mark summary clipping.

Post-close publication awaits its optional sink and preserves original Error/null
after sink failure. Local-tool summaries report no Docker owner; ownerCleanupSafe
describes the executor's cleanup boundary, not whole-application drainage. A
completed inspect CLI row does not certify its subsequent configuration checks.
Only owned transport calls are counted: generation, tooling verification,
PostgreSQL, JSON validation and caller queue wait remain separate work.

Focused validation passed 39 cases in 373.466 ms. It covers held work, immutable
snapshots, first Error/null through invalid clocks and held failing sinks, storage
budgets, continued execution after clipping, malformed/revoked/changing input,
safe partial reports and explicit CLI policy. Native Docker proof passed three
cases in 22.152 command seconds: actual changed-media reinspection, read-only
denial, nonzero exit and held-command timeout retirement. Aggregate admission
counts match the actual native invocations; completed scopes have no pending
rows and exclude their private root/container identity. Existing ownership/
workspace and canonical guards remain.

Final fast validation passed 10,156 cases (5,205 server, 4,384 client, 567 scripts),
static/ESM/lint checks and both builds in 131.717 seconds. A subsequent native
harness review preserved original scenario/close failures through counter checks
and workspace disposal. That test-only refinement passed targeted lint and all
three native cases in 13.088 seconds; shared runtime/benchmark sources were unchanged.
The final dependency audit passed with zero findings in 2.506 seconds. Repository
testing/standards skills and the installed standards mirror passed structural
validation and byte checks. This is not an exhaustive application security audit.
Final staged verification matched eleven tested JavaScript files, preserved forty-
nine unchanged baseline files and resolved 652 local links across eleven Markdown
documents. No private ignored measurement log was staged.

## Selected canonical measurement

Both off/on runs used the same reviewed benchmark/transport sources, local immutable media
image, owned inspector, sine profile, two bindings, one pair, fresh owned server,
same pool/deadline policy and exact private source/durable/digest comparisons.
Both completed two samples with two generated files and ten actual inspections.
Observation on/off changes no current verification work. The off-first order is
one descriptive collection, not an overhead bound or a speedup experiment.

| Diagnostics | Seed ms | Executor close ms | Measurement ms | Command seconds |
| --- | ---: | ---: | ---: | ---: |
| Off | 11,784.710 | 1,216.889 | 49,734.388 | 49.887 |
| On | 10,271.955 | 1,095.960 | 18,652.350 | 18.798 |

The difference in whole command time is largely outside these seed/close windows;
it does not prove an observer speedup or locate a startup stall. No prior largest
timeout was rerun or diagnosed, and no default/resource-policy promotion follows.

The on run reported one safely closed, unclipped owner with forty successful CLI
calls and zero failed/pending/untimed rows:

| Returned owner transport work | Calls | Total ms |
| --- | ---: | ---: |
| Startup image/create/inspect/start | 5 | 1,037.390 |
| Before/after command container inspections | 20 | 2,635.530 |
| Exec round trips | 10 | 2,241.447 |
| Retirement/removal controls | 5 | 1,094.881 |
| All measured owner CLI calls | 40 | 7,009.248 |

Control calls total 4,767.800 ms. Across startup, commands and teardown,
twenty-five container inspection reads total 3,433.852 ms. These serial native
windows may be summed; caller media/seed/close scopes overlap them and must not be
added again. Exec time includes host CLI, daemon, codec and stdio, so it is not
ffprobe CPU time. Control time likewise cannot be treated as entirely removable
host startup. It identifies a candidate boundary for an independently measured
adapter, not guaranteed savings.

## Recommendations and next work

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Optional fixed aggregates | Actual counts/cost, bounded private output, failure ownership intact | Observation and publication work; one pair cannot bound overhead | Implemented; use explicit diagnostics for investigation |
| Read-only Engine inspection adapter | Targets twenty-five measured reads; keeps exec/mutations on CLI | Endpoint/version, bounded HTTP and agent/drainage contracts; benefit unproved | Next controlled prototype |
| Full Engine exec/lifecycle migration | Could avoid more CLI launches | Adds multiplexed streams, uncertain-create and cancellation authority | Defer until read adapter proof |
| Skip inspections/cache current metadata | Removes calls | Removes current ownership/file guarantees | Reject |

Final stack: unchanged isolated owner -> actual bounded CLI calls -> monotonic
fixed aggregates -> verified close -> minimized bounded summary -> exact native/
canonical comparison. Next implement the
[read-only control adapter proposal](MEDIA_CONTROL_READ_API_PROPOSAL.md), preserving
every current inspection and existing conservative cleanup. Test daemon/context
matching, request/byte bounds, early close/abort and owned disposal before a
reversed-order native/selected comparison. Keep the historical largest locked-noop
timeout as a separate phase investigation.

Initial GitHub MCP repository/pulls lookup found zero open PRs; no random PR was
applicable. Evidence remains ignored under `.tmp/media-transport-phases-2026-10-14/`:
source freeze, focused/native logs, off/on selected reports and analysis, official
navigation, fast/audit results, skill hashes and staged verification. No production
source, schema, dependency, branch, release or tag changed. Existing testing and
standards skills are maintained; structural/byte checks do not claim a new blind
trial or standards certification. See separate [design](MEDIA_TRANSPORT_PHASE_DESIGN.md)
and [official October research](MEDIA_TRANSPORT_PHASE_RESEARCH_2026_10.md).

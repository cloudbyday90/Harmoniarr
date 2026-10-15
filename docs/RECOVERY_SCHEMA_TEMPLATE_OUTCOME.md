# Recovery schema timing and template outcome

Date: 2026-10-15. Work stays on main without a release, tag, branch or PR merge.

## Delivered boundaries

The recovery transaction suite now uses a small ESM scenario adapter. It forwards
the actual test signal and database pool/configuration, calls the existing
idempotent schema helper and measures the full returned recovery callback. Fresh
service context and case-owned seeds stay inside each independent database.
Schema policy is scoped to this suite through
HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE, accepting only empty or
migration_template; malformed values refuse startup before resource allocation.
After the paired comparison, migration_template is the default for this suite;
an explicit empty override retains the comparator without changing other suites.

The original nine case bodies remain byte-identical: 16,402 bytes, SHA-256
`106889e188a53ba9fbf88f0c69e0070a37e477a18835d97ab77412ca055d7fb4`.
They retain current consent/provenance, budgets, lease/current-source checks,
real lock waits, required audit/event rollback and durable recovery assertions.
No production service/SQL, dependency, shared runtime default, file scheduling,
pool bound, deadline or retry policy changed.

## Executed evidence

The focused owner/helper gate passes all 43 cases with zero failures,
cancellations or skips in 16.153 seconds. It covers policy validation, current
pool/signal forwarding, held preparation/scenario completion, original Error/null,
post-query cancellation refusal, schema idempotence and existing template/runtime
ownership contracts. Changed JavaScript lint, test hygiene and ESM checks pass.

All eleven selected native adoption/template controls pass, zero failures,
cancellations or skips, in 28.356 seconds. New controls commit genuine recovery
state and create clone-local fault triggers, then reject with Error/null. The
next clone has a different database name/OID, the earlier database is absent,
and users, candidates, discovery/Wanted state, runs, events and faults are absent.
Current migration state and actual pool/checkout limits are checked. One schema
template is prepared for both scenarios. A reopened source refuses the canonical
adapter before schema/context/scenario work and receives no empty fallback.

Existing native controls retain ledger/source fingerprint, active-session,
collision, replacement-OID, cancellation and cleanup evidence. Actual returned
test operations are registered and drained beyond runner cancellation. Expected
failure-only diagnostic records accompany deliberately rejected controls; these
are not reproduced PostgreSQL transport incidents.

All four explicit-mode comparisons pass the same nine tests: 36 native executions,
zero failures/cancellations/skips/TODOs, identical case/outcome digest
`69e1fd30808455440dd2c4e87bb1074eb3bd2c816d3ce42b46dbd9199a29bb2d`.
Every sample records fourteen successful schema/scenario spans and fourteen
scenario database drops. Empty mode creates fourteen databases; template mode
creates fifteen, prepares one template and separately drops it. Each sample
awaits one fresh server start/stop and full native output.

| Profile order | Empty elapsed | Template elapsed | Observed local saving |
| --- | ---: | ---: | ---: |
| Empty first | 36.576s | 13.229s | 23.347s / 63.83% |
| Template first | 23.144s | 11.875s | 11.269s / 48.69% |

The fourteen schema_prepare calls total 25.376s and 15.466s in empty mode,
versus 0.336s and 0.321s in template mode. Template preparation separately takes
1.579s and 1.413s. The idempotent migration call remains in every clone; setup
work is amortized rather than omitted. Scenario spans include case-owned seed
and recovery work. Inclusive phase aggregates are not summed as wall time.
Both profiles include the same additional reporter/timing instrumentation.
Two local pairs show substantial order/host variation and provide no statistical,
hosted-CI or whole-gate speed guarantee. New adoption coverage also changes the
full native test population. No cross-profile SQL projection digest was added;
unchanged native assertions and dedicated isolation controls own correctness.

The measured instrumented candidate keeps all 2,991 source/config inputs at
aggregate SHA-256
`e7075d35c73a92ad666b1ddd2b476b394ea95827157c11745ef851568ee49213`
before/after each sample. PostgreSQL uses the verified Linux image
`sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7`.
After comparison, only the policy's default value and its expected-default unit
control change. The scenario adapter, native controls and original case bodies
stay unchanged; the final policy/helper gate passes 43/43, zero skips, in 0.857s.
Candidate measurements and final-source validation remain separate.

The final default runs through the existing five-file shared selector with the
additional native evidence reporter. All 44 cases pass, zero failures,
cancellations/skips/TODOs, in 65.054 seconds of launcher time. It prepares five
templates, records 103 schema/scenario spans, creates/registers 108 databases,
drops 103 scenarios plus five templates and releases all 108 with zero reaping.
One parent starts/stops successfully. Recovery's final case digest matches the
candidate. Both Linux image IDs and ffmpeg/ffprobe prerequisites are verified;
this final selection is correctness evidence, not a matched whole-cohort speed
comparison with historical runs.

Final-source aggregate SHA-256 for the same 2,991 inputs is
`9aac76021938ae3b5445d0789e1b58a7f041a2fe8f5531a79acf28100dbe5d67`.
It matches before/after final native execution and after the complete fast gate.
The fast gate passes 10,365 cases (5,393 server, 4,384 client and 588 script),
zero failures/cancellations/skips, plus static policies, complete lint and both
builds in 143.813 seconds. The client build completes in 3.33 seconds with a
plugin-timing diagnostic. Its 225 existing Vue fixture warnings match the prior
gate; no client source changes. Production dependency audit reports zero known
vulnerabilities. The complete native integration population was not replayed;
the selected template controls, four comparisons and final cohort own this scope.

All six final JavaScript hashes match staged bytes, 109 previously frozen source
files remain unchanged and 739 local links across ten changed Markdown documents
resolve. Repository testing/standards skills and the installed standards skill
structurally validate; its four maintained files match repository bytes. Staged
whitespace checks pass. This focused skill reference maintenance is not a new
blind skill trial or general security/accessibility certification.

Private evidence remains ignored under
`.tmp/recovery-schema-2026-10-15/`.

## Recommendation and next item

Select the existing migration-template mechanism for this transaction suite's
default, retaining its explicit empty mode. Benefits: less repeated schema work
with independent real commits, pools and current guards. Costs: one extra source
database, fingerprint/clone verification and dedicated native isolation coverage.
Keep global runtime defaults and serial file scheduling unchanged.

Recommended stack: scoped recovery mode policy → existing sealed migration-only
owner → fresh clone/pool → idempotent migration check → fresh recovery context/
seeds → unchanged SQL/lease/rollback assertions → strict awaited release →
separate candidate measurement and final default evidence.

Next: audit and instrument music-queue-recovery-execution.test.js. It still calls
applyPendingMigrations directly per scenario and adds actual worker/reconciliation
owners. Establish schema/scenario cost and returned worker completion/close before
considering template or shared-parent admission for that file. Do not infer its
authority from this transaction-only result. Hosted Ubuntu canonical-media
evidence remains separate before media-default promotion.

Opening and final GitHub MCP collection reads found zero open PRs. No random or
stale PR was available to implement or rebase. No PR comment, merge or other
external message occurred. Existing standards/testing skills receive focused
source/ownership/evidence guidance rather than another overlapping skill.

See [design](RECOVERY_SCHEMA_TEMPLATE_DESIGN.md) and
[official research and pros/cons](RECOVERY_SCHEMA_TEMPLATE_RESEARCH_2026_10.md).

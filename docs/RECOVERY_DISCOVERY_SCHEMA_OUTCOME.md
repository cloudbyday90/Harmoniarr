# Recovery discovery schema outcome

Date: 2026-10-15. Work stays on main without a release, tag, branch or PR merge.

## Delivered boundaries

A small ESM fixture module now owns the discovery suite's custom recovery/
request/scoped context and controlled worker. The canonical suite reuses the
existing recovery scenario adapter for fourteen actual schema/callback spans,
current pool/configuration and fixtureSignal. The moving Date.now() minus 50 ms
clock, zero rediscovery delay, future-deadline case, reconciliation clocks and
global-work exclusions are preserved. Worker completion still comes from the
existing registered actual handle through returned ingestion/release/pruning;
no additional lifecycle or polling is introduced.

The nine original case bodies remain byte-identical: 12,260 bytes, SHA-256
`07485c3d48b8e158158104e167a842772b08c5b58b40cec96c94806674271522`.
Saved consent/floor/membership, private provenance, reserved-target dispatch,
lost-response uncertainty, supersession rollback and stale reconciliation/deadline
assertions stay intact. No production code, SQL/migration, dependency, global
runtime default, pool bound, retry, deadline or file scheduling changes.

HARMONIARR_INTEGRATION_RECOVERY_DISCOVERY_SCHEMA_MODE selects only empty or
migration_template independently of transaction/execution policies. Invalid
values refuse before runtime allocation without reflecting configured contents.
The measured candidate keeps empty as default; after comparison, discovery's
default becomes migration_template while explicit empty remains available.

## Executed evidence

The focused schema/policy/runtime/template/scenario/discovery-completion/lifecycle
gate passes 71 cases in 3.679 seconds, zero failures/cancellations/skips/TODOs.
Changed-file lint, test hygiene (1,265 files) and ESM checks pass.

All thirteen selected native controls pass with zero failures/cancellations/
skips/TODOs. Two new controls hold real preparation, provider response, returned
ingestion, actual lease release and eligible pruning independently. Parent
checks observe running/completed persisted status and a released lease while the
scenario remains pending and the database/pool remain live. Cancellation with
Error/null during held pruning preserves the exact original value and waits for
actual worker drain before completing scenario timing and database disposal.

The next clone from the same source has a different database name/OID, no earlier
database, and zero users/candidates/runs/events/discovery/reservation-links/Wanted/
lease rows. Current migrations and configured pool/checkout bounds are checked;
fresh discovery completes with one search and one ingestion. One source
preparation serves both scenarios in each control. Native operations are
registered/drained beyond runner cancellation before owner teardown.
Ingestion/pruning are held controlled callbacks at the actual worker boundary;
these controls prove returned-work lifetime, not real catalog ingestion, run
deletion semantics or live-provider completion.

Existing transaction-adoption/template controls retain genuine committed-state/
fault isolation, reopened-source refusal, lineage, active-session, collision,
replacement-OID, cancellation and cleanup proof. Expected failure-only records
for controlled Error/null or refused admission are not transport diagnoses.

The candidate's same 2,994 source/config inputs remain at aggregate SHA-256
`13f74344ea166ae174705cf2b8a0c2e503a053fba73d6ffa0b1c7acffb299560`
through native controls and before/after every comparison profile. All four
complete nine-case profiles pass: 36 native executions, zero failures/
cancellations/skips/TODOs, identical native case/outcome digest
`1b7c4933b095a5cd96b5e5cad1f30866b6ce1e520d82105f334431602f3d5450`.
Each profile records fourteen successful schema/scenario/database-drop spans,
one fresh server start/stop and complete returned output. Empty creates fourteen
databases; template creates fifteen and prepares/drops one source separately.

| Profile order | Empty elapsed | Template elapsed | Observed local saving |
| --- | ---: | ---: | ---: |
| Empty first | 25.852s | 11.597s | 14.255s / 55.14% |
| Template first | 23.973s | 11.939s | 12.034s / 50.20% |

Fourteen schema_prepare calls total 17.027s and 16.036s in empty mode versus
0.296s and 0.306s in template mode. One source preparation separately takes
1.320s and 1.264s. The per-clone migration call remains idempotent; no schema
check, case or committed transaction was omitted.

These are existing file-process adapter timings with the same additional native
reporter/phase instrumentation, not exact bare-command timings. Nested inclusive
phases are not additive wall time. Two local pairs do not establish statistical,
hosted-CI or whole-gate speed; no cross-profile SQL projection digest was added.
Unchanged assertions and native isolation controls own the correctness boundary.

Only the discovery default and its expected-default unit controls change after
measurement. The final policy/scenario gate passes 14/14, zero skips, in 0.325s.
Final defaults pass all 25 cases across discovery/execution/transactions, zero
failures/cancellations/skips/TODOs, with unchanged native signatures. Discovery's
phase work counts match its candidate template profile. The three files prepare/
drop three sources, perform 35 schema/scenario spans, create 38 databases and
drop all 35 scenarios, with three successful fresh server starts/stops.

Final-source aggregate SHA-256 for the same 2,994 inputs is
`e13ae30580a96bc37b8a194172f1dd3a1cc63b35720f9248267dbacce3cddaee`.
It matches before/after final native execution and after the complete fast gate.
`npm run validate:fast` passes 10,369 cases (5,397 server, 4,384 client, 588 script),
zero failures/cancellations/skips, plus complete lint, static policies and both
builds in 123.271 seconds. Client build completes in 1.65 seconds. Its 225 existing
Vue fixture warnings match the previous gate; client source is unchanged.
Production dependency audit reports zero known vulnerabilities.

All five final JavaScript hashes match staged bytes, 115 previously frozen source
files remain unchanged and 754 local links across eleven changed Markdown
documents resolve. Repository testing/standards skills and the installed standards
skill structurally validate; four maintained installed files match repository
bytes. Staged whitespace checks pass. Candidate timing and final validation
retain their distinct source identities and scopes.

The additional native evidence reporter emits the installed Node TestsStream
eleven-end-listeners warning in controls/comparisons/final runs. Complete native
summaries pass; the warning is retained, not suppressed or classified as a proved
leak. Both timed modes include that reporter. The complete native integration
population is not replayed by this scoped lane.

Opening and final GitHub MCP collection reads returned zero open PRs. No random
or stale PR was available to implement/rebase; no merge or external message
occurred. Existing standards/testing skills receive focused reference guidance,
not another overlapping skill or a new blind trial. No broad security or
accessibility certification is implied.

## Recommendation and next work

Select the scoped migration-template default and retain explicit empty with
the existing source engine. Benefits: amortize schema work with private committed
reservation/worker state; costs: one extra source, verification/copy/cleanup and native adoption
coverage. The two new controls add cases to the full integration population;
local suite timing cannot establish whole-CI savings.

Recommended stack: scoped mode → verified migration-only source → fresh clone/
pool → idempotent schema check → unchanged context/domain clock → actual dispatch/
ingestion/release/pruning completion → unchanged assertions → strict awaited release.

Next: audit execution/discovery parent registration and child drainage before
admitting them to the existing shared PostgreSQL cohort. Both canonical suites
use the common runtime, but the current allowlist still contains only the prior
five files. Require current reserve/CREATE/OID commit/release, actual child close,
no outstanding workers, exact case/work signatures and zero reaping; then compare
the proposed full seven-file cohort in both orders. Do not infer admission or a
global scheduling change from the scoped template results.

Private evidence remains ignored under `.tmp/recovery-discovery-2026-10-15/`.

See [design](RECOVERY_DISCOVERY_SCHEMA_DESIGN.md) and
[official research/options](RECOVERY_DISCOVERY_SCHEMA_RESEARCH_2026_10.md).

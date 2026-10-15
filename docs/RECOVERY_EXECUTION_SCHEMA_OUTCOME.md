# Recovery execution schema outcome

Date: 2026-10-15. Work stays on main without a release, tag, branch or PR merge.

## Delivered ownership

The execution suite reuses the small ESM recovery scenario adapter for its seven
schema preparations and complete callbacks. The actual test signal is forwarded
as fixtureSignal to the existing execution fixture, which already registers and
awaits the real returned worker completion. Reconciliation is directly awaited.
No additional worker lifecycle, production source, SQL/migration, dependency,
deadline, retry, pool bound or file concurrency changes.

Execution has an independent HARMONIARR_INTEGRATION_RECOVERY_EXECUTION_SCHEMA_MODE
policy accepting only empty or migration_template. After the comparison,
migration_template is this suite's default, with explicit empty retained. The
transaction policy and global runtime default remain independent. Malformed
modes refuse before runtime allocation without reflecting their contents.

All seven original execution case bodies remain byte-identical: 16,569 bytes,
SHA-256 `bc5766198b26e9ec7211550cbe1d960403f267d2068545ba5c59ef744e693d86`.
The transaction suite's original nine bodies also remain byte-identical, 16,402
bytes, SHA-256 `106889e188a53ba9fbf88f0c69e0070a37e477a18835d97ab77412ca055d7fb4`.
Current authority/provenance, single-provider dispatch, lost-response/no-second-
POST, required queue/audit rollback and reconciliation assertions are retained.

## Executed evidence

The focused policy/scenario/schema/template/runtime/worker/lifecycle gate passes
69 cases, zero failures/cancellations/skips/TODOs, in 27.479 seconds. Changed
JavaScript lint, test hygiene (1,264 files) and ESM checks pass.

All thirteen selected native controls pass with zero failures/cancellations/
skips/TODOs. Two new controls hold the actual worker first at provider response,
then at returned lease release. The parent observes running then completed
durable status, a released lease and committed transfer links while execution
is still pending. Error/null cancellation does not dispose the live database or
complete scenario timing until the held release and actual worker drain finish.
The next clone from the same template has a different database name/OID, no
previous database, and zero users/candidates/runs/events/discovery/Wanted/
transfer/lease rows; current migration/pool settings and fresh execution succeed.
Exactly one source preparation serves both scenarios in each control.

The unchanged transaction-adoption controls retain committed-state/fault isolation
and reopened-source refusal through the shared adapter. Existing native template
controls retain lineage, active-session, collision, replacement-OID, cancellation
and cleanup proof. Actual native operations are registered and drained before
server release beyond runner cancellation. Expected failure-only records for
controlled Error/null or refused admission are not transport incident diagnoses.

The candidate's same 2,992 source/config inputs remain at aggregate SHA-256
`986fb337b61409ddf78dfdc0c3864715f281a2cc46a5b22aa77ba0586788725a`
through the native controls and before/after every comparison sample. All four
complete seven-case profiles pass: 28 native executions, zero failures/
cancellations/skips/TODOs, with identical case/outcome digest
`859dc3011f5dccd39da5c2ad8311fcdc6b3412c81c1d50ff77cb8817a1b04fc8`.
Every profile records seven successful schema/scenario spans and database drops,
one fresh server start/stop and complete native output. Empty creates seven
databases; template creates eight and separately prepares/drops one source.

| Profile order | Empty elapsed | Template elapsed | Observed local saving |
| --- | ---: | ---: | ---: |
| Empty first | 25.386s | 15.333s | 10.052s / 39.60% |
| Template first | 37.701s | 19.908s | 17.793s / 47.20% |

Seven schema_prepare calls total 10.908s and 18.663s in empty mode, versus 0.198s
and 0.259s in template mode; one source preparation separately takes 1.445s and
2.280s. Per-clone migration checks remain. These timings use the existing file
process adapter with the same additional native reporter and phase observation;
they are not exact bare-command timings. Inclusive spans are not summed as wall
time. Two local pairs and substantial host/order variation do not establish
statistical, hosted-CI or whole-gate speed. No cross-profile SQL projection
digest was added; unchanged assertions and native isolation controls own that
correctness boundary.

Only the execution default and its expected-default unit controls changed after
measurement. The final policy/scenario gate passes 12/12 in 0.356 seconds, zero
skips. The final default and shared-adapter transaction consumer pass all sixteen
native cases with zero failures/cancellations/skips/TODOs and unchanged case
signatures. Final execution phase counts match its candidate template profile.
The two files prepare/drop two sources, perform 21 schema/scenario spans and
drop all 21 scenario databases, with two successful fresh server starts/stops.

Final-source aggregate SHA-256 for the same 2,992 inputs is
`62e66ec0e6f2ab69ee7e1c2a203dd747321c9c9411ccdb272c8508faba5b593e`.
It matches before/after final native execution and after the complete fast gate.
`npm run validate:fast` passes 10,367 cases (5,395 server, 4,384 client, 588 script),
zero failures/cancellations/skips, plus complete lint, static policies and both
builds in 185.781 seconds. Client build completes in 2.92 seconds. Its 225 existing
Vue fixture warnings match the previous gate; no client source changed. Production
dependency audit reports zero known vulnerabilities.

All six final JavaScript hashes match staged bytes, 111 previously frozen source
files remain unchanged, and 747 local links across eleven changed Markdown
documents resolve. Testing/standards repository skills and the installed standards
skill structurally validate; its four maintained files match repository bytes.
Staged whitespace checks pass. Candidate measurements and final validation keep
their distinct source identities and scopes.

The additional native evidence reporter emits the installed Node TestsStream
eleven-end-listeners warning in controls/comparisons/final runs. Native summaries
remain complete and passing; the warning is retained rather than suppressed or
classified as a proved leak. The extra reporter is part of both timed profiles.
The complete native integration population is not replayed by this scoped lane.

Opening and final GitHub MCP collection reads returned zero open PRs. No random
or stale PR was available to implement/rebase; no PR merge or external message
occurred. The existing standards/testing skills receive focused reference
guidance and the historical empty-schema wording is clarified. This is reference
maintenance, not a new blind skill trial or general security/accessibility audit.

## Recommendation and remaining work

Select the existing migration-only template engine for this suite's default,
retaining the scoped empty comparator. Benefits: avoid repeated schema
application while preserving independent commits, pools and fresh worker
authority. Costs: one extra source database,
verification/copy/cleanup and dedicated adoption coverage. The two new native
controls add cases to the complete population, so this is not whole-CI speed proof.

Recommended stack: independent scoped policy → sealed migration-only source →
fresh clone/pool → idempotent schema check → fresh context/seeds → actual worker/
service completion → unchanged assertions → awaited strict release.

Next: audit/instrument music-queue-recovery-discovery.test.js. It still applies
migrations directly per scenario and creates a custom recovery/request/scoped
service context plus an actual discovery worker. Preserve its clock/rediscovery
policy and provider/preparation/ingestion/lease boundaries before evaluating a
separate template or shared-parent adoption. Execution's proof grants neither.

Private evidence remains ignored under `.tmp/recovery-execution-2026-10-15/`.

See [design](RECOVERY_EXECUTION_SCHEMA_DESIGN.md) and
[official research and alternatives](RECOVERY_EXECUTION_SCHEMA_RESEARCH_2026_10.md).

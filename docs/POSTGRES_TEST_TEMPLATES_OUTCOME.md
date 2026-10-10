# Prepared PostgreSQL test database outcome

October 10, 2026, America/New_York. Baseline main: b9f4473.
Separate [design](POSTGRES_TEST_TEMPLATES_DESIGN.md) and
[research](POSTGRES_TEST_TEMPLATES_RESEARCH_2026_10.md) precede runtime edits.

## Baseline and implementation status

The unchanged Wanted suite passes ten cases, zero failures/cancellations/skips,
77.57s complete Node duration (59.34s suite duration). Safe phase records and wall
state are retained in `.tmp/postgres-test-templates-2026-10/wanted-baseline.log`
and `wanted-baseline-state.json`. This observation is separate from the prior
fixture slice's measurements and from a template throughput claim.

## Implemented boundary

The runtime defaults to `schemaMode: 'empty'`. Wanted explicitly selects
`migration_template`; `HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE=empty` retains
its comparison profile. All ten case assertions, thirty variants, fixture seeds,
idempotent per-clone migration checks, independent transactions and deadlines
remain. Migration/bootstrap/recovery and app-global preparation paths are separate.

Four new narrow ESM modules own actual input fingerprints, pool-bound complete
ledger/key verification, maintenance SQL and private template lifecycle. The
migration-only source is created from template0; no scenario data or workers run
against it. New connections are sealed, zero active sessions are observed, and
source OID/role/configuration plus repository inputs are verified before cloning.
No IS_TEMPLATE grant or cross-run cache is introduced. Clone connections are
explicitly enabled; every clone gets its own pool and maintenance connection.

Source credentials/environment are captured before use. Clone operations register
before awaits; cleanup closes admission, drains registered work, then removes
the positively created source and runtime-owned server. External mode does not
own that server. Strict selected-mode cleanup refuses otherwise successful work
after pool/drain/drop failure, while the original setup/work error retains priority.
Unknown source OID emits incomplete cleanup evidence without destructive guessing.
Observed replacement identity refuses both cloning and deletion of the replacement.

## Validation and corrections

| Boundary | Executed evidence |
| --- | --- |
| Input and pool-bound preparation | 16 focused tests passed |
| Template owner/store | 24 focused tests passed |
| Existing runtime/temporary DB/phase observer plus new controls | 25 focused tests passed |
| Combined focused group | 65 passed, zero failures/cancellations/skips; scoped 15-file lint passed |
| First real PostgreSQL group | 16/18 passed; two credential-configuration mistakes retained |
| Smallest corrected credential cases | 2/2 passed with original refusal predicates |
| Corrected complete affected PostgreSQL group | 18/18 passed, two suites, zero failures/cancellations/skips, 35.77s |
| Dedicated untemplated snapshot bootstrap | Passed, 105/105 migrations applied |
| Stable complete `npm run validate` | Passed 9,783 tests: 4,535 server, 4,377 client, 525 script, 346 integration; zero failures/cancellations/skips; all checks and both builds passed |
| Security | Passed; zero reported npm vulnerabilities |
| Maintained skills | Source/installed structural validation passed; all four standards files match by SHA256 |

Peer review found an asynchronous pool-creation cancellation seam. Its adverse
control failed before the guard, then passed after checking cancellation before
scenario/preparation work. Additional guards preserve exact Error/null reasons,
refuse pre-aborted startup and keep later environment mutation from redirecting
clone connections. Source reread is clear; no application/schema/dependency change
or deadline/assertion weakening was required.

The first PostgreSQL group accidentally built two clients by spreading internal
`pool.options`. Installed pg-pool deliberately makes password non-enumerable,
so both failed SCRAM authentication rather than exercising sealing. The correction
uses the owned connection configuration and selected source database. Both
original predicates then pass, including actual source connection denial and
non-quiescent-source refusal. Failed logs remain separate from passing coverage.

Real controls prove source preparation once, distinct clone identities/pools,
row/trigger/lease isolation, sealed-source connection refusal, preparation and
input drift refusal, active-session refusal, collision/sibling preservation,
cancellation/primary-error cleanup and replacement-OID protection. Controlled
cleanup failures are expected adverse populations, not clean spans.

## Measured comparison and recommendation stack

Both Wanted profiles pass the same ten cases/thirty variants on local PostgreSQL
18.3 Alpine, Node24.18.1/npm12.0.2, with 105 unchanged migrations.

| Observation | Empty/migration profile | Selected template profile |
| --- | --- | --- |
| Wanted suite duration | 59.34s | 17.89s |
| Repeated per-case migration/check sum | 43.63s | 0.69s |
| Per-case schema/check median | 1,470.02ms | 21.94ms |
| One source migration preparation | None | 1.26s |
| Thirty database creations | 1.54s; median 48.50ms | 3.50s; median 111.95ms, including admission |

The template replaces 43.63s of repeated migration work with 1.26s preparation
plus 0.69s idempotent checks. Creation is more expensive because it includes
fingerprint/seal admission and copying. Its nested 0.87s verification sum must
not be added twice. Container starts differ (4.38s versus 3.20s); these are one
local paired observation, not statistical parity, CI capacity or a whole-gate
speedup promise. The complete baseline Node duration also includes runner costs;
phase/suite durations must not be conflated with it.

The final complete integration population took **22m55s** and complete validation
took **25m24s** wall time. This run does not demonstrate a whole-gate speedup over
earlier recorded gates. Wanted's paired setup/suite improvement is the measured
result; broader file/server startup, media and workload costs need their own
attribution. The new eight-case acceptance file adds coverage to the population.

Promote only Wanted's explicit template selection. Keep focused/fast feedback,
real PostgreSQL boundary checks and one stable complete serial gate. Benefits:
less repeated schema work, preserved real commits/races, private sealed source
and truthful cleanup. Costs: admission I/O, clone copying and explicit ownership;
template preparation does not replace independent migration/bootstrap coverage.

Next: design a parent-owned PostgreSQL launcher for serial file subprocesses,
with child database ownership and parent-only server shutdown. Measure startup
and validate child failure/drain before adoption; do not increase workers or share
mutable scenario state. Further suite adoption needs its own preparation/seed and
isolation proof. Discovery-request recomputation remains the next product boundary.

## Evidence and limits

Ignored records are under `.tmp/postgres-test-templates-2026-10/`; backend input
controls are under `.tmp/migration-template-2026-10/`. `phase-comparison.json`
selects Wanted's actual correlation family, separating it from adverse acceptance
cases. Baseline, first failed acceptance, two-case correction and complete affected
group logs/states remain distinct. Final cleanup at **18:10:40 UTC** found no
integration processes or Testcontainers resources; user resources were untouched.
All 15 frozen code-file hashes remained identical through validation. Commit and
remote publication verification are reported with final Git state.

Final evidence: `.tmp/postgres-test-templates-2026-10/final-validation-evidence.json`.
Complete gate log SHA256:
`47c93ebf2b23558c4bbcaee7292fb88281a20b9800f73cbef8b92179526fbeac`.
Baseline log SHA256:
`c449e3af8b17560912e7fa4a0e823788873671aed4ac2f0900f8c798fcacd507`.
Initial failed acceptance SHA256:
`282d6513a0f256fe8e7b5b55e6ed1cffce8571b4679548409facb160d09a7262`.
Corrected complete acceptance SHA256:
`95fd5ac5f91b23587f3173fd1b74cc64e3a18fb0f17ec6c91b4228cbca23cd07`.
Phase comparison SHA256:
`42e5f27aa19781e51bf4458ead51e7feced05018e2c329905d0aa480dbfc527c`.
The manifest separately inventories bootstrap, security, source/skill identity
and actual red/green evidence. Overlapping focused counts are not added to 9,783.

Sealing is not protection from another privileged administrator. Identity checks
refuse observed replacement, not arbitrary concurrent administrative tampering.
Unabortable SQL and unreleased checked-out-client pool shutdown remain limits.
An acknowledged source whose OID cannot be read is not destructively guessed;
external-mode cleanup uncertainty must be reported, while an owned container can
still be stopped. Native output is independent from bounded phase records.
No UI or full W3C/WCAG conformance is claimed by this testing-only work.

The standards/testing skills are maintained without changing entry-point metadata
or invocation policy. Structural/source-installed checks remain distinct from
executed helper/database evidence and a new blind behavioral skill trial.
Fresh PR applicability is separate: [design](OPEN_PR_APPLICABILITY_TEST_TEMPLATES_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_TEST_TEMPLATES_2026_10_OUTCOME.md).

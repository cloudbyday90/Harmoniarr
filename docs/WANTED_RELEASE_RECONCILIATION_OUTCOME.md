# Current-owned wanted-release replacement outcome

October 10, 2026, America/New_York. Clean main baseline:
96d1f56fd7221702aab57a2faeb6fa9524e7f320. Separate
[design](WANTED_RELEASE_RECONCILIATION_DESIGN.md) and
[research](WANTED_RELEASE_RECONCILIATION_RESEARCH_2026_10.md) record decisions,
tradeoffs and official sources. The final corrected serial gate is complete;
the separate test-efficiency outcome records the accelerated local benchmark.

## Implemented boundary

Wanted reconciliation is now the transaction owner. It captures optional genuine
worker context before awaits, explicitly sets READ COMMITTED, checks maintenance
through the same client, locks participating operation/lease authority when present,
then acquires shared wanted/discovery publication admission. Explicitly provided
null, undefined or malformed context refuses; omitted context retains the internal
direct rebuild contract. Scan, ordinary discovery and metadata refresh forward
their actual original acquisitions. Scoped recovery keeps its global-rebuild skip.

The new reader uses the existing wanted calculator and a narrow complete metadata
projection method backed by existing repository SQL and presentation mappers.
Every source reader uses that client. Monitoring, artist payload, selections and
overrides are copied before later awaits. Frozen decision inputs and derived wanted
rows are recomputed before DELETE, bulk upsert, link sync and final checks. Changed
policy/profile, metadata, availability or output refuses the pass. Only exact
metadata_not_found/404 from artist lookup keeps the missing-artist behavior.

Persistence is extracted from the large read store into a narrow ESM write store.
It copies values before admission, builds paired arrays from the same rows,
verifies expected deleted composite identities and complete bulk returned keys,
and stamps SQL mutation time. Existing wanted UUIDs remain on conflict. Required
link synchronization uses the same client, retaining existing consent/search
evidence. Failure or final refusal rolls rows and link changes back together.
Raw ownership pairs are normalized by UUID value before deduplication and SQL
comparison, preserving PostgreSQL-accepted restore spellings and last-value
handling for equivalent pairs.

Authorized backup restore stays raw under its own maintenance authority and saved
snapshot contract. It joins publication admission and atomic link synchronization
without current-policy recomputation or a worker lease. Raw discovery replacement
also acquires admission before parent mutations, coordinating the two publishers
that synchronize these links. Its outside source lookup remains a follow-up.

All new first-party code is ESM. No schema, dependency, route, UI or deployment
change is introduced. Existing wanted policy and disabled-account projection
semantics remain; desired rows do not grant downstream acquisition authorization.

## Validation evidence

| Evidence | Result |
| --- | --- |
| New/refactored source modules, scoped lint | Passed |
| Caller/module wiring first focused pass | 99 passed, zero failures/skips |
| Wanted owner/reader/policy/raw-store focused controls | 68 passed, zero failures/skips |
| Corrected complete new PostgreSQL suite | 9 passed, zero failures/skips |
| Related PostgreSQL group, seven suites plus three consumer files | 54 passed, zero failures/skips |
| Full validation and both builds | Final corrected gate: 9,659 passed; zero failures/cancellations/skips; both builds passed |
| Security | Passed, zero npm vulnerabilities |
| Standards skill structure/installed identity | Passed, including final four-file resync |

Raw source/PR records and root validation logs are under
`.tmp/wanted-release-reconciliation-2026-10/`; backend targeted logs are under
`.tmp/wanted-reconciliation-2026-10/`. Exact final commands, counts and first
failure/correction are recorded below. Saved research and design
preceded the new runtime, test and skill edits.

Focused command:
`node --test test/server/library-wanted-release-owner.test.js test/server/library-wanted-release-service.test.js test/server/library-wanted-release-store.test.js test/server/library-discovery-request-store.test.js`.
The initial 64-test pass and pre-review 65-test pass are retained in
`wanted-focused-first.log` and `wanted-focused-final.log`. The added composition
case uses an injected client through actual reader/owner/facade/write modules;
it proves wiring, not database concurrency. Pure projection oracles remain unchanged.
After the UUID correction, the same focused command passes 66 in
`wanted-uuid-alias-focused.log`; isolated green and four-file lint are retained
in `wanted-uuid-alias-green.log` and `wanted-uuid-alias-lint.log`.

The first eight-scenario PostgreSQL run failed with four passes, three failures
and one cancelled case. Fixtures omitted a non-enumerable pool password, used an
incorrect restore lock type, and omitted required recording identity for an
override. An unreleased pause masked that SQL error as a timeout. Explicit password,
the real restore lock type, seeded recording identity and pause draining corrected
the harness. Four affected cases passed in isolation, then the original complete
eight-case command passed with zero failures/skips. Those fixture corrections
needed no runtime fix or assertion relaxation. A final fixture pins the SQL fault to the sorted second
bulk row, proving rollback after a prior row. Retain `backend-postgres-first.log`,
`backend-source-drift-repro.log`, `backend-fixture-correction.log` and
`backend-postgres-corrected.log`; the final related group includes that control.

Final caller command:
`node --test test/server/library-scan-worker.test.js test/server/library-discovery-worker.test.js test/server/library-module.test.js test/server/metadata-refresh-service.test.js test/server/metadata-module.test.js test/server/non-import-worker-lease-acquisition.test.js`.
Final database command:
`node --test --test-concurrency=1 test/integration/library-wanted-release-reconciliation.test.js test/integration/library-release-reconciliation.test.js test/integration/library-file-match.test.js test/integration/library-tag-snapshot.test.js test/integration/library-scan-catalogue.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/library-organize-mutation.test.js test/integration/operator-shared-discovery-correlation.test.js test/integration/missing-music-decision-query-store.test.js test/integration/music-queue-selection-concurrency.test.js`.
The pre-review 53 comprise new wanted 8, prior guarded/post-apply 42 and three consumer
controls. Retain `backend-postgres-final.log`, `backend-focused-final.log` and
`backend-eslint-final.log`. Focused/targeted counts overlap the full run.

A later source review found a separate production compatibility defect: raw
restore compared PostgreSQL UUID values with their original input strings.
Uppercase, braced or compact UUIDs could falsely refuse complete replacement;
equivalent spellings could also evade last-value deduplication. The isolated unit
and actual PostgreSQL cases both failed against that source. The policy/raw-store
fix canonicalizes ownership pairs before deduplication and SQL arrays, while
ordinary source/worker validation remains strict. The same actual PostgreSQL
case now passes, preserving canonical returned pairs, wanted row UUID and full
retained link/evidence. Retain `wanted-uuid-alias-red.log`,
`backend-restore-uuid-red.log` and `backend-restore-uuid-green.log`.
The original complete PostgreSQL command now passes all nine cases in
`backend-postgres-canonical-uuid.log`. The original caller command again passes
99 in `backend-focused-after-uuid.log`.
The same related database command passes 54 across seven suites in
`backend-postgres-final-uuid.log`, with zero failures, cancellations or skips.

The first full validation process was deliberately stopped to fix this review
finding; its exit -1 is an interrupted gate, not a test failure. Retain
`full-validate-first.log`. Revised focused/database commands pass. The fresh full
gate, `npm.cmd run validate`, completed with exit 0 at October 10, 2026,
13:01:23 UTC / 09:01:23 EDT. It passes 9,657 tests: 4,432 server, 4,377 client,
513 scripts and 335 PostgreSQL integration, with zero failures, cancellations
or skips. Copyright, migration naming/ID policy, schema snapshot, ESM, image tag,
topology, lint and test hygiene checks pass; client and server builds pass.
It used `HARMONIARR_INTEGRATION_MEDIA_IMAGE=harmoniarr-quality-fallback:local`.
Retain `full-validate-final.log`, SHA256
`87c9bc9a1600c63317f12c4ff8042846dc61d34e24b038863d9a80a6d20b73fb`.

That successful gate also emitted a node-postgres warning in the new wanted
suite: overlapping queries on one active client use a deprecated queue that will
be removed in pg 9. The same-client reader retained parallel artist/policy reads,
and its new narrow metadata method also overlapped groups/releases. Sequential
awaits are the appropriate driver-compatible contract. Two isolated
non-reentrant-client regressions failed against the prior source, then pass after
the correction: one covers multiple artists and policy/availability reads; the
other composes the actual metadata reader, repositories and presenters. Retain
`wanted-client-overlap-red.log`, `wanted-client-overlap-green.log`,
`wanted-metadata-overlap-red.log` and `wanted-metadata-overlap-green.log`.
The caller command again passes 99 in `backend-focused-sequential-reader.log`.
The original four-file focused command passes 68 in `wanted-client-serial-focused.log`;
scoped test lint passes in `wanted-client-serial-lint.log`. The original complete
PostgreSQL wanted command again passes nine in
`backend-postgres-sequential-reader-nine.log`.
The same related group passes 54 in `backend-postgres-sequential-reader-final.log`,
with zero failures/cancellations/skips. Neither PostgreSQL log contains the
overlapping-client deprecation. The subsequent full gate is recorded below;
the successful pre-correction full log remains unchanged.

Final corrected gate: `npm.cmd run validate` completed with exit 0 at October 10,
2026, 13:31:54 UTC / 09:31:54 EDT. It passes 9,659 tests: 4,434 server, 4,377
client, 513 scripts and 335 PostgreSQL integration, with zero failures,
cancellations or skips. All required static/lint/hygiene checks and both builds
pass; the overlapping-client deprecation is absent. Retain
`full-validate-sequential-reader.log`, SHA256
`5a4f6e5f69d303de44529f0aade6565e2cea550c79879e0c50f8b98891437ca4`.
Its integration phase took 1,123.47 seconds; the separate
[efficiency outcome](TEST_EXECUTION_EFFICIENCY_OUTCOME.md) records the operator's
subsequent test-speed request and complete local parallel benchmark.

`npm.cmd run validate:security` passes with zero npm vulnerabilities in
`security-first.log`. Both source/installed skill packages pass quick_validate;
final byte identity for all four files is retained in
`skill-final-client-sync-hashes.json`. Final documentation checks pass 338 local
links across 16 staged Markdown files. The maintained testing skill also passes
structural validation after the feedback-workflow update.
These structural/security checks
have their stated scope, not full standards conformance or vulnerability absence.

Actual fixture engine: PostgreSQL 18.3 Alpine x86_64. Host: Node 24.18.1/npm
12.0.2. These are executed observations, not production or latest-patch claims.
Schema stays at 105 migrations. The freshly inspected local media fixture is
`harmoniarr-quality-fallback:local`, image ID
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.

## Standards skill and PR applicability

The practical [standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
references map multi-caller authority, composite ownership, complete same-client
inputs, early capture and atomic link publication. Its separate
[design](WEB_STANDARDS_SKILL_DESIGN.md) and [outcome](WEB_STANDARDS_SKILL_OUTCOME.md)
record structural validation and installed identity, distinct from database or
browser conformance evidence.

Fresh open-PR discovery and local applicability are separate
[PR design](OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_DESIGN.md) and
[PR outcome](OPEN_PR_APPLICABILITY_WANTED_RELEASE_2026_10_OUTCOME.md).

## Recommendation stack and limits

Keep the existing ESM operation workers, genuine captured caller context, narrow
queryable reader and unchanged calculator, explicit READ COMMITTED, shared request
publication admission, full input/output revalidation, verified paired bulk writes
and atomic required link synchronization. This protects observed policy stability,
per-user identity and replacement ordering while preserving authorized restore.
Costs include several whole-source component reads and serialized publication;
observed drift refuses rather than adopting a new source halfway through a pass.

This is component-snapshot freshness, not one global instant or strict latest state
at commit. Later source commits can require another pass. Other manual/FK/source
writers are not all fenced, and universal deadlock freedom is not claimed. Earlier
metadata/file/availability commits and later acquisition remain separate owners.
W3C informs truthful existing job status; these backend tests add no browser,
assistive-technology or full WCAG conformance claim.

After the operator's test-efficiency request, immediate engineering priority is
fixture timing, prompt failure diagnostics and measured database setup ownership;
see the [efficiency outcome](TEST_EXECUTION_EFFICIENCY_OUTCOME.md).

Next product boundary: guard discovery-request replacement after its awaited source calculation.
Shared publication admission serializes its parent/link writes but does not refresh
the outside captured wanted/request/availability/search state. Reproduce an older
body resuming after a newer projection and preserve active recipients, saved
consent, manual intent, recovery scope and search evidence. This remains a source
finding, not an executed downstream race in this slice. Embedded artwork follows.

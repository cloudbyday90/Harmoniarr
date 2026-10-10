# Acquisition-owned release reconciliation outcome

Client task date: October 10, 2026, America/New_York. Clean main baseline:
29fa665efcf050fd58612c1e5a0d67c408bbab39. Separate
[design](RELEASE_RECONCILIATION_DESIGN.md) and
[research](RELEASE_RECONCILIATION_RESEARCH_2026_10.md) record alternatives,
primary sources and the selected freshness contract. Full validation completed
at 04:46:49 UTC / 00:46:49 EDT on October 10, 2026, with no application failures.

## Implemented boundary

The scan worker passes its original acquisition, requested/canonical roots and
verified catalogue root UUID. The existing release service is the transaction
owner. It captures that context before awaits, explicitly sets READ COMMITTED,
checks same-client maintenance readiness, locks run/advisory key/lease and global
projection admission, then refreshes context and database clock. The root is
compared without adding dependency row locks.

A new coverage SQL store retains the seven-table global query. A narrow policy
maps and freezes unique release rows with existing complete/partial/duplicate
precedence, counts and evidence. The owner accepts no precomputed aggregate.
Fresh global reads before deletion, before batch upsert and after writes reject
changed output; each read is followed by current authority and clock checks.

The raw writer shares the global transaction advisory key in supplied-client and
standalone modes. It copies values before waits, verifies deletion against current
target IDs, and batches all upserts through UNNEST with exact returned identities.
Current empty coverage still deletes obsolete rows. SQL, source, authority or
incomplete-write refusal rolls deletion and all upserts back together and stops
later wanted/request reconciliation from that invocation.

New modules separate context/coverage policy, source SQL, admission and authority
reads from persistence. All first-party code is ESM. No migration, dependency,
route, UI or deployment change is required.

## Executed evidence

| Evidence | Result |
| --- | --- |
| Six new/refactored reconciliation source modules, scoped lint | Passed |
| Owner/policy/raw-store focused tests | 43 passed, zero failures/skips |
| Worker/module and related acquisition cohort | 83 passed, zero failures/skips |
| First new PostgreSQL suite | 8 passed, zero failures/skips |
| Related PostgreSQL group, six suites | 42 passed, zero failures/skips |
| Full repository validation and both builds | 9,609 passed, zero failures/skips; both builds passed |
| Security | Passed, zero npm vulnerabilities |
| Standards skill source/installed validation and four-file identity | Passed |

Ignored logs and MCP source/PR artifacts are in
`.tmp/release-reconciliation-2026-10/`. Commands, counts and the lint-only
correction are recorded below. The research draft and design
were read before new runtime, test and skill maintenance in this slice.

Focused commands: `node --test test/server/library-release-reconciliation-service.test.js test/server/library-release-reconciliation-store.test.js`
and `node --test test/server/library-scan-worker.test.js test/server/library-module.test.js test/server/non-import-worker-lease-acquisition.test.js`.
The first new database command is
`node --test --test-concurrency=1 test/integration/library-release-reconciliation.test.js`.
The first focused 42-test pass and final 43-test pass are both retained; the
additional case composes the actual owner/coverage SQL/raw writer through a
double client. It proves wiring, not actual database concurrency. No application
test failure occurred in those commands. Formatting checks corrected line-ending
noise and Markdown EOF blanks without runtime semantic changes.
The initial five-file backend lint found a fixture local shadowing the imported
test hook. The local was renamed and the same scoped command passed; retain
`backend-lint-first.log` and `backend-lint-final.log`. No application behavior
or assertion was relaxed for this correction.

Actual new-suite diagnostic: PostgreSQL 18.3 on Alpine x86_64. The host is Node
24.18.1/npm 12.0.2. These are executed fixture/host observations, not production
version or latest-patch claims. Schema stays at 105 migrations. The freshly
inspected local media image is `harmoniarr-quality-fallback:local`, ID
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
Focused and targeted counts overlap the full repository run.
The related database command is
`node --test --test-concurrency=1 test/integration/library-release-reconciliation.test.js test/integration/library-file-match.test.js test/integration/library-tag-snapshot.test.js test/integration/library-scan-catalogue.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/library-organize-mutation.test.js`.
Its 42 tests comprise 8 release, 8 match, 8 tag, 8
catalogue, 1 post-apply and 9 organize cases. Retained logs:
`backend-postgres-first.log`, `backend-postgres-final.log`,
`backend-focused-final.log`, `reconciliation-focused-first.log` and
`reconciliation-focused.log`.

`npm.cmd run validate` passed once using the media fixture environment above:
4,393 server + 4,377 client + 513 script + 326 PostgreSQL integration tests =
9,609. All required lint, copyright, test hygiene, migration/schema, ESM and
Compose policy checks and both builds passed. `npm.cmd run validate:security`
also passed. Logs: `full-validate-first.log` and `security-first.log`. No runtime
or test assertion changed after these successful gates. No broad application
failure/correction cycle occurred.

Final skill structure and installed four-file identity are retained in
`skill-source-final-validation.log`, `skill-installed-final-validation.log`
and `skill-final-sync-hashes.json`. Documentation links and staged whitespace
are checked before commit. Work stays on main without a branch, release, tag,
deployment or PR merge. Release creation requires explicit workflow dispatch.

## Standards skill and PR decision

The practical [standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
references now distinguish global replacement admission from source-writer
coordination, current statement snapshots from transaction-start snapshots, and
query-snapshot freshness from commit-fresh coverage. Its separate
[design](WEB_STANDARDS_SKILL_DESIGN.md) and [outcome](WEB_STANDARDS_SKILL_OUTCOME.md)
own structural validation and installed-copy identity, not database or browser
conformance claims.

Fresh open-PR discovery, immutable comparisons and local replay applicability
are separate [PR design](OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_DESIGN.md)
and [PR outcome](OPEN_PR_APPLICABILITY_RELEASE_RECONCILIATION_2026_10_OUTCOME.md).
The final MCP refresh at 04:44:56 UTC / 00:44:56 EDT returned three open PRs,
then an empty page. PRs 23, 24 and 40 have unchanged head/base/file scopes and
were already locally replayed. No eligible random draw or new replay applies.

## Recommendation stack, tradeoffs and limits

Keep the existing ESM worker/operation-run system, original scan context, narrow
SQL/policy/service boundaries, explicit READ COMMITTED, global advisory admission,
fresh aggregate comparisons, shared transactions and complete returned identities.
This protects replacement ordering and atomic cleanup/publication, while batch
upsert keeps aggregate revalidation bounded. Costs include holding scan authority
and global admission through several global reads; source drift refuses the pass.

Source producers remain free. The invariant is current committed coverage at
each query snapshot, not strict latest coverage at commit: a source commit after
the final read can require another pass. Broad table barriers, automatic cached
retries and a second operation system were not introduced. Earlier file/tag/match
and artwork commits remain committed. Later wanted/request fulfillment is still
a separate owner. W3C supports truthful existing job status; no frontend change,
speech check or full WCAG claim follows from these backend tests.

Next: guard wanted-release replacement against stale operator intent and
availability. `library-wanted-release-service.js` reads monitoring, artist data,
release selections, track overrides and reconciliation rows through awaited work,
then its store starts a separate DELETE/upsert transaction. It is called by scan,
discovery and metadata refresh paths, so preserve each caller's authority contract
instead of making all work depend on a scan lease. Reproduce held-A/newer-policy-B
replacement refusal, preserve current desired state and legitimate empty cleanup,
and design fresh operator policy/availability comparisons at the owner.

Discovery request replacement and embedded artwork assignment/clearing remain
further follow-ups. These are source findings, not executed downstream races or
proof of an acquisition-policy bypass in this slice.

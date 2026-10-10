# Acquisition-owned file-match outcome

Work began October 9 local / October 10 UTC, 2026, on clean main
95cae708cf736490057fcb0769e79c89abb02e75. Separate
[design](FILE_MATCH_DESIGN.md) and [research](FILE_MATCH_RESEARCH_2026_10.md)
record alternatives and official guidance. Full validation completed at
2026-10-10 03:54 UTC / October 9, 23:54 EDT, with no application failures.

## Implemented behavior

The scan worker passes its original acquisition, requested/canonical roots and
verified root UUID into matching. The matcher captures observed source tuples,
nullable tag JSON and optional release scope before metadata lookup. It uses
those frozen inputs for the existing strategies and requires the owning writer.

New narrow ESM policy, owning service and guard store validate complete results,
maintenance readiness, running/noncancelled scan, original acquisition, current
catalogue/tag source and relevant saved release hints. Root-before-sorted-files
locking follows existing catalogue/tag/organize writers. Fresh database time is
checked after locks, before SQL and after writes.

Batch upsert uses the same client, repeats source/tag predicates and verifies
exact returned file identities. Partial or stale rows, SQL errors and final
authority/time refusal roll back the batch. Refusal stops later release/wanted/
request reconciliation for that invocation. The internal raw writer retains
standalone transaction and last-value deduplication behavior.

The post-apply integration harness previously returned simulated extracted tags
without saving them. It now persists controlled tags through the actual tag
snapshot owner before matching, exercising the current-source guard without
weakening it. No schema, dependency, route, UI or deployment changes are needed.

## Validation evidence

| Evidence | Result |
| --- | --- |
| Four new/refactored match source modules, scoped ESLint | Passed |
| Owner/policy/raw writer focused checks | 50 passed, zero failures/skips |
| Matching strategies, worker/module and related cohorts | 96 passed, zero failures/skips |
| Real PostgreSQL, first new suite | 8 passed, zero failures/skips |
| Related PostgreSQL group, five suites | 34 passed, zero failures/skips |
| Full repository validation | 9,565 passed, zero failures/skips; both builds passed |
| Dependency security | Passed, zero npm vulnerabilities |
| Standards skill source/installed validation and four-file identity | Passed |

Ignored logs and raw source/PR evidence are in `.tmp/file-match-2026-10/`.
The targeted commands are:

- `node --test test/server/library-file-match-service.test.js test/server/library-file-match-store.test.js`
- `node --test test/server/library-file-matcher-service.test.js test/server/library-scan-worker.test.js test/server/library-module.test.js test/server/non-import-worker-lease-acquisition.test.js`
- `node --test --test-concurrency=1 test/integration/library-file-match.test.js`
- `node --test --test-concurrency=1 test/integration/library-file-match.test.js test/integration/library-tag-snapshot.test.js test/integration/library-scan-catalogue.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/library-organize-mutation.test.js`

The 34 comprise 1 post-apply, 8 match, 9 organize, 8 catalogue and 8 tag tests.

Actual database diagnostic: PostgreSQL 18.3 on Alpine x86_64. The host is Node
24.18.1/npm 12.0.2. These are executed fixture/host observations, not production
version or latest-patch claims. The existing local media fixture image is
`harmoniarr-quality-fallback:local`, freshly inspected as
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
Schema remains at 105 migrations. Focused counts overlap broader validation.
No application test failure occurred in these targeted commands. Hygiene checks
identified Windows line-ending noise and one extra EOF blank; corrections changed
no runtime semantics. Skill copies were synchronized again after normalization.
`npm.cmd run validate` passed once with the media fixture environment above:
4,357 server + 4,377 client + 513 script + 318 PostgreSQL integration tests =
9,565. All required lint, test hygiene, copyright, migration/schema, ESM and
Compose policy checks and both builds passed. `npm.cmd run validate:security`
also passed. Retained full evidence: `full-validate-first.log`; security evidence:
`security-first.log`. There was no broad application failure/correction cycle,
and no runtime or test assertion changed after these successful gates.
Final skill structure and four-file identity are retained in
`skill-source-final-validation.log`, `skill-installed-final-validation.log`
and `skill-final-sync-hashes.json`. Documentation links and staged whitespace
are checked before commit. Work stays on main without a branch, release, tag,
deployment or PR merge; release creation requires explicit workflow dispatch.

## Standards skill and PR applicability

The existing practical [standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
is extended with capture-before-await, nullable structured-value comparisons and
this owner/evidence map. See its separate [design](WEB_STANDARDS_SKILL_DESIGN.md)
and [outcome](WEB_STANDARDS_SKILL_OUTCOME.md). Initial generic test-fixture and
skill-reference maintenance began under the implementation assignment before the
new research ledger was saved; new match runtime work followed the saved research
and design. No new blind skill trial or standards conformance is claimed.

Fresh random-PR eligibility and head/base/file evidence are recorded separately
in [PR design](OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_DESIGN.md) and
[PR outcome](OPEN_PR_APPLICABILITY_FILE_MATCH_2026_10_OUTCOME.md).
The precommit MCP refresh at 03:51:32 UTC / October 9, 23:51:32 EDT returned
three open PRs then an empty page, with unchanged head/base pairs for 23, 24 and
40. Their scopes are already locally replayed: no eligible draw or new replay.

## Recommendation stack and next item

Retain the existing ESM scan worker, PostgreSQL transactions/consistent row locks,
captured acquisition/source policy, semantic JSONB CAS and complete returned-ID
checks. This adds bounded comparison/locking cost and refuses the entire batch
when one file is stale; it avoids long metadata work under database locks.
OWASP authorization principles support the current server-owned write boundary;
W3C remains relevant to truthful existing job status. No browser change follows.

This compares saved catalogue/tag source, not physical byte identity or a metadata
candidate snapshot. Earlier catalogue/tag commits and sidecar artwork remain;
commit acknowledgement can cross a later expiry instant. Later reconciliation
and artwork effects need their own ownership designs.

Next: guard release reconciliation persistence. Source inspection of
`library-release-reconciliation-service.js` shows an awaited global coverage read,
then `replaceLibraryReleaseReconciliations` starts a separate transaction deleting
absent releases and upserting counts without the original scan context. An old
aggregate can affect availability before wanted/request reconciliation. Reproduce
held-A/newer-B refusal for both DELETE and upsert. Design current acquisition,
maintenance/cancellation/time guards and fresh coverage/serialization at the
owning transaction; checking a token alone does not establish global coverage
freshness across producers. Preserve current complete/partial/duplicate outcomes.

Embedded artwork assignment and no-picture clearing follow: its service assigns
after awaited ingestion and clears by file ID without a captured scan/source
frame. Both priorities are source findings, not executed downstream races in this
slice. Already-ingested asset retention/cleanup needs its own design.

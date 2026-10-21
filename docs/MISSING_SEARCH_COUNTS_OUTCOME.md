# Unit-aware shared-search count outcome

Date: 2026-10-20. See the separate [design](MISSING_SEARCH_COUNTS_DESIGN.md),
[research and tradeoffs](MISSING_SEARCH_COUNTS_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_MISSING_SEARCH_COUNTS_OUTCOME.md).

The actual mixed `Filtered` display was in advanced Activity > Wanted. It now
shows separate response/file cause counts and fixed messages, using a focused
presenter instead of rendering arbitrary reason-code arrays. The old helper lost
its duplicated message/count logic. Canonical Missing Music now receives bounded
counts through its authorized detail DTO, client composable normalizer and a small
Last recorded search component with a semantic description list.

The shared slskd numeric projection was extracted from external diagnostics; its
external wrapper retains the positive-response restriction. Recorded zero counts
remain evidence, not a new permission or proof of final publication. Missing or
inconsistent required counts and successful candidate results are omitted.
Canonical history is hidden after ready/new work, a later failure or a pending
continuation. Private peer/path/query data and supplied reason strings are dropped.

Existing actor/recipient scope, disabled-account history, command eligibility,
cooldown, attempts, and explicit actions remain unchanged. This is a read-only
projection with no new migration, dependency, queue or command.

Validation used Node 24.22.0/npm 12.0.2:

- The complete stable `validate:fast` gate passed: 5,591 server, 4,403 client and
  697 script tests (10,691 total), zero failures/cancellations/skips, plus static
  checks, full lint and both builds. Test phases took 67.4/11.5/7.6 seconds.
- The PostgreSQL/HTTP selection covered 13 unique cases. The broad candidate was
  12/13 in 38.0 seconds: the new fixture tried to persist operation-run-like states
  rejected by discovery's real CHECK constraint. Using ready/cooldown/blocked plus
  failure/continuation evidence, the corrected owning case passed in 6.6 seconds.
  The other 12 search-again/external-recovery cases passed and were not repeated
  for this fixture-only correction. No database guard or timeout was weakened.
- The new native case uses real sessions, PostgreSQL, recorded search success and
  the actual scoped detail endpoint. It proves own/admin reads, unrelated-target
  404, anonymous 401, disabled history/read-only permission, no private evidence,
  and suppression after ready, failure or pending continuation. Attempts, research
  count, next-search deadline and operation-run count remain unchanged by reads.
  This is persisted diagnostic/HTTP evidence, not a new native provider search.
- Four unique browser cases were covered. The two existing Activity Releases/
  Wanted cases passed in the broad candidate. The two new canonical/advanced
  cases initially exposed the omitted client DTO field and a non-adjacent term/
  value selector; the next run exposed an ambiguous Refresh selector. After those
  corrections, both owning cases passed in 9.7 seconds. They prove six separate
  unit/cause labels in the actual advanced view and canonical inspector, omission
  of raw/private reasons, Refresh removal of old evidence, retained focus and no
  submitted mutation. Controlled API projections render in the real app shell.
- The 390px canonical screenshot was inspected with no observed overflow.
  Description-list relationships are checked in the DOM; screen-reader output
  and full WCAG conformance were not tested.
- 165 focused projection/presentation/service/composable controls passed before
  the stable gate. The shared normalizer's external wrapper retained its existing
  positive-response behavior in unit and PostgreSQL recovery coverage.
- The existing standards AI skill now records actual surface ownership, DTO/
  composable traversal, valid discovery fixture states and adjacent semantic
  count assertions. Structural skill validation passed.

All development failures and passing corrections remain private under
`.tmp/missing-search-counts-2026-10-20/`. A fixture variable shadowing the test hook
was also corrected before the stable lint gate. No broad media/transfer matrix
was repeated for this diagnostic read change.

Frozen source: 3,165 files,
`e449173a35791ca0d68f9f974d28b1f9e8abc8065659af4a1fd7a6704f15225a`.
All 15 changed code/test files are byte-verified. Native/browser checks preceded
line-ending normalization with unchanged logic; the complete fast gate and Docker
image use final bytes. Packaged identity/readiness details are recorded separately.

Random PR #48 remains unapplied: fresh MCP metadata/complete patch and local
package/lock/installed Vue consumer checks match the retained failing TypeScript 7
candidate and passing TypeScript 6 control. No PR merge, closure or rebase, new
branch, dependency/version change, tag or release was created.

The subsequent [correction outcome](MISSING_SEARCH_CORRECTIONS_OUTCOME.md)
completes role-aware review destinations for ignored-source and malformed-response
causes in canonical Missing Music. It preserves requester scope and explicit
policy ownership; counts do not authorize ignore changes, quality relaxation or
another provider search. That record owns the next follow-up.

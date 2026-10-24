# Candidate search revision outcome

October 24, 2026. Implements the writer-invariant step of the previous
[query-plan follow-up](CANDIDATE_QUERY_PLANS_OUTCOME.md), following the
[design](CANDIDATE_SEARCH_REVISIONS_DESIGN.md) and official-source
[research and tradeoffs](CANDIDATE_SEARCH_REVISIONS_RESEARCH.md).

## Result

A committed candidate change anywhere in a source search invalidates its old
quality-review continuation, including changes behind an empty cursor. The page
reader binds a durable UUID revision into the authenticated context and compares
it before and after scanning. Changed or missing evidence returns the established
refresh conflict. A small ESM store owns the two indexed reads; policy remains in
the existing page/scope factories.

The additive migration backfills search revisions and installs INSERT, UPDATE,
DELETE and TRUNCATE statement triggers. The database covers all six current SQL
writer modules and direct SQL. Search moves invalidate both keys; empty statements
do not rotate revisions. Trigger/function/enabled-state, table, columns and primary
key are critical schema anchors. Historical migration checksums are preserved.

The real browser receives one 409 then one successful first-page refresh after a
new eligible choice appears behind a cursor, exposes that choice, announces the
existing status and leaves restart/audit untouched. Selection and restart still
use their independent current transactional guards. This increment does not bound
the complete command-side exhaustion scan or grant cached completion authority.

## Validation

- Focused store/page/cursor/scope checks: 12 passed. The stable fast gate passed
  11,104 checks: 5,925 server, 4,479 client and 700 scripts, plus lint, policy and
  production builds. The only later source edit updated an integration assertion
  for candidate-removal invalidation; that file passed targeted lint and both SQL
  cases. Its code delta is recorded separately from the retained broad gate.
- Affected PostgreSQL set: 25 distinct cases across seven files. The initial run
  passed 24 and found the old removal assertion; the corrected two-case pagination
  file passed. Other passing cases were retained. Includes populated adoption,
  fresh bootstrap, actual writer wait and inversion abort/rollback, the existing
  224-profile plan matrix, and selection/restart authority regressions.
- Schema check: 114 applied, zero pending/unknown/checksum drift, fresh snapshot
  114/114 and all 163 anchors matching. Disabled trigger detection is exercised.
- Real-browser set: eight cases across six suites, including the new stale-walk
  refresh and existing keyboard navigation, selection, restart and preflight review.
- Packaged PostgreSQL 18.6 passed both native entries, covering the same revision
  contention/rollback evidence and 224 plan profiles. Both maintained controlled-
  provider and file-backed media validators passed on the rebuilt immutable image;
  their owned resources and temporary workspaces were removed.
- Both updated standards/testing skills pass the skill validator. The standards
  [revision reference](../.agents/skills/harmoniarr-web-standards/references/candidate-search-revisions.md)
  records writer inventory, lock evidence, freshness, authority and validation
  boundaries using the skill-creator workflow.

The [Docker outcome](LOCAL_DOCKER_CANDIDATE_SEARCH_REVISIONS_OUTCOME.md) owns the
preserved-state no-cache rebuild and packaged qualifications. GitHub MCP found no
open PRs at initial selection or final recheck, so no random PR implementation,
merge or stale-PR rebase applied. Screen-reader and physical-device acceptance
remain deferred by the user.

## Recommendation and next item

Adopt durable PostgreSQL revisions, small ESM stores, authenticated revision-bound
navigation, existing W3C status/refresh handling and fresh command guards. Benefits
are atomic writer coverage and truthful continuation; costs are two indexed reads,
transition-relation storage, retained revision rows and same-search writer locks.

Next: **prove the writer/command concurrency protocol for bounded restart
qualification using existing operation runs**. The actual prelocked-candidate /
revision inversion abort confirms that a command cannot simply lock a revision
first and reuse an empty cursor. Qualify lock order or serializable predicate
protection, current policy/actor/track authority, rollback/replay, expiry and
starvation before replacing the complete guard. Keep this built into the platform.

The [bounded qualification outcome](BOUNDED_RESTART_QUALIFICATION_OUTCOME.md) now
implements that protocol using existing owned operation runs and a final NOWAIT
revision fence. It supersedes the complete restart traversal and owns the next
failed-candidate fact/lock reduction recommendation.

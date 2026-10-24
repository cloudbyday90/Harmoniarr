# Quality-review candidate access paths: outcome

Implemented October 24, 2026 on main. See the [design](CANDIDATE_QUERY_PLANS_DESIGN.md)
and [official-source research, pros/cons and final stack](CANDIDATE_QUERY_PLANS_RESEARCH.md).

## Delivered change

Migration `20261024_130717_quality_review_candidate_keyset_index.sql` adds the
partial B-tree `import_candidates_quality_review_page_idx` on search ID and UUID
for pending/held candidates. Existing indexes remain with their current owners.
The canonical snapshot now contains 113 migrations and the index is a critical
schema anchor.

The small ESM store exposes a shared parameterized query builder. First pages bind
source/limit and omit the anchor parameter; range pages bind source/UUID/limit
with a direct exclusive or inclusive inequality. The nullable anchor OR is removed.
The same builder serves actual store calls and qualification, including reverse
ordering and transaction-owned FOR UPDATE. No provider/user/cursor value is SQL
text. The literal status subset matches the partial index predicate.

Public choice fields, cursors, rate limits, session/recipient/quality checks,
200-fact/four-query read budget, complete fresh restart check and transactional
selection/audit remain unchanged. No client code, dependency, endpoint, separate
service/application, branch, version bump, Git tag or release was added.

## Measured host evidence

An owned disposable PostgreSQL 18.3 database contains 100,000 generated rows:
dense and sparse current searches plus mixed other searches/providers and terminal
history. Explicit ANALYZE precedes measurement. Each of four variants (legacy,
query-only, index-only, combined) runs seven boundary cases across two sources,
custom/generic cache modes and read/locking forms: **224 profiles**. Every profile
asserts the exact ordered UUIDs against an independent deterministic expectation.

Representative read profiles from the final corpus:

| Profile | Examined rows before / after | Root buffer accesses before / after |
| --- | --- | --- |
| Sparse custom first page | 12,322 / 50 | 637 / 54 |
| Sparse custom late range | 79 / 40 | 134 / 44 |
| Dense forced-generic late range | 90,490 / 50 | 4,659 / 28 |
| Sparse forced-generic late range | 100,000 / 40 | 5,148 / 44 |
| Forced-generic forward EOF | 100,000 / 0 | 5,148 / 3 |

For the dense generic late range, query-only examined 490 rows; index-only still
examined 9,050. The paired change examined fifty with no residual rejection.
The qualified generic combined profiles use the scoped index, retain source and
anchor in index conditions and need no sort. Dense custom first-page plans may
retain the primary key (490 examined rows/28 buffer accesses in this fixture).
Small custom ranges may use a bitmap/sort or primary-key path. These are legitimate
planner choices; the change makes a scoped ordered range available without hints.

The partial index occupies **2,498,560 bytes** in this controlled corpus. Examined
rows count emitted/filter-rejected/rechecked scan tuples with loop counts, omitting
duplicate bitmap-index tuples. Buffer totals come from the root plan's shared
hit/read counters, not summed parents/children. They are not unique disk reads,
a physical-work maximum or a wall-clock/RSS/whole-platform speedup claim. Forced
generic profiles are stress coverage; current unnamed driver queries normally
use value-specific plans.

## Executed validation

- Focused store/plan-evidence/anchor checks: **13 passed**, including parameter
  isolation, root-buffer accounting and first Error/null preservation while
  rollback/deallocation are attempted.
- Final fast gate: **11,102 passed** (5,923 server, 4,479 client, 700 script), with
  zero failures/cancellations/skips. Lint, copyright, ESM/schema/Compose policies
  and builds passed on frozen source.
- Final PostgreSQL/HTTP cohort: **23 passed**. New cases qualify the full matrix,
  upgrade a populated prior 112-migration schema with exactly one migration,
  verify valid two-key/non-covering index metadata, status/delete membership and
  rollback, compare fresh/upgraded definitions, detect anchor removal and prove
  migration replay is a no-op. Existing read-budget, pagination, shortlist,
  selection and restart cohorts retain current authority and actual lock-wait proof.
- Canonical database/schema check: 113 applied, zero pending/unknown/checksum drift,
  valid fresh 113/113 snapshot and **155 matching anchors**.
- Affected real-browser cohort: **seven passed** across six suites, covering empty
  continuation, bidirectional pages, hidden alternatives, selection, restart and
  initial review/recheck. Broader unchanged client acceptance is retained; client
  code and the public response contract were not changed.
- Guarded packaged PostgreSQL **18.6**: the same **224 profiles passed** in one
  native case on 100,000 generated rows. The entry refuses a non-disposable
  deployment profile before acquiring a pool. Its read/locking and custom/generic
  assertions reuse the host fixture; the corpus index also occupies 2,498,560 bytes.
  This is query-plan qualification, not a new memory benchmark.
- Updated standards/testing skills passed the skill-creator validator. Their new
  query-plan reference separates actual/custom/generic evidence, ownership,
  schema adoption, cleanup and unchanged W3C/command contracts.

The [Docker outcome](LOCAL_DOCKER_CANDIDATE_QUERY_PLANS_OUTCOME.md) owns the
preserved-state rebuild and packaged qualification. Generated candidate facts and
controlled media are separate from public-provider discovery. Manual screen-reader
and physical-device checks remain deferred. GitHub MCP found no open PRs at initial
selection and final recheck; no random PR implementation, merge or stale-PR rebase
was available.

## Recommendation and next item

Keep the shared ESM SQL builder/store, literal active-status partial B-tree,
current eligibility/read budget and independent fresh transactional guards. The
benefit is the measured scoped access path; costs are index storage/maintenance
and a regular transactional index build that can block writers and delay startup.
The default planner retains freedom; statistics and distributions still matter.

Next: **design bounded command-side exhaustion qualification with durable search
revisions coordinated across every candidate writer**. The complete restart check
can still traverse an entire active search and hold its canonical locks. Qualify
revision/lock ordering, in-flight insert/status/policy changes, rollback and fresh
command authority before using any cached completion certificate. Keep it built
into the platform; a historical browser cursor cannot grant restart authority.

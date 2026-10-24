# Bounded quality-review detail scanning: outcome

Implemented October 24, 2026 on main. See the [design](ELIGIBLE_MATCH_SCAN_BUDGET_DESIGN.md)
and [official research, pros/cons and recommendation stack](ELIGIBLE_MATCH_SCAN_BUDGET_RESEARCH.md).

## Delivered behavior

Each quality-review detail GET fetches and evaluates at most 200 candidate facts
through four fifty-row keyset queries. Dense results stop earlier at thirteen
eligible facts and return twelve. Scanner diagnostics record fetched/evaluated
counts, query count and boundaries internally; public responses retain the small
match fact allowlist and explicit page status.

Sparse windows can be short or empty without being exhausted. The existing
disclosure remains available as Check available matches, with Continue checking
matches or Continue checking previous matches as appropriate. It never chases
continuations automatically. Each navigation replaces the current bounded choices
and cursor, retaining the existing request gate, cancellation, failure retention,
background refresh and focus behavior. First page begins a fresh walk, including
after reverse EOF. An inclusive boundary restores the preceding match when
returning from an empty exact-budget EOF window.

The versioned signed cursor retains current actor/role, target, failed-search,
participant/quality binding and expiry. It also authenticates whether a forward
walk began at the start and has seen no eligible match. Only complete EOF for
that empty walk can suggest Search again; incomplete and reverse windows cannot.
Current-view history can become stale when a candidate changes behind the cursor.
The independent fresh transactional command guard still checks the complete
search and rejects a stale empty-walk inference before queueing intent/audit.
Cursor history grants no selection, quality consent or restart authority.

Queued rediscovery retires old windows without scanning them again; an old cursor
returns the existing bounded conflict and refreshes current state. Selection still
uses its existing current-scope locks, atomic event/audit and explicit download
action. No endpoint, dependency, migration, separate application, branch, version
bump, Git tag or release was introduced.

Scanner and page orchestration now live in two small ESM factory services. Scope
and eligibility retain their existing owner; parameterized SQL retains its narrow
store. This keeps the scope service smaller as the page contract grows.

## Executed validation

- Focused scanner/scope/cursor/store/decision/presentation/request-gate checks:
  **60 passed**. Structural evidence covers four-query/200-fact limits, early
  lookahead, exact EOF, sparse progress in both directions, inclusive boundary
  recovery, authenticated flags, safe empty-state feedback and queued-scan omission.
- Final fast gate: **11,098 passed**: 5,919 server, 4,479 client and 700 script
  tests. Lint, copyright, ESM/schema/Compose policies and client/server builds
  passed with zero failed, cancelled or skipped tests. Source was frozen before
  this stable gate; unchanged line endings were preserved.
- Final PostgreSQL/HTTP cohort: **21 passed** across five suites. New cases prove
  an eligible match beyond 200 weak facts, direct restart refusal beyond the read
  budget, exact-boundary EOF followed by guarded queueing, queued-window retirement
  and stale empty-walk refusal after a newly eligible fact appears behind the
  cursor. Existing pagination, shortlist, selection and restart cases retain
  authorization, replay, rollback, real lock-wait and quality-floor coverage.
- Final browser cohort: **31 passed** across seven suites. The new real-app case
  opens an empty partial window by keyboard, continues to a later match, retains
  terminal navigation focus, returns to First page and selects without download.
  Existing twenty-four detail acceptance cases and review/pagination/restart
  regressions also pass. The test scopes First page to match navigation rather
  than the independent worklist navigation.
- The fixture creates weak read/guard facts in one SQL statement. Selectable
  alternatives retain the existing real candidate/file fixture. This reduces
  setup operations without claiming a whole-suite timing improvement.
- Updated standards/testing skills passed the skill-creator validator. Their
  new scan-budget reference connects OWASP resource limits, W3C status behavior,
  PostgreSQL ordering, current authority and meaningful validation boundaries.

Controlled candidates and an injected media gate establish scoped application
behavior, not live discovery or measured audio. Manual screen-reader/device
acceptance remains deferred. Packaged native-media and preserved-state evidence
are recorded separately in the [Docker outcome](LOCAL_DOCKER_MATCH_SCAN_BUDGET_OUTCOME.md).
GitHub MCP found no open PRs at initial selection and final recheck. No random PR
implementation, merge or stale-PR rebase was available.

## Recommendation and limits

Keep the existing Vue disclosure/request owner, bounded fact projection, ESM
scanner/page factories, signed scoped cursor, PostgreSQL keyset store and fresh
transactional command guards. The benefit is bounded per-detail candidate
materialization/evaluation. The tradeoff is deliberate short/empty windows and
current-view inference rather than a frozen snapshot.

This is not a bound on physical database rows scanned, query latency, total
detail preparation, bytes, RSS or mutation work. The fresh restart check can still
traverse the complete current search; it is deliberately separate from read
continuation and cannot silently inherit the read cutoff.

Next: **qualify the candidate query access path with PostgreSQL EXPLAIN on large
mixed search histories**, including first, forward, reverse and inclusive EOF
boundaries. Measure rows scanned/rejected and buffer work, then evaluate a scoped
search/status/UUID index and anchor predicate changes. Command-side budgeting
requires a separate revision/certificate design involving every candidate writer;
do not replace the fresh guard with historical cursor authority.

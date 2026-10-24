# Bounded restart qualification outcome

October 24, 2026. Implements the next step from the
[revision outcome](CANDIDATE_SEARCH_REVISIONS_OUTCOME.md), following the
[protocol design](BOUNDED_RESTART_QUALIFICATION_DESIGN.md) and official-source
[research, alternatives and recommendation stack](BOUNDED_RESTART_QUALIFICATION_RESEARCH.md).

## Implemented behavior

Measured-quality Search again no longer traverses an entire source search while
holding its command transaction. The scanner has a hard 200-fact ceiling with no
caller override. Small observed EOF queues immediately; incomplete checks persist
one progress record in the existing operation-run queue and check one window per
claim. Exact-capacity windows need a later EOF probe. Eligible choices refuse
restart, including choices that appear behind previously saved progress.

Canonical current account/participant/policy/track checks remain in place under
explicit Read Committed. After nonlocking keyset scanning, a NOWAIT revision fence
must equal the revision captured before the window. No candidate locks follow the
fence. A local 250 ms lock timeout covers the table-lock limitation of NOWAIT.
Missing, changed or busy evidence never authorizes exhaustion. The previously
observed revision/candidate cycle now causes immediate fence refusal instead of
waiting on that cycle. Other canonical lock waits remain possible.

The ESM policy, SQL store, service and worker are separate modules. Existing run
descriptors, exact lease acquisitions, cancellation, paused lifecycle, stranded
recovery, dispatcher, retention and shutdown drainage own background work. One
active run per wanted release coalesces repeated commands; admission caps active
work at 16 globally and two per actor. A ten-minute fixed deadline, 500 steps and
three invalidations bound qualification. Three crash-recovery attempts permit
resumption after process loss; observed authority/expiry/execution failures stop
terminally. Progress retains one anchor, no page history, and accepts no client
certificate or cursor authority.

Current revision/policy changes reset the anchor. Original actor and failed
acquisition remain bound to the request. Intent, required audit and owned
completion commit together; stale leases and failed completion cannot leave a
queued intent. Required check audit failure rolls back initial admission. Dispatch
after commit remains separate and cannot rewrite committed success as failure.

Missing Music now distinguishes checking from a queued search, disables duplicate
actions, preserves keyboard focus and announces the existing persistent status.
Reload retains checking; queued status appears only after qualification succeeds.
The existing downstream claim/query/quality/transfer/library-add guards remain.

## Validation

- 51 focused store, scanner, scope, service, progress, worker, borrowed-ownership,
  route-adapter and client mutation checks passed.
- The completed stable fast gate passed 11,110 tests: 5,930 server, 4,480 client
  and 700 scripts, plus lint, repository policies and production builds. An initial
  lint-only stop identified a test-local variable shadowing the imported setup
  hook; renaming it changed no SQL behavior. No production source changed after
  the qualification freeze.
- The combined SQL cohort passed 46 cases across 11 files, including current
  qualification, both fence directions, revision adoption, 224 query-plan profiles,
  selection/restart regressions, acquisition fences and operation recovery. Nine
  qualification cases include coalescing, exact EOF, revision/policy reset, original
  actor/recipient drift, cancellation, TTL, admission caps, stale lease, in-window
  committed mutation, required audit/completion rollback and stranded-run resume.
- Nine real-browser cases across six suites passed, including checking → reload →
  queued, native keyboard controls, focus, stale cursors, selection and preflight.
- Schema verification passed: 115 applied, zero pending/unknown/checksum drift,
  fresh bootstrap 115/115 and all 164 critical anchors matching. The additive
  partial unique index enforces one active qualification per wanted release.
- Updated standards/testing skills pass their validator. The practical
  [qualification reference](../.agents/skills/harmoniarr-web-standards/references/bounded-restart-qualification.md)
  records current protocol, real failure cases, ownership and validation boundaries.

The [Docker outcome](LOCAL_DOCKER_BOUNDED_RESTART_QUALIFICATION_OUTCOME.md) owns the
preserved-state no-cache rebuild and packaged checks. GitHub MCP found no open PRs
at selection or recheck, so no random PR implementation, merge or stale rebase
applied. Manual screen-reader/physical-device checks remain deferred by the user.

Packaged PostgreSQL 18.6 passed all three isolated native entries (revision,
nonwaiting fences and 224 plan profiles), and both maintained media validators
passed on the rebuilt immutable image. Owned resources were retired and absence
verified. Existing admin/data/five binds are preserved in the healthy deployment.

## Recommendation and next item

Adopt the existing PostgreSQL revisions and indexed keysets, modular ESM services,
owned operation-run progress, current canonical checks, a final nonwaiting fence,
atomic intent/audit/completion and truthful W3C-aligned status. Benefits are bounded
candidate work and durable resumption. Costs are added job lifecycle/state handling,
revision contention, possible expiry under churn or oversized searches, and the
remaining canonical lock/detail costs. This is no wall-time, byte or RSS guarantee.

Next: **replace full failed-candidate detail/file loading and locking during
qualification with the smallest authoritative facts and lock set**. Prove parity
for original quality floor, recipients, track scope, failed acquisition and current
authority before narrowing it. Separately plan bounded orphan-revision retirement
and mixed-workload deployment measurements; historical revisions remain retained,
and these SQL/budget checks do not qualify a new concurrent memory envelope.

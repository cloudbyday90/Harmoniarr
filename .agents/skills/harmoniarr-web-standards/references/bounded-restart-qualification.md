# Bounded restart qualification and revision fencing

Use for measured-quality Search again, durable qualification progress, revision
fences or leased completion. Read active-repo docs/BOUNDED_RESTART_QUALIFICATION_DESIGN.md,
research and outcome. This supersedes the original full-traversal command guard.

1. Keep the existing fresh-session/CSRF/idempotent command. Never accept a client
   cursor, anchor or exhaustion flag as proof. Small EOF may commit immediately;
   larger searches use the existing operation queue, not another process/service.
2. Explicitly use Read Committed. Canonical maintenance/account/wanted/discovery/
   admission/failed-candidate locks precede owned run/lease locks. Nonlocking
   keysets evaluate/fetch at most 200 facts; exact capacity needs another EOF probe.
3. Fence only after the last candidate read or lock. Use the durable revision
   equality check with FOR UPDATE NOWAIT and a local lock timeout for table locks.
   Busy, changed or missing evidence is unknown/refused, never empty. SKIP LOCKED
   is unsuitable for exhaustion. Take no candidate locks after this fence.
4. Persist one server-owned progress object: original failed acquisition, effective
   policy/recipient digest, revision, exclusive anchor, state, counts and fixed
   deadline. Reset on current revision/policy drift. Validate stored shape, cap
   admission/invalidation/steps/lifetime and separate observed EOF from consumed
   completion. Retain no page history. Statement sorting is not global lock order.
5. Revalidate original actor and current participants before consumption. Borrow
   the canonical transaction for exact run/acquisition ownership, cancellation and
   final intent/audit/completion. A failed final lease write must roll back intent;
   do not publish merely because a callback returned false. Post-commit dispatch
   failure cannot change a committed success into failure.
6. One window per worker claim yields through paused lifecycle with lease drainage.
   Crash recovery resumes durable progress under a new acquisition; known authority
   and expiry failures stop terminally. Keep pending checking separate from a
   provider search in public status, feedback and permissions. Preserve focus and
   persistent polite announcements; manual assistive/device proof stays separate.
7. Run actual PostgreSQL contention in both directions using the shared fence
   fixture, also on guarded packaged PostgreSQL. Pair with real HTTP/queue tests
   for coalescing, policy/revision reset, TTL, admission, cancellation, actor and
   recipient drift, stale leases, crash recovery and audit/completion rollback.
   Exercise checking → reload → queued in the browser and existing selection/search
   regressions. Logical scan bounds do not prove overall latency, bytes or RSS.

Current costs: existing canonical lock waits and full failed-candidate file/detail
loads, same-search revision contention, historical revision rows and possible
expiry under churn. No revision/qualification token replaces downstream claim,
quality, transfer or library-add authority. Retention work must preserve these
boundaries rather than introducing a new job system.

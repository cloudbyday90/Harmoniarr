# Library discovery dispatch lifetime design

October 11, 2026. Discovery launches detached work and clears its active marker
before captured lease release and eligible ledger pruning. Reconciliation, artwork
prefetch and dispatch are already awaited; actual completion must retain those
returned promises and both finalizers. Dispatch can queue selected-import execution
through its existing awaited auto-download service; no direct execution-worker
launch was found in the traced production path.

## Selected design

Reuse shared ESM task lifecycle, work/cleanup precedence and lease drainage.
Queued acknowledgement returns actual completion. Duplicate run IDs share it
through pruning, and terminal close seals admission before waiting and retains
escaped failures including null. Keep request metadata, actor, ordinary versus
scoped-recovery forwarding, dispatch breakdown and domain outcomes unchanged.

Drain admitted renewal before captured lease release. Attempt release after drain
failure; skip pruning if renewal/release cleanup fails. Otherwise prune only after
cleanup that returned without throwing when the original worker acquired a lease
and did not lose
authority or receive a refused persisted mark. Keep eligible pruning after handled
domain failure, pause and cancellation. Preserve escaped work Error/null over
cleanup fallout. Unexpected acquisition errors become observable; empty acquisition,
expected unavailable acquisition, lost lease and refused marks retain policy.
Null domain/artwork failure gets a fixed fallback message. Artwork remains an
awaited best-effort outcome, with lease loss propagated to the outer handler.

Preserve scoped recovery's exclusion of global reconciliation/artwork, current
consent and membership checks, provider request protocol and uncertainty policy.
No automatic POST retry, forced provider cancellation or new dispatch authority is
introduced. Completion owns returned local work, not remote search completion or
unreturned descendants.

Application selection becomes discovery/execution/inspection/transcode/apply/
organize/scan. Snapshot concrete owners before awaiting, preserve receivers and
attempt all after failure while retaining first Error/null. Discovery is placed
ahead of execution for its queue-producing handoff; apply has a scan-producing
handoff. Other ordering is conservative. Startup and both app fixtures share the
adapter; residual waits remain until other workers/periodic producers are owned.

The scoped recovery fixture must register actual completion before launch and
await it beyond callback observation, including pruning. Preserve its earlier
callback error policy and prevent early execution failure from waiting behind an
unreachable observer. Unit consumers also await actual completion.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared completion and captured lease cleanup | Consistent coalescing and teardown | Cooperative waits; selected |
| Poll terminal status or add sleep | Small edit | Does not establish pruning/returned-work drainage; reject |
| Await the whole job from start | Simple API | Changes queued acceptance and dispatcher scheduling; reject |
| Prune after failed release/lost authority | More cleanup attempts | Changes original eligibility and broadens work after failure; reject |
| Retry or abort provider calls on close | Potentially shorter shutdown | Unknown acceptance and consent require separate policy; defer |

Stack: durable queue/current authority; shared ESM completion; awaited scoped
dispatch and producer handoffs; renewal/release then eligible pruning; ordered
application owners; native pool lifetime; focused and affected PostgreSQL/HTTP
validation. See [official research](DISCOVERY_DISPATCH_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan and limits

Retain duplicate acquisition during held release as a controlled red. Gate
reconciliation, artwork/provider, renewal, release and pruning independently;
verify pruning eligibility, canonical handles, late admission and Error/null
precedence. Exercise both app fixtures with real PostgreSQL through held release
and pruning, and a controlled native HTTP request through local completion.
Include scoped consent/recovery and queue-producing consumer integration evidence
in one stable affected group. Preserve original deadlines/assertions and run the
complete fast gate after source review. No new branch, release or PR merge;
no exhaustive/native speedup, full-app drainage or security/WCAG certification.

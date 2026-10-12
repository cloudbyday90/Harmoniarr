# External intake planning lifetime design

October 11, 2026. The planner reloads the active external request, normalizes its
stored URL, persists ingest rows/evidence and awaits the execution queue service.
The worker currently detaches launch and removes duplicate protection before
lease release. This slice gives callers actual completion through that work and
captured lease cleanup while preserving queued acceptance.

## Selected design

Reuse the shared ESM task lifecycle, work/cleanup precedence and lease drainage.
Return `{ completion }` from start, coalesce the same run through release, and
provide canonical terminal close that seals admission synchronously and drains
admitted work. Observe escaped failures, including null. Drain admitted heartbeat
renewal before releasing the captured lease; attempt release after drain failure
and preserve the earlier work failure. Unexpected acquisition failures escape;
empty acquisition, expected unavailable/lost acquisition, lost authority and
refused persisted marks retain their existing outcomes. Null domain failure gets
a fixed diagnostic message.

Keep planning and queue callbacks awaited. Forward returned normalized source,
request ID, original actor and planning_complete trigger to the queue owner.
Preserve cancellation checks before and after queueing, no handoff for empty
plans, maintenance pause, target ownership and guarded persistence. Completion
ends after local durable handoff and cleanup; the provider execution worker is
still a separate unowned boundary. No URL fetching, POST retry, forced cancellation
or new requester authority is introduced.

Application drainage captures the concrete planner ahead of existing discovery,
execution, inspection, transcode, apply, organize and scan owners, before its first
await. Attempt every selected owner after failure and preserve first Error/null.
Startup and both app fixtures share this selection. Keep the residual fixture
delay until other workers and periodic producers are owned.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared completion and captured lease cleanup | Consistent ownership; removes guessed test sleeps | Cooperative drainage can wait on a slow dependency; selected |
| Sleep or poll completed status | Small edit | Earlier than cleanup; reject |
| Await the entire job from start | Simple call site | Changes queued acceptance/scheduling; reject |
| Abort or retry on close | Potentially shorter wait | Requires provider acceptance and cancellation policy; defer |
| Broad URL/network rewrite | May harden outbound destinations | Actual clients/redirects require separate evidence; defer |

Stack: stored active request and normalized descriptors; durable queue/current
authority; shared ESM task completion; awaited planning and execution handoff;
renewal then captured lease release; ordered application drainage; focused and
affected PostgreSQL validation. See [official research](EXTERNAL_INTAKE_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan

Retain a held-release duplicate failure against the original source. Gate planning,
handoff, admitted renewal and release independently. Test canonical completion and
close, late refusal, expected lease/authority outcomes, Error/null precedence,
normalized handoff and cancellation before/after queueing. Exercise both app
fixtures with real stores and PostgreSQL through held handoff and release; verify
durable pending execution and resources before cleanup. Include existing external
recipient/collection and cancellation authority cases in one stable native group.
Freeze code after focused review, then run complete fast and affected native gates.
No exhaustive speedup, remote provider completion, full-app quiescence or security
certification is claimed. Stay main; no release, branch or PR merge.

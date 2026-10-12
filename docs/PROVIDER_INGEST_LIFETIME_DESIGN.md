# Provider ingest execution lifetime design

October 11, 2026. The executor detaches launch and removes its active marker
before lease release. Its execution service already awaits provider requests,
per-row and derived-work persistence, request evidence and audit. Tracked
collections return their bounded, guarded transactional preparation promise.
Actual completion must own these returned paths and captured lease cleanup.

## Selected design

Reuse shared ESM task lifecycle, work/cleanup precedence and lease drainage.
Start retains queued acceptance and returns `{ completion }`; duplicate run IDs
share completion through release. Canonical terminal close seals admission and
drains all admitted work, preserving escaped Error/null. Drain admitted renewal
before captured lease release, attempt release after drain failure and preserve
earlier escaped work failure. Unexpected acquisition errors escape without
unowned writes; expected empty/unavailable/lost acquisition, lost authority and
refused marks retain policy. Null worker domain failure gets a fixed message.

Keep request/actor/trigger forwarding and cancellation gates. Preserve existing
per-row failed outcomes: a service result can complete the operation with a
nonzero failedCount, while request evidence reports executed_with_failures.
Collection results may remain preparing after one bounded batch. Completion is
local returned execution plus cleanup, not complete collection preparation,
remote download completion or hidden descendants. Do not change provider
transport, collection cursor/snapshot/budget rules, target eligibility or replay.

Capture planner then provider executor before discovery and the existing import,
inspection, transcode, apply, organize and scan owners. Planner may persist child
queue intent before executor admission seals. Snapshot concrete owners before
awaiting, preserve receivers, attempt every selected owner after failure and
retain first Error/null. Startup and both app fixtures share the selection.
Other workers and periodic producers keep the residual app-fixture delay.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared completion and captured lease drainage | Consistent ownership and deterministic fixtures | Waits for admitted dependencies; selected |
| Poll completed status or add delay | Small edit | Earlier than release and returned work; reject |
| Await the job directly from start | Simple caller | Changes queued acceptance/scheduling; reject |
| Abort/retry providers on close | Potentially faster shutdown | Needs provider acceptance and cancellation policy; defer |
| Rewrite transport or collection protocol | Broader hardening | Existing owners and adverse evidence deserve a separate change; defer |

Stack: current request/target authority; bounded official provider clients;
guarded row/collection persistence and durable queue; shared ESM completion;
admitted renewal then captured release; ordered concrete application drainage;
focused and affected native evidence. See
[official research](PROVIDER_INGEST_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan

Retain held-release duplicate acquisition against original source as a controlled
red. Gate returned provider/collection work, renewal and release; assert queued
acknowledgement, canonical handles, refused late admission, captured inputs and
lease/mark outcomes. Preserve partial counts and cancellation/maintenance policy.
Exercise both app fixtures using real service/store/provider-client paths with a
test-owned native HTTP transport, then held release; add tracked collection
publication and cancellation evidence. Include production authority/collection
and planner/dispatcher/pool regressions in one stable affected PostgreSQL group.
Freeze source after focused review; run complete fast and the affected native
group once. No forced retries, widened deadlines, security/WCAG certification,
exhaustive speedup or whole-app quiescence claim. Stay main; no release or PR merge.

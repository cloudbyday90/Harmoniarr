# Metadata artist refresh lifetime design

October 12, 2026. Artist refresh detaches launch and removes its active marker
before captured lease release. Catalog refresh already awaits provider lookup/
browse, catalog writes, optional materialization, wanted projection, durable
operator reconciliation queueing and detection. The worker then awaits refresh
scheduling. Actual completion must retain these returned paths through renewal
and release.

## Selected design

Reuse shared ESM task lifecycle, work/cleanup precedence and lease drainage.
Queued start returns `{ completion }`; duplicate IDs share it through release.
Canonical terminal close seals admission and drains admitted work, preserving
escaped Error/null. Drain admitted renewal before captured release and attempt
release after drain failure, retaining an earlier work failure. Unexpected
acquisition errors escape without unowned writes. Empty or expected unavailable/
lost acquisition, lost lease and refused marks retain existing policy. Null worker
domain failure receives a fixed diagnostic message.

Preserve original artist IDs, trigger, captured workerContext/expected lease and
throwIfCancelled hook. Catalog refresh already clones the accepted context before
provider awaits; leave its authority, current-state and cancellation checkpoints
at existing owners. Keep scheduling's monitored/unmonitored branch and summary
counts. A queued operator reconciliation is durable intent, not completed child
execution. No new provider retry/abort, cancellation semantics after partial
catalog writes, scheduler policy or acquisition authority is introduced.

Capture the concrete metadata refresh owner before the ten existing library/import
owners at startup and both app fixtures. Extend the shared adapter's metadata
input and startup call explicitly; a fixture already supplies the full application.
Snapshot receivers before awaiting, attempt all eleven after failure and preserve
first Error/null. Metadata queues durable reconciliation intent through an awaited
service; its reconciliation worker remains a separate unowned boundary. Other
workers/periodic producers keep the residual fixture delay.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared completion and lease cleanup | Deterministic ownership through provider/schedule writes | Waits on admitted dependencies; selected |
| Poll terminal status or add delay | Small edit | Earlier than returned work and release; reject |
| Await the whole job from start | Simple caller | Changes queued acceptance/scheduling; reject |
| Abort/retry provider calls on close | Potentially shorter wait | Requires transport/cancellation/acceptance policy; defer |
| Rewrite scheduler or partial-write cancellation | Broader consistency | Requires separate domain evidence; defer |

Stack: captured lease/current authority; existing provider policy and guarded
catalog/wanted writes; durable operator queue intent; returned schedule
persistence; shared ESM completion; admitted renewal/captured release; ordered
concrete application drainage; focused and affected native evidence. See
[official research](METADATA_ARTIST_REFRESH_LIFETIME_RESEARCH_2026_10.md).

## Evidence plan

Retain duplicate acquisition during held release against original source as a
controlled red. Gate provider/refresh result, schedule and renewal/release
independently; verify accepted start, canonical handles, late refusal, captured
context/hook and summary counts. Preserve expected lease/mark/interruption policy
and Error/null cleanup precedence. Native proof uses both app fixtures, real
catalog and scheduler stores plus a test-owned MusicBrainz HTTP endpoint; hold
schedule before publication and release afterward. Include existing wanted
projection fencing, captured-context and rollback evidence in one stable native
group. Consumers await actual worker completion beyond release/tick observation.
Freeze source after focused review, then run complete fast and affected native.
Stay main; no release, branch or PR merge. No live-provider, whole-app drainage,
exhaustive speedup or security/WCAG certification claim.

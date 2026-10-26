# Bounded startup backup recovery design

October 26, 2026. Follows the [container qualification](BACKUP_CONTAINER_CRASH_OUTCOME.md).
See [research](BACKUP_STARTUP_RECOVERY_RESEARCH.md) and [outcome](BACKUP_STARTUP_RECOVERY_OUTCOME.md).

Queue a durable backup recovery scan through the existing startup supervisor,
operation queue, lease and Background Jobs infrastructure. HTTP readiness remains
independent from recovery completion. Use the qualified owned backup service,
preserving confirmation, directory, identity, sync/close and exclusive-link rules.

Each dispatch reads at most 25 journal rows plus one lookahead, ordered by exact
database timestamp and ID through a fixed startup cutoff. Persist an opaque
continuation in the job summary; pause/resume batches without consuming failure
retry attempts. A five-second admission budget stops starting more items between
operations; it never races or abandons in-flight I/O. Automatic file reads are
capped at 16 MiB using the same owned file handle, including growth detection.
Larger/invalid-size artifacts defer without becoming corrupt or entering inventory.

Use existing exact job-acquisition fencing and the backup filesystem ownership
gate. Check maintenance/cancellation/lease authority at recovery boundaries.
Await admitted work, heartbeat renewal and lease release through shutdown. A
crashed job resumes through existing stranded-run recovery. Coalesce unstarted
pending startup scans; a running scan may be followed by a fresh-cutoff scan for
a later boot. Bound startup admission attempts and report failures safely.

Persist aggregate progress and completion/deferral/confirmation counts. Expose a
whitelisted status through the existing administrator backup read endpoint and a
stable polite Recovery status region. Background Jobs uses the shared descriptor,
summary presentation and existing cancellation controls. Do not expose file paths,
checksums, internal cursors or raw database/filesystem errors in the status.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing durable queue and owned recovery, bounded batches | Reuses restart/lease/status behavior; no extra service | Adds paging and lifecycle integration | Implement |
| Await full scan before listening | Simple ordering | Readiness can hang on backlog/I/O | Reject |
| Timer-only process state | Small implementation | Loses progress and operator history on restart | Reject |
| New recovery application/service | Separate lifetime | Adds deployment and authority surface | Reject |

Keep mandatory schema/startup validation fatal. Recovery admission is background
work and its failure is visible rather than a false readiness failure. Preserve
existing manual backup semantics; automatic limits apply to the new startup lane.
Validate paging fairness/exact cursors, oversize/growth refusal, authority loss,
maintenance/cancellation/drain, actual startup recovery and privileged status
delivery/rendering. Research and outcome remain separate documents.

# Bounded startup backup recovery outcome

October 26, 2026. Implements the next item from the
[container replacement qualification](BACKUP_CONTAINER_CRASH_OUTCOME.md).
See the separate [design](BACKUP_STARTUP_RECOVERY_DESIGN.md),
[official-source research and tradeoffs](BACKUP_STARTUP_RECOVERY_RESEARCH.md),
and [local Docker outcome](LOCAL_DOCKER_BACKUP_STARTUP_RECOVERY_OUTCOME.md).

Startup now queues a durable backup journal scan through the existing application
supervisor and Background Jobs dispatcher. Each dispatch reads 25 ordered journal
records plus one lookahead and persists an exact timestamp/ID continuation through
a fixed startup cutoff. Held and oversized records cannot trap the scan on its
first page. Continuations use the existing pause lifecycle without consuming
failure retries. Startup admission has three bounded attempts and visible failure
status; eligible failed jobs use the existing three-attempt retry policy.

Automatic recovery caps input at 16 MiB, checks declared size before file work,
and bounds actual reads through the same owned handle, including file growth.
The five-second budget stops new admissions between records. It never discards
in-flight I/O or claims a hard timeout. All qualified confirmation, missing-tree,
exclusive-publication, identity, sync/close and deletion rules remain in force.
Manual backup behavior retains its existing contract.

The worker owns a 30-second acquisition-fenced lease renewed every 10 seconds,
checks cancellation/maintenance/authority at owned boundaries, and drains actual
work and heartbeat renewal before release. It reuses the pinned PostgreSQL backup
filesystem ownership gate. No additional application or deployed service is needed.

Recovery displays a stable atomic status, an explicit refresh and the canonical
Background Jobs link. A finished scan can still have unfinished journal records;
the message says so. Administrator responses contain whitelisted counts/states
with `Cache-Control: no-store`. Internal continuation fields are omitted from
delivered operation summaries. The existing Refresh status button now retains
keyboard focus while its guarded request runs.

Validation:

- Full fast gate: 6,110 server, 4,488 client and 700 script tests passed, with
  lint, copyright, schema/migration, ESM, Compose and build checks. Final formatting
  was whitespace-only; focused recovery/presentation tests and lint passed after
  normalization. The later qualification-protocol correction passed eight focused
  probe tests and lint, including refusal of absent/false automatic-recovery proof.
- The packaged production startup test scanned 34 real PostgreSQL/file records
  across batches: 29 completed, three deferred, one awaiting confirmation, one
  abandoned. It verified exact microsecond pagination, continuation retry accounting,
  maintenance-paused HTTP readiness, coalesced startup admission, 401/403/admin
  boundaries, no-store delivery, safe status and real bytes/catalog/lease outcomes.
- On the final image, all eight existing backup native entries passed: directory
  creation/sync, readiness, handle close, failure precedence, I/O drainage,
  exclusive publication and journal failure. Nineteen process interruption,
  18 SQL interruption and 18 PostgreSQL immediate-shutdown/WAL recovery cases passed.
- The final replacement matrix passed all 18 cases on the immutable rebuilt
  image, with 19 production containers, background services enabled, the same
  owned persistent volume, observed WAL redo and automatic startup recovery before
  manual probes. All test containers/probes/volumes were retired and absence
  verified. The preliminary health failure did not recur in this complete run.
- The real-browser controlled loading/queued/unresolved scenario passed without
  moving refresh focus. The preserved Compose stack separately displayed its real
  completed startup status at desktop and 390 px widths; screenshots were inspected.
- No dependency changes; npm audit reported zero vulnerabilities. Runtime source,
  packages and native identities were compared. Unrelated media/codec matrices
  were not repeated; their implementation and packaged native dependencies did
  not change. Shared startup/queue changes were exercised by the new native path.

The first replacement qualification rejected the new result field because its
strict test protocol still expected the prior shape. The protocol now requires
affirmative automatic-recovery proof; failed-run evidence and verified retirement
were preserved. Replacement verification waits for this boot's startup scan before
manual probes, preserving cluster, sentinel, WAL, bytes, inventory and repeated
recovery assertions. It no longer mislabels the post-recovery state as an unchanged
pre-crash SQL snapshot.

One preliminary replacement run returned HTTP 500 from `/healthz` after six
successful cases. Its response body was not captured, so the cause is unknown;
it must not be attributed to host load without evidence. The fixture now records
the response on failure. All owned containers, probes and volumes from that run
were retired and their absence verified. Treat a recurrence as a readiness
diagnostic investigation rather than silently retrying a failed assertion.

GitHub MCP checks found no open PRs in `cloudbyday90/Harmoniarr`; random selection,
local PR implementation and stale-PR cleanup were therefore inapplicable. Work
remains on main, with no PR merge, branch creation, tag or release.

Private evidence: `.tmp/backup-startup-recovery-2026-10-26/`. The local rebuild
preserved the existing administrator, database and all five real storage binds.
The provider check establishes readiness only. Manual screen-reader and physical
device checks remain deferred; these tests do not establish hardware power-loss
durability or a minimum container memory requirement.

Next recommended item: qualify interruption of the recovery job itself while a
batch owns file I/O and at the durable continuation boundary. Prove restart,
lease-loss/cancellation and shutdown drainage with actual process replacement,
including unfinished counts that remain accurate when a batch is replayed. Reuse
the existing application and qualification fixtures; do not introduce another
deployed service or weaken confirmation requirements.

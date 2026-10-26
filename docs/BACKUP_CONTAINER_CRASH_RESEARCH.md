# Backup container replacement research

Official sources discovered through MCP search/navigation and checked on October
26, 2026. The PostgreSQL 18 and Node 24 references match the pinned runtime.
See [design/tradeoffs](BACKUP_CONTAINER_CRASH_DESIGN.md) and
[outcome](BACKUP_CONTAINER_CRASH_OUTCOME.md).

[Docker container kill](https://docs.docker.com/reference/cli/docker/container/kill/)
documents the default SIGKILL behavior and explicit signal selection for the
container's main process. Use explicit KILL, wait for the inspected container's
exit and check its exit/OOM state. A successful kill request is not sufficient
evidence of retirement, and graceful stop is a different lifecycle.

[Docker volumes](https://docs.docker.com/engine/storage/volumes/) persist beyond
container lifetime; named volumes are retained when their container is removed.
Create a labelled local volume explicitly, inspect actual container mount/image/
ownership metadata, remove the old container and verify the volume before reuse.
Remove only the acknowledged exact resources after qualification; broad pruning
does not provide scoped ownership or a safe recovery test.

[PostgreSQL WAL settings](https://www.postgresql.org/docs/18/runtime-config-wal.html)
describe durability controls. Keep fsync, synchronous commit and full-page writes
on. Inference: independently observed committed state should survive these
container-process failures, while an interrupted client request alone cannot
establish the commit outcome. A post-checkpoint committed sentinel plus actual
redo messages distinguishes WAL recovery from readiness alone.
[Server startup](https://www.postgresql.org/docs/18/server-start.html) describes
data-directory ownership and logging. Test the real entrypoint/server command
against the same owned volume without manually deleting stale PID/control files
or resetting WAL. The qualification preserves the cluster identifier.

[PostgreSQL logging](https://www.postgresql.org/docs/18/runtime-config-logging.html)
documents collector startup and log destinations. The owned test cluster enables
collector output for its next container startup, keeping a per-checkpoint offset
so the verifier checks that replacement's recovery messages. Durability settings
are retained; this configuration is confined to the disposable test volume.

[Node child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
distinguish process exit from closure of its stdio streams. Bound Docker exec
output, validate finite protocol envelopes and observe close before accepting a
killed or completed probe. Treat missing/duplicate/foreign messages and output
budget failures as failures even if a later valid-looking message arrives.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block)
applies to user-visible recovery feedback: preserve contextual, programmatically
determinable waiting, completion and error messages without unnecessary focus
moves. HTTP health is not confirmation that a backup operation finished. This
test-only implementation changes no UI or announcements and establishes no new
screen-reader/physical-device acceptance; those checks remain deferred.

Recommended stack: owned container/volume -> real target observation -> hash-bound
persisted snapshot -> KILL/observed exit -> old-container removal -> replacement
entrypoint/HTTP/WAL readiness -> fresh default backup recovery -> repeat and clean
up. Pros: real startup and persistence coverage without a deployed fault surface.
Cons: more startup work, fixture complexity and Docker process/storage semantics;
host failure, disk corruption and hardware power loss need separate evidence.

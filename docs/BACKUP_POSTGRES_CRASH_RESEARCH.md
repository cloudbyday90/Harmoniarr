# Backup PostgreSQL crash/restart research

Official sources discovered through MCP search/navigation and verified on October
26, 2026. PostgreSQL links use version 18 to match the pinned runtime.
See [design/tradeoffs](BACKUP_POSTGRES_CRASH_DESIGN.md) and
[outcome](BACKUP_POSTGRES_CRASH_OUTCOME.md).

[PostgreSQL pg_ctl](https://www.postgresql.org/docs/18/app-pg-ctl.html) documents
immediate mode as aborting server processes without clean shutdown, requiring
crash recovery at next start. Use explicit immediate mode, wait for completed
shutdown, and then observe recovery; a successful command dispatch alone is not
completion. Its status command distinguishes a stopped server, and log redirection
avoids holding the command's output pipe open through a background server.

[PostgreSQL WAL settings](https://www.postgresql.org/docs/18/runtime-config-wal.html)
describe fsync, full-page writes and synchronous commit. Keep these durability
settings enabled and check their actual values. Inference: a separately observed
committed mutation should survive database-process failure; an unresolved client
query alone cannot reveal its commit outcome. This is not proof of the host
storage stack's behavior under power loss.

[CHECKPOINT](https://www.postgresql.org/docs/18/sql-checkpoint.html) forces a database
checkpoint. Commit a fixture sentinel after it so the qualification requires
replaying known subsequent committed WAL, rather than accepting readiness alone.
[pg_controldata](https://www.postgresql.org/docs/18/app-pgcontroldata.html) provides
cluster identity/control information. Check stable cluster identity, unclean
control state before restart, new postmaster identity and redo/readiness evidence.
[Server startup](https://www.postgresql.org/docs/18/server-start.html) documents
data-directory/PID ownership and server logging; operate only on the declared
owned test directory, never an endpoint selected from operator configuration.

[Docker volumes](https://docs.docker.com/engine/storage/volumes/) persist independently
of container lifetime and are managed by Docker. Use an explicitly created local
volume with a unique ownership label, verify actual inspect metadata before start,
mount code/evidence read-only, and remove only the acknowledged exact container
and volume. This avoids host-specific database directory permissions while
keeping production storage detached. Never use broad volume pruning as cleanup.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block)
applies when recovery status is presented in the application. Preserve contextual,
programmatically determinable waiting/completion/error messages without moving
focus unnecessarily. A restarted database or returned recovery call is not itself
user-action completion. This test-only work changes no UI or announcements and
does not add manual screen-reader/device acceptance; those checks remain deferred.

Recommended stack: owned named-volume profile -> verified SQL wait or committed
response loss -> immediate database shutdown -> old-session retirement -> same
cluster WAL recovery -> fresh default backup recovery and idempotence -> bounded
validation and exact cleanup. Pros: real durable-state coverage, no deployed fault
surface, repeatable isolation. Cons: fixture/control complexity and controlled
signal/storage semantics; container replacement and hardware failure need their
own qualification.

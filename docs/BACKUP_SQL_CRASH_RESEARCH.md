# Backup SQL interruption research

Official sources discovered through MCP search and opened on October 26, 2026.
These recommendations apply to the pinned PostgreSQL 18 / Node 24 runtime; they
are not a claim about future versions. See [design](BACKUP_SQL_CRASH_DESIGN.md)
for alternatives and [outcome](BACKUP_SQL_CRASH_OUTCOME.md) for observations.

[PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
explain statement transactions and visibility of committed changes. Inference:
independent SQL observation is needed to distinguish a rolled-back target from
a committed target whose application response was lost. A rejected or unresolved
client Promise alone cannot establish the durable outcome.

[Protocol message formats](https://www.postgresql.org/docs/18/protocol-message-formats.html)
define length-prefixed messages, command completion, ReadyForQuery transaction
status and variable-length backend cancellation-key data. The fixture validates
framing, expected mutation category and idle status, but retains no cancellation
secret or row payload. It separately queries committed state; protocol completion
alone is not a storage power-loss guarantee.

[Administrative functions](https://www.postgresql.org/docs/18/functions-admin.html)
document cancellation of a current query and distinct bigint/two-integer advisory
key spaces. Use a separate fixture key space and verify the owned backend before
cancellation. Cancellation is not assumed to terminate a session.
[System information functions](https://www.postgresql.org/docs/18/functions-info.html)
define pg_blocking_pids; use the actual blocker rather than elapsed time as proof.
[pg_locks](https://www.postgresql.org/docs/18/view-pg-locks.html) documents advisory
lock representation. Observe retirement after process/socket closure rather than
equating a signal request with released ownership.

[Node 24 net](https://r2.nodejs.org/docs/latest-v24.x/api/net.html) describes socket
destruction, stream backpressure and server closure. Track each owned socket's
close event and await server closure. Bound partial frames and connection count;
discard withheld bytes after inspection. Keep the deliberate retained backend
socket explicit in evidence, with cleanup on both success and failure.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block)
requires status information to be available through suitable semantics without
moving focus. Applicable product recommendation: expose observed recovery
completion, deferral or ownership-busy state through the existing accessible
status components, using precise language. This backend qualification changes no
UI, focus behavior or announcements and provides no new screen-reader/device
acceptance evidence. Manual checks remain deferred as requested.

Final recommendation stack: existing modular owned backup service and pinned
PostgreSQL -> isolated real SQL gates -> bounded Node process/wire observation ->
independent committed-state assertions -> fresh default recovery/idempotence ->
one frozen fast gate and selected native regressions -> exact runtime comparison.
Benefits are realistic ambiguity coverage and a small deployed surface. Costs
are fixture complexity and controlled failure boundaries. Database restart,
container crash, arbitrary filesystem interruption and hardware power loss remain
separate qualifications.

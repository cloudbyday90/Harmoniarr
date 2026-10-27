# Automatic schema maintenance design

October 27, 2026. Replace operator-triggered schema diagnostics with automatic
maintenance and read-only status presentation. Schema modification stays in the
existing preparation/migration owner before application startup.

`schema-maintenance-service.js` uses the existing interval heartbeat runner and
startup supervisor. It runs immediately at startup with an hourly due interval
for current/attention results; paused, busy and failed attempts use five minutes.
Due times are anchored to the attempt start. Attempts never overlap or queue.
It retains one detached safe summary;
an overdue successful result becomes stale rather than claiming live currency.
Restart starts pending and performs another observation. No schema migration,
new persistent table, new job system or extra app container is needed.

The default diagnostics service opts into maintenance admission. Its read-only
observer checks active, unexpired recovery/restore/upgrade maintenance locks with
the existing lock/statement/transaction/owner deadlines. It also keeps the shared
preparation lock. The admission check is bounded SQL on the same owned observer,
not an unowned pool query before the deadline. A recovery lock arising after the
read can coexist with read-only observation; this check does not promise an
exclusive maintenance window or grant permission to mutate application data.

Caller completion and actual drainage remain separate. Maintenance retains
admission until native work/connection retirement settles. Shutdown aborts the
owned task and awaits drainage; uncertain retirement seals further attempts and
refuses successful shutdown. Both supervisor stopAndDrain and application fixture
close use that same idempotent closure. No browser disconnect cancels maintenance.

The existing administrator GET now returns only the maintained snapshot. It keeps
no-store, rate limits, current administrator checks before/after delivery and
fixed failure summaries. Query parameters cannot request inspection or repair.

The schema component mounts only when diagnostics opens and loads status
automatically. There is no schema refresh button. Pending/running status can be
followed every five seconds within the existing 25-second request lifetime;
completed/paused/error results stop UI polling. Closing the panel aborts only its
status read. Reopening reads the latest summary. A persistent polite status node
stays outside the busy result container, and loading never moves focus. Status
and timestamps explicitly describe the latest maintenance observation.

Qualification covers automatic startup, cadence/retry/staleness, real read-only
observation, maintenance/preparation refusal, bounded admission SQL, cheap HTTP
reads, drift without repair, shutdown drainage, and automatic accessible loading
with no permanent UI polling. Existing migration/observer/authority boundaries
remain independent and require their original guarantees.

See [research](AUTO_SCHEMA_MAINTENANCE_RESEARCH.md) and
[outcome](AUTO_SCHEMA_MAINTENANCE_OUTCOME.md).

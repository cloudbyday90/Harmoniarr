# Automatic schema maintenance research

October 27, 2026. The previous manual control requested a read-only diagnostic,
not schema migration or repair. The user requested automatic safe maintenance.

The existing Docker entrypoint already prepares schema/migrations before HTTP
startup. Preparation has an exclusive database advisory lock, transactional writes
and final validation; bare application startup verifies prepared state. This
change schedules routine observation through the existing heartbeat/supervisor
infrastructure and makes the UI a reader of the latest bounded summary.

## Official sources consulted through MCP

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  is vendor documentation. Transaction-level advisory locks release at transaction
  end and require participating callers. Retain the shared observer/exclusive
  preparer protocol and never run DDL from a diagnostic GET.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  is an informative WCAG 2.2 Understanding document. Expose pending/result/error
  status programmatically and preserve focus during automatic loading.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  discusses automatically updating content. Avoid a permanent UI ticker: read on
  opening the panel, follow an already-running check for a bounded interval, then
  stop. Backend maintenance continues independently. This is a design application,
  not a claim of full WCAG or assistive-technology conformance.

## Alternatives and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Manual scans from the UI | Useful on demand | Requires operator action and couples inspection to HTTP lifetime |
| Scan automatically whenever a page opens | No button | Multiple tabs can cause redundant database work; views own scan timing |
| Scheduled maintenance with a bounded latest summary (selected) | Independent automatic checking, one scan, cheap status reads | Summary is historical and can become stale; resets to pending on process restart |
| Automatic repair of arbitrary drift | Could remove a manual step | Cannot infer safe intent from a missing/altered object; risks data loss or bypassing reviewed migrations |

Use an immediate startup check and hourly maintenance cadence. Retry paused,
busy or failed checks at a five-minute cadence without queued attempts. Honor
recovery/restore/upgrade locks inside the existing bounded read-only observation
transaction. Keep the 20-second owner deadline, native drainage and shutdown
fencing. HTTP reads must never start or cancel maintenance.

Known versioned migrations remain automatic through guarded startup preparation.
Unexpected drift becomes attention/unavailable status for review; no blind repair
is introduced. The cached result is diagnostic history, never authorization or a
substitute for startup/mutation guards. Schedule timing is best effort under load.

See [design](AUTO_SCHEMA_MAINTENANCE_DESIGN.md) and
[outcome](AUTO_SCHEMA_MAINTENANCE_OUTCOME.md).

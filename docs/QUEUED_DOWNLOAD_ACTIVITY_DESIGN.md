# Explicit download preparation Activity design

October 20, 2026. The canonical native command prototype reproduced two
unsupported_event_type diagnostics: each Start download emitted the existing
music_queue_download_queued event, but the service allowlist rejected it.
The database CHECK constraint and client presentation also lacked this type.
Commands/transfers still succeeded, leaving explicit preparation absent from
Activity. This differs from the later provider-accepted Download started event.

Admit the existing queued event in the Activity service and a new forward-only
migration that preserves every existing event type. Generate the schema snapshot
with the repository workflow; anchor the table/event column/constraint. Preserve
best-effort Activity semantics and required command audit as distinct owners.

Render Download queued as routine download history, link to the canonical
Missing Music decision, and retain it as an explicit boundary between automatic
milestones. Copy describes preparation awaiting provider acceptance. Manual match
selection describes its separate explicit Start download action. Do not reuse
the provider-accepted event or promise automatic download after selection.

Verify producer-to-service admission, filtering and client presentation with
focused tests. The native PostgreSQL scenario awaits the actual queued-event
recording result, checks one persisted event and its authenticated feed projection
per replayed command, required audit, actor/recipient and eventual native outcome.
The preserved-data no-cache walkthrough rebuild exercises the upgrade path.
See the [canonical design](NATIVE_CANONICAL_COMMAND_DESIGN.md) and
[official-source decisions](NATIVE_CANONICAL_COMMAND_RESEARCH_2026_10.md).

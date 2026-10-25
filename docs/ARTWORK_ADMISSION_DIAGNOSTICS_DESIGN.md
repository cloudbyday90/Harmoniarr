# Artwork admission diagnostics design

October 25, 2026. Continues the [mixed qualification](WEBP_SELECTION_MIXED_MEMORY_OUTCOME.md).
See [research](ARTWORK_ADMISSION_DIAGNOSTICS_RESEARCH.md) and
[outcome](ARTWORK_ADMISSION_DIAGNOSTICS_OUTCOME.md).

Expose one fixed numeric snapshot of the existing ingestion gate: active/queued
jobs, queued input bytes, logical reserved/budget bytes and configured concurrency,
queue count/input and wait limits. Read one synchronous admission state without
changing job ownership, limits, policy, cancellation or publication lifetime.
Never expose a queue entry, source path, URL, payload, peer or error string.

The ingestion service owns access to its actual gate. Wire that service through
the app/system composition rather than constructing a diagnostic-only gate.
Use a shared allowlist/number validator at projection boundaries. Missing or invalid
observations are null/unavailable, not healthy zero values. Each diagnostic read
timestamps live admission separately from the existing monitor's last process
sample. RSS/heap/external/ArrayBuffers describe the web process, not a container
total; ArrayBuffers overlap external memory, and reservations are not measured RSS.

Add the projection to existing administrator-only system overview, queue diagnostics
and redacted diagnostics export. Reuse existing authorization and mark mutable
diagnostic responses no-store. Queue diagnostics reads only cached process memory
and live counters: no added query, provider check, native launch, history or timer.

Render a small component inside the existing Recovery diagnostics disclosure.
Reuse its load/manual-refresh lifecycle and status/error handling. Use semantic
name/value lists, binary MiB labels, sample timestamps, explicit unavailable states
and persistent polite loading/completion feedback without focus movement.
Keep logical reservations and process measurements in separate labeled sections.
Correct the adjacent queue summary's existing top-level-count mismatch against
the real nested queueState contract; omit its unsupported completed count.

Validate focused projection, real gate lifecycle, ingestion/app/system wiring,
export and route authorization/no-store boundaries. Exercise actual composed
HTTP/PostgreSQL and a browser with controlled responses for held load, populated,
unavailable/error, refresh focus and narrow layout. Run one stable fast gate,
then the no-cache Docker walkthrough preserving administrator/data/five binds.
Retain native allocation/media proof only after precise source/runtime review;
this read-only feature does not establish new native capacity or manual AT acceptance.

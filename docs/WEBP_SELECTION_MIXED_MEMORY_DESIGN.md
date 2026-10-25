# Selected WebP mixed-workload design

October 25, 2026. Continues the [selection outcome](WEBP_OUTPUT_SELECTION_OUTCOME.md).
See [research](WEBP_SELECTION_MIXED_MEMORY_RESEARCH.md) and
[outcome](WEBP_SELECTION_MIXED_MEMORY_OUTCOME.md).

## Scope

Qualify the enabled bounded WebP selector alongside the existing controlled
single-app review/media workload. Reuse all four pinned 1024-edge corpus inputs;
do not regenerate images, alter production caps, reduce reservations or add a
persistent service. Use fresh guarded 2/3 GiB containers, two CPUs, no swap,
256 PIDs, read-only source/input mounts and disposable PostgreSQL/tmpfs data.
Prepare inputs using the existing [pinned corpus](WEBP_ARTWORK_CORPUS_DESIGN.md)
workflow, then mount its prepared input directory read-only at `/boundary-inputs`.
The opt-in command is `validate:native-deployment-review-webp-selection`; set
`HARMONIARR_SELECTION_CASE` to one catalog ID and
`HARMONIARR_SELECTION_SCENARIO` to `publish` or `cancel` inside the guarded profile.

Reuse actual authenticated detail/restart HTTP, owned queue/lease completion,
64-file scan/tagging, four media inspections, 120-second audio preflight to null
output, two held PostgreSQL sort statements and a retained 256 MiB caller buffer.
Preserve original media bytes. This selected synthetic workload does not represent
every periodic platform task or establish a minimum deployment size.

## Boundaries and evidence

Add small test-only case, observation and orchestration modules through optional
fixture seams in existing workload owners. Production modules remain unchanged.
A test-only Node preload samples Sharp's active task counter and writes one
bounded marker to stderr. Keep the actual production worker/session, native
limits, cache/concurrency settings, transforms and output framing. Disclose the
instrumentation in observations and require an observed active selected task while the
scan and encoder lifetimes overlap. This does not mean a whole HTTP response
overlaps a whole selected encode; measure actual review-response overlap with
scan/encoder lifetimes separately.

For publication, hold the first actual lookup after child close and require the
full initial reservation, one queued second job and no second child. Then verify
two normal closes, two assignments, one real asset row/file, exact selected/source
hashes, sanitized metadata and exact RGB8 graphic pixels. All leases must drain.

For cancellation, abort at the first actual active-task marker. Keep the full
reservation immediately after abort and through the close event; require actual
SIGKILL retirement, no publication/assignment/file/row and no queued sibling
launch after cancellation. Review/media owners must still complete and retire.

Use focused observer/case/concurrent-drain checks, one stable fast gate and the
new opt-in matrix. Re-run baseline mixed/memory controls affected by fixture seams;
retain unchanged production/native/SQL/browser/provider proof only after exact
source, test-driver and packaged-runtime comparison. Complete the no-cache local
Docker walkthrough preserving administrator/data and all five actual binds.

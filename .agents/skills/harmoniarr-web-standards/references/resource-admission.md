# Resource admission across provider work

Use when bounding provider downloads, image processing or other expensive
asynchronous work. Discover current official guidance through MCP; the
[artwork research](../../../../docs/ARTWORK_ADMISSION_RESEARCH.md) is a starting map.

Trace admission through actual completion. In Harmoniarr, artwork routes and
prefetch share the fetch-service instance created in artwork-module.js. A limiter
inside each batch or provider leaves concurrent single calls and sibling batches
outside that budget. Separate factories/processes have separate budgets; do not
call an instance-owned gate a distributed limit.

Put bounded scalar request metadata in the queue before provider/byte allocation.
Define active count, waiting count and queue expiry separately. Recheck saved
policy after admission. Lazy producers prevent a batch from eagerly consuming all
wait slots. Preserve result ownership and distinguish temporary capacity refusal
from a provider's qualified absence; refusal must not create missing-item backoff.

Queued cancellation can remove unstarted work. An active timeout or aborted
caller does not prove native work stopped. Keep the permit until the original
download/decode/filesystem/assignment promise settles, including Error/null and
cleanup. Drain batch siblings before returning its capacity failure. Record whether
earlier batch items can already have committed; a transport error is not rollback.

For artwork, run the admission policy/consumer tests, HTTP capacity test and
artwork-admission-https native journey. Hold final publication while overlapping
batch/single calls wait; prove no third download, real Sharp/files and zero
dispatch for cancelled waiters. Keep fixture routing/trust scope explicit.
Numeric counters and fixed errors need no endpoint/recipient telemetry.

Per-image bytes/pixels, stream backpressure, Sharp threads/cache, admitted image
lifecycles and process/container memory are different budgets. Tiny-image native
proof establishes lifecycle counts, not safe RSS or production throughput. Preserve
resource controls and qualify large-image/multi-process needs separately. See the
[design](../../../../docs/ARTWORK_ADMISSION_DESIGN.md) and
[outcome](../../../../docs/ARTWORK_ADMISSION_OUTCOME.md).

## Direct image ingestion

Inventory actual callers before assuming a feature exists. Artwork serving reads
stored originals; derivative settings/directories alone do not establish a running
generator. Provider, embedded and sidecar paths share the module's ingestion service.
Its independent gate covers reading/decoding through asset publication. Fetch can
hold an outer fetch slot while awaiting this gate; ingestion must not reacquire its
own gate from the file entrypoint or acquire fetch admission in reverse order.

Bound queued buffer bytes as well as count. Supplied buffers remain caller-owned
and must stay stable through completion; this accounting does not bound allocations
made before the call. Queue paths without reading files first. Stat and bounded
reads belong to one regular-file handle; count the first excess byte after growth
and await close. Keep read-limit evidence distinct from path authorization or file
snapshot/immutability claims. Native file errors need fixed private diagnostics.

Use artwork-ingestion-budget/admission and artwork-file-reader server tests, then
the explicit Linux native FIFO/growth lane. The fixed ingestion workload measures
six real one-megapixel files/buffers; compare exact hashes/dimensions/publications
between immutable images. Sampled RSS and one elapsed pair are observations, not
worst-case capacity, safe defaults or a throughput improvement. Keep measurement
containers isolated and verify their exact retirement. See the
[ingestion design](../../../../docs/ARTWORK_INGESTION_BUDGET_DESIGN.md),
[research](../../../../docs/ARTWORK_INGESTION_BUDGET_RESEARCH.md) and
[outcome](../../../../docs/ARTWORK_INGESTION_BUDGET_OUTCOME.md).

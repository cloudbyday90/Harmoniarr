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

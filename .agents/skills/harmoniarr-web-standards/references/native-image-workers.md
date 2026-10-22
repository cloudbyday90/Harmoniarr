# Native image worker qualification

Use when changing artwork processing, child lifecycle, cancellation, result delivery
or memory-containment claims. Start with the actual shared ingestion owner and
[resource admission](resource-admission.md). Do not infer a derivative generator
from settings/directories. Do not build a second job queue or grant Docker-daemon
access to the application.

## Decide the boundary

1. Discover official version-specific Node, Sharp, OWASP and deployment documentation
   through MCP; open actual results/navigation. Record date, version, source status
   and the engineering inference separately. W3C Privacy Principles is a Statement,
   not an accessibility or security conformance certificate.
2. Inventory which process owns input bytes, native execution, source metadata,
   credentials, storage paths and repository publication. Give a child only the
   bytes/numeric policy it needs. Review transitive imports: importing auth solely
   for an error helper pulls application dependencies into the native worker.
3. Compare in-process work, worker threads, short-lived processes and separate
   constrained deployment. Worker-thread JS limits and Node heap flags exclude
   native buffers; libvips cache/thread settings are different budgets from RSS.
4. Keep input/output/header limits, active/wait-byte admission, processing deadline
   and OS limits explicit. A deadline invalidates results; failed termination must
   retain the permit. Never promise a bounded response if OS retirement can stall.

## Implement and prove

Use explicit executable/argument vectors, ESM modules, no shell/preloads, a minimal
environment and bounded binary framing. Project allowed fields and fixed errors;
never publish raw child stderr or native paths. Keep stores/filesystem publication
in the parent. The child shares OS user/container capabilities unless independently
sandboxed; absence of application publication imports is not OS access control.

Accept success only after validated exact output, zero exit and actual child/stdio
close. Register error, stream and close handlers before dispatch. Kill on timeout,
active abort or invalid protocol, discard late output, and hold admission through
close even when kill fails. Preserve temporary worker failures through batch
consumers; do not turn them into provider absence/backoff. Cancellation after the
completed worker boundary does not undo a parent publication already started.

Test close separately from exit and signal delivery. Hold valid late output and
assert zero file/repository effects after refusal. Then use real processes/Sharp:
maximum byte input, maximum pixels, first excess byte/dimension, synchronous
non-cooperation, native-active cancellation, nonzero exit and parent-loader-blocked
default wiring. Verify retired PIDs and container absence. A blocked fixture is
not a reproduced decoder defect; padded bytes are not high-entropy pixel stress.

Keep expensive cases in the explicit constrained Linux lane. Compare exact hashes,
dimensions, approved metadata and publication counts. Report container-wide memory
and per-process samples with their scope. A shared cgroup can kill the server;
do not claim independent worker OOM containment. Review PIE/ASLR and actual OS
capabilities before claiming hostile native-code isolation. If the operator asks
for memory management in the existing app, use [worker memory](worker-memory.md);
do not turn that request into a separate deployed service.

See [design](../../../../docs/ARTWORK_WORKER_DESIGN.md),
[official research and tradeoffs](../../../../docs/ARTWORK_WORKER_RESEARCH.md)
and [outcome/run instructions](../../../../docs/ARTWORK_WORKER_OUTCOME.md).

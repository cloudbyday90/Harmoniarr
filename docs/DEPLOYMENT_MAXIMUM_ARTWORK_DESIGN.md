# Maximum-resolution artwork qualification design

Date: October 24, 2026. Implements the next item from the
[mixed corpus outcome](DEPLOYMENT_REVIEW_CORPUS_OUTCOME.md).
See the separate [research](DEPLOYMENT_MAXIMUM_ARTWORK_RESEARCH.md) and
[outcome](DEPLOYMENT_MAXIMUM_ARTWORK_OUTCOME.md).

## Boundary and architecture

Exercise fixed 8192 × 8192 RGB8 JPEG and WebP noise under existing 100 MiB input
and pixel policies. Use the existing single application, public-address-checked
local TLS provider, artwork admission/decoder, PostgreSQL, scan/probe/encode and
authenticated review workload. No additional deployed service or production
resource-policy change is required for this qualification.

Keep generation, case selection, outcome verification and the guarded native
entry in separate ESM files. `artwork-noise-source.js` emits deterministic
uncompressed TIFF with sixteen-row strips, one 24 KiB RGB row at a time. Stream
it into an exclusively created owned temporary file with 64 KiB stream thresholds.
Sharp encodes that file with cache disabled and concurrency one, restoring prior
preferences on success/failure. The 192 MiB raw file is removed before application
work. Encoded output is bounded at 100 MiB and must exceed 20 MiB. Stream thresholds
do not bound native encoder memory; lifetime cgroup peaks include generation.

The maximum cases retain current input and production processing bounds. Fixture
generation has its own 60-second encoder bound; production rewrite/worker deadlines
remain 10/15 seconds and the Linux worker DATA ceiling remains 1 GiB. The test
entry requires disposable Linux tmpfs/database and declared 2/3 GiB, two-CPU,
256-PID profiles before acquiring its pool. Each case uses a fresh container.

## Evidence and outcomes

Admission eligibility does not promise successful decoding. Observe both jobs and
distinguish publication, owned capacity/processing refusal, mixed outcomes and
**contained native failure**. The latter records SIGABRT plus an owned failed
worker result; it establishes containment only. It does not establish a graceful
refusal, a successful maximum-resolution feature, or the cause of the abort.

Reject forged admission/worker failures, cancellation, malformed-input refusals,
unexpected signals, unowned kills and kernel limit/OOM events. A SIGTERM/SIGKILL
needs an owned timeout. At least one actual artwork child must run; capacity
refusals account exactly for jobs that did not spawn. The original seven-case
corpus keeps its stricter success/memory-refusal contract.

For every success verify source/stored hashes, dimensions/format, metadata removal,
asset identity and owner assignment. Every refusal needs zero assignment. Compare
the complete artwork root to successful paths and the asset table to successful
identities. Require publication lookups only for successful jobs, actual child
close/process absence, zero final reservation, released leases, unchanged media
sources and successful unrelated work. Compare kernel counters before generation
and after cleanup as well as within the measured workload.

Real lifecycle overlap remains required; it does not imply simultaneous maximum
CPU or memory peaks. Preserve per-operation HTTP observations, caller buffers,
native/database settings, sampled process fields and whole-lifetime cgroup peaks
as separate quantities. Human screen-reader/device acceptance stays deferred.

## Validation plan

Run lazy-source/actual TIFF decode and multi-strip pixel parity, owned cleanup,
Error/null preservation, cache restoration and refusal/termination classification
checks with the existing corpus and observer/drain cohort. Keep native allocation
outside the fast gate. Run the two new cases at both caps, affected default memory
and baseline mixed cases, and representative strict corpus success/refusal cases.
Retain unchanged SQL/browser/provider evidence only after exact source and packaged
runtime comparison. Perform the preserved-state no-cache walkthrough rebuild;
do not reset the existing administrator, data or mounts or create a release.

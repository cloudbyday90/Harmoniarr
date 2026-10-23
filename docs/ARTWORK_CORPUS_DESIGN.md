# Artwork sample-depth and entropy qualification

Decision date: October 22, 2026. Implements the next qualification item from the
[built-in memory outcome](ARTWORK_MEMORY_OUTCOME.md). See separate
[research and alternatives](ARTWORK_CORPUS_RESEARCH.md) and
[executed outcome](ARTWORK_CORPUS_OUTCOME.md).

## Bounded inputs and real decoder evidence

Add a test-only ESM corpus generator with seven fixed, frozen cases. It accepts
only its owned case objects, keeping dimensions, raw allocation, compressed output
and format choices bounded. A small PNG writer emits actual 8/16-bit network-order
samples, filter-zero scanlines, CRCs and zlib data. The largest refusal image streams
repeated rows through compression rather than allocating its entire 512 MiB raw
pixel array. Compressed fixture output is capped at 20 MiB.

Accepted cases cover 1024-square RGB8, RGBA8, grayscale16 and RGBA16 PNG noise;
1024-square JPEG noise; and 512-square WebP noise. Deterministic pseudo-random
samples provide incompressible PNG data. This is decoder workload diversity, not
cryptographic randomness or a claim about worst-case hostile media. The JPEG
contains actual synthetic EXIF metadata to qualify its removal.

The seventh case is an 8192-square 16-bit RGBA PNG with compressible pixel patterns.
It is valid and fits the compressed-byte policy, but its sample-depth estimate
exceeds the existing 1 GiB DATA budget. Require the actual default worker to return
owned capacity failure with no file or repository publication.

Native Sharp metadata must confirm dimensions, channels, `ushort`/`uchar` depth
and PNG `bitsPerSample`; a generation option alone does not establish bit depth.
Accepted PNGs must remain pixel-identical in their canonical decoded **8-bit**
projection. The existing application deliberately rewrites them at eight bits;
this does not preserve original 16-bit precision. JPEG/WebP are lossy and do not
use input/output pixel equality as an acceptance criterion.

## Existing execution and publication owners

Use the existing ingestion service and real filesystem publication. Accepted
cases execute the real transformation in the existing disposable-child fixture,
with actual pre-exec DATA/core limits, JIT-less settings, cache disabled and one
native thread. The fixture reports only bounded test-owned memory counters. The
refusal case uses the production worker entrypoint and fixed failure protocol.
No runtime decoder, queue, deployment or publication policy is replaced.

Require source checksum/output hash agreement, output format/dimensions/alpha,
expected publication counts, retired child PIDs and unchanged kernel OOM-kill
counters. Validate a synthetic EXIF-bearing JPEG before asserting no output EXIF.
Child kernel maximum RSS is distinct from the whole-container peak. Per-case
elapsed time includes publication/verification and is not a native-operation
benchmark or an elapsed-time test assertion.

Extract test-only cgroup v1/v2 profile checks into a small shared helper used by
the existing memory lane and this corpus lane. Require the declared CPU, memory,
no-additional-swap and PID controls; unavailable evidence fails qualification.

## Efficient repeatability

Expose `npm run validate:native-artwork-corpus` for the constrained Linux container.
It runs seven cases serially in a one-CPU/1 GiB/96-PID, network-disabled, read-only,
UID-1000 fixture with disposable storage. Keep it outside routine fast-test globs.
Requalify the existing three-case memory lane after sharing its kernel helper.
No SQL/client changes require another full database or browser acceptance matrix.

## Aggregate admission decision

Keep the existing two-active-job gate and 1 GiB child DATA limit. Moderate-size
noise/depth samples cannot justify reducing a ceiling needed by the prior maximum
JPEG. Summed observed peaks also cannot establish a safe whole-app memory budget.
The parent retains input/output buffers; provider intake, embedded PostgreSQL,
native reservations and shared mapped pages have separate ownership/accounting.

A future aggregate change should reserve a documented parent/input baseline before
heavy work, exchange bounded child metadata before rewrite, then acquire the
additional decoded-work budget in the existing admission owner. Release that
reservation only after actual child close/publication completion. Keep cancellation,
deadlines, bounded waiting and owned temporary failures. A sampled free-memory value
may inform refusal/diagnostics but is not a reservation or a protection against
another process allocating after the sample.

That staged reservation needs dedicated protocol/lifecycle qualification before
implementation. This round supplies diverse native evidence and that concrete
design recommendation; it does not claim aggregate OOM containment.

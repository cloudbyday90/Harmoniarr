# Artwork rewrite headroom design

October 24, 2026. Follows the diagnosis item in the
[maximum artwork outcome](DEPLOYMENT_MAXIMUM_ARTWORK_OUTCOME.md).
See separate [research](ARTWORK_REWRITE_HEADROOM_RESEARCH.md) and
[outcome](ARTWORK_REWRITE_HEADROOM_OUTCOME.md).

## Observed boundary

A minimal private phase replay reaches input completion and metadata completion,
then starts rewrite and aborts before rewrite returns. Bounded stderr records a
GLib failure to allocate 134,217,728 bytes. Kernel limit/OOM counters do not increase.
A separate run with extra memory sampling completes successfully; that run does
not diagnose the earlier abort. No syscall trace or allocation stack identifies
the exact backing allocation or proves the particular limit that denied it.

The child guard used `64 MiB + 2 × input + decoded estimate`, while the parent
already estimated child work as `128 MiB + 2 × input + 100 MiB output + decoded
estimate`. The output allowance matters during native rewrite, before a returned
Buffer can be checked. A JavaScript catch cannot turn a GLib process abort into
a normal refusal.

## Change and ownership

Export one pure `artworkWorkerMemoryEstimate` from the existing small worker-memory
module. Reuse it in both the child guard and parent metadata reservation. Keep
the parent's existing numeric estimate; raise the child admission estimate to
match it. This consolidates policy without adding a service or singleton.

The model retains 128 MiB runtime allowance, two input-byte allowances, the
existing 100 MiB output allowance and the current conservative decoded-pixel/
sample-depth estimate. These are planning allowances, not exact allocator limits,
independent RSS quantities, or a guarantee against every native failure. DATA
remains 1 GiB, old-space 128 MiB, rewrite/worker deadlines 10/15 seconds, and
aggregate admission 2 GiB. Input byte/pixel policies do not change.

The guard runs after validated metadata and before the parent grant, rewrite or
statistics. It emits the existing owned `artwork_worker_memory` 503 frame. This
preserves temporary-failure semantics, actual child close and parent-owned
publication. No paths, credentials, raw native diagnostics or phase markers are
added to the production protocol or product interface.

At 8192² RGB8 the new model admits at most 14 MiB input at the exact estimate
boundary. This is one geometry/depth example, not a global encoded-file limit.
The fixed noisy JPEG/WebP inputs exceed it. Smaller/cheaper combinations and the
existing maximum-pixel low-entropy RGB case retain their acceptance behavior.

## Regression contract

The maximum native entry now requires owned memory/capacity refusal, zero
publication and normal exit code 1 with no signal. Each real child must emit only
the 21-byte memory-failure frame: no metadata/grant handshake or output body.
Retain queue capacity accounting and all existing unrelated review/media success,
leases, hashes, counter and cleanup checks. Historical containment evidence stays
historical; SIGABRT is no longer an accepted result for this fixed regression.

For these two large maximum fixtures, keep the scan's first tag stage gated until
actual artwork spawn, then release it. Ordinary cases keep their existing release
point. This removes a short-scan timing race during large TLS downloads without
delaying or replacing the real encoder. Cleanup always releases the scan; actual
encoder/artwork overlap remains required. This is lifecycle coordination, not
proof of simultaneous maximum processing peaks.

Use focused budget, transform/grant, framing, ingestion and observer tests, then
one stable fast gate. On the final immutable image run both maximum formats at
2/3 GiB, default deployment memory and baseline mixed checks, plus the seven-case
native corpus, seven worker lifecycle cases and four allocation/admission cases
in their original profiles. Keep expensive work outside the fast gate. Rebuild
the preserved-state walkthrough without cache; create no release.

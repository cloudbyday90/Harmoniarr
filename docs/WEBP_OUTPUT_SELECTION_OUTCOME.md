# Bounded WebP output selection outcome

October 25, 2026. Implements the [design](WEBP_OUTPUT_SELECTION_DESIGN.md) and
[research/recommendation stack](WEBP_OUTPUT_SELECTION_RESEARCH.md), following the
[lossless qualification](WEBP_LOSSLESS_REWRITE_OUTCOME.md). Docker preservation and
runtime identity are documented separately in the
[rebuild outcome](LOCAL_DOCKER_WEBP_OUTPUT_SELECTION_OUTCOME.md).

## Implemented behavior

Production now compares sequential sanitized lossy and lossless WebP rewrites for
confirmed still, opaque, three-channel RGB8/sRGB lossless WebP inputs of at most
1024 pixels per edge and 1 MiB compressed. Decoder metadata and bounded container
facts must agree. Profiled, alpha, animated, lossy and unsupported layouts retain
the existing rewrite. The structural inspector never substitutes for decoding.

Both encodes use quality 90/effort 4 and must succeed. The smaller sanitized output
wins; lossless wins a size tie. Neither source bytes nor an alternate file are
published. New ESM modules own container facts, eligibility and the injectable
rewrite service, keeping those policies outside the worker lifecycle service.

The encodes share one ten-second monotonic acceptance budget. Native timeout
windows round down from the remaining seconds, with pre/post completion checks.
Because Sharp's timeout excludes libuv queue wait, this is not an independent
instantaneous ten-second kill: the unchanged fifteen-second parent deadline and
actual child-close fence remain essential. Native failure, insufficient time,
late completion, invalid geometry or oversized output produces an owned failure,
without retrying or returning a partially completed selection.

## Memory ownership and tradeoff

The selected mode reserves the full existing initial envelope before granting
native work: 1 GiB child DATA, 64 MiB mapping allowance, parent input and two
100 MiB collector/final-output allowances. Both retained encoder outputs and
native/runtime allocations remain inside the child's DATA ceiling. This is
conservative admission accounting, not a universal RSS or allocator guarantee.

The optional `webpSelection: true` metadata field is strictly validated against
bounded geometry, sample type, format and actual input length before grant. Its
reservation cannot shrink. Tests held 1,350,566,688–1,351,406,432 bytes through
actual child close and a deliberately delayed publication lookup. A second job
remained queued until publication released the lease; all final reservations were
zero. Ordinary jobs keep their existing shrinking behavior.

The benefit is bounded output size without choosing lossless for photographic
content that grows substantially. The cost is a second encode and serialization
of selected jobs under the existing 2 GiB active budget. Keep this conservative
policy; these small-input observations do not justify reducing the reservation.

## Actual publication and cancellation

Each publication case ran twice through production workers and the real default
PostgreSQL repository/filesystem in a fresh guarded container, at both 2 and 3 GiB.
The first ingestion stored the asset; the second deduplicated it. Each profile
ended with exactly one asset row and one file, the pinned source checksum, the
expected selected output hash, stripped EXIF/ICC/XMP and two normally closed
workers. Graphic outputs matched every decoded RGB8 sample exactly.

| Pinned input | Selected encoding / bytes | Previous lossy bytes | 2 GiB kernel lifetime peak | 3 GiB kernel lifetime peak |
| --- | --- | --- | --- | --- |
| photo-earth | Lossy / 150,382 | 150,382 | 201,224,192 | 205,430,784 |
| painting-cypresses | Lossy / 143,482 | 143,482 | 185,331,712 | 179,785,728 |
| cover-type | Lossless / 538 | 37,194 | 181,051,392 | 181,092,352 |
| cover-gradient | Lossless / 5,232 | 12,430 | 194,146,304 | 197,607,424 |

These peaks include PostgreSQL, worker statistics and post-publication pixel
verification. They are whole-fixture observations, not isolated encoder benchmarks
or minimum deployment requirements. The host exposed cgroup v1 approximate current
usage and a kernel lifetime peak; its v2-style OOM event field is unavailable.
Available event counters were unchanged in every profile.

A separate 3 GiB cancellation fixture waited for a real active Sharp native task
before aborting. The child was still open at abort; all 1,350,571,400 reserved bytes
remained held immediately afterward. The child then closed with SIGKILL, leaving
no publication lookup, asset row or file and zero final reservation. All worker
PIDs were gone after each test.

## Validation and evidence scope

- 257 focused policy, parser, rewrite, admission, framing and lifecycle tests passed.
- One stable fast gate passed 11,173 tests: 5,993 server, 4,480 client and 700 scripts,
  plus required lint, ESM, copyright, migration/schema, topology, hygiene and builds.
- The rebuilt immutable image passed 38 native tests in 21 fresh containers:
  nine new selection/publication/cancellation profiles and 29 affected existing
  worker, corpus, allocation and mixed review/media controls.
- Existing maximum JPEG publication, medium WebP success and deliberate large
  WebP pre-grant refusals remained correct. The fixed noisy 7120 WebP case still
  refused normally with its owned 21-byte frame; it was not relabeled a success.
- Six actually mapped native binaries match the prior runtime. The 21 final
  containers, two development smoke containers and inventory/identity helpers
  were retired and their absence checked; the application remains healthy.

The previously established 42 SQL and nine browser checks, controlled-provider
and file-backed chains are retained evidence, not fresh executions. Exact source,
driver and packaged-runtime comparison supports retaining them: nine intended
artwork runtime modules changed/appeared, while 928 other existing server modules,
11 shared modules, 155 client files and dependency/native inventories match.
Affected native coverage was rerun. No new UI or manual accessibility acceptance
is claimed; the previously deferred human checks remain pending.

Private reproducible logs, pins, source manifests, resource retirement and audit
records are under `.tmp/webp-output-selection-2026-10-25/`. A trailing CR on the
test-only inspector re-export was normalized after the fast gate; an exact byte
comparison records that formatting-only difference and targeted inspector tests
were rerun. No runtime code changed after the stable gate or image build.

GitHub MCP searches at task start and final review returned no open pull requests,
so random PR implementation, rebase or cleanup was not applicable. Work stays on
main with all project changes committed/pushed; no release or branch is created.

## Next recommendation

Continued in the [mixed-workload qualification](WEBP_SELECTION_MIXED_MEMORY_OUTCOME.md),
with separate [design](WEBP_SELECTION_MIXED_MEMORY_DESIGN.md) and
[research](WEBP_SELECTION_MIXED_MEMORY_RESEARCH.md). The following recommendation
records the evidence gap at the end of this implementation.

Qualify this selected mode while heavy review/media native work overlaps, using
the existing pinned inputs in fresh 2/3 GiB profiles. Keep the full reservation
and verify actual overlap, publication/queued work, cancellation, kernel events
and lease retirement. The existing mixed controls exercise the baseline path;
the new selection publication profiles do not yet establish selected-mode
behavior under that heavier overlap. Obtain that evidence before considering
a smaller reservation, more concurrency or broader input eligibility.

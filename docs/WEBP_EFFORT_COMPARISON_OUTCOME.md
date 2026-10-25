# WebP effort comparison outcome

October 25, 2026. Implements the next item in the
[encoder boundary outcome](WEBP_ENCODER_BOUNDARY_OUTCOME.md). See separate
[research and tradeoffs](WEBP_EFFORT_COMPARISON_RESEARCH.md),
[design and replay](WEBP_EFFORT_COMPARISON_DESIGN.md), and
[no-cache Docker outcome](LOCAL_DOCKER_WEBP_EFFORT_COMPARISON_OUTCOME.md).

## Result and policy decision

Effort 2 at quality 90 encoded the fixed full-size input within unchanged limits;
effort 4 returned an owned normal failure without an artifact. On the independently
predeclared center crop, effort 2 was faster but produced **32.80% more bytes** and
slightly higher RGB error. **Retain production quality 90/effort 4 and its current
early memory refusal.** This experiment supports a representative quality review,
not a global effort switch or automatic retry policy.

The input is the same 7120² RGB8 WebP, 10,675,042 bytes:

`7ea1eb9d58f173027c2e3534dacac3c8c83596a438e7b062d0ce5c03122430ad`

It was reused from the prior prepared artifacts; no fixture dimensions, source
bytes, quality, DATA/heap limits or deadlines were tuned to obtain a reference.
The center crop is 1024² at left/top 3048, declared before measurement.

## Encoder observations

Each final case used its own fresh 3 GiB/two-CPU/96-PID container on immutable
image `sha256:bb22248b50ffdc7603f642fed9fbca66390723c842385c055663d8d5adc73410`,
with network disabled, no capabilities, read-only root/input and a fresh explicit
artifact directory. Temporary filesystem capacity was verified at 256 MiB,
matching the existing native profile. Children retained 1 GiB DATA, 128 MiB
old-space, ten-second native rewrite and fifteen-second outer deadlines.

| Scope / effort | Actual outcome | Output bytes | Rewrite ms | Whole worker ms | Child peak RSS KiB | Container lifetime peak bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Full / 2 | Encoded | 25,373,902 | 5,197.462 | 5,465.91 | 487,700 | 525,119,488 |
| Full / 4 | Owned failure, normal exit 1 | 0 | 7,147.186 | 7,360.08 | 827,336 | 994,189,312 |
| Center / 2 | Encoded | 660,940 | 1,150.154 | 1,372.42 | 484,632 | 492,658,688 |
| Center / 4 | Encoded | 497,712 | 1,266.100 | 1,509.34 | 483,208 | 491,020,288 |

`encodeMs` measures the lazy Sharp rewrite pipeline, including decode, rotation
and crop where applicable; it stops before output handoff. Whole-worker time also
includes startup, metadata/grant and output delivery through actual close.
Container peak includes parent/test and temporary-file costs; child peak is a
separate process-lifetime RSS observation. These are single runs under existing
host load, not statistically established speedups or deployment minima.

All children closed with no signal and verified PID absence. Successful artifacts
were written by the parent after close, reread and hashed; output dimensions and
EXIF/ICC/XMP removal were verified. The failed full-size case left no output file.
All cgroup v1 fail-count and OOM-kill counters remained zero; unavailable v2 OOM
evidence remains `null`. Current v1 memory usage is approximate. The full effort-4
failure has generic owned worker code `artwork_worker_failed`/503; this run does
not independently re-establish the previous debugger's exact native allocation.

## Separate pixel measurements

Decoded each output against the same decoded, already-lossy input in a separate
3 GiB/two-CPU/96-PID container, verifying artifact hashes before decoding. Metrics
allocate no memory inside the encoder measurements. RGB MSE averages all 8-bit
channel samples; PSNR is `10 log10(255²/MSE)`. Identical pixels would use
`identical=true` and `psnrRgbDb=null` to represent infinite PSNR safely in JSON.

| Scope / effort | RGB MSE | RGB PSNR dB | Maximum absolute channel error |
| --- | ---: | ---: | ---: |
| Full / 2 | 31.747223 | 33.113746 | 70 |
| Full / 4 | Unavailable: no output | Unavailable | Unavailable |
| Center / 2 | 33.457300 | 32.885895 | 54 |
| Center / 4 | 31.740189 | 33.114709 | 54 |

For the crop, effort 4 used 24.70% fewer bytes relative to effort 2 and improved
RGB PSNR by 0.228814 dB. This noise-only crop cannot establish natural-artwork
perceptual quality or full-size resource behavior. There is **no full-size paired
quality or compressed-size comparison**, because effort 4 produced no output.
Re-encoding an already-lossy source cannot restore its original TIFF detail.
The separate metric container peaked at 623,722,496 bytes with unchanged counters.

Successful output SHA-256 values:

| Case | SHA-256 |
| --- | --- |
| Full / 2 | `ff9b6ed568768ee2edd465eaf7a94c33beddb4d97d1eeab0cb039e7c06242635` |
| Center / 2 | `b8bd5fe9c6f5b1cc97badaaffe79f8aad91d12e77a73957dfd6ca954e4c71a76` |
| Center / 4 | `5e53fc9ca4b0d78b08a0b2ce7642f2e489637f042162f758ce740af7d9fa61aa` |

## Preserved attempts and correction

The preliminary probe produced the same full effort-2 artifact hash and a failed
effort-4 result. Its timer included writing the output file, so its duration is
excluded from the final timing comparison.

The first four harness cases accidentally used 128 MiB temporary storage instead
of the existing 256 MiB profile; all failed. One separate bounded diagnostic run
observed `No space left on device` during rewriting. These five runs remain under
`attempt-1-*` and `diagnostic-*` in private evidence and are invalid as method
comparison evidence. Corrected the harness to the original storage profile and
added a native preflight capacity/mount guard. No DATA, heap, container memory,
CPU or deadline limit was increased. Repeated focused checks and the fast gate
after that guard change; the earlier passing gate is preserved separately.

## Implementation and validation

Added small ESM testing modules for frozen case selection, production-service
process/framing reuse, a pinned test-only child and RGB metrics. The opt-in entry
is `validate:native-webp-effort-comparison`; the
[design](WEBP_EFFORT_COMPARISON_DESIGN.md) includes its constrained replay command.
There is no persistent second app/service. Diagnostic output is bounded, arguments
allowlisted, file writes parent-owned and cleanup tied to actual process close.
The child explicitly bypasses application aggregate admission solely to compare
rewrites; its results do **not** qualify application publication or statistics.

- Final 25 focused tests passed: selectors/metrics and existing worker framing,
  session, lifecycle and pinned-input checks.
- Final fast gate: **11,138 passed** (5,958 server, 4,480 client, 700 scripts),
  plus lint, copyright/ESM/migration/schema/image/topology/hygiene checks and builds.
- Six final native comparison/control tests passed in six fresh containers.
  Four comparison tests mean three encodes plus one correctly recorded failure,
  not four successful encodes. The production 4096² WebP control produced 29,920
  bytes with its unchanged hash. The production 7120² mixed-workload control
  retained normal pre-grant memory refusal, 21-byte frames, zero publication and
  zero remaining reservation while review/media work completed.
- The 13 preliminary, invalid/diagnostic, final comparison, metric and production
  control containers were retired and absence checked. Inventory/identity helpers,
  the builder and bootstrap helper were also retired. Six actually mapped runtime
  file hashes, including Sharp/libvips and libc, match the preceding normal image.
- Earlier 27 unaffected native, 42 SQL and nine browser tests plus controlled
  provider/file-backed evidence are retained after exact production source,
  existing driver, package and packaged-file comparison. They are not new runs.
  Human screen-reader/device acceptance remains deferred as previously requested.

Final source fingerprint: 3,481 files,
`da18503c481e85a18ca2ca059930d7af80c1fd86e6658c17dedb34777505f524`.
Private evidence is under `.tmp/webp-effort-comparison-2026-10-25/`; large generated
images, logs and local state remain outside Git. The GitHub MCP found **no open
PRs**, including the final recheck, so no random PR could be implemented or rebased.

## Recommendation stack and next item

1. Keep production effort 4, shared admission, native hard limits and owned refusal.
2. Keep isolated pinned comparisons and production success/refusal controls opt-in.
3. Require actual artifacts, separate metrics and honest absent-reference results.
4. Reuse unchanged evidence after exact review; keep the routine fast lane cheap.
5. Next: predeclare a small representative artwork corpus and acceptable quality,
   size and latency deltas; compare both efforts within the existing limits and
   perform visual review before deciding on effort 2 or an explicit fallback.

Effort 2's benefit is a supported full-size rewrite with lower observed resource
use here; its cost is larger output and slightly higher crop error. Retaining the
current policy preserves established compression behavior and conservative refusal,
at the cost of continuing to reject this known oversized-memory candidate. The
representative corpus is the recommended next item; no release or branch is created.

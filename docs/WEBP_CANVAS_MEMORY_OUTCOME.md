# WebP decoder canvas outcome

October 25, 2026. See the separate [design](WEBP_CANVAS_MEMORY_DESIGN.md),
[official research and tradeoffs](WEBP_CANVAS_MEMORY_RESEARCH.md), and
[local rebuild](LOCAL_DOCKER_WEBP_CANVAS_MEMORY_OUTCOME.md).

## Implemented behavior

The shared estimate now includes the WebP decoder's four-byte-per-pixel canvas,
even for RGB images without alpha. Child admission and parent reservations use
the same helper. After header inspection, the selected 8192² WebP returns owned
`artwork_worker_memory` 503 before the metadata/grant handshake, rewrite or
statistics, replacing its
previous opaque rewrite failure. No image or assignment is published.

Its estimate changes from 1,072,636,152 to 1,341,071,608 bytes, exceeding the
unchanged 1,073,741,824-byte DATA limit by 267,329,784 bytes. The pinned JPEG's
estimate remains 1,072,690,756 bytes. Heap, DATA, deadlines, aggregate budget,
byte/pixel/output policies, encoder settings and public protocol stay the same.
The implementation remains modular ESM within the existing application.

The canonical opt-in command is
`npm run validate:native-deployment-review-artwork-boundary`. Select the fixed
JPEG `rgb8-jpeg-admitted-noise` or WebP `rgb8-webp-canvas-refusal` descriptor.
The previous admitted command and WebP selector remain aliases to this entry.
Use the explicit disposable deployment profile and read-only prepared input
mount from the [prepared-input design](ARTWORK_ADMITTED_BOUNDARY_DESIGN.md).
`npm run validate:native-artwork-webp-canvas` separately requires the guarded
3 GiB/two-CPU/96-PID profile for a real 4096² WebP success control.

## Investigation evidence

Two real mixed-workload jobs completed input/metadata, then failed inside rewrite
with a private native diagnostic requesting 256 MB. Neither reached statistics;
both exited 1 without a signal. Separate probes under identical DATA/heap bounds
show minimal decode and statistics succeed, while file-backed rewrite fails with
the same message. Probe children and containers retired, with no added OOM kills.

Pinned libvips source establishes an RGBA loader canvas and an internal writer
even for file output. Its 8192² canvas is 256 MiB. The matching size supports the
accounting decision; it does not identify the exact failing call or denying
constraint without a captured allocation stack/syscall trace. No production
logic matches vendor error text or exposes these diagnostics.

## Validation

The frozen 3,472-file source fingerprint is
`baf7b0096adcf592aca18d0b182c99a2b63ad5457ea2a5807be1956964405d40`.
One stable fast gate passes **11,131 tests**: 5,951 server, 4,480 client and 700
scripts, plus lint, ESM, schema/migration, hygiene and build checks. The affected
focused cohort passes 63 tests. Both updated skills validate.

The rebuilt runtime passes **27 native tests in ten fresh containers**: four
boundary profiles, three default-memory cases, one baseline mixed case, seven
worker lifecycle cases, four allocation/reservation cases, seven corpus cases and
one medium-WebP success case. Lifecycle/corpus profiles retain 1 GiB/one CPU;
allocation/medium profiles retain 3 GiB/two CPUs. Mixed profiles use 2/3 GiB and
two CPUs. Workers retain their original DATA/heap/deadline limits.

| Fixed input | Container | Images / assignments | Actual worker result | Lifetime peak / sampled peak (MiB) |
| --- | --- | --- | --- | --- |
| JPEG, quality 24 | 2 GiB | 2 / 2 | Both exit 0, no signal | 1570.0 / 1567.8 |
| JPEG, quality 24 | 3 GiB | 2 / 2 | Both exit 0, no signal | 1564.7 / 1562.5 |
| WebP, quality 3 | 2 GiB | 0 / 0 | Both memory 503, exit 1, no signal | 745.7 / 743.5 |
| WebP, quality 3 | 3 GiB | 0 / 0 | Both memory 503, exit 1, no signal | 786.2 / 781.6 |

Each WebP child sends only the 21-byte memory-failure frame, before any grant or
body. JPEG retains sanitized output/hash/metadata checks. Prepared bytes match
their source-pinned hashes in every consumer; the earlier preparation manifest
has the historical WebP label, while the bytes and pinned digest remain identical.
No input is regenerated or tuned in these profiles.

Each boundary run also completes eight actual HTTP operations and three worker
qualification steps, two held 100,000-row sorts, scan/tag work, probes and a real
FFmpeg encoding task. Actual HTTP/native lifetime overlap is observed. Children,
reservations and all four captured leases retire, with no publication on refusal.
The host uses cgroup v1: usage is approximate, limit failure counts and OOM kills
remain unchanged, and unavailable v2 OOM events remain null. Peaks include fixture
setup/input loading, exclude separate preparation, and establish neither a
deployment minimum nor simultaneous per-component maxima.

The 4096² WebP control succeeds with actual grant metadata, EXIF removal and child
retirement: 30,178 input bytes, 29,920 output bytes, output SHA-256
`8c3ff2ea21ab444421e8c69ca66c2b4930041a793dafb4b7329eea9c9fb5b33c`.
Its child estimate is 507,571,140 bytes. All 14 diagnostic/preliminary/final
qualification containers are removed and absence-checked; inventory containers,
builder and bootstrap retirement are recorded separately.

Private evidence is under `.tmp/artwork-webp-failure-2026-10-25/`, including phase
diagnostics, probes, frozen hashes, gate logs, per-profile measurements, runtime
comparison and retirement checks. Binaries and native diagnostics remain local.
The [standards reference](../.agents/skills/harmoniarr-web-standards/references/webp-canvas-memory.md)
records the method for subsequent work.

Unrelated 42 SQL, nine browser and controlled-provider/file-backed results are
retained through exact relevant source/test and packaged-runtime comparison.
These are retained results, not new executions. Only the memory-estimate server
module changes; its affected native paths are freshly qualified. GitHub MCP finds
no open PR at initial selection and recheck, so no random application, merge,
stale closure or rebase applies. Human screen-reader/device acceptance remains
deferred; this backend result makes no new UI conformance claim. No release or
new branch is created.

## Recommendation and next item

The [admitted WebP outcome](WEBP_ADMITTED_BOUNDARY_OUTCOME.md) records the next
fixed noisy-source qualification under this accounting policy.

Use source-backed decoder accounting, owned refusal, unchanged native limits,
success controls and focused opt-in qualification. Benefits are earlier refusal,
consistent reservations and less failed native work; the cost is conservative
acceptance for large WebP. File output alone did not repair the observed failure.
The research document contains the full option comparison and recommendation stack.

Next: **qualify noisy-source RGB WebP near the new format-aware admitted boundary**.
Choose fixed dimensions/quality before observing outcomes, prepare and pin once,
then prove actual sanitized publication in fresh mixed 2/3 GiB profiles. A medium
solid-color success does not establish the difficult admitted envelope. Keep the
same limits and separate preparation cost, admission, rewrite and retirement.

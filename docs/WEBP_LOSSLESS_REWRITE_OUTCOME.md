# WebP lossless rewrite outcome

October 25, 2026. Continues the [artwork corpus finding](WEBP_ARTWORK_CORPUS_OUTCOME.md).
See separate [design/reproduction](WEBP_LOSSLESS_REWRITE_DESIGN.md),
[official research/tradeoffs](WEBP_LOSSLESS_REWRITE_RESEARCH.md) and
[no-cache Docker outcome](LOCAL_DOCKER_WEBP_LOSSLESS_REWRITE_OUTCOME.md).

## Result and recommendation

Explicit lossless rewriting **preserved every prepared decoded RGB8 pixel and
removed metadata in all 12 candidate runs**. Both graphic samples passed the
predeclared screen: typography shrank from 37,194 to **538 bytes**, and the gradient
from 12,430 to **5,232 bytes**. The photograph and painting failed the size criterion,
growing to 5.58× and 3.96× their paired lossy sizes. All candidate medians remained
below the one-second screen, but lossless was substantially slower for most samples.

Retain the current production quality-90/effort-4 lossy default and admission.
These results justify a separately designed **mode-aware resource budget and
bounded output-selection policy**; they do not justify a universal lossless switch,
input passthrough, automatic retries or reuse of the lossy encoder's memory estimate.

## Fixed experiment

Reused the preceding corpus's exact four prepared inputs and committed pins:

| Sample | RGB8 dimensions | Prepared input bytes |
| --- | ---: | ---: |
| NASA Apollo 17 Blue Marble photograph | 1024 × 1024 | 840,544 |
| Van Gogh, Wheat Field with Cypresses; The Met Open Access CC0 | 599 × 477 | 568,348 |
| Repository-owned bitmap typography | 1024 × 1024 | 800 |
| Repository-owned smooth gradient | 1024 × 1024 | 5,512 |

Provenance, original URLs/credits and prepared hashes remain in
`testing/server/webp-artwork-corpus.js`. No new download, regeneration, resize,
sample tuning or limit increase occurred. The prepared reference is lossless
decoded RGB8; the photographic originals had already passed through JPEG decoding
and corpus preparation. This is not original camera or painting fidelity.

Compared lossy and explicit lossless modes at quality 90/effort 4, three alternating-
order repetitions per mode/sample. In lossless mode quality controls compression
effort rather than pixel loss. All 24 paired cases encoded successfully with stable
output size/hash within each mode/sample. Every final encoder used a fresh
3 GiB/two-CPU/96-PID container, verified 256 MiB tmpfs, read-only root/input, no
network/capabilities and explicit parent-owned artifact storage, on image:

`sha256:f8547f22b6af16239c98b02b05be96fcbfc82a3486213bfabe97a1594a283647`

Children retained 1 GiB DATA, 128 MiB old-space, ten-second native rewrite and
fifteen-second outer deadlines. Actual close/PID absence preceded parent artifact
writes; successful files were reread and hashed. These are test-only encoder
comparisons, not aggregate application admission, publication or statistics proof.

## Measurements

Times below are medians of three lazy decode/rotate/rewrite observations; they stop
before output delivery. These are modest local samples under existing host load,
not statistically established latency or throughput guarantees.

| Sample | Lossy bytes | Lossless bytes | Size ratio lossless/lossy | Median rewrite ms, lossy / lossless | Screen |
| --- | ---: | ---: | ---: | ---: | --- |
| Photograph | 150,382 | 839,476 | 5.582290 | 137.335 / 791.714 | Fail: output size |
| Painting | 143,482 | 568,058 | 3.959089 | 75.107 / 669.835 | Fail: output size |
| Typography | 37,194 | 538 | 0.014465 | 86.868 / 49.000 | Pass |
| Gradient | 12,430 | 5,232 | 0.420917 | 88.455 / 357.861 | Pass |

Typography saves 98.55% of paired output bytes. The gradient saves 57.91%, with
roughly four times the rewrite duration in these observations. Photographic size/
CPU costs rule out treating lossless as a universally better compression setting.

| Sample | Maximum child RSS KiB, lossy / lossless | Maximum container lifetime peak bytes, lossy / lossless |
| --- | ---: | ---: |
| Photograph | 88,464 / 116,252 | 76,546,048 / 106,995,712 |
| Painting | 79,508 / 93,716 | 68,435,968 / 81,297,408 |
| Typography | 86,980 / 94,500 | 74,575,872 / 79,802,368 |
| Gradient | 84,676 / 109,304 | 71,712,768 / 98,529,280 |

Each maximum is across three separate containers, not a simultaneous sum. Process
RSS and cgroup-charged memory have different accounting scopes, including shared
page charging; they are not interchangeable private-memory totals. Current cgroup
v1 usage is approximate. Available fail-count and OOM-kill counters remained zero;
unavailable v2 OOM evidence remains `null`. The separate pixel-metric container
peaked at 95,580,160 bytes. These modest inputs establish no large-lossless-image
memory bound, deployment minimum or mixed-workload headroom.

## Sanitization and exact-pixel evidence

The bounded structural inspector observed `VP8X`, `VP8L`, `EXIF` on each pinned
input, with matching canvas/image dimensions, version zero and no alpha hint.
Both actual native decoder metadata and the completed rewrite remained opaque
RGB8. Every candidate output contains **only `VP8L`**, with no EXIF, XMP or ICC;
Sharp output inspection independently confirmed metadata absence and geometry.
The output hashes differ from the original marked inputs. The code calls native
decode/rotate/re-encode and never writes the input through unchanged.

Each output was separately digest-verified, fully decoded and compared against
the prepared decoded reference. All 12 lossless results have **MSE 0, total squared
error 0 and maximum channel error 0** across every RGB8 sample. Identical pixels
use `identical=true` and `psnrRgbDb=null` for JSON-safe infinite PSNR. The current
lossy outputs retain the preceding corpus's nonzero error and exact output hashes.
Metric allocations are outside encoder time/memory measurements.

| Sample | Lossless output SHA-256 |
| --- | --- |
| Photograph | `1a7ec0db5ba76bb7881a12ff8c2beb0e2239da9d192d07a0be5bdc5d5a1209c1` |
| Painting | `f8fae10733e926902a4482bb929bd3f9151c30f3d261256cfdc62bd0667fed26` |
| Typography | `86e91dedb1dafabe7149eaf0496f2dcc0e5b8f24f7e261e8e269989760fc606e` |
| Gradient | `cb21eb3f16b948fc8a0e295a2da4418373107b6c9514a9582c9e465c7868bd85` |

The structural reader is a narrow testing utility, not a full bitstream decoder or
production validator. Its bounds, flags and padding checks cannot establish pixel
validity alone. It declines unknown, animated, alpha-hinted, lossy or ambiguous
layouts rather than broadening the qualified scope. This experiment covers no
alpha, ICC conversion, nontrivial orientation, HDR or animation. Exact RGB8 equality
for these samples is stronger than an agent visual ranking, but it is not human
blind acceptance or UI accessibility validation. Previously deferred human
screen-reader/device acceptance remains separate.

## Implementation and validation

Added small ESM modules for immutable rewrite modes/schedule, bounded lossless
container facts and per-sample qualification, plus focused parser/policy tests.
Extended the existing worker/entry with an allowlisted optional mode. Omitted
mode retains lossy behavior; arbitrary scopes, encoder options and unsupported
lossless efforts cannot spawn. Production framing, bounded diagnostics, deadlines
and actual-close ownership remain shared. Production runtime code is unchanged.

- **48 focused checks passed**, covering parser truncation/overflow/padding,
  high-bit FourCC aliases, reserved/version/alpha/metadata consistency, mode
  allowlisting, exact pixels, nondeterminism, failures, size/latency boundaries
  and existing worker/session/framing/pinned-input behavior.
- Final stable fast gate: **11,161 passed** (5,981 server, 4,480 client, 700 scripts),
  plus lint, copyright, ESM, migration/schema, image/topology/hygiene and builds.
  After review tightened missing metadata fields to fail rather than count as
  false, focused checks and the fast gate were repeated; initial evidence remains
  preserved separately. No thresholds, samples or resource limits were retuned.
- **29 native checks in 29 fresh containers**: 24 paired encodes, four original
  full/crop regressions and a corpus effort-2 compatibility control. The original
  full effort-2 output remains 25,373,902 bytes; full effort 4 returns normal owned
  failure without signal/output; both crops and the effort-2 graphic encode with
  their unchanged hashes. A passing failure-observation check is not encoding
  success or production publication.
- All 30 encoder/metric containers were retired and absence checked. Inventory/
  identity helpers, builder and bootstrap helper also retired. Six actually mapped
  native/runtime file hashes match the preceding normal image.
- Exact production source, unrelated driver, package/root metadata and packaged
  app-file comparison support retaining 29 earlier production-native, 42 SQL,
  nine browser and controlled-provider/file-backed checks, plus the unchanged
  corpus preparation. Retained checks are not new executions.

Final source fingerprint: 3,492 files,
`a3a01dea7f15e85910337a565588b6cef7f1ebe8d00901c71bb8fba60493bd8b`.
Private evidence is under `.tmp/webp-lossless-rewrite-2026-10-25/`; reused input
artifacts remain in the preceding corpus directory. Generated images/logs and
local state stay outside Git. GitHub MCP found no open PRs, including the final
recheck, so none was available to sample, implement or rebase. No release or new
branch was created.

## Recommendation stack and next item

1. Keep current production effort 4, sanitization, shared admission and hard limits.
2. Preserve these explicit lossless graphic wins and photographic costs; do not
   replace them with a global codec-mode preference or file passthrough.
3. Keep qualification opt-in, with complete container/decoder/pixel evidence and
   explicit unavailable fields; reuse unchanged validation only after exact review.
4. **Next: design mode-aware resource accounting and bounded WebP output selection
   for small opaque lossless inputs**, before enabling any production choice.

That next design must own the full deadline and every retained input/output until
actual child close. If it compares two encodes, reserve both outputs and account
for the actual sequential working set; these separate-container peaks cannot be
summed or reused as a calibrated selector budget. Define conservative supported
layouts/geometry and decoder-confirmed facts, preserve the baseline path for
unsupported inputs, and qualify selection, refusal, cleanup and actual publication.
Avoid adding a second persistent service or an unbounded retry loop.

The benefit is exact graphic pixels with much smaller output in the qualified
samples. The costs are additional mode/resource ownership and content-dependent
CPU/size behavior. A built-in bounded selection service, backed by measured
admission and publication tests, is the recommended next implementation step.

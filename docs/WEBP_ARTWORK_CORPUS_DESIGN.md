# WebP artwork corpus design

October 25, 2026. Continues the [fixed-input comparison](WEBP_EFFORT_COMPARISON_OUTCOME.md).
See separate [research](WEBP_ARTWORK_CORPUS_RESEARCH.md) and
[outcome](WEBP_ARTWORK_CORPUS_OUTCOME.md).

## Predeclared scope and decision criteria

Use four RGB8 samples: NASA's Apollo 17 Blue Marble photograph, The Met's public-
domain Wheat Field with Cypresses painting, a deterministic bitmap-letter cover
with sharp edges, and a deterministic smooth color gradient. This is a small
screening corpus across photographic, textured, graphic and smooth content;
it does not represent all album artwork, alpha, HDR, animation or maximum sizes.

Prepare each source once on the pinned packaged Sharp runtime as lossless RGB8
WebP with longest side at most 1024 pixels, no enlargement and a fixed EXIF Artist
marker. Record original and prepared file sizes/hashes and provenance. Do not
change content or settings after seeing the comparison. Lossless preparation
preserves the resized decoded JPEG pixels, not original camera/painting fidelity.

Compare efforts 2 and 4 at quality 90, with three fresh-container repetitions per
method/sample, alternating method order across repetitions. Keep 3 GiB, two CPUs,
96 PIDs, 256 MiB tmpfs, 1 GiB child DATA, 128 MiB old-space, ten-second rewrite and
fifteen-second outer deadline. Reuse production framing/close ownership. Verify
actual output, dimensions, metadata stripping, hashes and retirement. Codec work
remains opt-in. Measure pixel errors later in a separate constrained container.

Before measurement, use these conservative engineering screening criteria, not
standards-mandated perceptual thresholds:

- Both methods must encode every repetition and produce deterministic hashes.
- Effort 2 output may be at most 10% larger for every sample.
- Effort 2 RGB PSNR may regress at most 0.25 dB and maximum absolute channel error
  may increase at most eight for every sample. An identical baseline requires an
  identical candidate. Pixel metrics are diagnostics, not perceptual acceptance.
- Each sample's median rewrite time may regress at most 10%; the median of the
  four sample time ratios must improve at least 10% overall. Three repetitions
  provide screening evidence under host load, not statistical confidence.
- A production switch additionally requires visual acceptance. Inspect original
  and paired output at normal size and fixed 256-square center/edge crops at 1:1.
  Center uses floored half-differences; edge uses left zero and the center top.
  Record agent inspection separately from a human blind review; do not invent a
  human acceptance result. No automatic production switch follows from a score.

## Implementation and ownership

Keep corpus catalog/provenance, deterministic pixels, preparation and screening
policy in small ESM testing modules. Extend the existing comparison selector and
worker without changing production admission, settings, file publication or retry
ownership. Pin readers to catalog identities and hashes; reject arbitrary paths,
unbounded inputs and forged selectors. Keep original downloads and preparation
outside measured containers; native consumers have no network and read-only input.

Retain unrelated SQL/browser/provider/native evidence only after exact source and
packaged-runtime comparison. Run focused regressions, one stable fast gate and
affected native comparison controls. Rebuild the walkthrough without cache,
preserving administrator/data and all five actual binds; commit/push on main,
without a release or new branch.

## Reproduction

The catalog `testing/server/webp-artwork-corpus.js` records original URLs, rights,
byte counts and digests. Download only those two originals into a fresh private
source directory, verify pins, and keep them outside Git. Do not fetch anything
from a measured container. Preparation and encoding use the outcome's immutable
image and the existing constrained invocation in the
[comparison design](WEBP_EFFORT_COMPARISON_DESIGN.md).

For preparation, mount the originals read-only at `/sources`, a fresh empty output
directory at `/qualification`, current `src/server`, `src/shared`, `testing/server`
and the new native entry read-only under `/app`. Retain the same 3 GiB/two-CPU/
96-PID/256 MiB tmpfs profile and invoke:

```text
node --test --test-concurrency=1 test/native/artwork-webp-corpus-preparation.test.js
```

The resulting `inputs/` directory contains all four pinned consumers. Mount it
read-only at `/boundary-inputs`. For encoding, use the existing comparison entry
and environment contract: `HARMONIARR_BOUNDARY_FIXTURE_ROOT=/boundary-inputs`,
`HARMONIARR_WEBP_COMPARISON_EFFORT=2` or `4`, and
`HARMONIARR_WEBP_COMPARISON_SCOPE` equal to a registered corpus ID. Give every run
a fresh empty `/qualification` artifact directory. Follow the 24 frozen entries
exported as `webpCorpusSchedule`; `runId` uniquely names each repetition. Keep the
four original full/crop cases as separate regressions rather than new corpus data.

Decode and compare the pinned prepared reference and every successful output in
a separate container using `measureRgb8Error`. Verify output bytes against each
run's digest before decoding. Feed the complete observations to
`evaluateWebpArtworkCorpus`, including `runId`, `scope`, `effort`, `repetition`,
owned `outcome`, `encodeMs`, output size/digest and `metrics`. Preserve the complete
screening result and actual failures; do not replace a failed row or threshold.
Keep normal images and fixed 1:1 comparison sheets outside Git, recording their
hashes and the distinction between agent and human review.

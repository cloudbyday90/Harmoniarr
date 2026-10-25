# WebP artwork corpus outcome

October 25, 2026. Continues the [fixed-input comparison](WEBP_EFFORT_COMPARISON_OUTCOME.md).
See separate [research/tradeoffs](WEBP_ARTWORK_CORPUS_RESEARCH.md),
[predeclared design/reproduction](WEBP_ARTWORK_CORPUS_DESIGN.md) and
[no-cache Docker outcome](LOCAL_DOCKER_WEBP_ARTWORK_CORPUS_OUTCOME.md).

## Decision

**Retain production quality 90/effort 4, native limits and existing admission.**
Effort 2 encoded all four samples and reduced measured rewrite times, but failed
the predeclared content-class screen: typography output was **23.18% larger**,
and the photograph lost **0.313592 dB** RGB PSNR against the allowed 0.25 dB drop.
No threshold or sample was changed after measurement. This is a screening result,
not a universal perceptual ranking or automatic production-policy authority.

## Inputs and execution

Original URLs were discovered through MCP official pages/API responses. The Met's
current object API returns a different image URL from its documentation example;
the catalog pins the actual response's downloaded JPEG. NASA's photograph uses
the official page's linked JPEG and credit. Original and prepared bytes/hashes,
rights links and immutable input definitions are recorded in
`testing/server/webp-artwork-corpus.js`.

| Sample | Prepared RGB8 dimensions | Prepared lossless WebP bytes | Content/source |
| --- | ---: | ---: | --- |
| `photo-earth` | 1024 × 1024 | 840,544 | Apollo 17 Blue Marble; NASA Johnson Space Center, Earth Science and Remote Sensing Unit |
| `painting-cypresses` | 599 × 477 | 568,348 | Vincent van Gogh, Wheat Field with Cypresses, 1889; The Metropolitan Museum of Art, Open Access CC0 |
| `cover-type` | 1024 × 1024 | 800 | Repository-owned deterministic bitmap lettering, blocks and edges |
| `cover-gradient` | 1024 × 1024 | 5,512 | Repository-owned deterministic smooth RGB gradient |

Offline preparation reproduced all four exact prepared pins on the packaged
Sharp runtime. No enlargement occurred; the painting remains its source's smaller
geometry. Lossless preparation preserves the prepared decoded JPEG pixels, not
original camera/painting fidelity. Preparation ran outside measured encoders;
consumers had no network and read-only pinned inputs.

Ran the 24 frozen, alternating method-order schedule entries: efforts 2 and 4 at
quality 90, three fresh containers per method/sample. Every run used image
`sha256:6751387436daa469809b62a779fb40d2131dbad94d4fb4afd0695025c271bd3f`,
3 GiB/two CPUs/96 PIDs, 256 MiB temporary filesystem, read-only root, no capabilities
and explicit fresh parent-owned artifact storage. Children retained 1 GiB DATA,
128 MiB old-space, ten-second native rewrite and fifteen-second outer deadlines.

All 24 corpus rewrites encoded successfully and produced identical output size/
hash within each method/sample's three repetitions. Dimensions, EXIF/ICC/XMP
removal, file hashes, normal child exit/actual close and PID absence were verified.
The test-only encoder comparison bypasses aggregate application admission and does
**not** qualify app publication, statistics or mixed-workload capacity.

## Paired measurements

Rewrite time measures lazy decode/rotate/rewrite, ending before output delivery.
The table uses medians of three observations per method. The overall median of
per-sample effort-2/effort-4 time ratios is **0.628386**, satisfying the time
condition. These modest samples under host load establish no statistical confidence
or general speed guarantee.

| Sample | Effort 2 bytes | Effort 4 bytes | Size ratio 2/4 | Median rewrite ms, 2 / 4 | RGB PSNR dB, 2 / 4 | Screen |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Photograph | 152,774 | 150,382 | 1.015906 | 102.479 / 139.754 | 40.328610 / 40.642202 | Fail: RGB PSNR |
| Painting | 143,172 | 143,482 | 0.997839 | 45.911 / 69.820 | 30.610332 / 30.665374 | Pass |
| Typography | 45,816 | 37,194 | 1.231812 | 62.321 / 104.006 | 34.377757 / 34.453926 | Fail: output size |
| Gradient | 12,696 | 12,430 | 1.021400 | 70.564 / 121.961 | 49.075571 / 49.026303 | Pass |

| Sample | RGB MSE, 2 / 4 | Maximum absolute channel error, 2 / 4 |
| --- | ---: | ---: |
| Photograph | 6.028641 / 5.608674 | 27 / 29 |
| Painting | 56.499828 / 55.788280 | 98 / 101 |
| Typography | 23.730379 / 23.317809 | 96 / 96 |
| Gradient | 0.804495 / 0.813673 | 4 / 4 |

Pixel metrics ran afterward in a separate constrained container, verifying every
artifact digest before decode and comparing decoded RGB8 with the prepared input.
The evaluator preserves missing-reference, nondeterminism and individual size,
PSNR, maximum-error and timing failures. It always reports
`productionSwitchQualified=false`, even if numerical screening passes.

Corpus container lifetime peaks ranged from 61,792,256 to 76,472,320 bytes; the
separate metric/artifact container peaked at 90,148,864 bytes. These peaks include
their respective test/parent work and are not simultaneous process sums. Available
cgroup v1 fail-count and OOM-kill counters remained zero. Unavailable v2 OOM
evidence stays `null`; current v1 usage is approximate. This modest corpus does
not establish a deployment memory minimum or large-image behavior.

## Visual inspection

Inspected twelve hashed comparison sheets: four fitted 256-square overview sets,
four fixed 256-square native-pixel center crops and four left-center edge crops.
Panels are reference, effort 2, effort 4. Source crop coordinates were fixed before
measurement. Normal views are display resamplings; 1:1 crops provide complementary
fine-detail observations. Agent inspection is unblinded and not human acceptance.

- Photograph: both preserve recognizable geography/cloud structure at overview
  size; slight fine-texture softening at native crops. No reliable method ranking.
- Painting: composition and brush strokes remain recognizable; subtle changes in
  fine texture/highlights. No gross distortion or reliable method preference.
- Typography: both retain readable bitmap letters and block geometry. No visible
  benefit justifies effort 2's extra bytes in this sample.
- Gradient: both preserve overall color structure, with subtle native-pixel
  quantization/patchiness against the reference. No reliable perceptual preference.

No clear visual benefit compensates for effort 2's failed numerical criteria.
Human blind review was **not performed**. This inspection is neither perceptual
equivalence certification nor UI accessibility validation. Existing human screen-
reader/device acceptance remains deferred as previously requested.

## Implementation and validation

Added separate ESM modules for pinned corpus/provenance, deterministic pixels,
offline preparation and pure screening policy. Extended the existing allowlisted
selector/worker and native entry; retained production framing, bounded diagnostics,
hard deadlines, exact-close ownership and parent-only artifact writes. No arbitrary
input path, external fixture manifest or raw native error can grant a new policy.

- **34 focused tests passed**, including the prior comparison, worker lifecycle,
  framing/session and pinned-input checks plus nine corpus-policy/selector checks.
- One stable fast gate passed **11,147 tests**: 5,967 server, 4,480 client, 700
  scripts; lint, copyright, ESM, migration/schema, image/topology/hygiene checks and
  builds passed. Native work stays opt-in.
- **29 native checks in 29 fresh containers**: one offline preparation, 24 corpus
  encodes and four original comparison regressions. The original full effort 2
  output remains 25,373,902 bytes; full effort 4 returns normal owned failure,
  no signal/output, and both original crops encode. A passing failure-observation
  check is not successful encoding or production publication.
- Six actually mapped native/runtime file hashes match the previous normal image.
  Exact production source, existing unrelated drivers, package inventories and
  all packaged app files support retaining 29 earlier production-native, 42 SQL,
  nine browser and controlled-provider/file-backed checks. They are not new runs.
- All 33 preparation/comparison/metric/review containers were retired and absence
  checked; inventory/identity helpers, builder and bootstrap helper also retired.
  One initial private preparation attempt failed before image work because its
  script was mounted outside package resolution. That attempt and its retirement
  remain recorded; it contributes no encoder/quality evidence.

Final source fingerprint: 3,487 files,
`6944870c68e77ba626f88c9cdb1f9bb5f68367a7aeb3cebcd4e60c232116d7e6`.
Private originals, prepared inputs, output hashes, measurements, review artifacts
and audits live under `.tmp/webp-artwork-corpus-2026-10-25/`, outside Git. The
GitHub MCP found no open PRs, including the final recheck; none was available to
sample, implement or rebase. No new branch or release was created.

## Recommendation stack and next item

1. Retain production effort 4, shared admission and existing native hard limits.
2. Retain the failed screen and exact artifacts; do not loosen its criteria to
   justify a global effort-2 switch or automatic retry.
3. Keep cheap policy tests in the fast gate and native/review work opt-in; reuse
   unchanged proof only after exact source/runtime comparison.
4. **Next: evaluate a bounded lossless WebP rewrite for already-lossless graphic
   inputs**, including trustworthy input facts, sanitization, output size, pixel
   equality and native resource qualification before designing a selection rule.

This corpus exposed a concrete opportunity: the lossless typography input was
800 bytes, while the effort-4 lossy rewrite is 37,194 bytes (46.49×) with nonzero
pixel error. The gradient similarly grows from 5,512 to 12,430 bytes. This does
not establish how often production artwork has this property. Sharp supports an
explicit lossless mode; qualify that supported rewrite using these fixed inputs.
Never replace sanitization with untrusted-file passthrough or infer that lossless
photographic output will be smaller. Any production choice needs separate
resource/admission and publication review. A bounded output-dimension policy for
large images remains a later alternative, with input-decode costs still accounted.

Effort 2 offers lower measured rewrite times and previously encoded the fixed
large candidate. Its content-dependent size/error costs prevent this global
switch. Retaining effort 4 preserves current behavior and conservative refusal;
the lossless-graphics experiment targets a measured inefficiency without changing
that security boundary prematurely.

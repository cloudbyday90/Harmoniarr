# Noisy WebP admitted-boundary outcome

October 25, 2026. **The fixed candidate passes numeric admission but fails
successful-processing qualification.** Its workers refuse safely; this does not
establish a working noisy WebP envelope. See separate [design](WEBP_ADMITTED_BOUNDARY_DESIGN.md),
[research and tradeoffs](WEBP_ADMITTED_BOUNDARY_RESEARCH.md) and
[rebuild](LOCAL_DOCKER_WEBP_ADMITTED_BOUNDARY_OUTCOME.md).

## Fixed input and implementation

Before observing processing, selected 7120² RGB8 deterministic noisy-source TIFF,
WebP quality 3/effort 4 and synthetic EXIF. Exact input is 10,675,042 bytes,
SHA-256 `7ea1eb9d58f173027c2e3534dacac3c8c83596a438e7b062d0ce5c03122430ad`.
The unchanged shared estimate is 1,071,535,812 bytes: 2,206,012 bytes below the
1 GiB DATA limit, inside the declared 4 MiB headroom band. No dimensions, quality,
padding, limits, deadline or production encoder settings were tuned afterward.

The catalog now owns per-case geometry/headroom. Preparation can select one fixed
case or group default preparation by geometry, preserving older byte pins and
never replacing output directories. The maintained preparer reproduced all three
pins, restored Sharp cache/concurrency and retired raw sources. Its lifetime peak
was 874,864,640 bytes in a separate 3 GiB container; initial pin discovery had a
661,864,448-byte peak. These costs are excluded from measured consumers.

A small shared profile module guards disposable cgroups, read-only fixture mounts
and numeric admission before acquiring PostgreSQL. The strict native entry still
requires both admitted images to publish. The new opt-in characterization entry
uses the same workload and records `processingQualified` independently from safe
owned outcomes. Passing characterization cannot make a failed publication check
pass. All code is ESM; no application service, dependency or production module
changes.

## Investigation

The preliminary strict 3 GiB check failed: two owned `artwork_worker_failed` 503s,
normal exit 1/no signal, no images, assignments or publication lookup. Bounded
private phase markers show input/metadata completion followed by native encoding
failure before statistics. Separate minimal-decode/statistics probes succeed;
file-output rewrite fails with the same generic encoder/write diagnostic.
All probe children retire without an outer timeout or added OOM kill.

Pinned libvips source retains a memory writer even for file targets and collapses
`WebPEncode` failure into a generic error. The captured text does not prove a
particular encoder enum, allocator denial or deadline expiry. Production continues
returning its opaque owned error; diagnostics stay local.

## Validation

Frozen source: 3,474 files,
`ae23192f10c677fc6ab742449c328c6d308f1b253997c44ed684539649bb1d47`.
One stable fast gate passes **11,131 tests** (5,951 server, 4,480 client, 700
scripts), plus lint, ESM, schema/migration, hygiene and build checks. The focused
cohort passes 24 checks, including unknown/fixed selector rejection, existing
output preservation, pin/read/handle lifetime and observer/drain behavior. Both
updated skills validate.

| Fixed input / entry | Profile | Images / assignments | Worker outcome | Lifetime / sampled peak (MiB) |
| --- | --- | --- | --- | --- |
| 7120² WebP / characterization | 2 GiB | 0 / 0 | Both owned failed 503, normal exit 1 | 1600.5 / 1599.9 |
| 7120² WebP / characterization | 3 GiB | 0 / 0 | Both owned failed 503, normal exit 1 | 1604.2 / 1603.6 |
| 8192² JPEG / strict | 2 GiB | 2 / 2 | Both exit 0 | 1567.5 / 1564.5 |
| 8192² JPEG / strict | 3 GiB | 2 / 2 | Both exit 0 | 1565.1 / 1564.6 |
| 8192² WebP / strict refusal | 2 GiB | 0 / 0 | Both pre-grant memory 503, normal exit 1 | 780.6 / 771.9 |
| 8192² WebP / strict refusal | 3 GiB | 0 / 0 | Both pre-grant memory 503, normal exit 1 | 785.0 / 781.2 |

New WebP children each send 114 protocol bytes (metadata followed by failure),
with no signal, output body, publication lookup or assignment. Characterization
records `processingQualified: false`. Earlier WebP children still send only the
21-byte pre-grant failure frame; JPEG publication retains actual saved hash,
format/dimension, metadata-removal and complete inventory checks.

Each mixed profile completes eight actual HTTP operations, three worker
qualification steps, held database sorts, scan/tag work, probes and real FFmpeg
encoding. Actual HTTP/native lifetime overlap is observed; children, all four
captured leases and final reservations retire. cgroup v1 usage is approximate;
available limit counts and OOM kills remain unchanged, while unavailable v2 OOM
events remain null. Peaks include setup/input loading and exclude preparation.
They establish neither a deployment minimum nor simultaneous component maxima.

Use `rgb8-webp-admitted-7120-noise` with the explicit disposable profile and
read-only `/boundary-inputs` mount. The optional
`validate:native-deployment-review-artwork-characterization` command records
bounded outcomes. `validate:native-deployment-review-artwork-boundary` retains
the strict success assertion and fails for this candidate. Do not replace the
strict result with a characterization pass.

Unrelated 42 SQL, nine browser, controlled-provider/file-backed and 19 unchanged
worker checks are retained through exact source/test and packaged-runtime review,
not reported as new executions. GitHub MCP finds no open PR at initial selection
or recheck, so no random application, merge, stale closure or rebase applies.
Human screen-reader/device acceptance remains deferred; native evidence makes
no new UI conformance claim. No release or new branch is created.

The final rebuilt-runtime matrix executes 12 checks in ten fresh containers:
**ten containment/regression checks pass; two strict publication checks fail**
for the new WebP under 2/3 GiB. Both strict runs finish unrelated work and owned
cleanup before the unchanged publication assertion fails. All 15 preparation,
probe, diagnostic, preliminary and final qualification containers retire and are
absence-checked; inventory, builder and bootstrap retirement are separate proofs.

Private evidence remains under `.tmp/artwork-webp-admitted-2026-10-25/`, including
failed strict logs, bounded phase diagnostics, probes, pins, gate logs, per-profile
results, runtime comparisons and retirement proofs. Binaries stay outside Git.

## Recommendation and next item

Keep fixed source pins, separate preparation, shared numeric accounting, unchanged
containment and strict publication checks. Use characterization for bounded
negative evidence. The benefit is repeatable failure evidence without weakening
acceptance; the cost is that this admitted candidate still cannot publish.
The research document contains the full comparison and recommendation stack.

Next: **capture structured WebP encoder failure and allocation evidence for this
same pinned candidate under the same limits**. Distinguish internal writer growth,
picture/encoder allocations and deadline paths before changing admission or
output delivery. A file-target substitution alone did not repair this case.

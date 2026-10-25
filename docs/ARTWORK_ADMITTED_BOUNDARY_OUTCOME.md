# Admitted artwork boundary outcome

October 24, 2026. Completed the admitted-boundary follow-up from
[rewrite headroom](ARTWORK_REWRITE_HEADROOM_OUTCOME.md). See separate
[design](ARTWORK_ADMITTED_BOUNDARY_DESIGN.md),
[official research/tradeoffs](ARTWORK_ADMITTED_BOUNDARY_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_ARTWORK_ADMITTED_BOUNDARY_OUTCOME.md).

## Implementation and finding

Added frozen admitted-case descriptors, a bounded pinned-file reader, a loader,
an explicit preparation function and an opt-in native entry as separate ESM
modules. Existing corpus selection and mixed-workload coordination now recognize
these two prepared cases. Production runtime, resource limits and rewrite settings
remain unchanged.

The fixed noisy-source JPEG publishes successfully at both caps. The WebP passes
the same admission model but returns controlled `artwork_worker_failed` 503 results
at both caps, with normal exit 1 and no publication. No native abort qualifies as
a pass. This establishes selected success/refusal behavior, not a universal
accepted-image envelope or the cause of WebP's opaque failure.

## Prepared input identity

| Fixed 8192² RGB8 input | Encoder quality | Actual encoded bytes | Child estimate | Estimate headroom |
| --- | ---: | ---: | ---: | ---: |
| JPEG noise / EXIF | 24 | 14,154,530 | 1,072,690,756 | 1,051,068 |
| WebP noise | 3 | 14,127,228 | 1,072,636,152 | 1,105,672 |

All values are bytes. No padding is used. Both estimates are just below the
unchanged 1 GiB DATA ceiling. Quality settings were fixed before observing worker
outcomes. Lossy encoding changes the decoded noise distribution; it is not evidence
of arbitrary incompressible pixels or worst-case codec complexity.

Exact file sizes and SHA-256 pins live in
[the fixed catalog](../testing/server/artwork-boundary-cases.js). Each consumer
requires an explicit read-only `/boundary-inputs` bind and verifies regular-file
ownership, exact bounded bytes, EOF and the source-pinned digest. A mutable
manifest is evidence, not input authority. Changed/missing files fail; they are
never silently regenerated inside measured profiles.

The maintained preparer reproduced both pins on the pinned Linux runtime. It
creates a fresh output directory, refuses existing output, removes the owned
192 MiB raw TIFF and restores encoder preferences. Its separate 3 GiB/two-CPU
control peaked at 840.7 MiB with unchanged OOM-kill counters. Encoding occurs once
per prepared set, rather than once per consumer profile. Binaries stay outside Git.

Separate full-decode controls succeed for both artifacts, producing 201,326,592
RGB8 bytes each. A 262,144-byte sample has marginal byte entropy 7.6735 and 7.7265
bits/byte respectively. This is sampled marginal entropy, not whole-image or
conditional entropy. That control peaks at 756.9 MiB, with unchanged kernel events;
it runs separately from the 1 GiB DATA worker and does not qualify its rewrite.

## Final-image measurements

One fresh container/database per admitted case/profile, two CPUs, 256 PIDs, equal
memory/swap caps, read-only root, network none and no published ports.

| Input | Cap | Lifetime peak MiB | Sampled workload peak MiB | Actual result |
| --- | ---: | ---: | ---: | --- |
| JPEG | 2 GiB | 1,560.5 | 1,559.9 | Two publications/assignments; both children exit 0 |
| JPEG | 3 GiB | 1,562.6 | 1,562.1 | Two publications/assignments; both children exit 0 |
| WebP | 2 GiB | 755.5 | 749.9 | Two owned failed 503s; both children exit 1 |
| WebP | 3 GiB | 753.0 | 741.1 | Two owned failed 503s; both children exit 1 |

JPEG verifies source/output hashes, matching rewritten bytes, dimensions/format,
metadata removal, assignments and the complete stored-artifact inventory. Each
JPEG profile stores one deduplicated asset with two owner assignments. WebP
has zero publication lookup, asset, file or assignment. All children close with
no signal; all reservations settle to zero.

Each case completes eight actual authenticated HTTP operations and three
qualification steps alongside 64 scan/tag files, four probes, real null-output
encoding, two held 100,000-row sorts and 256 MiB retained caller bytes. All eight
HTTP operations overlap scan/encoder lifetimes through completion in each run.
Observed HTTP durations span 97.1–697.6 ms; they are not an SLO. Media hashes,
four released leases, actual process retirement and unrelated-work success remain
verified. Lifecycle overlap does not imply simultaneous maximum CPU/allocations.

These are cgroup v1 approximate-usage observations. Consumer lifetime peaks include
loading and fixture setup/cleanup, but exclude separate artifact encoding. Do not
compare them directly with older per-profile-generation peaks, sum overlapping
Node/kernel fields or infer a production minimum. Failcnt/OOM-kill counters remain
zero; the unavailable v2 OOM-event field remains null.

## Validation and reproduction

Twenty-four focused checks pass, including exact pin/size/EOF behavior, actual
file-handle retirement after success/refusal/null cancellation, fixed admission
math, no-overwrite preparation and existing selector/observer/drain cases. The
stable fast gate passes 11,129 tests: 5,949 server, 4,480 client, 700 scripts,
plus repository checks, lint and builds.

Ten final native tests pass in eight fresh containers: four admitted cases, three
default deployment-memory cases, one baseline mixed case and two representative
strict corpus success/refusal cases. The prior over-budget/native lifecycle matrix
is retained through unchanged relevant source/runtime proof, not claimed as rerun.
The preparation replay and full-decode control are separate from those ten tests.

To reproduce, mount the repository helpers in a constrained Linux preparation
container and dedicate a writable output bind at `/qualification`. Invoke
`prepareBoundaryArtworkInputs({ root: '/qualification/inputs' })` from
`testing/server/artwork-boundary-preparation.js`; the target must not exist.
Then use the existing disposable deployment profiles, mount that directory at
`/boundary-inputs` read-only, set `HARMONIARR_BOUNDARY_FIXTURE_ROOT=/boundary-inputs`
and select either catalog ID with `HARMONIARR_REVIEW_ARTWORK_CASE`. Run
`npm run validate:native-deployment-review-admitted-artwork`. The native entry
refuses undeclared/live-data profiles before acquiring its pool.

Standards/testing skills validate and include the practical
[prepared-artifact reference](../.agents/skills/harmoniarr-web-standards/references/artwork-admitted-boundary.md).
Unrelated 42 SQL, nine browser and controlled-provider/file-backed results are
retained through exact relevant source and packaged-runtime comparison. GitHub MCP
finds no open PR at selection/recheck; no merge, stale cleanup or rebase applies.
Human screen-reader/device acceptance remains deferred. No release or new branch.

## Recommendation and next item

The October 25 [WebP canvas outcome](WEBP_CANVAS_MEMORY_OUTCOME.md) completes
the investigation below and records the current format-aware admission policy.

Keep shared admission, native isolation and current DATA/deadline controls. Use
fixed pinned fixtures prepared once, fresh read-only consumers and focused tests.
Benefits are exact input identity and less repeated qualification setup; costs are
explicit artifact/version ownership and an admitted WebP case that still fails
processing. Full options and the recommendation stack are in the research document.

Next: **trace the admitted WebP's controlled processing failure under the unchanged
worker limits**. Compare minimal decode, rewrite and statistics boundaries using
bounded private evidence. The independent full-decode control proves valid input,
but does not identify the failing worker operation or allocation constraint. Decide
whether format-specific accounting or output delivery needs a change only after
that evidence; do not assume a larger DATA cap or file-backed rewrite is the fix.

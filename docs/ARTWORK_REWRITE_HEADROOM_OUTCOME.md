# Artwork rewrite headroom outcome

October 24, 2026. Completed the diagnosis/fix follow-up from the
[maximum artwork outcome](DEPLOYMENT_MAXIMUM_ARTWORK_OUTCOME.md). See separate
[design](ARTWORK_REWRITE_HEADROOM_DESIGN.md),
[official research/tradeoffs](ARTWORK_REWRITE_HEADROOM_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_ARTWORK_REWRITE_HEADROOM_OUTCOME.md).

## Diagnosis and repair

Minimal private phase markers reproduce the JPEG abort after input/metadata
completion and during rewrite, before statistics. Bounded stderr records a GLib
failure to allocate 128 MiB. A stderr-only control also aborts; an earlier replay
with extra process-memory sampling succeeds. That successful instrumented control
does not diagnose the failure. No allocation stack/syscall trace identifies the
exact backing object or establishes which allocation constraint denied it.

The child guard omitted the output allowance already present in the parent's
child-work estimate. Consolidated both in `artworkWorkerMemoryEstimate`: 128 MiB
runtime allowance, twice the input bytes, the existing 100 MiB output allowance
and the conservative decoded-pixel/sample-depth estimate. Parent reservation
values remain numerically unchanged. The child now uses that same model before
its metadata/grant handshake, native rewrite and statistics.

The fixed maximum noisy JPEG/WebP inputs now return the owned
`artwork_worker_memory` 503 with a normal exit, replacing native abort/opaque
processing failure for these selected combinations. This is deliberate resource
refusal, not successful processing of maximum noisy images. DATA remains 1 GiB,
old-space 128 MiB, aggregate admission 2 GiB and rewrite/worker deadlines 10/15
seconds. Byte/pixel limits, formats, protocol authority and publication ownership
remain unchanged. No raw native diagnostics or phase markers ship in production.

At 8192² RGB8 the model's input boundary is 14 MiB: the exact estimate fits;
one further input byte refuses. This is geometry-specific admission accounting,
not a proven universal native allocation envelope. Existing maximum-pixel
low-entropy RGB and maximum-byte behavior retain their native regression checks.

## Final-image maximum cases

Each case/profile uses fresh disposable storage, two CPUs, 256 PIDs, equal memory/
swap caps, read-only root, network none and no published ports. Each exercises two
real TLS downloads, one real decoder memory refusal and one owned queued-capacity
refusal. The actual child emits only the 21-byte memory-failure frame and exits
1/no signal. There is no metadata/grant exchange, output body, publication lookup,
asset, file or assignment. Reservations settle to zero.

| Fixed 8192² RGB8 input | Encoded bytes | Cap | Lifetime peak MiB | Sampled workload peak MiB |
| --- | ---: | ---: | ---: | ---: |
| JPEG noise / EXIF | 55,298,216 | 2 GiB | 1,044.8 | 1,039.6 |
| JPEG noise / EXIF | 55,298,216 | 3 GiB | 1,025.0 | 1,023.7 |
| WebP noise | 54,289,930 | 2 GiB | 1,969.1 | 1,006.3 |
| WebP noise | 54,289,930 | 3 GiB | 1,973.3 | 1,015.2 |

These are actual cgroup v1 approximate-usage observations. Lifetime includes
fixture generation/setup/cleanup; WebP's peak already exists at workload baseline.
No failcnt or OOM-kill counter increases; the unavailable v2 OOM-event field
remains null. Do not add overlapping Node/kernel fields or infer a deployment
minimum. Lower JPEG peaks accompany deliberately avoided rewrite work and changed
fixture coordination; they are not a successful-processing performance comparison.

All cases complete eight authenticated HTTP operations, three qualification
steps, 64 scan/tag files, four probes, real null-output encoding, two held
100,000-row sorts and 256 MiB retained caller bytes. Original media hashes, four
released leases, zero active leases and actual child/process retirement remain
verified. Six, five, five and five HTTP operations respectively overlap scan/
encoder lifetimes through completion. Observed HTTP durations span 31.7–829.9 ms;
they are not an SLO.

## Validation and preserved failures

Sixty-five focused checks pass, including exact budget boundary, refusal before
grant/rewrite/statistics, framing, ingestion, reservation ownership and existing
observers. The final stable fast gate passes 11,126 tests: 5,946 server, 4,480
client and 700 scripts, plus repository checks, lint and builds.

All 26 final native tests pass in nine fresh containers: four strict
maximum cases, three default deployment-memory cases, one baseline mixed case,
seven worker lifecycle cases, four allocation/admission cases and the seven-case
strict native corpus. The lifecycle/corpus lanes retain their 1 GiB/one-CPU
profiles; allocation controls retain 3 GiB/two CPUs and their existing PID caps.
Only the four maximum cases use one fresh container per individual case/profile;
the corpus's whole-container peak includes previous cases and setup.

The first final-image 3 GiB WebP attempt failed the required scan/encoder/artwork
overlap check. It remains a failed candidate. Maximum fixtures now retain the
first scan-tag gate until actual artwork spawn; cleanup releases unconditionally.
Ordinary scheduling, the real encoder and overlap assertions remain unchanged.
This is explicit lifecycle coordination, not proof of simultaneous maximum CPU/
allocation peaks. The fast gate was repeated because these fixture files changed.
Final source is frozen through native validation; expensive encodes remain opt-in.

Standards/testing skills now include the practical
[rewrite-accounting reference](../.agents/skills/harmoniarr-web-standards/references/artwork-rewrite-headroom.md)
and validate successfully. Unrelated 42 SQL, nine browser and controlled-provider/
file-backed evidence is retained through exact relevant source and unaffected
runtime comparison. Two production modules intentionally differ; retained results
do not qualify the new artwork policy, which uses the new native matrix.

GitHub MCP reports no open PR at selection/recheck; no random PR, merge, stale
cleanup or rebase applies. Human screen-reader/device acceptance remains deferred.
The no-cache walkthrough rebuild preserves administrator/data/all five mounts and
passes authenticated readiness. No release, version change, tag or new branch.

## Recommendation and next item

Keep shared child accounting, explicit pre-grant refusal, existing process/DATA/
deadline controls and parent publication fences. Benefit: the reproduced expensive
combination is refused before unsafe rewrite allocation, with no separate service.
Cost: some large combinations that occasionally succeeded are now conservatively
refused. See the research document for the full option comparison and stack.

That qualification is now recorded in the
[admitted boundary outcome](ARTWORK_ADMITTED_BOUNDARY_OUTCOME.md), including exact
prepared input identity and different JPEG/WebP outcomes. Use its next item before
promising an accepted envelope or changing native output delivery. The arithmetic
boundary alone does not establish allocator behavior.

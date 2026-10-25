# Maximum artwork outcome

October 24, 2026. Completed the maximum-resolution follow-up from the
[mixed corpus outcome](DEPLOYMENT_REVIEW_CORPUS_OUTCOME.md). See separate
[design](DEPLOYMENT_MAXIMUM_ARTWORK_DESIGN.md),
[official research/tradeoffs](DEPLOYMENT_MAXIMUM_ARTWORK_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_DEPLOYMENT_MAXIMUM_ARTWORK_OUTCOME.md).

## Finding and implementation

The fixed maximum-resolution inputs establish **containment, not successful
maximum-image processing**. JPEG reproducibly aborts its isolated decoder with
SIGABRT and returns `artwork_worker_failed` 503. WebP returns the same owned error
with normal exit code 1. Neither publishes an asset, file or assignment. These
results do not establish the native failure's cause or a graceful memory refusal.

Both inputs are roughly 53 MiB, so one concurrent job also receives the owned
`artwork_ingestion_capacity` 503 while the other decoder is active. The existing
32 MiB queued-byte limit remains intact. Each profile exercises one actual child,
two actual TLS downloads and both jobs' real outcomes. Every child closes; no
child or reservation is released merely because a kill was requested.

Added modular ESM owners for lazy deterministic RGB8 TIFF rows, bounded maximum
JPEG/WebP generation, and separate publication/refusal/containment verification.
The raw 192 MiB temporary source is removed before application work. Fixture
generation disables the Sharp cache and uses concurrency one, restoring prior
preferences even on original Error/null. The opt-in native entry validates the
fixed selector/disposable profile before pool acquisition. Existing production
byte/pixel/deadline/DATA limits, runtime code and deployment architecture remain
unchanged. Shared qualification now compares kernel counters across generation
and cleanup as well as the application workload.

## Final-image measurements

Fresh container/database storage per case/profile; two CPUs, 256 PIDs, equal
memory/swap caps, read-only root, no network or published ports. The exact final
image is recorded in the Docker outcome.

| 8192² RGB8 input | Encoded bytes | Cap | Lifetime peak MiB | Sampled workload peak MiB | Actual decoder outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| JPEG noise / EXIF | 55,298,216 | 2 GiB | 1,685.8 | 1,685.2 | SIGABRT; owned failed 503 |
| JPEG noise / EXIF | 55,298,216 | 3 GiB | 1,684.0 | 1,683.8 | SIGABRT; owned failed 503 |
| WebP noise | 54,289,930 | 2 GiB | 1,968.9 | 1,015.8 | Exit 1; owned failed 503 |
| WebP noise | 54,289,930 | 3 GiB | 1,969.1 | 1,018.4 | Exit 1; owned failed 503 |

The host exposes cgroup v1 approximate-usage accounting. Lifetime peaks include
setup, generation and cleanup. WebP's lifetime peak was already present at the
workload baseline; it cannot be attributed to application ingestion. Its 2 GiB
run leaves little fixture headroom and is not a recommended production minimum.
Sampled current usage can miss brief peaks. Node RSS/heap/external/ArrayBuffers,
logical reservations and kernel usage overlap and must not be added.

Failcnt and OOM-kill counters were zero before/after the fixture and unchanged
through the measured workload. The unavailable v2 OOM-event field remains null.
No kernel OOM is hidden by the contained-abort classification.

Each case completes eight real authenticated HTTP operations and three actual
qualification steps, plus 64 scan/tag files, four probes, real null-output
encoding and two held 100,000-row PostgreSQL sorts. It retains 256 MiB caller
bytes. At least one completed detail page overlaps scan/encoder activity; 5, 6,
7 and 7 of the eight HTTP operations respectively overlap through completion.
HTTP observations range 36.7–614.5 ms; they are not an SLO or causal comparison.
All original media hashes, three media runs, four released leases and zero final
artwork reservations are verified. Lifecycle overlap does not imply simultaneous
maximum CPU/memory peaks.

## Validation and retained scope

Twenty-one focused checks passed: lazy generation, actual multi-strip TIFF pixel
parity, owned cleanup, Error/null, cache restoration, refusal/termination ownership
and existing corpus/observer/drain regressions. The stable fast gate passed 11,124
tests: 5,944 server, 4,480 client, 700 scripts, plus repository checks, lint and
builds. No maximum encode was added to that fast gate.

The explicit final matrix covers four maximum containment cases, three default
memory regressions, one baseline mixed case and two representative strict corpus
success/refusal cases. The previous fourteen-case corpus matrix remains historical
evidence; this round does not claim a complete rerun of it. Final native results
and resource retirement are checked against frozen source and the immutable image.

Preliminary candidates remain separate: PPM was unsupported by the installed
Sharp build on Windows and Linux; actual TIFF decode replaced it. An initial
strict outcome check rejected the genuine queue-capacity result, and its successor
rejected SIGABRT as graceful refusal. The final contract explicitly reports native
abort containment while preserving the original corpus's strict refusal checks.
Those failures are not counted as passing processing tests.

Standards/testing skills now route to the practical
[maximum artwork reference](../.agents/skills/harmoniarr-web-standards/references/deployment-maximum-artwork.md).
Their validators pass. Existing SQL/browser/provider evidence is retained only
through exact relevant source and packaged-runtime comparison; it is not a new
execution. GitHub MCP found no open PR at selection/recheck, so no random PR,
merge, stale cleanup or rebase applied. Human screen-reader/device acceptance
remains deferred. No release, version change or tag.

## Recommendation and next item

Keep built-in admission, native process isolation and current resource limits.
Use the opt-in maximum lane and bounded evidence alongside focused fast tests.
The benefit is actual failure containment without another service; the cost is
explicit native qualification and currently unsupported maximum noisy inputs.
The full option comparison and recommendation stack are in the research document.

The diagnosis and shared-budget repair are now recorded in the
[rewrite headroom outcome](ARTWORK_REWRITE_HEADROOM_OUTCOME.md). The historical
measurements above remain containment evidence. The repaired fixed maximum entry
requires deliberate memory refusal before the metadata/grant handshake and normal
child close; the new outcome records its follow-up and resource-policy limits.

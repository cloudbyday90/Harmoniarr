# Durable media worker cancellation outcome

Recorded October 23, 2026. The [design](MEDIA_WORKER_CANCELLATION_DESIGN.md)
and [official-source research and tradeoffs](MEDIA_WORKER_CANCELLATION_RESEARCH.md)
are separate documents. The [Docker outcome](LOCAL_DOCKER_MEDIA_WORKER_CANCELLATION_OUTCOME.md)
records the preserved local deployment.

## Delivered behavior

Inspection and transcode workers now observe durable cancellation and maintenance
pause during their media preview/preflight steps. One step-owned scope serializes
checks, forwards one AbortSignal through tooling readiness and native dispatch,
drains admitted checks, and checks durable authority again before handoff. The
production polling interval is one second; database/event-loop delay and process
termination mean this is not a cancellation latency SLA.

Queued work is removed without spawning a child. Active work uses the existing
bounded command service and termination escalation, retains capacity until actual
process/stdio close, then permits terminal persistence and captured lease release.
Preview siblings and both tooling checks settle before the owner returns. Error
and null reasons survive media-warning adapters. Delivered-track re-verification
also receives cancellation and refuses a cancelled result handoff.

The implementation uses two small ESM helpers and existing modular services. It
adds no deployed service, endpoint, schema, dependency or memory setting. Graceful
worker shutdown still drains. Spectral analysis accepts an optional signal, but
its independent durable job owner is outside this polling change. SQL/filesystem
operations without cancellation support remain awaited. Existing source/target
verification, command allowlists, shell-disabled dispatch, output/time bounds,
container limits and artwork admission remain in force.

## Executed validation

- **102 focused tests passed**, including serialized checks, cancellation/pause,
  Error/null propagation, sibling drainage, native close and captured lease release.
- Final `validate:fast` passed: **5,843 server, 4,470 client and 697 script tests**
  (**11,010 total**), static/lint/ESM/hygiene checks and both builds. This stable
  candidate required one full fast run.
- **16 PostgreSQL integration tests passed**: six new cases cover both workers
  during readiness, queued admission and active execution; ten existing lifetime
  cases remain green. They use real durable stores and the existing cancellation
  control method. The isolated integration fixture uses PostgreSQL 18.3.
- **Two new Linux native cases passed** on the rebuilt image. A real Node child
  remains open after SIGTERM until a private fixture gate permits close: the run
  and lease remain active in the meantime. Actual FFmpeg encoding is also
  interrupted; all three tooling/encoder commands close, the run is cancelled,
  the lease is released, and every original source file/hash remains unchanged.
  Held readiness uses the production one-second interval; active FFmpeg uses an
  explicit **25 ms qualification interval**, not a production policy change.
- The **two existing Linux command-admission cases passed**, including exit before
  descendant-held stdio close and successful real codec consumers through the FIFO.
- All **four shared-container memory cases passed at each of 3 GiB and 2 GiB**.
  Details and limits are below. Both project skills passed the skill validator;
  the standards reference and test routing now include practical cancellation proof.

These selections overlap and are not additional unique test totals. An initial
native launcher omitted a required read-only fixture-helper mount and failed
before either test ran. Its log and verified container retirement are retained
separately; the corrected launcher passed without runtime source changes. The
previous round's 18 artwork native cases were not repeated; artwork runtime bytes
are unchanged, and the current memory cases exercise real artwork overlap.

## Shared-container memory evidence

All cases used image
`sha256:959bf438bf6babed7eb9d333a53ceff7ddbc39808c003edc76b7799ced23170d`.
Each fresh profile ran media overlap first, then ordinary artwork, maximum pixels
and maximum bytes. The media case uses 64 generated tracks in four formats, real
scan/tag persistence, four FFprobe inspections, one FFmpeg null-output preflight,
two 8192² artwork jobs, provider-image TLS, two held PostgreSQL sorts and a retained
256 MiB caller buffer. It recorded three completed runs, three released leases,
zero active leases and zero final artwork reservation in both profiles.

| Limit | Sampled container peak, MiB | Kernel peak after fixture cleanup, MiB | Sampled Node RSS peak, MiB | Observed headroom, MiB |
| --- | ---: | ---: | ---: | ---: |
| 3 GiB | 1418.0 | 1420.0 | 419.4 | 1652.0 |
| 2 GiB | 1409.7 | 1415.4 | 408.3 | 632.6 |

Kernel peaks are **1,488,957,440** and **1,484,128,256 bytes**. All final cases
retained zero limit-hit/OOM-kill counters; the unavailable cgroup v1 OOM-event
count remains null. This host's v1 usage is approximate. Kernel peaks include
startup, fixture generation and hash verification; later cases inherit historical
peaks. Process/category figures overlap and must not be added.

Lifecycle overlap does not mean simultaneous maximum CPU/memory. FFmpeg uses four
threads under a two-CPU quota. Preflight creates no converted file. Controlled
selection, 64 files and tmpfs do not represent populated catalogue distributions,
all periodic jobs, real provider accounts or bind-mount I/O. Generated Opus bytes
vary between runs, so these are not matched-input performance comparisons. The
passing 2 GiB subset does not establish a deployment minimum or reserved RAM.

Seventeen JavaScript files and 3,356 source files were frozen before the final
fast gate and rebuild, with source fingerprint
`00a5e6f0b3a195397328816f6514086f95f19b129628f765883fc0bf17d0fc96`.
The final production/test bytes match that snapshot. Private evidence is retained
under `.tmp/media-worker-cancellation-2026-10-23/` and is not committed.

## Recommendation and next item

Retain durable operator/pause authority → serialized step-owned checks → one
propagated signal → bounded command admission/termination → complete sibling,
process and read drainage → guarded terminal persistence and captured lease release.
The benefit is stopping obsolete media work without orphaning resources. Costs
are additional bounded checks and cancellation delay; count limits still do not
isolate codec memory, threads, descendants or unrelated database/artwork work.

The [lease interruption follow-up](MEDIA_LEASE_INTERRUPTION_OUTCOME.md) now
connects observed renewal refusal/failure to media interruption, preserving
replacement acquisition authority and close-before-release. **Next:** carry
interruption through spectral proof and sidecar owners, with separate claim,
cache/publication and native drainage evidence. This remains a bounded follow-up,
not a claim that every background owner is covered.

GitHub MCP found no open PRs at selection and again before publication. No
applicable random/stale PR could be implemented, rebased or closed. No PR was
merged. Work remains on `main`; app version and lockfile are unchanged. No release
or tag is created.

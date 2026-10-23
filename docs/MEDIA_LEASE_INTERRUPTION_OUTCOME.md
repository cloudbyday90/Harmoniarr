# Media lease interruption outcome

Recorded October 23, 2026. See separate [design](MEDIA_LEASE_INTERRUPTION_DESIGN.md),
[official research and tradeoffs](MEDIA_LEASE_INTERRUPTION_RESEARCH.md) and
[local Docker outcome](LOCAL_DOCKER_MEDIA_LEASE_INTERRUPTION_OUTCOME.md).

## Delivered behavior

The existing operation-run heartbeat now exposes an instance-owned AbortSignal.
Null renewal or a missing captured acquisition signals a fixed lease-loss error;
a thrown renewal exception signals its original Error/null before optional error
reporting. The first signal reason remains sticky. Existing heartbeat results and
non-consuming workers retain their prior behavior.

Inspection/transcode workers forward this signal into the existing step-owned
interruption scope alongside durable cancellation/pause polling. Pre-aborted
steps do not dispatch; interrupted work, sibling commands and pending reads drain
before handoff. Step listeners are removed on settlement. Worker boundary checks
prevent another media step or completion after observed loss. Graceful shutdown
does not request cancellation.

Confirmed loss skips terminal operation-run writes. After actual native close,
cleanup stops/drains the heartbeat and attempts only the captured acquisition's
fenced release, using cleanup status `failed`. An expired owner can release its
own row; an old token cannot change a replacement acquisition. The run remains
running for its current owner or existing stranded-run recovery. Renewal exceptions
use the existing fenced failure path; an exception is not relabelled confirmed
loss. Database checks remain authoritative across notification races.

Five narrow existing ESM modules changed. No new deployed service, schema,
dependency, endpoint, branch or memory policy was introduced. The production
heartbeat remains **60 seconds** and the operator/pause poll remains **one second**.
There is no extra lease query or local expiry timer. Detection follows observed
renewal results and is not an expiry/detection latency guarantee.

## Executed validation

- **98 focused tests passed**, covering heartbeat/scope behavior, both media owners,
  prior cancellation, command ownership, consumer compatibility and worker lifetime.
- One stable-candidate `validate:fast` passed: **5,857 server, 4,470 client and 697
  script tests** (**11,024 total**), static/lint/ESM/hygiene checks and both builds.
- **22 PostgreSQL integration tests passed**: eight acquisition-fencing cases,
  six existing durable cancellation cases and eight new media cases. New cases
  replace acquisitions during readiness/queued/active work for both owners, plus
  active expiry without replacement. They prove native drainage, no stale terminal
  publication, unchanged replacement authority and exact own-expiry release.
  The cached integration PostgreSQL image identifies version 18.3.
- **Two new Linux native lease cases passed** on the image below. A real child
  handles SIGTERM but remains open until a private fixture gate permits close;
  the command remains active in the meantime. Actual FFmpeg encoding also stops,
  all three tooling/encoder commands close, original source hashes remain unchanged,
  and replacement acquisitions stay active and unreleased. These controls explicitly
  invoke the real renewal tick after replacement, without changing its interval.
- **Two existing native cancellation cases and two command-admission cases passed**
  on the same image. Cancellation includes actual FFmpeg and a held Linux child;
  command admission retains exit-before-stdio-close and successful real consumers.
- Both project skills passed the skill validator. The native reference and test
  routing now describe lease observation, uncertainty, fenced publication and
  replacement/expiry proof.

These scopes overlap and are not unique tests to add together. The initial focused
command contained two mistyped lifetime paths that Node silently ignored; the final
selection verified every path before execution. Its first run exposed two old
`completed` cleanup expectations for lost leases. Those tests now require `failed`
cleanup while preserving no-terminal-write behavior. The initial lint shadowing
failure and intermediate results remain private alongside the final passing logs.
No runtime source changed after the final frozen candidate/full fast gate.

## Shared-container memory evidence

All four cases passed in each fresh **3 GiB and 2 GiB** profile on image
`sha256:04ed04d88d130d45c595dcd768de6266f1334f9eb23504313f8df45524db7373`.
The media case retains 64 generated tracks in four formats, real scan/tag
persistence, four FFprobe inspections, one FFmpeg null-output preflight, two
8192² artwork jobs, provider-image TLS, two held PostgreSQL sorts and a retained
256 MiB caller buffer. Both profiles recorded three completed runs, three released
leases, zero active leases and zero final artwork reservation. Ordinary artwork,
maximum-pixel and maximum-byte cases also passed in each container.

| Limit | Sampled container peak, MiB | Kernel peak after fixture cleanup, MiB | Sampled Node RSS peak, MiB | Observed headroom, MiB |
| --- | ---: | ---: | ---: | ---: |
| 3 GiB | 1404.0 | 1409.1 | 416.6 | 1662.9 |
| 2 GiB | 1401.8 | 1409.7 | 406.8 | 638.3 |

Corresponding kernel peaks are **1,477,541,888** and **1,478,221,824 bytes**. All
cases retained zero limit-hit/OOM-kill counters; the unavailable v1 OOM-event count
remains null. This host's cgroup v1 usage is approximate. Kernel peaks include
startup, generation and hash verification; later cases inherit historical peaks.
Do not add overlapping process/category figures.

Lifecycle overlap is not simultaneous maximum CPU/memory. FFmpeg uses four threads
under a two-CPU quota. Preflight creates no converted file. Controlled 64-file
tmpfs selections do not cover populated catalogue distributions, every periodic
job, real provider accounts or bind-mount I/O. Generated Opus bytes vary, so this
is not a matched-input performance comparison or proof of a deployment minimum.
The preceding 18 artwork native checks were not repeated; artwork runtime bytes
are unchanged and the selected memory lane exercises real artwork overlap.

Twelve JavaScript files and 3,359 source files were frozen before the full fast
gate and rebuild, with source fingerprint
`b2e1fb9f68c58270d56aa8d8aaa196e558f262b6460602e5a364ce8abeb60b30`.
Final source/test bytes match that snapshot. Private logs, source/runtime comparison,
native measurements and acknowledged retirement records remain under
`.tmp/media-lease-interruption-2026-10-23/`, excluded from the commit.

## Recommendation and next item

Retain captured acquisition → existing heartbeat observation → sticky failure
signal → step-owned propagation and full drainage → current fenced writes where
authorized → exact captured release. This avoids extra lease polling and stops
obsolete work without weakening ownership. Costs are renewal-dependent detection
and conservative interruption on transient renewal errors. Signals do not reserve
memory or replace process/deadline/output/queue/container controls.

**Next:** propagate interruption through spectral proof and sidecar ownership.
Both callers currently invoke the signal-capable analyzer without a signal; their
hashing, job claims, cache writes and final publication need separate ownership
and native close proof. This round covers inspection/preflight only and does not
establish cancellation of every background job or a new authorization vulnerability.

GitHub MCP found no open PRs at selection and again before publication. No
applicable random/stale PR could be implemented, rebased or closed; no PR was
merged. Work remains on `main`. App version and lockfile are unchanged; no release
or tag is created.

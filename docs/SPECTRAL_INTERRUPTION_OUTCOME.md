# Spectral interruption outcome

Recorded October 23, 2026. See separate [design](SPECTRAL_INTERRUPTION_DESIGN.md),
[official research and tradeoffs](SPECTRAL_INTERRUPTION_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_SPECTRAL_INTERRUPTION_OUTCOME.md).

## Delivered design

The apply owner's strict-quality preparation now propagates cancellation/pause
and observed lease failure through the quality gate, spectral proof, sampled
hashing and the shared analyzer. Interruption escapes warning/candidate-failure
adapters. Admitted file reads, handle close, native process/stdio and pending
checks drain before terminal persistence and captured lease release. The returned
advisory sidecar drain also receives the heartbeat signal. Ordinary public proof
calls without a signal retain their behavior; not every HTTP caller automatically
acquires a disconnect signal.

The sidecar's existing positive attempt counter identifies each captured claim.
Completion, failure and interrupted-batch release now require active state and
that generation. Preparation observes claim loss with the existing serialized
one-second scope, then stops/drains its observer before publication. A completed
job is not misclassified as lost. Recovery/reclaim cannot authorize an older
consumer's writes. Counter values never reset or decrement, including on abort;
reusing a value would reauthorize stale consumers. Interruption returns owned
active jobs to pending but consumes claim attempts under the existing failure cap.

Analysis stays outside SQL transactions. Short publication locks the current
claim and commits cache/job writes on one queryable, checking abort before commit.
Cancellation observed during publication rolls them back. Signal-bearing pre-add
cache writes also use a short transaction. Only successful owned completion can
invoke the returned reputation callback. A stale refusal publishes neither cache
nor peer evidence. Remaining captured batch claims are released after drainage,
with all cleanup attempted and the original Error/null preserved.

Two small ESM modules separate claim persistence and per-job preparation/publication
from the reduced sidecar orchestrator. No schema, dependency, second deployed
service, endpoint, fingerprint algorithm, quality policy or resource setting changed.
The standards/testing skills now include a practical spectral ownership reference.

## Executed validation

- **133 focused tests passed** across proof/hash, spectral queue/cache/classification,
  quality/apply ownership, prior interruption and shared command boundaries.
- One stable `validate:fast` passed: **5,867 server, 4,470 client and 697 script
  tests** (**11,034 total**), static/lint/ESM/hygiene checks and both builds.
- **12 PostgreSQL integration tests passed**: six new spectral cases, five existing
  apply-lifetime cases and the existing request-owned apply/scan/match/reconcile/
  fulfillment flow. New cases prove normal committed ordering, stale generation
  refusal, an interrupted actual Node child, cache/job rollback, standalone proof
  cache rollback and an actual recovery lock wait behind publication. The cached
  integration image identifies PostgreSQL 18.3; packaged native tests use 18.6.
- **Two new Linux spectral cases passed** on the rebuilt image below. One retains
  a SIGTERM-handling child until explicit close and leaves the replacement claim
  unchanged, without cache/evidence writes. The other first measures actual
  spectral frames, then cancels real FFmpeg only after decoded spectral metadata
  arrives. Both native commands close; original file hashes remain unchanged and
  no cancelled proof cache entry appears.
- **Two existing lease-interruption and two shared-admission native cases passed**
  on the same image, retaining real encoding and exit-before-stdio-close proof.
- Both project skills passed the skill validator. Every owned native container,
  including the provisional source control, was removed and absence verified.

These selections overlap; they are not unique test totals to add together. The
initial focused command omitted a mistyped proof-test path; the final selection
was discovered and each path verified. Initial lint shadowing and an obsolete raw
error-message assertion were corrected before the frozen gate. Their logs remain
private. Expected null-scenario diagnostics in the existing lifetime tests are not
new database connection failures. The preliminary Linux control used the preceding
runtime image with current read-only source mounts; final native results above
use the rebuilt image and frozen source. No runtime/test source changed afterward.

## Memory regression qualification

All four shared-container cases passed in each fresh **3 GiB and 2 GiB** profile on
`sha256:d85f94f19ba210b1c578f04a4ed5091c702beca7b60b7964928bfb2c5937608f`.
The media case uses the existing 64-file/four-format catalogue, real scan/tag
persistence, four FFprobe inspections, one FFmpeg null-output preflight, two
8192² artwork jobs, actual provider-image TLS, two held PostgreSQL sorts and a
retained 256 MiB caller buffer. Both runs completed three jobs and released three
leases, with zero active leases and zero final artwork reservation. Ordinary,
maximum-pixel and maximum-byte artwork cases also passed in each container.

| Limit | Sampled container peak, MiB | Kernel peak after fixture cleanup, MiB | Sampled Node RSS peak, MiB | Observed headroom, MiB |
| --- | ---: | ---: | ---: | ---: |
| 3 GiB | 1408.7 | 1409.8 | 408.0 | 1662.2 |
| 2 GiB | 1412.7 | 1413.4 | 411.5 | 634.6 |

Kernel peaks are **1,478,258,688** and **1,482,039,296 bytes**. Limit-hit/OOM-kill
counters remained zero; unavailable v1 OOM-event counts remain null. Host cgroup
v1 usage is approximate. Historical kernel peaks include startup, generation,
verification and earlier cases; do not add overlapping process/category figures.

This selected lane does not overlap spectral DSP with every other worker. Lifecycle
overlap is not simultaneous maximum CPU/memory. FFmpeg uses four threads under a
two-CPU quota. Controlled tmpfs selections exclude populated catalogue distributions,
all periodic jobs, real provider accounts and bind I/O. Generated Opus bytes vary,
so these are not matched-input performance comparisons or a deployment minimum.
The preceding 18 artwork native checks were not repeated; artwork bytes are unchanged.

Sixteen JavaScript files and 3,364 source files were frozen before the fast gate
and rebuild, with fingerprint
`a2b775dade071b49be8af1eac39320bd0157df809a8e084e379d01f537c4e61c`.
Private source/runtime inventories, logs, native results and verified retirement
records remain in `.tmp/spectral-interruption-2026-10-23/`, excluded from the commit.

## Recommendation, limits and next item

Retain captured claim/upstream authority → serialized preparation observation →
bounded hash/native work and actual close → locked cache/job publication → returned
advisory reputation → exact captured cleanup. Benefits are migration-free stale-write
protection and no long analysis transaction. Costs include observation reads,
short publication transactions and claim attempts consumed by interruption. SQL
and file operations without cancellation support remain awaited; polling/drainage
is not a latency SLA or proof of whole-application quiescence.

An admitted commit cannot be undone by later abort. Reputation is separate from
cache/job commit: crash, callback failure or post-commit interruption can omit
advisory evidence. Existing trust hooks may start hidden work and are not claimed
fully drained or exactly-once. A durable outbox needs a separate design. Sampled
fingerprint and classification policies are unchanged; these controls do not
establish general content authenticity or protection against file replacement.

**Follow-up completed:** the [admission outcome](SPECTRAL_ADMISSION_OUTCOME.md)
subsequently reproduced concurrent backlog/dedup races and added shared producer
transactions. These interruption tests did not themselves reproduce that race.
The admission outcome owns that separate proof and the next reputation-delivery
recommendation.

GitHub MCP found no open PRs at selection and again before publication. No
applicable random/stale PR could be implemented, rebased or closed; no PR was
merged. Changes remain on main. App version and lockfile are unchanged; no release
or tag is created.

# Mixed review/media memory outcome

October 24, 2026. Completed the resource qualification recommended by the
[read-scope outcome](QUALITY_REVIEW_READ_SCOPE_OUTCOME.md). See separate
[design](DEPLOYMENT_REVIEW_MEMORY_DESIGN.md),
[official research/tradeoffs](DEPLOYMENT_REVIEW_MEMORY_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_DEPLOYMENT_REVIEW_MEMORY_OUTCOME.md).

## Implemented lane

Added narrow ESM catalogue, HTTP/owned-work and observation helpers, plus an explicit
native entry and package alias. Existing production services, resource limits,
workers, schema and dependencies are unchanged. One app handles real authenticated
review requests alongside its real media/artwork/database workload.

The controlled catalogue has two failed candidates, 4,096 failed file rows, 1,001
weak alternatives and thirteen eligible choices. Actual GETs traverse incomplete,
forward and reverse pages. Restart passes through checking, three real queue/lease
claims and queued state, with one required audit/intent and final lease release.
Synthetic failure records establish review state; the media workload uses real
audio and the existing controlled worker inputs. No live-provider evidence is
claimed from those records.

The mix retains the existing 64-file/four-format scan, four FFprobe inspections,
120-second source encoding to null, two 8,192-pixel artwork jobs, 256 MiB caller
buffer and two PostgreSQL 100,000-row sorts. Every original file hash is preserved.
Native closes, worker completion, reservations and exact lease release are checked.
Observer records are capped at 24 fixed labels and preserve original Error/null
while draining sibling work and attempting all owned cleanup.

## Frozen-image measurements

Each profile ran alone in a fresh 2-CPU/256-PID container on Node 24.22.1,
PostgreSQL 18.6 and FFmpeg 8.0.1. PostgreSQL and Node share the measured cgroup.
Memory/swap limits are equal, with no network, published ports or live data mounts.
These are cgroup **v1 approximate-usage** observations. Lifetime peak includes
startup, fixture generation, authentication, setup and cleanup.

| Observation | 2 GiB profile | 3 GiB profile |
| --- | ---: | ---: |
| Container lifetime peak | 1,463.0 MiB | 1,472.4 MiB |
| Sampled current peak | 1,454.7 MiB | 1,471.7 MiB |
| Sampled Node RSS peak | 420.3 MiB | 437.9 MiB |
| Sampled heap-used peak | 51.9 MiB | 59.8 MiB |
| Sampled external peak | 276.2 MiB | 284.0 MiB |
| Sampled ArrayBuffers peak (included in external) | 271.5 MiB | 279.3 MiB |
| Observed HTTP duration range, eight operations | 97.1–508.5 ms | 97.7–404.0 ms |
| Memory samples | 405 | 419 |

All eight HTTP operations completed within observed scan/encoder lifetime overlap;
three additional measured operations own actual qualification claims/completion.
This is lifecycle overlap, not proof that component CPU or memory maxima coincide.
Do not add overlapping memory fields or compare these two small latency samples
as an improvement/SLO. Both runs retain zero increases in failcnt/OOM kills; v1 has
no v2 OOM-event counter, which remains null.

Actual database settings: shared buffers 128 MiB, work_mem 4 MiB, hash multiplier 2,
max connections 100 and app pool maximum 10. The two controlled sorts individually
use 8 MiB work_mem and no parallel workers. Logical artwork budget remains 2 GiB,
publication reservation 1,255,277,354 bytes and final reservation zero. Those are
logical accounting values, separate from container or process memory.

## Validation and retained evidence

Fifteen focused observer/concurrency/memory tests passed. The stable fast gate
passed 11,118 tests: 5,938 server, 4,480 client and 700 scripts, plus lint, repository
checks and builds. Two final native cases passed, one per fresh profile. Code and
package alias remained frozen through qualification. An initial fixture bound the
app wrapper instead of its Express listener and timed out; that wiring was
corrected. Preliminary profiles are separate from the final-image measurements.

Production server/shared/client bytes and runtime packages match the preceding
image. The preceding 42 SQL, nine browser, controlled-provider and file-backed
results are retained after source/test/runtime comparison, rather than rerunning
unchanged matrices. No new release, schema object or operator setting. GitHub MCP
found no open PR at selection or recheck, so no applicable random PR or stale cleanup.
The standards/testing skills validate; their practical
[mixed-workload reference](../.agents/skills/harmoniarr-web-standards/references/deployment-review-memory.md)
records proof boundaries and cleanup. Human screen-reader/device acceptance remains
deferred; HTTP checking/queued status is separate evidence.

## Recommendation and next item

Retain the current single-app architecture, container caps, artwork/native admission,
owned queues/leases and bounded review facts/scans. The selected mix passed without
demonstrating a need for a new memory control. It does not establish a production
minimum: one review owner, short catalogue, low-entropy artwork and stopped unrelated
periodic workers limit extrapolation.

Next: **qualify the existing fixed high-entropy/sample-depth artwork corpus within
this same mixed workload**. Use fresh bounded profiles and the existing native
decoder/admission owners before changing reservation headroom or recommending a
deployment minimum. Household concurrency remains a separate unmeasured dimension.

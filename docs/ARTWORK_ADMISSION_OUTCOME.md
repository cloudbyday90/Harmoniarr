# Aggregate artwork admission outcome

Completed October 22, 2026 on `main`. See the separate
[design](ARTWORK_ADMISSION_DESIGN.md), [official research and alternatives](ARTWORK_ADMISSION_RESEARCH.md)
and [Docker outcome](LOCAL_DOCKER_ARTWORK_ADMISSION_OUTCOME.md).

## Implemented behavior

The artwork fetch service now owns a FIFO budget of two active resolutions,
32 waiters and a 15-second queue wait. The production module already shares this
service between HTTP routes and monitored-artist prefetch, so individual requests
and overlapping batches use the same budget. Separate instances/processes have
independent limits. There is no global active-work singleton or new dependency.

Small ESM modules own admission, lazy batch production and request normalization.
Only copied scalar metadata enters the gate: owner type/role strings are bounded
to 64 characters, owner ID to 256, and refresh is boolean. Policy is read after
admission. The slot covers provider retries/downloads, actual inspection/rewrite,
filesystem/asset publication, assignment/stale cleanup and returned quota/backoff
work. Success, thrown Error and thrown null all retire the slot.

Batches use two lazy producers and accept at most 50 items below the route boundary.
Ordinary item failures preserve partial-result behavior. Overload, queue expiry
and queued cancellation have fixed owned errors; capacity failures reach both HTTP
endpoints as 503 rather than empty artwork results. They do not create provider
absence backoff. Batch failures drain all admitted siblings before returning;
earlier items may already have published, so a failed batch response is not rollback.

Queued signals remove unstarted work and its timer/listener without dispatch.
Handoff also checks monotonic expiry. Active work retains its original completion
contract; aborting its caller does not release its slot early or undo publication.
Service-level signals are supported, but HTTP disconnect and background-worker
cancellation propagation were not added. Existing request/image deadlines remain
separate from the queue deadline.

## Validation and evidence

| Check | Result |
| --- | --- |
| Focused artwork/provider, CAA, wiring and local-ingestion compatibility cohort | 183 passed |
| `npm run validate:fast` | 10,927 passed: server 5,760; client 4,470; scripts 697 |
| Exact-image isolated Linux cohort | 65 passed: 11 native HTTPS checks and 54 admission/service/module/HTTP checks |
| Actual packaged ESM probe | Default shared slots, queue overflow/cancel, batch bound and seven real Sharp/file publications passed |
| Client comparison | All 155 artifacts unchanged |
| Both project skill validators and changed-document links | Passed |

The default-service control holds the first two final assignments while a 50-item
batch, another batch and an individual request overlap. Only two downloads and
two policy reads enter before release; all 53 items complete afterward. Separate
controls cover FIFO, queue overflow, timer/monotonic expiry, listener removal,
pre-cancelled and late work, fresh saved policy and Error/null release.

The native journey downloads seven real PNGs across Fanart.tv, TheAudioDB and CAA,
performs actual Sharp inspection/rewrite and temporary-file storage, and holds
final assignment with exactly two active slots. A queued cancelled request makes
no image connection. Original Host/SNI and default TLS verification are retained;
DNS and loopback routing are controlled, with child-scoped trust and zero proxy
contact. Assignment/asset sinks are controlled, so this is not PostgreSQL durability
or live-provider acceptance. Tiny images establish lifecycle counts, not production
throughput or safe maximum RSS.

The first Linux harness omitted the HTTP fixture's transitive phase-observer file
from its read-only mounts. That test file could not load; the corrected mount set
passed the complete cohort without production or image changes. Its diagnostic
summary and exact-container retirement are retained; the initial private runner
did not save the complete raw failure output. Final passing TAP is retained.
The touched route-test file was normalized to LF after whitespace checks detected
mixed endings. No application assertion was relaxed.

Nine changed/new code and fixture files were frozen for validation and packaging.
The source fingerprint covers 3,300 files:
`a7de1c09120f65816f9b3c50e6210f50822cbb74a49fcf86b8b3d46a760e6f77`.
Private evidence remains under ignored `.tmp/artwork-admission-2026-10-22/`.
The web-standards skill now routes to a practical resource-admission reference;
the testing skill records native proof and memory-claim limits. GitHub MCP found
zero open PRs at selection and completion, so random implementation and stale-PR
cleanup were inapplicable. No SQL, dependency, client UI, release-version or tag
changes were needed. Unrelated PostgreSQL/browser matrices were not repeated.

## Recommendation and next item

Retain request bounds → lazy batch producers → shared FIFO admission → existing
provider/DNS/TLS/byte/pixel controls → awaited decode/storage/assignment → release.
Benefits are bounded outstanding fetch work and explicit refusal without extra
dependencies. Costs are slower large batches, shared capacity for cached reads
and slots occupied by slow publication. Defaults are conservative project choices.

**Next: inventory and qualify aggregate admission for direct/local ingestion and
derivative generation.** Those owners remain outside the fetch-service cap. Measure
their actual large-image work on the packaged Linux stack before choosing a shared
decode/memory budget or worker isolation. Preserve per-image limits and deployment
resource controls. Stream thresholds, Sharp cache/thread limits, admitted pipeline
counts and process memory are different properties; this change does not establish
a hard heap/native-memory ceiling or a distributed limit.

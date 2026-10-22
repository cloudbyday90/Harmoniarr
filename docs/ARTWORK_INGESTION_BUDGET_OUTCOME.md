# Shared artwork ingestion budget outcome

Completed October 22, 2026 on `main`. See the separate
[design](ARTWORK_INGESTION_BUDGET_DESIGN.md), [official research and alternatives](ARTWORK_INGESTION_BUDGET_RESEARCH.md)
and [Docker outcome](LOCAL_DOCKER_ARTWORK_INGESTION_OUTCOME.md).

## Implementation and inventory

Provider, embedded and sidecar capture already share the module's ingestion service.
It now owns two active ingestions, four waiters, a 32 MiB queued-buffer allowance
and a 15-second queue wait. File waiters retain bounded paths rather than reading
their input first. Supplied buffers are validated against the 100 MiB hard maximum
before admission; saved per-image policy is read afterward. Buffer reservations
count each request's length, including repeated references to the same buffer.

A reusable ESM FIFO module now owns scheduling and weighted waiting. Small adapters
preserve fetch's existing defaults, diagnostics and state shape, and give ingestion
its own errors and byte accounting. Fetch may await ingestion while retaining its
separate fetch slot. File and buffer ingestion enter one admitted implementation;
neither reacquires its own gate. Slots remain owned through returned reading,
decode/statistics, filesystem and asset publication, including Error/null failures.
Queued abort/expiry returns byte reservations without dispatch. Active abort does
not release native work early. HTTP/worker signal propagation remains unchanged.

File ingestion opens/stat-checks one regular-file handle after admission. It rejects
declared oversize before reading, detects growth at the first excess byte, and
awaits handle close before slot release. Nonblocking open prevents a Unix FIFO
from waiting for a writer. Chunk copies retain only bytes read. Native file errors
have fixed approved diagnostics without paths or causes; an earlier refusal wins
over close failure. Existing library-path authorization and mutable-file semantics
are unchanged; this is not a file-snapshot or symlink-authorization contract.

Inspection/rewrite/statistics moved into a small processing module with compatible
public helper exports. Byte refusal precedes hashing. Statistics now use the same
pixel policy and a three-second native-processing timeout, retaining best-effort
color extraction. Native timeout excludes libuv wait and is not a whole-ingestion
deadline. Ingestion capacity failures remain owned admission errors through batch
resolution, rather than becoming provider absence or missing-artwork backoff.

No active derivative generator was found: serving reads stored originals, while
derivative settings/directories are configuration scaffolding. This round does not
create or claim a derivative cache-miss workflow. Local library assignment follows
asset ingestion; the existing outer fetch permit includes provider assignment.

## Validation and native measurement

| Check | Result |
| --- | --- |
| Focused artwork/provider/CAA/wiring/local-capture cohort | 196 passed |
| `npm run validate:fast` | 10,940 passed: server 5,773; client 4,470; scripts 697 |
| Exact-image isolated Linux cohort | 80 passed: 11 HTTPS, two native FIFO/growth, 67 admission/service/module/HTTP checks |
| Actual packaged ESM probe | Weighted waiting, queued cancellation, fetch compatibility, bounded same-handle growth and real FIFO refusal passed |
| Client comparison | All 155 artifacts unchanged |
| Both skill validators and changed-document links | Passed |

The native workload uses six real 1024×1024 PNG ingestions: three files and three
supplied-buffer requests. Both immutable images ran under the same isolated Linux
profile: no external network, UID 1000, one CPU, 512 MB memory and 64 MB temporary
storage. The same frozen workload code, installed Node 24.22.1/Sharp 0.35.5/libvips
8.18.7 and fixed source bytes were used. Asset sinks are controlled; decode,
statistics, output files and hashes are real. Supplied-buffer requests share the
fixed fixture buffer; this is not independent-client allocation stress.

| Observation | Preceding image | Candidate |
| --- | --- | --- |
| Peak outstanding work from inspection entry through asset sink | 6 | 2 |
| Inspections and asset publications | 6 / 6 | 6 / 6 |
| Sampled process peak RSS | 152,592,384 bytes | 124,620,800 bytes |
| Elapsed ingestion phase | 2,081.28 ms | 2,073.05 ms |

Exact input/output hashes, byte counts, dimensions and MIME projection match.
Each output is PNG, 1024×1024, 3,152,404 bytes, SHA-256
`86bb0325ad3cb9c269d95b9d3c8d0683bcf8b8b4fc5fde614c8f1bfd2658c451`.
Counters include queued native work, not six simultaneous CPU threads. RSS sampled
every five milliseconds is an observation, not a ceiling. This single pair does
not establish a throughput improvement, maximum-policy safety or database durability.

Scoped lint caught cleanup-flow, duplicate-export and shadow issues; they were
corrected before the final gate without relaxing assertions. The workload baseline
was repeated after its cleanup-only refinement so the final comparison uses the
same frozen fixture. Earlier observations and cleanup records remain separate.
Temporary validation builders/containers were retired with absence verified.

Twelve changed/new code and fixture files were frozen for validation and packaging.
The fingerprint covers 3,309 source files:
`e8b57ce9c7c8b099b7eca991c8969f9b199eb06c08022ed41124fcfc454f39fa`.
Private evidence remains under ignored `.tmp/artwork-ingestion-2026-10-22/`.
The standards/testing skill references now cover actual-owner inventory, weighted
waiting, bounded file reads and honest native measurements. GitHub MCP found no
open PRs at selection and completion, so local PR implementation and stale-PR
cleanup were inapplicable. No SQL, dependency, client UI, release-version or tag
changes were needed. Unrelated PostgreSQL/browser matrices were not repeated.

## Recommendation and next item

Retain provider admission → shared ingestion active/wait-byte budget → bounded
file/buffer input → raster/pixel policy → rewrite/statistics → awaited file/asset
publication → release. Benefits are shared decoder ownership, bounded queued source
bytes and refusal before unbounded file allocation. Costs are queue latency,
rejection under contention and an additional bounded file read/copy path. Budgets
remain per service instance/process; caller allocations and native caches are outside
their accounting. Global Sharp cache/thread settings were not changed.

**Next: qualify native image-worker isolation under the configured maximum byte
and pixel policies.** Include native hangs, termination/drainage and publication
fencing before treating worker memory limits as containment. Current one-megapixel
measurements do not qualify worst-case input or hard RSS. Preserve deployment
resource controls; design derivative generation explicitly if that feature is
implemented later rather than assuming its scaffolding already performs work.

The subsequent [worker outcome](ARTWORK_WORKER_OUTCOME.md) records implementation
and qualification of that next item, including the separate remaining OS boundary.

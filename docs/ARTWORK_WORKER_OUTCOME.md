# Artwork process worker outcome

Completed October 22, 2026 on `main`. See the separate
[design](ARTWORK_WORKER_DESIGN.md), [official research and alternatives](ARTWORK_WORKER_RESEARCH.md)
and [Docker rebuild outcome](LOCAL_DOCKER_ARTWORK_WORKER_OUTCOME.md).

## Implementation

Default provider, embedded and sidecar ingestion now runs image inspection,
rewrite and best-effort color statistics in a short-lived ESM Node process.
The existing shared gate still covers reading through asset publication. The
child receives bytes and numeric limits, with no inherited application secrets,
Node preloads, source URL, storage path or database dependencies. A generic error
helper was extracted from auth so native modules do not pull in that graph.
The compatible auth export remains available.

Worker framing permits a 1,024-byte header and at most 100 MiB output. The parent
checks exact byte count, supported format, dimensions and projected color data.
It owns hashes, source metadata, paths, file writes and repository publication.
The rewritten-output cap is new: an input within policy can be refused if its
rewrite exceeds that cap. Child libvips cache is disabled and its image/thread-pool
concurrency is one; server-global Sharp settings are unchanged.

A 15-second parent deadline includes startup, transfer and native processing.
Timeout, cancellation and malformed output invalidate the result and send SIGKILL.
Admission remains held through actual child/stdio close, including failed kill,
late valid output and nonzero exit. No worker result reaches publication before
successful validated close. Temporary worker failures retain owned 503 errors
through fetch batches without creating provider-absence backoff. Cancellation
after the worker has completed does not roll back parent publication already begun.
An unretirable OS process keeps its slot; the deadline is not a guaranteed response
time in that condition.

Direct preparation/inspection helpers remain available for focused native tests;
the service default uses the child. Injection moved from individual native helper
functions to the whole preparation boundary. The historical ingestion workload
explicitly retains inline preparation for its admission comparison; its sampled
parent RSS must not be repurposed as child-worker memory evidence.

## Validation

| Check | Result |
| --- | --- |
| Focused artwork/provider cohort | 229 passed; final worker cohort separately passed 10 checks |
| `npm run validate:fast` | 10,950 passed: server 5,783; client 4,470; scripts 697 |
| Isolated Linux provider/ingestion/worker cohort | 90 passed |
| Explicit maximum-policy/process lane | Seven passed, zero skipped |
| Actual packaged ESM probe | Default publication with parent loaders blocked; packaged child path, minimal environment, exact output, cancellation and retired observed PID verified |
| Client comparison | All 155 artifacts unchanged |
| Both skill validators and changed Markdown links | Passed |

The explicit lane used the exact rebuilt runtime image with read-only source/test
mounts, no external network or published ports, UID 1000, one CPU, 96 PIDs, 1 GiB
memory, equal memory-plus-swap and 16 MiB temporary storage. Actual cgroup memory,
CPU and PID values were checked. Native work/files were real; repository sinks
were controlled, so this is not PostgreSQL durability or live-provider acceptance.

| Native case | Observed outcome |
| --- | --- |
| Exact 104,857,600-byte valid PNG | Accepted; ancillary padding removed; 16×16 output, 100 bytes, exact expected hash |
| First excessive input byte | Refused before spawning another worker or publishing |
| Real 8192×8192 JPEG, 67,108,864 pixels | Accepted; 786,702-byte JPEG, dimensions/hash verified |
| 8193×1 JPEG | Refused by dimension policy; child retired |
| Synchronous non-cooperation after actual Sharp output | Timeout, SIGKILL, closed/reaped PID, zero publication |
| Abort after child output and abort after observed native activity | Cancellation, SIGKILL, closed/reaped PIDs, zero publication |
| Exit 7 after valid image output | Refused despite output; zero publication |
| Parent native input loaders blocked | Default ingestion still published through its separate child |

The small PNG output SHA-256 is
`0201a304652d5c7a872673cecb170e186c87d763b39e8f8ddf3961a6ed77da1a`;
the maximum-pixel JPEG output is
`6cd962b9433503f386017ab370eaf43b2524abc7cd1e6abf501b540d79630576`.
Kernel-recorded peak for the whole seven-case qualification container was
880,525,312 bytes, including fixture generation and all parent/child work. This is
one observed peak, not production sizing, worst-case decoder memory, two concurrent
maximum images or a per-worker ceiling. Padding and a solid-color maximum image
do not represent high-entropy pixel stress. The blocking control is not a
reproduced libvips deadlock. Linux signal/retirement evidence does not certify
every Windows cancellation behavior.

An initial final-lane attempt refused before image work because its preflight
assumed cgroup v2. The host actually exposes v1. The fixture now checks either
interface while retaining exact resource assertions and no skipped cases. Scoped
lint/hygiene and all seven native cases passed after that fixture-only correction;
production code remained byte-identical to the complete fast gate and built image.
The initial failed log and exact-container retirement remain preserved.

Sixteen changed/new code and fixture files were frozen. Final source fingerprint,
3,318 files: `46ebd46cc2cb9e2b496fa1b73582465de51eebc16f147c9424a70761e9df5acc`.
The earlier fast-gate fingerprint and the single native-fixture revision are kept
separately under ignored `.tmp/artwork-worker-2026-10-22/`. Temporary qualification
containers/builders were removed with absence verified. The standards skill now
routes to a practical native-worker workflow, and the testing skill distinguishes
routine checks from explicit maximum-policy qualification. Scenario review covered
thread heap-limit claims, exit-before-close publication and padded-input evidence;
the skill validator alone does not establish those decisions.

GitHub MCP found no open PRs at selection or completion, making random PR
implementation and stale-PR cleanup inapplicable. No SQL, client UI, dependency,
version, release or tag changes were required.

## Run the explicit lane

After the documented local no-cache rebuild, run this PowerShell command from the
repository root. It uses separate disposable test storage and no walkthrough
data/admin mounts. `--rm` removes the container after completion.

```powershell
docker run --rm --network none --read-only --cap-drop ALL `
  --security-opt no-new-privileges:true --user 1000:1000 `
  --cpus 1 --pids-limit 96 --memory 1024m --memory-swap 1024m `
  --tmpfs /tmp:rw,nosuid,nodev,size=16m --workdir /app `
  --mount "type=bind,source=$($PWD.Path)/src/server,target=/app/src/server,readonly" `
  --mount "type=bind,source=$($PWD.Path)/src/shared,target=/app/src/shared,readonly" `
  --mount "type=bind,source=$($PWD.Path)/testing/server/artwork-worker-fixture.js,target=/app/testing/server/artwork-worker-fixture.js,readonly" `
  --mount "type=bind,source=$($PWD.Path)/test/native/artwork-worker.test.js,target=/app/test/native/artwork-worker.test.js,readonly" `
  --entrypoint node harmoniarr:walkthrough-local `
  --test --test-concurrency=1 test/native/artwork-worker.test.js
```

This lane requires accessible cgroup v1/v2 controls and the stated limits; missing
evidence refuses qualification. It is outside the routine server test glob.

## Recommendation and next item

Keep shared admission → bounded original → short-lived child with native policy
and whole-job deadline → bounded output → successful close → parent publication.
Benefits are external retirement and reduced child data exposure; costs are process
startup/copying and refusal of excessive rewritten output. Workers share the OS
user and application cgroup, so native code compromise or aggregate OOM is not
independently contained. The actual packaged executable is PIE (ELF ET_DYN), but
broader exploit-hardening behavior was not certified.

**Next: design and qualify a separately constrained image-worker deployment.** Give
it independent memory, PID, filesystem and network boundaries without an app Docker
socket. Prove parent survival under forced worker OOM, two concurrent maximum-policy
images, bounded result delivery and the same close/publication fence. Retain process
workers until measured startup costs justify the ownership complexity of a pool.

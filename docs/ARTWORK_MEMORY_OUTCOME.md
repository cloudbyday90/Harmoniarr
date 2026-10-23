# Built-in artwork memory outcome

Completed October 22, 2026 on `main`, following the operator's request to keep
memory management inside the existing app. See the separate
[design](ARTWORK_MEMORY_DESIGN.md), [official research/pros and cons](ARTWORK_MEMORY_RESEARCH.md)
and [local Docker outcome](LOCAL_DOCKER_ARTWORK_MEMORY_OUTCOME.md).

## Delivered behavior

The existing decoder children now receive a verified Linux **1 GiB DATA soft/hard
allocation ceiling**, zero core-file limits, child-only JIT-less execution and
128 MiB V8 old space. A small ESM memory module also rejects excessive combined
input/pixel/sample-depth estimates before native rewriting. Linux fails closed
when the limiter/effective limit is unavailable. Windows retains the explicit
child path without claiming Linux memory enforcement.

Fixed temporary failures survive the actual worker protocol and shared fetch
batch without provider-absence backoff. Opaque native rewrite failures remain
temporary, with no raw diagnostic matching/disclosure. Exact output, successful
exit and actual child/stdio close still precede any parent publication. No
additional deployed service, socket, queue, Compose volume or privileged daemon
access was added. No release, tag, version bump or database migration was created.

## Executed checks

The complete `npm run validate:fast` gate passed **10,957 tests**: 5,790 server,
4,470 client and 697 scripts. Baseline/policy checks, lint, hygiene, server build
and client build passed. All 155 client artifacts remained byte-identical.

After that gate, only two native test files and a shared native input fixture
changed to narrow the concurrent stress case. Scoped lint and the complete
1,395-file hygiene check passed. Production/server-test code remained frozen;
the unchanged full fast gate was not rerun for native fixture-only changes.

Fast source fingerprint, 3,322 files:
`72fda0bc7a4bc3dac728811ac03b1609c9b0a4bb89fd0ebc78d8146f3bfc4448`.
Final source fingerprint, 3,323 files:
`7e7a7093aed6ea4d7ff8c65ba5d6c6e93c5ddbcc824883989b41e1b734d37a75`.
Twelve changed/new code and fixture files are separately hashed.

Native Linux amd64 checks used the rebuilt immutable image:

- **97** compatibility tests passed in the network-disabled, read-only, UID-1000,
  one-CPU/256 MiB profile, including actual provider HTTPS/admission consumers.
- **7** worker cases passed in the one-CPU/1 GiB/no-additional-swap profile:
  exact 100 MiB PNG, 8192-square RGB JPEG, first excess limits, hang/cancel/crash,
  native-active cancellation and default child wiring with parent loaders blocked.
- **3** memory cases passed in the two-CPU/3 GiB/no-additional-swap profile,
  described below. Large cases remain outside the routine server test glob.
- The packaged default-ingestion probe passed with parent input loaders blocked,
  exact output hash, actual packaged worker/limiter arguments, minimal environment,
  closed child, early cancellation and PIE executable checks.

The native/compatibility counts overlap fast coverage; do not sum them as unique
tests. No SQL changed, so a full PostgreSQL matrix was unnecessary.

## Actual memory evidence

The allocation control first emits a valid rewritten PNG, then retains and touches
16 MiB native Buffer allocations. The kernel refused further allocations after
**989,855,744 bytes (59 buffers)**. Child maximum RSS was **1,034,252 KiB**; DATA
and RSS cover different regions. The child exited seven, its PID retired, the
parent survived, the ingestion slot drained, storage stayed empty and repository
publication count stayed zero. The kernel OOM-kill counter was unchanged. A fresh
default worker succeeded afterward. This is an allocation-refusal control, not a
reproduced decoder vulnerability or a cgroup OOM simulation.

Two simultaneous **100 MiB padded PNG inputs** produced two exact 16×16 outputs
and two asset publications after both children closed. Their kernel maximum RSS
values were **283,816 and 284,456 KiB**, each with the actual 1 GiB DATA limit.
Both output hashes were
`0201a304652d5c7a872673cecb170e186c87d763b39e8f8ddf3961a6ed77da1a`.
Padding has real PNG ancillary CRCs; it is not high-entropy pixel complexity.

The default production worker refused a **100 MiB padded 8192-square JPEG** with
the fixed `artwork_worker_memory` 503 frame before publication. Storage stayed
empty and the OOM-kill counter stayed unchanged. Thus independently supported
maximum bytes and maximum pixels do not imply their combination is admitted.

Whole-container peak in the three-case memory lane was **1,049,047,040 bytes**,
including the test parent, fixture generation and allocation control. It is not a
per-worker ceiling, production sizing or a worst-case workload bound.

## Preserved failures and scope

A 768 MiB DATA candidate rejected the maximum JPEG with an actual native allocation
error. A 1 GiB candidate preserved the single maximum JPEG hash. Concurrent
maximum-pixel trials produced opaque native failures and separate successes under
one/two-CPU profiles. Their causes remain unproven; later healthy controls do not
diagnose them. The final concurrent gate deliberately qualifies maximum **bytes**,
while the single maximum-pixel case remains required. Two concurrent maximum-pixel
throughput is not certified. Native deadlines/concurrency were not raised.

Private failed/probe logs remain under ignored
`.tmp/artwork-isolation-2026-10-22/` and `.tmp/artwork-memory-2026-10-22/`.
Owned temporary containers/builders were removed with absence checked. The rejected
companion implementation was retired and is not part of this change.

GitHub MCP found no open PRs, so random open-PR implementation and stale-PR cleanup
were inapplicable. The standards AI skill now includes a practical memory workflow;
both skill validators passed. Scenario review checked heap-only limits, low RSS
with large DATA reservations, combined-policy refusal, output-before-failure,
shared-cgroup claims and preserving the requested single-app scope.

## Recommendation and next item

Keep shared admission → bounded bytes → verified per-child DATA limits → metadata
memory admission → native policy/deadline → exact result and successful close →
parent publication. This adds a useful native allocation guard with modest OS
dependencies and no additional deployed service. Costs include experimental
child-only JIT-less behavior, conservative capacity refusals and remaining shared
container/host memory competition. It is not a total RSS or hostile-code sandbox.

The subsequent [corpus outcome](ARTWORK_CORPUS_OUTCOME.md) qualifies diverse
high-entropy and 16-bit inputs. Its [design](ARTWORK_CORPUS_DESIGN.md) assesses the
next aggregate admission step inside the existing app. Keep load-sensitive
concurrent maximum-pixel throughput separate from the memory correctness gate,
with unchanged deadlines and recorded resource/host conditions.

## Run the explicit memory lane

After the local rebuild, from the repository root in PowerShell:

```powershell
docker run --rm --network none --read-only --cap-drop ALL `
  --security-opt no-new-privileges:true --user 1000:1000 `
  --cpus 2 --pids-limit 96 --memory 3072m --memory-swap 3072m `
  --tmpfs /tmp:rw,nosuid,nodev,size=16m --workdir /app `
  --mount "type=bind,source=$($PWD.Path)/src/server,target=/app/src/server,readonly" `
  --mount "type=bind,source=$($PWD.Path)/src/shared,target=/app/src/shared,readonly" `
  --mount "type=bind,source=$($PWD.Path)/testing/server,target=/app/testing/server,readonly" `
  --mount "type=bind,source=$($PWD.Path)/test/native/artwork-worker-memory.test.js,target=/app/test/native/artwork-worker-memory.test.js,readonly" `
  --entrypoint node harmoniarr:walkthrough-local `
  --test --test-concurrency=1 test/native/artwork-worker-memory.test.js
```

This uses disposable test storage and no walkthrough data mounts. It requires the
stated kernel profile and OOM counter evidence rather than skipping those checks.

# Built-in artwork memory management

Decision date: October 22, 2026. The operator requested memory management inside
the existing application. This replaces the separate worker deployment suggested
in the preceding [worker outcome](ARTWORK_WORKER_OUTCOME.md). See the separate
[official research and alternatives](ARTWORK_MEMORY_RESEARCH.md) and
[executed outcome](ARTWORK_MEMORY_OUTCOME.md).

## Ownership and limits

Keep the existing shared ingestion admission (two active jobs, four waiting jobs,
32 MiB waiting buffers) and disposable decoder children. Add one narrow ESM module,
`src/server/artwork/artwork-worker-memory.js`, owning launch policy, Linux limit
verification and image memory admission. The app retains storage, credentials,
hashing, repository writes and publication authority. Compose topology is unchanged.

On Linux, launch the existing worker through absolute `/usr/bin/prlimit` with
DATA soft and hard limits of **1,073,741,824 bytes (1 GiB)** and zero core-file
limits. Then exec the pinned Node executable with `--jitless` and
`--max-old-space-size=128`. Use argument vectors, no shell, no inherited preloads
and the existing minimal environment. Install Alpine's maintained
`util-linux-misc` runtime package rather than shipping a copied, untracked binary.
The packaged dependency footprint is verified separately from npm dependencies.

The child reads `/proc/self/limits` before input intake and refuses missing,
unlimited or excessive DATA limits. Failure to spawn the limiter refuses work;
there is no unbounded Linux fallback. Windows development uses the explicit Node
child with the same flags; it does **not** gain Linux resource enforcement.

DATA bounds relevant writable data allocations, including native allocations; it
is neither total RSS nor total virtual address space. The child cannot raise its
hard limit without privilege in the supported non-root, capability-dropped image.
The zero core limit avoids persistent decoder memory dumps. Node's heap option
controls only part of runtime memory. JIT-less mode reduces writable code-space
reservations in the measured runtime and is confined to the small child program.
It is experimental upstream and must be requalified with Node upgrades.

## Admission before rewrite

After actual native metadata inspection and existing format/dimension/page checks,
estimate memory using:

```text
64 MiB + (2 × input bytes)
       + (4 × oriented width × oriented height × max(3, channels) × sample bytes)
```

Known native depth names map to one, two, four or eight bytes; unknown depths use
eight, unknown channels use four. Refuse estimates above the child DATA budget
before rewriting or statistics. This is a conservative engineering admission rule,
not an allocator model or a guarantee that accepted images fit. The kernel ceiling
remains necessary. One maximum RGB JPEG and one maximum padded-byte PNG qualify
individually; combining maximum bytes and maximum pixels is refused as capacity.

Keep the existing 100 MiB original/output bounds, bounded protocol header,
Sharp cache disabled/concurrency one, three-second native operations and
15-second whole-job deadline. These controls address different resource dimensions.

## Failure and publication

Memory admission/startup refusal emits only `{ "failure": "memory" }`; opaque
native rewrite failure emits only `{ "failure": "failed" }`. The parent accepts
those fixed frames only with exit one and zero body bytes, recreating an owned
503 error. Native rewrite messages cannot reliably distinguish memory, corrupt
data and timeout, so they remain temporary failures without string matching.
Malformed native metadata retains the existing generic content-refusal policy.
Native process abort or nonzero exit also remains an owned temporary failure.

Shared batch consumers propagate those failures after draining siblings. They
must not turn them into provider absence/backoff. Success still requires exact
bounded output, zero exit, no signal, a live deadline and actual process/stdio
close. Even valid output before a later allocation failure cannot publish. The
original ingestion permit remains held through close, including failed kills.

## Qualification and limits of the claim

Fast tests cover the launch contract, startup refusal, combined memory estimate,
fixed protocol/privacy and batch propagation. Large allocation and maximum-image
tests stay in explicit constrained Linux lanes. Use actual external buffers,
kernel OOM counters, child retirement, exact output hashes and zero publication
after refusal. Drain all concurrent operations before fixture cleanup.

The one-CPU/1 GiB lane retains the preceding seven compatibility cases. The
two-CPU/3 GiB memory lane covers actual allocation refusal, two concurrent maximum
byte inputs and combined-policy admission refusal. Its extra memory belongs only
to disposable qualification, not another deployed app/service or a Compose change.

The application and children still share OS user/container capabilities and any
overall cgroup budget. Two DATA ceilings do not reserve two GiB of RAM, and do
not protect the parent from every aggregate/host OOM or native-code compromise.
No independent hostile-code sandbox or production-wide memory sizing is claimed.
The next useful measurement is diverse high-entropy/16-bit artwork against this
admission rule, followed by aggregate admission sizing inside the same app.

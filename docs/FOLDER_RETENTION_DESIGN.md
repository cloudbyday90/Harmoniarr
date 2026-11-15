# Persistent folder browse qualification design

This opt-in development lane answers whether one built-in service reuses all four
admissions and retires owned directory handles across repeated browse/cancel work.
It records finite idle memory behavior. It does not tune production GC, add a
second application service, change the 128-entry buffer or establish a leak-free
long-running plateau. See [research](FOLDER_RETENTION_RESEARCH_2026_11.md) and
[results](FOLDER_RETENTION_OUTCOME.md).

## Ownership and module boundaries

| Module | Responsibility |
| --- | --- |
| `folder-retention-session.js` | Construct one production service and stable filesystem adapter; own fresh wave barriers/controllers/tasks; verify independent page digests and successful close counts. |
| `folder-retention-observer.js` | Run the fixed schedule, wait for settled wave scope and brief idle, gather separate memory/cgroup/descriptor observations, await bounded checkpoint output. |
| `folder-retention-policy.js` | Fixed warm-up/measurement/budget policy and strict chronological summary validation. |
| `folder-retention-protocol.js` | Bind JSONL checkpoints to owner and sequence, compare final evidence, retain complete partial records after failure. |
| Existing folder profile runner/worker/Docker helper | Reuse immutable-image/source verification, owned fixture generation, resource inspection and actual container retirement. |

One worker process constructs exactly one service before any cycle. Its stable
adapter passes `{ bufferSize: 128 }` unchanged to native `opendir`. Per-wave
results, controllers, tasks, settled outcomes and barriers leave scope before
idle observation. Only compact numeric records, a digest, a fixed expected page
and bounded reporting state persist. Memory includes this harness bookkeeping.

Each cycle performs:

1. Admit four scans and hold delivery after their first native reads dispatch.
   Refuse a fifth without stat/open/read I/O. Abort the first request.
2. Release reads, hold all closes before native close dispatch, refuse another
   fifth without I/O and abort a second request. Release closes and await every
   task and actual successful close. Two pages publish and two requests abort.
3. Admit another complete four-request wave on the same service, hold first-read
   delivery and refuse a fifth. Release and verify four complete pages.

A completed cycle has eight opens/successful closes, six verified publications,
two aborts, three busy refusals, fifteen stats and 350,008 caller-visible reads.
The fixture contains 50,000 directories with bounded long ASCII, decomposed/
composed Unicode and emoji names. Expected pages are calculated independently
without retaining the full directory listing.

Any early stat/open/read/deadline failure releases barriers and drains siblings.
Rejected native close leaves a nonzero owned-handle count and fails qualification.
A failed session cannot produce subsequent passing cycles. Original rejections,
including `null`, survive optional diagnostic failure. Cooperative checkpoints
do not guarantee interruption or bounded settlement of stalled native I/O.

## Measurements and failure evidence

The fixed schedule is three warm-up plus twelve measured cycles, without early
stopping. Every process records an initial checkpoint and one after each cycle.
After each cycle, a 50-ms delay is a brief idle checkpoint, not stabilization.
Auxiliary cgroup and fd reads finish, both modes yield an event-loop turn, and
memory/resource types are sampled. No interval or heap snapshot is installed.

Natural GC is primary and that worker does not expose `globalThis.gc`. A separate
fresh diagnostic worker exposes and calls GC at the same sixteen checkpoints.
The two modes are not paired allocation-equivalence or latency experiments.
Report each field's post-warm-up range and signed end-to-start change. Per-cycle
change is an endpoint average, not regression, causality or a leak threshold.
Supplementary resource histograms cannot prove descriptor retirement. Consistent
fd totals and awaited successful owned closes are separate lifecycle evidence.

Reports are capped at 128 KiB, with at most sixteen checkpoints and fifteen cycle
records. The complete JSONL exchange is capped at twice that size. Each checkpoint
write callback completes before the next cycle; stdout acknowledgement is not
crash-safe disk persistence. The live controller retains complete lines after
worker failure/cancellation and cannot summarize them as success. A controller
crash can still lose evidence. Missing/duplicate/out-of-order records, mismatched
owner/digest, nonfinite measurements, fd growth or OOM events refuse summary.

Consumers are unprivileged in separate read-only, network-disabled containers:
two CPUs, 1 GiB, no swap, 64 PIDs, dropped capabilities and no-new-privileges.
The 600-second controller timeout bounds each full worker; production's five-second
cooperative deadline remains intact. Fixture preparation/cleanup are separately
owned root phases. Actual kill/wait/nonrunning inspection/removal precedes fixture
cleanup; uncertain retirement retains the owned fixture.

## Reproduction and review scope

Use the pinned Node 24.22.3/npm 12.0.2 toolchain, create output/scratch parents,
and keep outputs exclusive. These commands reuse the immutable qualified app:

```text
node scripts/measure-folder-browse.js --image sha256:fda139f38a81a4af9a2b49a6c4521b75aecca279efb9f72c76936a995be49d98 --output .tmp/retention-volume.json --storage volume --experiment persistent-retention
node scripts/measure-folder-browse.js --image sha256:fda139f38a81a4af9a2b49a6c4521b75aecca279efb9f72c76936a995be49d98 --output .tmp/retention-bind.json --storage bind --scratch-root .tmp/retention-scratch --experiment persistent-retention
```

Each storage profile creates one fixture, runs the two persistent workers and
removes its fixture only after all owned processes retire. No image build or
permanent testing service is required. Keep production source/package/runtime
boundaries equal before retaining earlier unrelated SQL/browser/provider evidence.
No release workflow dispatch, deployment or PR merge belongs to this lane.

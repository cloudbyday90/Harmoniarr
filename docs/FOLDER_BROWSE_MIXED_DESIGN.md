# Mixed-file first-page comparison design

October 31, 2026. See [research/tradeoffs](FOLDER_BROWSE_MIXED_RESEARCH_2026_10.md)
and [outcome](FOLDER_BROWSE_MIXED_OUTCOME.md).

The existing measurement CLI gains `--experiment mixed-first-page`. This fixes
storage to bind, cases to mixed, comparison to buffers and repetitions to four.
It rejects conflicting choices. Standard matrix behavior remains the default.
The fixed planner is a small ESM module separate from command policy and run
orchestration; a second pure module owns descriptive summaries.

Each of four blocks contains four adjacent 32/128 pairs with 5 ms RSS sampling
and four adjacent pairs without periodic sampling: 16 samples per block, 64 total.
Every sample uses a fresh consumer. Each state has two pairs with 32 first and
two with 128 first. Each block has two repetitions with the sampled pair first
and two with the control pair first. Fisher-Yates shuffles use Node crypto.randomInt;
tests inject deterministic draws. This is measurement ordering, not an app setting.
Report version 3 retains the complete sequence, block, repetition and observer
state, so the actual randomized schedule can be reviewed without guessing a seed.

The fixture is prepared once and contains exactly 1,000 directories plus 9,000
ordinary files. All samples request only the first 100-folder page. The unchanged
packaged service still checks metadata/cursors, raw-entry limits, admission,
deadline checkpoints and actual close. Native options are verified before only
bufferSize is substituted; read/stat observers return the original native Promise.
Each successful sample must perform 10,001 caller-visible reads, two stats and
one awaited open/close, with exact independently generated page names/digest.

The immutable image and its five scanner/policy hashes must match the checkout.
Consumers retain UID 1000, read-only root/fixture, network none, dropped
capabilities, no-new-privileges, two CPUs, 1 GiB, zero swap and 64 PIDs. Root is
used only for preparation/cleanup inside the owned mount. The existing UUID,
canonical containment and acknowledged container-retirement guards remain.
One full run owns 67 containers: probe, preparation, 64 samples and cleanup.
No new image, app service, schema, dependency, environment setting or deployment.

The analyzer validates complete sequence/pair identities, all four balanced
blocks and finite measurements. It returns min/median/max/count, per-buffer
elapsed/CPU/RSS-rise distributions, per-pair percent changes and faster/slower
counts, split by observer state, block and first buffer. Refused pairs are counted
separately and excluded from successful paired timings; slow successful pairs
remain. A refusal does not become a faster successful sample.

The statistics are descriptive. No p-value, significance or causation inference
is implemented. Periodic sampling-off peaks are boundary observations, not the
same peak coverage as sampling-on. Immediate post-GC snapshots are not leak tests.
Do not add RSS/heap/cgroup fields or correct durations from noisy observer controls.
Fresh processes do not clear shared storage caches. No cold-cache or network/NAS
claim is made. Fixed resources do not guarantee equal host activity.

Finish code review/focused checks, freeze source, run the explicit focused lane
serially, then execute one complete fast gate. Reuse the existing immutable image
and retain unrelated SQL/native/browser proof only after exact source/test/runtime
comparison. The task-owned scratch resource must be removed after actual container
retirement; preserve compact raw evidence and avoid new build/image accumulation.

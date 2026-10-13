# Reusable current-file fingerprint design

October 13, 2026. Baseline main `5f00e15`. Separate research/outcome documents
record applicable official contracts, measured tradeoffs and validation.

## Candidate and authority

Compare existing streams with a small ESM service that owns one read-only file
handle and one zero-filled buffer per fingerprint. Reuse that buffer sequentially;
hash only returned bytes and handle short reads without exposing unused tails.
Read at most the captured descriptor size, refusing early EOF or changed metadata.
Never follow an indefinitely growing file or load entire media into memory.

Bind opened descriptor size/mtime/inode/device to the captured pathname stat before
reading, compare descriptor metadata again after reading, then close before the
outer after-stat/root checks. Preserve current canonical-root containment, symlink
refusal and every existing Wanted/apply/publication reread. Path and descriptor
checks do not promise kernel-atomic directory confinement against hostile external
rename races. No positive cache, provider replay or weaker receipt authority.

Validate internal method/buffer options before I/O. Initially retain stream/64 KiB.
Keep the current 64 KiB/256 KiB/1 MiB allowlist; allocate at most the selected
buffer or captured file size. Preserve original read/stat Error/null through close
failure, and never return evidence after failed close. Optional byte telemetry
cannot change the result. Factories keep filesystem/handle dependencies injectable
for controlled failure and path-substitution proof.

## Experiment and selection

Extend the existing isolated-process benchmark to stream/reusable × three buffers,
using six rotating samples per configuration on the same tonal/noise profiles.
Compare exact hashes/sizes/actual bytes privately, reporting fixed method/buffer/
timing/memory fields. Pre-sample GC, sampling overhead, warm cache, process baseline
and synthetic-media limits remain. No elapsed-time threshold or automatic promotion.

Adopt only if result/race/cleanup proof and observed memory/performance jointly
support a default. The stream comparator remains an internal experiment; neither
method is a public setting. Prove actual large private delivery and fresh Wanted
refusal/replay with the existing bounded native fixtures, then freeze appropriate
fast/affected serial gates. No resource-bound increase or CI speedup inference.

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Current stream / 64 KiB | Known behavior and explicit close | Repeated buffer allocation | Baseline |
| Larger stream buffers | Lower observed large-file median | Higher sampled memory in prior experiment | Do not promote |
| Owned handle with bounded reusable buffer | Potential allocation reduction; descriptor/path binding | Short-read, EOF and cleanup contracts need proof | Implement and measure |
| Whole-file read or historical hash reuse | Simpler or less I/O | File-sized memory or stale authority | Reject |

Recommended stack: owning guard → current root/path stat → bound read-only handle
→ bounded sequential reusable read/hash → descriptor recheck/close → pathname/root
recheck → unchanged publication rules. Main only; no release or PR merge.

# Concurrent ceiling scan design

October 31, 2026. See [research and tradeoffs](FOLDER_BROWSE_CONCURRENT_RESEARCH_2026_10.md)
and [outcome](FOLDER_BROWSE_CONCURRENT_OUTCOME.md).

Extend the explicit measurement CLI with `--experiment concurrent-ceiling`.
Fix cases to ceiling, comparison to buffers and repetitions to four. Permit
either a disposable Docker volume or a canonical owned Windows bind child.
Standard and mixed-first-page experiments retain their existing behavior.

A dedicated ESM workload starts four first-page calls on one factory-created
production service in one process, over the same exact 50,000-directory fixture.
An adapter verifies the production buffer option before substituting 32 or 128.
It dispatches each handle's first native read and holds delivery until all four
have reached that boundary. All subsequent reads and stats return their original
native Promises. This small synchronization overhead is included in the work
window for both variants; it establishes overlapping open handles, not equal
kernel scheduling or four simultaneous syscalls.
The timed window includes factory setup, the four calls, awaited closes and
independent result verification; preparation and lifecycle controls are separate.

Each variant/state has four fresh-process observations: 16 consumers per storage
profile. Adjacent 32/128 pairs use randomized balanced buffer and sampling order.
The report records the actual schedule. Sampling on uses the existing 5 ms RSS
observer; sampling off uses boundary observations. A pure analyzer validates
pair identities, counts, resource scopes and explicit refusals. Durations are
group completion times, not a sum of four independently measured durations.

Successful groups require four identical independently generated first pages,
200,004 caller-visible reads, eight stats, four opens and four completed native
closes. Peak owned handles must be four and final live handles zero. Refused
groups remain explicit and cannot enter successful paired timing comparisons.

Two separate lifecycle consumers per storage profile exercise both buffers.
Four calls hold first-read delivery after native dispatch; a fifth must refuse
before stat/open. Abort one held reader, release delivery, then hold all four
closes before native close dispatch. A fifth still refuses with no extra I/O.
Abort a second call at close, release the barrier, await actual closes and all
four outcomes, then verify capacity with a successful new scan. Two aborted
results must never publish. This proves cooperative ownership and late-abort
publication refusal; it does not prove interruption of blocked kernel I/O.
Barriers race operation failure and always release/drain in cleanup, preserving
the original rejection including null.
If close is reached before all four first reads are dispatched, both gates
release immediately so the failed operation can finish and wake its waiting
peers. Synchronous native dispatch failure and a deadline after open exercise
this boundary; a whole-operation rejection alone cannot wake peers while its
own close is deliberately held.

Each profile reuses the immutable matching image: no build or second app service.
Actual UID 1000, read-only root/fixture, network none, dropped capabilities,
no-new-privileges, two CPUs, 1 GiB, no swap and PID limits remain inspected.
The image's five scanner/policy hashes must match checkout. Root is confined to
owned preparation/cleanup. All consumers must retire before fixture removal.
One profile owns 21 containers: probe, prepare, 16 measurements, two lifecycle
controls and cleanup. Failure preserves partial evidence and uncertain resources.

RSS sampling measures the whole process while all four scans run. Cgroup current
before/after and lifetime peak measure the whole fresh container, including
startup and charged filesystem cache; v1 current remains approximate. Report
these scopes separately, retain OOM/throttle counters and disclose unchanged
caches/current host load. Do not add overlapping fields, equate observer states'
peak coverage, or infer minimum whole-app memory. Deadlines and all production
defaults remain unchanged. Freeze code before native profiles, run profiles
serially, then one complete fast gate and exact retained-runtime comparison.

# Wanted root-cost profile outcome

October 13, 2026. This round implements the previous outcome's diagnostic step:
an opt-in ESM cost observer and `--root-costs` mode on the existing benchmark.
Production authorization, current-root reads, opening/closing full hashes,
individual source identities and publication/event guards remain intact.

## Implemented boundaries

`testing/integration/wanted-guarded-cost-observer.js` retains two fixed query
buckets and four fixed process-memory windows. Exact normalized matching of the
canonical root-context statement identifies its query count and awaited time;
native assertions tie that count to actual root-resolution calls. SQL text,
values, paths, owners, errors, result rows and projection DTOs never enter the
aggregate. Snapshot callers receive a detached copy.

Query timing includes transport and driver result decoding, not just server SQL
execution. Root-resolution timing additionally includes result mapping,
containment and observation overhead; subtracting the two is not a pure
filesystem benchmark. Signed memory ranges include garbage collection and other
process work. Nested windows and memory fields overlap and cannot be summed.
Digest serialization is a separate window because the benchmark itself allocates.
No window establishes allocation attribution, a hard cap or a leak.

Diagnostics-off/on variants use identical closed-group work, one connection,
fresh rollback-owned transactions and private full-result/projection-digest
comparison. Both retain the original periodic memory sampler. Existing resource
bounds, original Error/null, actual completion/drain and fixture cleanup remain.
No global scheduling or ordinary integration-discovery expansion.

## Matched measurement

All **24 samples / 12 pairs** complete in 216.895 seconds of benchmark runner
time. Each pair retains identical complete results, seven private projection
digests, query counts, receipt outcomes, hash calls and actual bytes. Alternating
off/on order uses two pairs for each of six media/count profiles. Seven reviewed
source hashes are frozen before measurement and remain the gate candidate.
This comparison measures observation overhead; it introduces no optimization.

Each sample has seven projections and 28 hashes. Root queries are 224 / 672 /
1,344 for 16 / 48 / 96 receipts; total queries are 354 / 802 / 1,474. Hash bytes
are 954,492 for tonal and 508,451,776 for noise at every receipt count. These are
historical duplicates of two distinct actual private files, not independent
acquisition scaling. Controlled media uses the network-disabled local image
`harmoniarr-quality-fallback:local`, observed digest
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
and ffprobe 8.0.1, on Node 24.18.1. No runtime upgrade.

Off/on values are local medians; root columns are diagnostics-on medians. Heap
columns are the largest sampled growth over each variant's own post-GC baseline.

| Profile / receipts | Service off / on (ms) | Root resolution (ms) | Root query await (ms) | Worst heap growth off / on (MiB) |
| --- | --- | --- | --- | --- |
| Tonal / 16 | 501.425 / 544.414 | 331.350 | 206.919 | 13.004 / 13.684 |
| Tonal / 48 | 957.479 / 1,103.582 | 875.094 | 562.576 | 28.773 / 26.169 |
| Tonal / 96 | 1,807.261 / 1,878.331 | 1,622.613 | 1,042.597 | 56.093 / 58.045 |
| Noise / 16 | 1,024.241 / 952.626 | 302.305 | 195.263 | 21.188 / 22.760 |
| Noise / 48 | 1,557.349 / 1,600.230 | 907.953 | 589.024 | 34.946 / 38.063 |
| Noise / 96 | 2,441.815 / 2,793.842 | 1,980.936 | 1,247.271 | 49.339 / 54.170 |

Root query await is about 62–65% of the root-resolution medians. This makes
repeated root statements a useful design target, but their remaining phase cost
still includes containment/mapping/diagnostics. Noise 96 observation-on median
is about 14.4% higher; noise 16 is lower despite added work, illustrating limited
samples and host/cache/GC variance. No universal overhead or speed claim.

At noise 96, across the two instrumented samples, signed heap changes per window
range from -53.665 to +0.064 MiB for a root query, -45.108 to +8.603 MiB for a
projection, +0.249 to +0.267 MiB for a fingerprint, and +0.171 to +0.172 MiB for
digest serialization. Positive projection growth exceeds individual observed
hash/digest windows, but nesting, intervening work and GC prevent subtracting or
assigning it to receipt capture or driver allocations. The large negative query
changes show that a window can coincide with process-wide collection.

The largest serialized cost aggregate is **1,025 bytes**. Fixed retained state
does not mean the observer is allocation-free: normalization, memory reads and
window closures cost work. Largest RSS growth off/on across all profiles is
8.082 / 32.988 MiB, another reason to keep this opt-in. RSS, heap, external and
ArrayBuffers are sampled separately and overlap. No cap or leak diagnosis.

Direct guarded service elapsed time excludes setup/BEGIN/ROLLBACK, GC, commit,
scheduling and HTTP; the runner includes fixture setup/cleanup. Private digest
work, periodic sampling and explicit GC affect the measurement. Two pairs,
warm caches and duplicate controlled receipts limit generalization. Prior
experiments are different collections and are not matched speed baselines.

Ignored `.tmp/wanted-root-costs-2026-10-13/` retains the source freeze, complete
data-minimized report, numeric analysis, literal native selection and gate logs.

## Validation

Ten focused cases pass, including the actual root store, held awaited query,
fixed-field privacy, detached snapshots, signed GC decreases, invalid admission,
timer ownership and original Error/null despite failing memory/clock adapters.

The affected serial native cohort passes **2/2 scenarios across two literal
files** in 42.188 seconds of Node test time (42.290 seconds runner time). It proves
diagnostics preserve complete results and counters, all 224 actual root queries,
seven projection/digest windows and 28 fingerprint windows in the controlled
sixteen-receipt case. Late-byte refusal, same-marker mutation, canonical group
publication and required-event rollback also pass. No failure/cancellation/skip.
This is the changed profiling boundary and its canonical consumer, not an
exhaustive integration/browser run.

The frozen final `validate:fast` gate passes **10,077 tests** (5,139 server,
4,384 client, 554 scripts), static checks and both builds in 123.267 seconds,
with zero failure/cancellation/skip. The unchanged 107-migration snapshot is
current. Seven working/staged source hashes match the measurement freeze through
the gate. Dependency audit reports zero vulnerabilities; dependencies remain
unchanged. This is not a matched whole-suite performance comparison, and does
not establish that historical intermittent PostgreSQL failures are resolved.

Three skill structure checks and four repo/installed standards-file hashes pass.
The existing practical standards/testing skills receive this procedure; metadata
and invocation policy stay unchanged. These checks are separate from runtime
proof, a new blind trial or certification.

## Decision and next work

The [design](WANTED_ROOT_COST_PROFILE_DESIGN.md) compares tradeoffs and the
[official research](WANTED_ROOT_COST_PROFILE_RESEARCH_2026_10.md) identifies source
versions/status. The [PR applicability record](OPEN_PR_APPLICABILITY_ROOT_COSTS_2026_10_OUTCOME.md)
finds no new applicable head. Main only; no PR merge or release.

Static review identifies `app-user-service.js:updateAppUser` as the owner of
disabled/private-root updates and `settings-service.js:updateSettings` with
`settings.js:persistSettings` as the transaction/persistence boundary of music-root
setting updates. Before reducing root reads, inventory publication coordination
and remaining callers, then prove late committed changes on the actual borrowed
transaction. A stable earlier snapshot cannot establish current authority. This
is a design prerequisite, not a reproduced vulnerability or claim that the writer
inventory is complete.

Recommended stack: fixed cost evidence → exact-work control → current-state
writer/lock contract → bounded owner/requirement root batching only after native
revocation proof → both full hashes → existing publication/event transaction.
Adopt the diagnostic layer now. The next item is the writer/lock and revocation
design for bounded opening/closing root reads; retain conservative independent
reads until that design is demonstrated.

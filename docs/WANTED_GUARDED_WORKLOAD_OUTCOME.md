# Larger guarded Wanted workload outcome

October 13, 2026. Baseline main `73e579e`. Separate
[design](WANTED_GUARDED_WORKLOAD_DESIGN.md) and
[official research](WANTED_GUARDED_WORKLOAD_RESEARCH_2026_10.md) own scope,
source status, alternatives and the recommendation stack.

## Delivered measurement boundary

New modular ESM benchmark, profile, memory and client helpers execute the actual
Wanted service/reader/maintenance/write/link/source-event paths with current
root and byte checks in direct reconciliation mode. Worker lease/scheduling
context is outside this measurement. A pair owns one concrete connection and each
variant rolls back separately. Full results and complete projection digest
sequences are compared privately; saved summaries explicitly select work/phase/
memory fields and omit IDs, paths, digests, SQL and raw messages. Uncertain
rollback discards the connection, preserving original Error/null over cleanup.
Each pair has the unchanged scenario deadline and registered actual completion.

The explicit benchmark compares stream/64 KiB with reusable/256 KiB on 16/48/96
historical receipts, two alternating pairs per tonal/noise profile. Real saved
two-owner scope and apply completion produce two separate private files; history
copies scale receipt work without introducing distinct-track coverage. Production
hashing and publication guards remain unchanged; no positive cache/grouping,
pool/deadline increase, schema/dependency/worker/UI change.

Run the opt-in experiment with:

```powershell
node --expose-gc scripts/measure-wanted-guarded-workload.js --output .tmp/wanted-guarded-workload.json
```

The full experiment remains outside normal integration discovery. One bounded
new native case proves both readers, late-byte refusal and required-event
rollback; existing larger-media controls supply complementary coverage. Initial
native review ran tonal/noise controls, 2/2 in 72.341 seconds; the final ordinary
case retains the tonal control to avoid repeating equivalent noise acquisition
in every validation. That initial result is separate from frozen final proof.
Nine focused lifecycle/memory/privacy controls pass before the freeze.

The first attempted npm wrapper invocation rejected the forwarded --output flag
before any benchmark/database work. The direct Node invocation is used instead;
failed launcher evidence is retained separately. Nine code/package hashes are
frozen before the experiment and final gates.

## Interpretation and decision

The benchmark measures complete guarded service work inside rollback-owned
transactions. Connection acquisition/BEGIN/ROLLBACK, app/media setup and explicit
pre-sample GC are outside elapsed time. Sampling and private projection digest
work are included. It excludes commit durability, operation scheduling and HTTP.
RSS/heap/external/ArrayBuffers remain separate sampled observations; ArrayBuffers
overlap external. Warm cache, process baseline, GC/order, synthetic signals and
two pairs limit timing/memory generalization. Nested phases overlap and cannot
be added as wall time. Samples from separate historical experiments are not
combined into a matched speed claim.

The full frozen experiment completes **24 samples across twelve pair scenarios**
in 413.205 seconds. Two samples per method/profile/cardinality compare exact
results, seven private projection digests, query counts, observer counters and
path work. No scenario/checkout/pool bound changes. Media uses the existing
network-disabled `harmoniarr-quality-fallback:local` image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
and ffprobe 8.0.1. Tonal private files are 34,085/34,093 bytes; noise files are
18,158,988/18,158,996 bytes.

| Receipts | Projection reads | Queries | Hashes | Bindings per projection / summed guard observations | Repeated hashes within projections | Tonal / noise bytes hashed per sample |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 7 | 242 | 112 | 2 / 14 | 98 | 3,817,968 / 2,033,807,104 |
| 48 | 7 | 466 | 336 | 2 / 14 | 322 | 11,453,904 / 6,101,421,312 |
| 96 | 7 | 802 | 672 | 2 / 14 | 658 | 22,907,808 / 12,202,842,624 |

Both methods perform identical work. At 96 receipts, 658/672 observations
(97.9%) repeat a binding already observed in the same projection. Fourteen
distinct-per-projection observations still represent seven fresh guard reads
of two private paths. These counts do not authorize reducing freshness or
collapsing different receipt evidence/owners.

Medians and worst sampled memory across two samples per method, in milliseconds
and MiB respectively (stream / reusable):

| Profile / receipts | Guarded service median (ms) | Fingerprint phase median (ms) | Worst RSS growth (MiB) | Worst ArrayBuffer peak (MiB) |
| --- | --- | --- | --- | --- |
| Tonal / 16 | 621.031 / 581.180 | 237.237 / 207.352 | 7.172 / 8.648 | 8.407 / 4.135 |
| Tonal / 48 | 1,469.294 / 1,496.149 | 656.878 / 651.374 | 8.637 / 21.375 | 9.341 / 8.452 |
| Tonal / 96 | 2,991.726 / 3,253.004 | 1,475.497 / 1,621.707 | 8.809 / 13.516 | 9.274 / 8.590 |
| Noise / 16 | 4,631.183 / 2,533.609 | 4,018.181 / 2,157.042 | 26.734 / 10.230 | 28.285 / 9.423 |
| Noise / 48 | 10,897.371 / 7,181.017 | 9,729.352 / 6,351.525 | 23.941 / 11.133 | 29.035 / 9.176 |
| Noise / 96 | 29,467.185 / 15,471.089 | 26,697.841 / 13,788.938 | 18.906 / 10.289 | 29.598 / 9.908 |

The largest noise median is locally about 47.5% lower with reusable reads.
Tonal 48/96 medians are higher and reusable heap growth is higher in these app
samples; at tonal 96 the worst sampled heap delta is 9.484 / 25.257 MiB. Query
times also vary despite identical counts. This app workload does not inherit
the isolated hash probe's memory-growth result or prove a universal speedup.
Retain reusable/256 KiB and prioritize the observed duplicate work for a separate
authority-preserving design. No grouping or cache is adopted from timing alone.

The frozen fast gate passes **10,061 tests** (5,123 server, 4,384 client, 554
scripts), static checks and both builds in 210.345 seconds, with no test
failure/cancellation/skip. The unchanged 107-migration snapshot is current.
Nine code/package hashes match staged and working bytes. Five skill structure
checks and seven maintained/installed hashes pass. Dependency audit reports zero
vulnerabilities; dependencies remain unchanged. Build plugin-timing diagnostics
are observations from successful compilation, not a whole-gate speed comparison.

The frozen serial native cohort passes **18/18 tests across five literal files**
in 111.660 seconds of Node-reported test time, without failure/cancellation/skip.
It covers the bounded profiler, existing tonal/noise verification, Wanted
publication/reconciliation, indexed receipt integrity and actual large private
delivery. Late byte change, required-event rollback and current-byte/refusal
controls pass. The full 24-sample experiment is not repeated in this gate.
All nine frozen code/package hashes still match working and staged bytes.
Initial two-profile controls, the explicit benchmark and this selected gate are
separate evidence; they are not summed as distinct or exhaustive coverage.

Ignored `.tmp/wanted-guarded-workload-2026-10-13/` retains local
logs, literal manifests, fixed summaries and source hashes. The experiment's
result does not diagnose earlier PostgreSQL timeouts or certify web/security
conformance.

Recommended stack: current guarded service → same-client rollback measurement →
fresh root/byte checks → fixed work/phase/path/memory observations → matched
private comparisons → bounded follow-up design. Keep reusable/256 KiB and every
existing guard. The
[PR outcome](OPEN_PR_APPLICABILITY_GUARDED_WORKLOAD_2026_10_OUTCOME.md) records
no newly applicable revision; main only, no merge/release/deployment.

## Next item

Exact work confirms repeated identical private bindings. Next, design bounded
per-projection grouping with independent owner/root/path/expected-evidence and
late-change/refusal controls before adoption. Retain each receipt's individual
availability result and every fresh publication reread; do not share positive
evidence across guards, owners or invocations. Naturally recurring connection
failures still require the preceding checkout/server evidence to justify a cause.

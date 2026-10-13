# PostgreSQL connection boundary outcome

Date: 2026-10-13. Status: implemented and validated; no release.

The original bounded-root workload failure remains unexplained: its records did
not capture the failed client's startup or target. The new fixture-only adapter
adds that evidence for future failures without changing production pools,
resource bounds, retries or authorization. See the
[design](POSTGRES_CONNECTION_BOUNDARY_DESIGN.md) and
[official research](POSTGRES_CONNECTION_BOUNDARY_RESEARCH_2026_10.md).

## Implemented behavior

Three narrow ESM modules separate target/record projection, owned driver
instrumentation and its existing checkout composition. Both app entrypoints and
direct scenario pools forward the acknowledged database configuration privately.
Owned checkout records are version two; the separate first-app schema record is
unchanged. Internal pg 8.23.0 / pg-pool 3.14.0 surfaces are version-checked and
custom factories refuse instrumentation. Construction/startup/event observation
preserves original driver clients, callback/release values and Error/null.

Fixed milestone listeners read no payloads; startup dispatch follows the original
method's return. The target result compares only resolved host/port/user/database
scalars, excluding credentials. Queued/reused clients remain not observed.
Listeners/startup methods close at settlement, failure capture drains, and the
owned factory descriptor restores before teardown. Production pool and Wanted
authority/hash code, dependency pins, schema and bounds are unchanged.

## Remaining noise profiles

The explicit fresh collection completed all eight samples in 87.583 seconds on
Node 24.18.1: noise 48/96 receipts, two alternating member/bounded pairs for each.
It used the controlled media image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
ffprobe 8.0.1, a two-client pool and the unchanged 10,000 ms connection limit.
Each sample used a fresh rollback-owned transaction on its pair's client.

| Receipts | Mode | Queries | Current-root calls | Service median ms | Root-phase median ms | Worst sampled heap growth MiB | Worst sampled RSS growth MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 48 | Member | 804 | 672 | 1824.891 | 1045.259 | 16.163 | 10.918 |
| 48 | Bounded | 160 | 28 | 793.401 | 50.314 | 14.288 | 3.570 |
| 96 | Member | 1476 | 1344 | 2527.553 | 1783.774 | 35.208 | 28.117 |
| 96 | Bounded | 160 | 28 | 863.861 | 51.195 | 31.803 | 9.305 |

Both samples in each row have the stated counts. Every sample preserves seven
guarded projection reads, 28 actual full hashes and 508,451,776 hashed bytes.
Files are 18,158,988 and 18,158,996 bytes. Private complete result/projection
comparison passed; only the permitted bounded-root counters and root query work
differ. Required publication/source-event guards remain.

These are medians of two local observations per mode, not universal speed or
memory guarantees. At 96 receipts the observed service median is about 65.8%
lower; root calls are about 97.9% lower. Sampled heap and RSS improvements here
do not invalidate the previous mixed tonal memory results. Nested phase times
cannot be added as independent elapsed work; process growth is not allocation
ownership or a cap. Setup/cleanup are outside service elapsed time.

The [original outcome](WANTED_BOUNDED_ROOT_READ_OUTCOME.md) retains its failed
24-sample collection with twelve completed tonal samples and its separate
one-pair noise-16 control. This eight-sample collection is separate evidence; it
does not turn that historical collection into a completed run or diagnose its
timeout. No cold failure recurred in this collection.

Local ignored artifacts: `.tmp/pg-connection-boundary-2026-10-13/noise.json`,
`noise.log`, `noise-result.json`, `analysis.json` and `code-freeze.json`. Prior
artifacts remain under `.tmp/wanted-bounded-roots-2026-10-13/`.

## Validation and review scope

The first native candidate passed eight cases across two literal files. The
first fast gate then rejected an implicit Promise-executor return in the new
test callback. Braces removed that ignored return; original logs/frozen hashes
remain separate. The final native cohort passed 8/8 again, zero failures,
cancellations or skips, in 46.877 seconds (Node reporter 46.769 seconds).
The final frozen `npm run validate:fast` passed static/copyright/ESM/schema/image/
topology/lint/hygiene checks, 10,092 tests (5,154 server, 4,384 client, 554 script)
and both builds in 132.892 seconds. Every test layer reports zero failures,
cancellations and skips. Rolldown's plugin timing output is informational; it
does not establish complete build allocation or separate overlapping hooks.
The nine final changed JS files match their frozen hashes. Only the integration
test callback changed after the workload capture; all eight other JS files match
its candidate hashes. Production Wanted/hash/authority files are unchanged.

`npm run validate:security:npm` reports zero known vulnerabilities. This is a
dependency audit, not a complete application security certification. Three skill
folders validate structurally, and all four installed standards-skill files match
their versioned sources. Markdown links and whitespace checks pass. This round
does not claim the complete integration suite, browser/assistive-technology work,
a real TLS deployment test or a new blind skill trial.

Focused record/observer controls cover data minimization, invalid clocks,
immutable target capture, unavailable/custom factories, conservative deferred
creation, TLS stage distinction, original Error/null and descriptor restoration.
The native cohort owns actual startup hold and successful authentication/readiness
on promise/query callback paths, queue failure in both application entrypoints,
failure capture before cleanup and first-app observer coexistence. Synthetic TLS
events do not certify a real TLS deployment or certificate validation.

The maintained standards/testing skills gain this method; structure and installed
mirror checks are separate from runtime evidence or a new blind skill trial.
[Open PR applicability](OPEN_PR_APPLICABILITY_CONNECTION_BOUNDARY_2026_10_OUTCOME.md)
records random #40 and unchanged previously evaluated heads. No applicable patch
was reimplemented, no PR merged, and no release created.

## Next recommended work

Extend the explicit guarded workload with increasing distinct private file and
requirement bindings, separating those counts from duplicate historical receipts.
Measure real hashes/bytes, current-root and seven projection guards, latency and
sampled process memory before proposing further optimization. Keep production
authorization and both full hashes unchanged. Diagnose any recurring checkout
from its new original-client evidence; healthy later probes alone remain insufficient.

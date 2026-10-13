# Wanted distinct binding profile outcome

Date: 2026-10-13. Status: implemented and validated; no release.

The separate [design](WANTED_DISTINCT_BINDING_PROFILE_DESIGN.md) and
[official research](WANTED_DISTINCT_BINDING_PROFILE_RESEARCH_2026_10.md) establish
canonical distinct deliveries, fixed historical duplicates, private exact-work
comparisons and unchanged current authorization/full hashes. Final native proof,
measurements, limits, recommendation and next work are recorded separately below.

## Implemented boundary

Five ESM fixture/policy/orchestration modules add --distinct-bindings to the
existing CLI, preserving its other modes. The profile creates real 2/4/8 private
deliveries and saved requirements across two owners and 1/2/4 disjoint contexts,
then exactly three historical receipts per binding. Actual applied workers close
before inventory; no primary receipt or delivered byte is fabricated. Store-read
saved scopes match receipt owner/release/recording/medium/position; receipt paths
match the delivered files and every file has a distinct device/inode pair.

The existing guarded profiler performs member/bounded comparisons on one physical
client, fresh rollback per sample. For B satisfied sources, P=B+5 full projection
reads produce 2BP full hashes; three receipt histories produce 3BP available
rows. All root authority, file/content checks and required publication/event
guards remain. No production, schema, pool bounds or dependency pins change.
Pure admission policy tests import no application graph.

## Native and focused evidence

The initial two-file candidate passed the unchanged guarded-profile case but
failed the new fixture inventory: a mistyped plural override table produced
42P01. It remains in native-candidate.log/result. The corrected fixture uses
the established override store, with additional path/saved-scope comparisons.
The corrected native case passed; after extracting pure workload admission,
the final frozen native case passed again in 45.167 seconds (runner recorded
separately). Repeated controls are not counted as additional unique cases.

The four-binding native scenario verifies four saved scopes, twelve receipts,
two owners/two contexts, nine projections, 72 full hashes and a 144-query root
reduction with complete result/digest equality. Returned service work rolls back
without changing durable Wanted/event snapshots. A real second-context file
change after the opening projection refuses with library_wanted_projection_stale;
the required source-event rejection preserves durable Wanted/event snapshots.
Owned lifecycle work is awaited before database/container cleanup.

Three final pure admission cases pass in 94.422 ms, rejecting invalid/sparse/
duplicate dimensions and retaining cancellation Error/null. The earlier nine-case
focused cohort includes unchanged profiler controls and took 30.865 seconds;
that scope is different and is not an equivalent speed comparison.

## Completed 24-sample workload

All 24 samples completed in 425.664 seconds, using Node 24.18.1, PostgreSQL 18.3
and controlled FLAC/ffprobe 8.0.1. The media image was
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2.
There are two alternating member/bounded pairs for every media/cardinality shape;
each pair owns one connection and each sample a fresh rollback transaction.
The two-client pool, 10,000 ms checkout and existing scenario deadlines remain.
There were no failed/cancelled comparisons, retries or relaxed bounds.

| Bindings / requirements | Contexts | Receipts | Projections | Hashes per sample | Member / bounded queries | Member / bounded root calls |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 1 | 6 | 7 | 28 | 216 / 160 | 84 / 28 |
| 4 | 2 | 12 | 9 | 72 | 528 / 384 | 216 / 72 |
| 8 | 4 | 24 | 13 | 208 | 1488 / 1072 | 624 / 208 |

Each variant hashes identical actual bytes in every pair. Tonal totals are
954,492 / 2,454,534 / 7,091,058 bytes for 2/4/8 bindings. Noise totals are
508,451,776 / 1,307,447,550 / 3,777,070,882 bytes. Complete private result and
projection-digest comparisons pass. Receipts remain three histories per binding;
every shape has exactly two owners. Root query differences are exactly 56/144/416,
matching root-call differences; the same hash/byte work remains in both variants.

| Media | Bindings | Mode | Service median ms | Root phase median ms | Full hash phase median ms | Source lifecycle median ms | Worst sampled heap growth MiB | Worst sampled RSS growth MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tonal | 2 | Member | 484.537 | 191.872 | 75.272 | 176.365 | 6.499 | 0.898 |
| Tonal | 2 | Bounded | 319.740 | 59.570 | 65.722 | 127.456 | 6.492 | 0.832 |
| Tonal | 4 | Member | 743.213 | 300.209 | 120.597 | 402.484 | 24.459 | 1.098 |
| Tonal | 4 | Bounded | 534.526 | 105.205 | 111.163 | 290.549 | 21.822 | 0.117 |
| Tonal | 8 | Member | 1904.419 | 758.136 | 324.069 | 1335.489 | 49.818 | 27.855 |
| Tonal | 8 | Bounded | 1418.912 | 280.369 | 320.482 | 975.838 | 48.351 | 5.051 |
| Noise | 2 | Member | 718.832 | 112.928 | 460.067 | 290.189 | 15.440 | 3.867 |
| Noise | 2 | Bounded | 626.264 | 41.108 | 454.540 | 266.069 | 14.371 | 7.484 |
| Noise | 4 | Member | 1779.383 | 290.521 | 1174.103 | 951.979 | 16.891 | 3.945 |
| Noise | 4 | Bounded | 1563.886 | 103.590 | 1161.847 | 835.142 | 16.003 | 6.664 |
| Noise | 8 | Member | 4957.948 | 778.274 | 3344.809 | 3471.726 | 17.429 | 9.570 |
| Noise | 8 | Bounded | 4302.896 | 282.309 | 3221.906 | 2955.366 | 16.162 | 6.898 |

These are medians of two local observations per row, with setup, media generation,
GC and rollback excluded from service elapsed time. Media has already been read
during actual apply; this is not cold-storage latency or whole-app/CI throughput.
Phase windows overlap: source lifecycle includes its full projection/hash work,
so phase times cannot be summed. Heap/RSS/external/ArrayBuffers remain separate
sampled process observations; ArrayBuffers overlap external. Higher bounded RSS
at noise 2/4 bindings is retained. No memory cap, allocation ownership, leak or
universal speed claim follows from these measurements.

## Interpretation, recommendations and next item

Bounded roots reduce root queries by two thirds at fixed three-receipt history.
They reduce the observed eight-binding noisy service median by about 13.2%; the
remaining workload still hashes 3.78 GB. Four times as many distinct files grows
hash calls from 28 to 208 because P grows from 7 to 13. Current satisfied-source
work is 2B(B+5) hashes, not a constant seven-read or linear-file experiment.

Source lifecycle's eight-binding bounded median is 975.838 ms tonal and 2955.366
ms noisy, about 69% of service median in each shape. Code inspection shows it
rechecks the entire projection before every conditional transitionSource call,
including an UPDATE that may affect zero rows. Timings locate an owning phase;
they do not independently count no-op writes or authorize skipping a guard.

| Next option | Pros | Cons / proof needed | Recommendation |
| --- | --- | --- | --- |
| Keep current bounded roots and all source guards | Existing authority and mutation behavior retained | Measured repeated full work grows with distinct sources | Retain as baseline |
| Plan current source transitions and identify proven no-ops | Targets full rechecks before non-writing work | Needs transaction-owned current predicates, concurrency/lease/actor/file mutation proof, required-event atomicity and conservative fallback | Next design and bounded implementation |
| Reuse positive hashes or root values broadly | Could avoid more work | Historical byte/authority evidence can be stale; this profile supplies no cache contract | Reject for this round |

Final stack: canonical distinct-delivery fixtures; pure policy feedback; exact
guarded native and explicit matched measurements; existing bounded root authority;
then a separately proved source transition plan. Next investigate no-op-aware
source lifecycle admission while retaining current guards for actual writes and
required events, a final full comparison and both hashes at every retained
verification boundary. Measure the same distinct-binding workload afterwards.
Do not replace current behavior based only on phase totals.

That follow-up now has a separate
[source-noop design](WANTED_SOURCE_NOOP_DESIGN.md) and
[outcome](WANTED_SOURCE_NOOP_OUTCOME.md). It preserves this compatibility
baseline and proves a narrower positive-row skip with its own native and matched
evidence; the measurements above remain the original profile's results.

## Final gate and repository evidence

Artifacts are under ignored .tmp/wanted-distinct-bindings-2026-10-13/:
measurement.json/log/result, analysis.json, native.log/result and rejected
native-candidate.log/result, focused-candidate.log and policy-focused.log,
code-freeze.json and skill hashes/results. The final frozen npm run validate:fast
passes static/copyright/schema/ESM/image/topology/lint/hygiene checks, 10,095 tests
(5,157 server, 4,384 client, 554 script) and both builds in 131.657 seconds. Every
test layer reports zero failures, cancellations and skips. Rolldown's overlapping
plugin timing output is informational. npm run validate:security:npm reports zero
known vulnerabilities; this is a dependency audit, not a full application scan.

The final native four-binding case passes with zero failure/cancellation/skip in
45.261 runner seconds; the unchanged legacy guarded-profile case passed in the
earlier two-file candidate. These are separate executed scopes; the rejected
combined candidate is retained rather than relabeled a passing complete cohort.
The eight final changed JS files match the frozen native/workload/gate source.
Three skill folders pass structural validation, and four installed standards
files match their versioned sources. Markdown link and whitespace checks pass.

No production source, dependency pin, schema or release changes were made. The
ordinary suite adds one bounded native case, not the large scaling workload.
This round does not claim the entire integration suite, browser/assistive
technology validation, a new blind skill trial or broad standards certification.

The [PR applicability and cleanup outcome](OPEN_PR_APPLICABILITY_DISTINCT_BINDINGS_2026_10_OUTCOME.md)
records random #24 and the user's subsequent authorization to close obsolete
#23/#24/#40. GitHub confirms closed/unmerged and zero open PRs. No PR rebase,
branch creation, merge, release or dependency-update suppression occurred.

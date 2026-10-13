# Wanted source no-op outcome

The default canonical Wanted service now skips a source UPDATE and its preceding
full projection only when a locked, current, exactly owned positive source row
is already `already_exists`. A separate narrow ESM store binds the proof to
the private transaction/queryable authority and uses NOWAIT/savepoint recovery.
Actual writes and required events, the complete final comparison, current job
authority, and opening/closing full hashes remain. Fulfillment/custom/negative/
missing/mismatched/expired/busy paths stay conservative. See the
[design](WANTED_SOURCE_NOOP_DESIGN.md) and
[official research](WANTED_SOURCE_NOOP_RESEARCH_2026_10.md).

## Executed native and focused evidence

The final new native case passes on PostgreSQL 18.3 in 47.339 seconds of case
work (58.334 seconds runner wall time). It uses four real private files, four
canonical saved requirements, two owners/two artist-release contexts, and three
receipt histories per binding. It proves:

- Exact locked positive success; missing request, foreign owner, scope mismatch,
  negative availability, foreign queryable, expired token and connection reuse
  in a different transaction decline the skip.
- Busy-row 55P03 recovery leaves the owning transaction usable and takes the
  original guarded path. Three no-ops plus one attempted no-write transition
  retain six full projections and 48 hashes; durable results match compatibility.
- Complete private result, request/event/link state and projection comparisons
  match compatibility with nine projections/72 hashes versus five/40. Paired
  states omit generated event/Wanted IDs and top-level creation/update/event
  clocks; request identity and event details remain exact. Full failure snapshots
  separately retain all columns, IDs and clocks.
- An actual `needs_fetch` source writes one required retirement event with its
  original pre-transition guard. Three peer no-ops retain six projections/48
  hashes and exact paired durable results. Required retirement-event failure
  rolls back Wanted, links, requests and events. Unavailable-file reopening event
  failure likewise rolls back those complete snapshots.
- Same-size/same-time in-place byte change at the final lifecycle guard refuses
  publication after all four skips. Same-transaction owner disable, lease expiry
  and cancellation also refuse and roll back. Controlled non-lock Error/null
  failures propagate unchanged through actual native transaction authority.
- A later source-state writer is observed blocked after the final production
  source check. Both commit and controlled rollback release its lock; rollback
  preserves every durable field except the subsequent writer's intended state
  change. Successful default publication executes five projections/40 hashes.

A separate final regression cohort passes 6/6 cases in five files, 153.936 seconds
Node duration: bounded roots, closed groups/default wiring, distinct-binding
compatibility, legacy guarded profiling, and root authority/migration/writer
coordination. No failure, cancellation or skip. This is separate from the new
one-case proof, rather than a claimed single seven-case run.

Focused service/profile controls pass 14/14 in 736.364 ms, including custom-store
fallback, original source capture/deduplication, Error/null event propagation,
measurement admission and summary privacy. Dependency audit reports zero known
vulnerabilities. The final fast/build gate passes. The original explicit matrix
stopped as recorded below; the separate noise control passes.

## Matched workload observations

The incomplete original collection retained ten tonal samples: two alternating
pairs each for B=2 and B=4, and one pair for B=8. The separately owned noise
control completed two alternating B=8 pairs (four samples) in 170.239 runner
seconds. It uses the same frozen code and unchanged pool/scenario limits, but
does not complete or replace the failed matrix. Noise B=2/4 and the original
second tonal B=8 pair were not collected in a completed full matrix this round.

Both modes use bounded roots and the reusable fingerprint method, with three
historical receipts per actual binding and canonical delivery before timing.
Every reported pair passed complete private result, retained projection and
normalized durable request/event/link equality. The profiler excludes setup,
explicit GC, durable snapshot comparison and rollback from elapsed work.
File hashing was already exercised by actual apply, so these are warm-media
observations. There was no redundant warm-up or elapsed-time assertion.

| Collection/media | B | Statistic per mode | Projections compatibility / locked | Full hashes | Queries | Service ms | Source phase ms |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Partial tonal | 2 | Median of 2 | 7 / 5 | 28 / 20 | 160 / 122 | 346.157 / 281.055 | 143.173 / 54.275 |
| Partial tonal | 4 | Median of 2 | 9 / 5 | 72 / 40 | 384 / 228 | 1030.568 / 546.099 | 536.345 / 138.831 |
| Partial tonal | 8 | Single observation | 13 / 5 | 208 / 80 | 1072 / 440 | 2585.821 / 978.066 | 1851.592 / 215.560 |
| Separate noise | 8 | Median of 2 | 13 / 5 | 208 / 80 | 1072 / 440 | 4997.337 / 2049.445 | 3469.003 / 398.192 |

All locked samples counted B proven no-ops and zero transition attempts;
compatibility counted zero skips and B attempts. Each retained projection still
has two full hashes per group and two current bounded-root resolutions. The
hash formula changes from 2B(B+5) to 10B only for this fully satisfied shape.

Exact hashed bytes compatibility / locked were 954,492 / 681,780 for tonal B=2;
2,454,534 / 1,363,630 for tonal B=4; 7,091,058 / 2,727,330 for tonal B=8; and
3,777,070,882 / 1,452,719,570 for noise B=8. Noise fingerprint medians were
3718.360 / 1513.438 ms. Replacement medians were 745.929 / 831.347 ms, so that
phase did not improve in this small control; nested phase times overlap.

| Collection/B | Worst sampled heap growth MiB compatibility / locked | RSS growth MiB |
| --- | --- | --- |
| Partial tonal/2 | 2.227 / 3.715 | 0.207 / 2.832 |
| Partial tonal/4 | 4.940 / 3.667 | 0.316 / 0.000 |
| Partial tonal/8 (single) | 8.493 / 10.883 | 0.465 / 1.559 |
| Separate noise/8 | 16.371 / 15.623 | 8.215 / 3.398 |

Heap/RSS observations are mixed: the locked tonal B=2/8 samples were higher.
Sampled process growth includes GC/unrelated work and is not allocation ownership
or a memory cap. Fewer counted queries/hashes are the structural result; the
small elapsed sample set does not establish an application-wide speed guarantee.

The workload remains an explicit `--source-noops` CLI mode. Ordinary discovery
adds one native fixture covering multiple adverse controls and five unit cases,
not a repeated scaling matrix.

## Final gate and repository evidence

The frozen `npm run validate:fast` passes static/copyright/schema/ESM/image/
topology/lint/hygiene checks, all 10,100 tests (5,162 server, 4,384 client and 554
script), and both client/server builds in 136.239 runner seconds. Every test
layer reports zero failures, cancellations and skips. Dependency audit reports
zero known vulnerabilities; this is not a full application security scan.

Fourteen changed JavaScript files were frozen before the final native regression,
noise controls and fast gate. Source/staged hash, baseline-byte and Markdown-link
verification passes: all 14 source/staged hashes match, 17 retained production/
checkout baseline files are unchanged, and 739 local links in 13 changed Markdown
documents resolve. Three skill folders pass structural
validation and all four installed standards files match their versioned sources.
No dependency, schema, release, branch, tag or deployment change was made.

Ignored artifacts under `.tmp/wanted-source-noops-2026-10-13/` retain the failed
measurement.json/log/result, separately completed noise-control.json/log/result,
analysis.json, final native/regression logs/results, both rejected candidate
logs, focused/fast/audit logs, code-freeze.json and skill/verification results.
The entire integration suite, browser/assistive technology and a new blind skill
trial were not run in this backend slice.

## Preserved rejected candidates

The first native candidate failed with 42703: the new snapshot helper assumed
`id` on the discovery/Wanted link table. That table has a composite key; receipt
ordering also uses its actual composite key. The fixture queries were corrected.
The next candidate reached the controlled rollback but its raw expected rejection
was incorrectly registered as a fixture failure. Registering the observed
settlement while asserting the original rejection separately corrected lifecycle
ownership. Those two failed runs remain separate from final frozen validation;
no retry policy, resource limit or deadline was relaxed to obtain green evidence.

## Remaining scope and next recommendation

The original 24-sample matrix stopped after ten completed tonal samples, in
309.951 runner seconds. Its next cold application-pool checkout failed at
10,012.915 ms, with zero prior clients/queued waiters and a temporary one-client
requested count under the unchanged two-client/10-second policy. The original
client privately matched the acknowledged fixture target: construction 0.165 ms,
transport connected 1.807 ms, startup dispatched 1.890 ms. No authentication or
backend-ready milestone was observed. Both generic Error codes were unknown.
The correlated independent host probe failed at connect; container readiness
accepted and its running/OOM/restart state was healthy. A subsequent CPU snapshot
was 97%; that observation does not establish the cause of the failed connection.
There was no pool queue starvation evidence, and no server-side log/connection
correlation to locate the startup gap. The failed matrix stays incomplete.

This is a strict positive-state proof, not general source-state classification.
Later source writers can wait; NOWAIT does not remove table-lock waits or existing
fallback deadlocks. SQL locks do not freeze host bytes. Two matched observations
per shape will be descriptive, with warm media from actual apply; they do not
prove cold-storage, allocation ownership, whole-CI speed or universal timing caps.

Next, add bounded server-side startup/authentication/setup-duration evidence for
the original owned cold client, privately correlated and sanitized before output.
The [official PostgreSQL logging guidance](https://www.postgresql.org/docs/18/runtime-config-logging.html)
supports this diagnostic follow-up; no logging setting or deadline changed here.
This repeated validation failure takes priority over further performance work.

After that, profile and design a guarded no-change Wanted/link replacement path. The
current write store always invokes complete projection checks before DELETE and
link sync, even when their DML will change no rows. Inspect all writers and prove
current target/link equality and absent-row coordination before skipping either
check; retain actual-write/event guards and complete final byte/job authority.
This source finding is a follow-up proposal, not permission to cache hashes.

The practical standards skill was maintained through its official-practice and
project-owner references and testing guidance. Structure/install checks are
separate from application evidence and do not claim a new blind skill trial or
general standards/security certification. The [PR check](OPEN_PR_APPLICABILITY_SOURCE_NOOP_2026_10_OUTCOME.md)
found no open PR to replay locally. Work stays on main without a release.

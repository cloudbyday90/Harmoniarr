# Wanted root lookup outcome

October 2026. Baseline main `7848883`. The separate
[design](WANTED_ROOT_LOOKUP_DESIGN.md) and
[official research](WANTED_ROOT_LOOKUP_RESEARCH_2026_10.md) own alternatives,
source status and applicability. This document records implementation, measured
work and validation scope.

## Delivered behavior

`operator-track-root-context-store.js` reads the exact parameterized owner and
optional `paths.music` setting in one statement. The delivery service now selects
that read by default, while keeping explicit settings, custom settings loaders
and legacy custom stores on their existing contracts. Missing setting means the
existing default; explicit JSON null remains a refusal. Missing/disabled owner,
invalid private-root binding and unexpected original Error/null remain distinct.

Every receipt still resolves its current root and hashes actual bytes. Existing
Wanted write/event rechecks remain fresh and serial on the owning transaction.
No root/hash cache, multi-owner grant, extra checkout, parallel-query promotion,
schema/migration, new worker or public API/UI change is introduced. Six fixed
reader phases attribute monitoring, metadata, selections, overrides, availability
and receipt lookup inside optional private diagnostics. Output still omits paths,
hashes, SQL, domain/provider identities and raw errors.

## Measurement and retained failures

The fixture uses real two-owner saved scopes, current catalog/duration, actual
tagged FLAC and real apply-worker completion. Added candidate history passes
through the existing receipt ledger trigger. Each profile reuses the same two
physical files across historical candidates: this scales historical evidence
work, not distinct-track acquisition or a cold physical library. Profiles contain
2, 16 and 48 receipts; larger FLAC files are thirty-second 192 kHz generated
noise, not representative musical compression.

Four timed samples per variant alternate legacy/joined order on one borrowed
client. A fixture-owned adapter counts actual returned SQL calls and duration,
rejects overlap, and never prints SQL or patches a pool. Each pair must return
identical complete projection DTOs, root/fingerprint calls and actual bytes.
Measurement covers a single projection, not whole guarded reconciliation.

Initial focused validation was 46/48: two new expectations omitted the existing
`users/` root segment. Corrected tests pass without production path changes.
The initial six-profile experiment was **5 passing / 1 cancelled** after its
largest noise scenario exceeded the existing 90-second bound. Database teardown
then overtook unregistered direct profiling work; logs retain later administrator
termination/unexpected-connection errors and the separate failure probes. These
later observations do not replace the original timeout or diagnose the historical
connection-reset cause.

The reviewed fixture registers actual app-scenario completion for serial
admission/suite cleanup, cooperatively stops new queries/hashes on cancellation,
awaits admitted work and preserves the original Error/null. The actual apply
already hashes the files, so two redundant warm-up projections were removed;
all four timed samples per variant and all correctness assertions remain. No
scenario/checkout/pool/teardown bound increased. The reviewed isolated largest
profile passes 1/1: scenario 43.515s, command 80.123s. It is separate evidence,
not a clean initial full profile or a matched whole-suite speedup.

## Observed work and decision

All selected comparisons retain exact hash/byte work. Query counts per projection:

| Historical receipts | Legacy queries | Joined queries | Queries avoided |
| --- | --- | --- | --- |
| 2 | 21 | 19 | 2 |
| 16 | 49 | 33 | 16 |
| 48 | 113 | 65 | 48 |

The root lookup changes from two statements to one per receipt. At 48 receipts
that removes 42.5% of projection query calls, without reducing root/hash checks.
Tonal delivered sizes are 34,085/34,093 bytes; larger noise sizes are
18,158,988/18,158,996 bytes. At 48 receipts each variant still hashes 1,636,272
tonal bytes or 871,631,616 noise bytes in each projection.

Initial whole-projection medians vary; the sixteen-receipt noise joined sample
was slower despite fewer queries because observed fingerprint time increased.
In the reviewed isolated largest profile, root medians are 163.208ms legacy /
120.179ms joined, while fingerprint medians are 1,596.016ms / 1,383.063ms. These
are local ordered warm observations, not causal portable speedups. Nested phases
overlap; their totals cannot be added as wall time. Four samples, repeated physical
files, controlled signals and host/cache variance limit generalization.

Final frozen medians, four samples per variant, in milliseconds (legacy / joined):

| Profile / receipts | Whole projection | Root resolution | Fingerprinting |
| --- | --- | --- | --- |
| Tonal / 2 | 34.318 / 31.594 | 5.249 / 4.076 | 4.806 / 5.015 |
| Tonal / 16 | 108.001 / 90.741 | 43.143 / 31.961 | 38.217 / 33.953 |
| Tonal / 48 | 317.765 / 264.520 | 155.842 / 105.456 | 127.887 / 126.374 |
| Noise / 2 | 105.179 / 102.015 | 5.298 / 3.268 | 70.105 / 73.344 |
| Noise / 16 | 544.486 / 893.371 | 47.414 / 41.392 | 475.636 / 830.697 |
| Noise / 48 | 1,324.534 / 1,262.494 | 145.859 / 100.944 | 1,156.577 / 1,138.630 |

The frozen sixteen-receipt noise result again demonstrates why query reduction
cannot be promoted as a universal whole-projection speedup. Actual query counts,
complete projections and hash/byte work are the stable result of this change.

Adopt the bounded joined context for its exact query reduction, minimized
settings read and unchanged current-state result/refusal proof. It adds a small
store/default-mapping contract; it does not promise faster whole reconciliation
or fewer hashes. Broader batching and caching remain deferred.

## Validation and follow-up

The frozen fast gate passes **10,022 tests** (5,084 server, 4,384 client, 554
scripts), static checks and both builds in 148.935 seconds, with no test failures,
cancellations or skips. The unchanged 107-migration schema snapshot is current.
The client build prints a Rolldown plugin-timing diagnostic; compilation succeeds.
Five skill structure validations and seven maintained/installed SHA-256 matches
pass. Dependency audit reports zero vulnerabilities on Node 24.18.1/npm 12.0.2.
The final focused default/cancellation run passes 51/51 cases.

The affected frozen serial native gate passes **117/117 tests across eighteen
literal files**, including all six scaling profiles, with zero failures,
cancellations, skips or todos. Node reports 530.383 seconds. It also covers scan
catalogue/negative evidence/lifetime, receipt ledger, delivery recovery, track
catalog/consent, publication authority, Wanted/release reconciliation, metadata/
operator worker lifetime, import apply, scoped recovery and quality fallback.
This is the affected cohort, not the entire integration/browser suite. Eleven
frozen ESM source/test/fixture files match working and staged SHA-256 values through
both final gates. Native failure probes identify PostgreSQL 18.3; actual media
uses the existing `harmoniarr-quality-fallback:local` image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
ffprobe 8.0.1, with owned fixtures and networking disabled.

The ignored
`.tmp/wanted-root-lookup-2026-10-12/` retains failed, reviewed and final logs,
literal manifests, measurements and SHA-256 freezes separately. Source is reviewed
before final gates; file/scenario isolation and existing resource bounds remain.
Native controls cover explicit null versus missing setting, disabled owner, late
setting change and Wanted rollback. Existing current-byte/event/replay and
root-alias controls remain in the affected cohort.

The maintained standards/scoped/testing skill references now locate same-client
root context, missing/null semantics, historical-cardinality limits and profiling
drainage. Structural/hash proof is separate from a new blind skill trial or full
standards/security certification. The
[PR outcome](OPEN_PR_APPLICABILITY_WANTED_ROOT_2026_10_OUTCOME.md) records no
unreplayed applicable PR. Main only; no merge or release.

Next: measure bounded fingerprint stream buffer sizes on the same media profiles
with alternating samples and identical bytes/results. Preserve before/after
file evidence and private-root checks, serialized work, cancellation/drainage
and late-change/event controls. The local Node 24.18.1 read stream reports a
65,536-byte high-water mark. Fingerprinting dominates the larger local profile;
evaluate bounded buffer settings only with measured benefit and peak-memory
evidence. A high-water mark is a threshold, not a strict process-memory cap.
Do not introduce a positive hash cache or reduce publication rechecks.

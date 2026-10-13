# Track fingerprint stream outcome

October 13, 2026. Baseline main `0e3fe30`. The separate
[design](TRACK_FINGERPRINT_STREAM_DESIGN.md) and
[official research](TRACK_FINGERPRINT_STREAM_RESEARCH_2026_10.md) own alternatives
and source applicability; this document records decisions and actual evidence.

## Delivered architecture

The fingerprint policy allows only 64 KiB, 256 KiB and 1 MiB internal read-buffer
values, with **64 KiB retained as the default**. Invalid values refuse stream
admission without echoing input. The new small ESM stream service owns SHA-256,
byte observation, stream completion and actual close. Primary iterator/hash
Error/null survives secondary completion/cleanup failures; optional throwing or
rejecting byte callbacks do not replace evidence or failures.

The file-evidence service keeps private-root/canonical-path containment, symlink
refusal, regular-file and before/after size/mtime/inode checks. After-stat/root
checks run after stream close. There is no root/hash cache, whole-file memory
load, reduced publication reread, public setting/API, new worker, migration or
dependency upgrade. Explicit ownership is now a tested contract; this does not
assert that the previous async iterator leaked descriptors.

## Controlled timing and memory

`node scripts/measure-track-fingerprint-buffers.js --output <local JSON>` generates
owned two-second 44.1 kHz tonal and thirty-second 192 kHz noise FLAC using the
existing network-disabled media fixture. Six rotating-order samples per buffer/
profile run in separate Node processes; each sample performs four fresh complete
hashes of the same physical file. Child startup and explicit pre-sample GC are
outside reported hash time. Timings include memory sampling and fresh root/stat/
close work; they do not measure whole Wanted or CI performance.

The child samples process memory every five milliseconds and at the first chunk,
roughly each MiB of hashed work and completion. It records RSS, heap, external
and ArrayBuffers separately, with baseline, sampled peak and growth. ArrayBuffers
are included in external memory; do not add them. Sampling, GC, process-baseline,
OS/cache/order and controlled-signal limitations remain. Sampled peaks are not
strict maxima or process-memory guarantees.

All **36 samples** pass exact private hash/evidence and byte-count comparisons.
Tonal media is 33,958 bytes (135,832 hashed bytes per sample); noise media is
18,158,861 bytes (72,635,444 per sample). No hashes, paths, IDs, raw SQL/provider
data or child stderr enter the saved summary. The initial benchmark precedes
final source freeze; later harness cancellation/cleanup-reporting review is
validated separately and does not change the production hash algorithm.

| Profile | Buffer | Median four-hash time (ms) | Worst sampled RSS growth (MiB) | Worst sampled ArrayBuffer peak (MiB) |
| --- | --- | --- | --- | --- |
| Tonal | 64 KiB | 9.167 | 1.035 | 0.835 |
| Tonal | 256 KiB | 9.360 | 2.449 | 2.335 |
| Tonal | 1 MiB | 10.206 | 8.566 | 8.335 |
| Noise | 64 KiB | 91.925 | 31.141 | 29.463 |
| Noise | 256 KiB | 61.327 | 67.387 | 66.408 |
| Noise | 1 MiB | 53.009 | 69.527 | 69.158 |

Noise chunk/iteration observations per four-hash sample are 1,112 / 280 / 72 for
64 KiB / 256 KiB / 1 MiB; tonal observations are four for every size. Larger buffers
improve the local noise median while increasing observed process/buffer peaks.
The observations do not identify every GC/allocation cause or extrapolate to
concurrent application workers and real music libraries.

## Decision, ownership and validation

Retain 64 KiB. The larger-buffer median benefit does not justify its sampled memory
growth without a stronger allocation/ownership strategy. This keeps the existing
buffering default and adds explicit bounded policy and stream-close proof.
Larger sizes remain internal experiment options, with no public configuration.

The process adapter captures its spawned child, uses non-shell arguments/minimal
environment and bounded output/duration, observes original Error/null, attempts
owned termination and waits for actual close. Incomplete termination is reported
separately; the caller retains the owned workspace rather than deleting active
files. CLI cancellation closes new admission and drains admitted child work.
The real delivery/Wanted scenario also retains actual app completion beyond a
test-runner timeout before server disposal. No unrelated process is stopped and
no checkout/scenario/pool/teardown bound increases.

Focused proof passes 17/17: actual files for every buffer, changed-file/outside-
root/missing refusal, throwing/rejecting telemetry, held success/error/null close,
real child memory/evidence, cancellation and incomplete termination. Source review
also corrected four lint findings before the final freeze. These development
checks remain separate from the complete frozen gates recorded below.

The frozen fast gate passes **10,032 tests** (5,094 server, 4,384 client, 554
scripts), static checks and both builds in 183.840 seconds, with zero test
failures/cancellations/skips. The unchanged 107-migration schema snapshot is
current. Five skill structure validations and seven maintained/installed hashes
pass. Dependency audit reports zero vulnerabilities on Node 24.18.1/npm 12.0.2.
This is reference maintenance, not a new blind skill trial or full conformance
certification.

The affected frozen serial native gate passes **112/112 tests across eighteen
literal files**, with zero failures/cancellations/skips/todos. Node reports
363.387 seconds. It covers the new large-media delivery/Wanted case and existing
receipt diagnostics, scan catalogue/negative evidence/lifetime, receipt ledger,
delivery recovery, track catalogue/consent, publication authority, Wanted/release
reconciliation, metadata/operator worker lifetime, import apply, scoped recovery
and quality fallback. The unchanged six-case historical scaling experiment is
not repeated: targeted large-media authority proof owns this stream change.
This is the affected cohort, not the entire integration/browser suite.

Nine frozen ESM source/test/fixture files match working and staged SHA-256 values
through both final gates. Native probes identify PostgreSQL 18.3. Actual media
uses the existing `harmoniarr-quality-fallback:local` image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
ffprobe 8.0.1, owned workspaces and networking disabled.

The ignored `.tmp/fingerprint-stream-2026-10-13/` retains measurements, focused/
final logs, literal manifests and source hashes. Native proof covers actual
large private deliveries, fresh guard counts/bytes, late replacement rollback
and owner-specific idempotent reopening, plus existing event/root/lease controls.
This is scoped application evidence, not a full security or standards certification.

The [PR applicability outcome](OPEN_PR_APPLICABILITY_FINGERPRINT_STREAM_2026_10_OUTCOME.md)
records no unreplayed applicable PR. Work stays on main; no merge or release.

## Next item

Compare the current streaming allocation pattern with a bounded reusable read
buffer on an owned file handle. First prove identical evidence, actual byte work,
handle/close ownership, original Error/null, current root/file-change refusal and
peak-memory behavior; then compare rotating-order timings. Keep the current
default and publication guards until that independent evidence supports a change.
Do not infer a leak or a safe memory cap solely from this sampled experiment.

# Reusable fingerprint read outcome

October 13, 2026. Baseline main `5f00e15`. Separate
[design](TRACK_FINGERPRINT_REUSABLE_DESIGN.md) and
[official research](TRACK_FINGERPRINT_REUSABLE_RESEARCH_2026_10.md) documents own
alternatives and source applicability.

## Delivered behavior and decision

The default file-evidence composition now selects **reusable reads / 256 KiB**.
Explicit stream selection keeps its 64 KiB default; internal buffer options
remain 64 KiB, 256 KiB and 1 MiB. There is no public method/buffer setting. Small
files allocate only their captured size, and each call owns one zero-filled
buffer, one read-only handle and sequential positional reads.

Opened descriptor size/mtime/inode/device must match the captured pathname stat
before any bytes are read. Only returned bytes are hashed; short reads continue,
invalid counts or early EOF refuse, and work is bounded by captured size. After
reading, descriptor identity/metadata and regular-file state are rechecked. Handle
close is awaited; successful hashing cannot return evidence after failed close,
and original read/stat Error/null survives secondary cleanup failure.

The outer service retains current private-root/canonical-path/symlink checks and
after-close pathname/regular-file/stat comparison. A small injectable facade
preserves the existing fingerprint export and receipt DTO. Shared byte observation
keeps throwing/rejecting diagnostics outside result authority. No root/hash cache,
whole-file read, reduced publication guard, provider replay, query concurrency,
new worker, migration or dependency upgrade. These checks do not promise atomic
directory confinement against hostile external rename races.

## Controlled comparison

The existing benchmark now compares stream/reusable × three buffer sizes, with
six rotating samples per configuration on two controlled FLAC profiles: **72
samples**. Each isolated Node process performs four fresh complete hashes. Exact
private evidence and actual bytes match for every configuration. Tonal media is
33,958 bytes (135,832 hashed bytes/sample); noise media is 18,158,861 bytes
(72,635,444/sample). No hashes/paths/IDs/raw errors enter saved summaries.

Child startup and explicit pre-sample GC are outside reported time. Memory is
sampled every five milliseconds, first chunk, roughly each MiB and completion;
timing includes sampling and current root/stat/close work. RSS/heap/external/
ArrayBuffers are separate observations; ArrayBuffers overlap external. Sampled
peaks, process baseline, GC/OS/cache/order and synthetic-signal limitations remain.
This is hash-only comparison, not whole Wanted, CI or concurrent-worker scaling.

| Profile | Method / buffer | Median four-hash time (ms) | Worst sampled RSS growth (MiB) | Worst ArrayBuffer peak (MiB) |
| --- | --- | --- | --- | --- |
| Tonal | Stream / 64 KiB | 17.964 | 1.023 | 0.835 |
| Tonal | Stream / 256 KiB | 18.883 | 2.395 | 2.335 |
| Tonal | Stream / 1 MiB | 20.112 | 8.516 | 8.335 |
| Tonal | Reusable / 64 KiB | 20.341 | 0.473 | 0.339 |
| Tonal | Reusable / 256 KiB | 17.094 | 0.309 | 0.339 |
| Tonal | Reusable / 1 MiB | 16.493 | 0.488 | 0.339 |
| Noise | Stream / 64 KiB | 175.833 | 31.484 | 29.588 |
| Noise | Stream / 256 KiB | 100.454 | 66.590 | 65.408 |
| Noise | Stream / 1 MiB | 85.066 | 68.566 | 68.158 |
| Noise | Reusable / 64 KiB | 161.880 | 1.703 | 0.490 |
| Noise | Reusable / 256 KiB | 103.580 | 1.469 | 1.264 |
| Noise | Reusable / 1 MiB | 80.045 | 4.480 | 4.222 |

Choose reusable/256 KiB for the observed balance: about 41% lower large-profile
median than stream/64 KiB, with substantially lower sampled growth. Reusable/1 MiB
is faster locally but increases configured allocation and sampled peaks. Tiny-file
timing variation does not establish a portable ranking. No strict process-memory
cap, leak diagnosis, universal speedup or cross-run matched improvement is claimed.
The previous experiment's absolute timings are not combined with this run.

## Proof and validation scope

Focused review passes 26/26 cases. New controls prove reused-buffer identity and
poisoned unused tails, short reads, invalid configuration/evidence, opened identity
mismatch, early EOF/bad counts/growth/nonregular state, held close, original
Error/null through close failure, empty files and actual files for every buffer.
A real same-size/same-time replacement has a different inode and is refused
before any byte observation; its opened handle is closed. Default composition
chooses reusable/256 KiB and explicit stream retains 64 KiB.

The isolated comparison precedes the final source freeze; default selection and
timestamp/control review are separate from initial timing samples. The ignored
`.tmp/fingerprint-reusable-2026-10-13/` retains measurements, focused/final logs,
literal manifests and source hashes. Final frozen gates are recorded after
completion. Native selection retains the existing large private delivery/Wanted
case and affected current-byte/root/event/replay/lease consumers; the unchanged
historical scaling experiment is not repeated.

The frozen fast gate passes **10,041 tests** (5,103 server, 4,384 client, 554
scripts), static checks and both builds in 172.478 seconds, with zero test
failures/cancellations/skips. The unchanged 107-migration schema snapshot is
current. Five skill structure checks and seven maintained/installed hashes pass;
dependency audit reports zero vulnerabilities on Node 24.18.1/npm 12.0.2.
Reference maintenance is distinct from a new blind skill trial or full standards/
security certification.

The frozen serial native cohort completed **110/112 tests across eighteen files**
in 479.919 seconds, with two failures and no cancellation/skip. The large-media
delivery/Wanted fingerprint case and receipt/root/publication/replay controls
passed. The failures were PostgreSQL connection timeouts in the delayed-old-scan
case during migration setup, and in fallback candidate selection during the
automatic-discovery claim. Neither reached fingerprinting. These failures remain
part of the validation result; successful unrelated cases do not make this cohort
green. Later healthy probes do not establish the original timeout cause.

A separate diagnostic run selects the two complete affected files, retains the
same frozen source and resource bounds, and enables existing phase/checkout
records plus failure-only server evidence. Its result is recorded separately;
there is no retry loop, deadline/pool increase or assertion/skip change.

That separate run passes **17/17 tests across two files** in 82.120 seconds of
Node-reported test time (82.255 seconds including its runner). It reproduces
neither timeout. All ten frozen code hashes remain unchanged. Phase records and
the existing first-app-checkout observer are scoped evidence; the latter does
not observe every discovery claim or direct-fixture checkout. This passing
diagnostic subset is not a clean eighteen-file cohort or a timeout diagnosis.

The [PR outcome](OPEN_PR_APPLICABILITY_FINGERPRINT_REUSABLE_2026_10_OUTCOME.md)
records no unreplayed applicable PR. Main only; no merge or release.

## Next item

First close the native PostgreSQL diagnostic gap: capture the actual failed
connection establishment or queued checkout, correlated fixture phase and fresh
server state before cleanup. Distinguish schema preparation from discovery claims;
retain primary failure and existing resource bounds. Diagnose from reproduced
evidence rather than a later healthy server or passing isolated run.

Then measure repeated full guarded Wanted reconciliation with larger historical
receipt sets using the selected reader, retaining exact projections, query counts,
bytes, memory samples and late-change/event controls. Separate duplicate physical
observations from distinct files before considering bounded per-projection
grouping. Preserve fresh guard rechecks; timing or historical evidence alone
cannot grant a positive cache.

# Current track fingerprint stream design

October 13, 2026. Baseline main `0e3fe30`. Separate research and outcome documents
record official-source applicability, measurements, decisions and validation.

## Boundaries

Retain current private-root/canonical-file containment, symlink refusal and
before/after regular-file size/mtime/inode checks. Every call hashes current
bytes; every existing Wanted/apply/publication guard remains. No positive cache,
provider replay, query concurrency or weaker historical-receipt authority.

Extract SHA-256 stream work into a small ESM service and read-buffer policy.
Evaluate an explicit allowlist of 64 KiB, 256 KiB and 1 MiB. Reject invalid sizes
without echoing input; expose no public setting or endpoint. Initially retain
64 KiB. Adopt a different default only if identical hashes/bytes, adverse checks
and isolated-process timing/memory evidence support it.

The stream service owns returned stream completion/close, observes failure as
soon as admitted and preserves the first Error/null through cleanup. Optional
byte callbacks cannot change evidence or failures. A buffer high-water mark is
a threshold, not a strict process-memory cap; bound the configured sizes and
measure actual process memory separately.

## Measurement

Generate the existing two-second tonal and thirty-second noise FLAC profiles in
owned local media workspaces. Use isolated child Node processes per buffer and
sample, rotating order and reporting process-relative elapsed time, actual byte/
chunk counts and sampled RSS/heap/external/ArrayBuffer peaks. Keep warm/cache,
sampling/GC/process-baseline and controlled-signal limits explicit. Hash-only
measurements do not certify whole Wanted or CI speedups.

Register/drain child processes and scenario work through cancellation before
deleting files or databases. Use fixed output fields; exclude paths, hashes,
SQL, domain/provider identities and raw errors from measurement summaries.
Compare complete evidence privately in tests. Use no elapsed-time pass threshold,
deadline/pool increase or automatic performance promotion.

## Alternatives and stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Bounded larger streaming buffers | Fewer read/iteration steps on larger files | More transient buffering; workload/platform sensitivity | Measure |
| Read entire file into memory | Simple hash invocation | Memory scales with media size | Reject |
| Reuse historical or cross-guard hashes | Less I/O | Can miss current byte/root changes | Reject |
| Serialized fresh streaming plus owned close | Explicit lifecycle and stable evidence | Small completion-observation overhead | Implement |

Recommended stack: current owning guard → private-root/before-stat checks →
bounded fresh SHA-256 stream → admitted stream completion/close → after-stat/root
checks → existing receipt/publication rules. Keep modules narrow and ESM, then
freeze for appropriate fast and affected native validation. Main only; no release
or PR merge.

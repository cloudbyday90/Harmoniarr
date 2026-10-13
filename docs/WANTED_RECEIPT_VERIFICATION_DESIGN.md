# Wanted receipt verification diagnostics and measurement

October 12, 2026. Baseline main `a7c48b1`. Separate research/outcome documents
record primary-source applicability, actual measurements and validation.

## Selected boundaries

Instrument existing fresh verification; measure before changing its authority.
Wanted reads every eligible receipt on the owning transaction, resolves its
current private root and hashes actual bytes. Reconciliation repeats that read
at write/event gates. These repeated observations cannot be replaced by a
historical receipt, negative scan, filename or size/mtime cache.

Extract receipt verification into a small ESM service preserving reader results,
missing/refused/error behavior and caller-owned queryables. Add a per-reconciliation
diagnostic collector with fixed counts and phase names. Count stream chunks actually
hashed, including bytes processed before a later verification failure; never infer
read work from the receipt's declared size. Fingerprint telemetry cannot alter
its result or original failure. No observer state is shared across operations.

Set `HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS=1` for one bounded record after
success or failure. Default is off. Output contains an opaque diagnostic ID,
outcome, aggregate counts/bytes and monotonic phase durations; omit paths, hashes,
owner/candidate/request IDs, provider content, SQL and raw error details. Sink,
clock or diagnostic construction failure cannot replace a domain result/Error/null.
This output is observation, not required audit or proof of database commitment.

## Measurement and alternatives

Measure real saved two-owner scopes, actual imported tagged FLAC and unchanged
guarded Wanted reconciliation. Compare small tonal and larger generated noise
files with exact actual sizes, repeated verification counts and process/phase
durations. Use the same owning pool/scenario bounds; report cache/order/host-load
limits. Include missing/replaced bytes and rollback controls, not just timing.
There is no elapsed-time threshold assertion or automatic cache promotion.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Bounded opt-in diagnostics and actual-byte measurement | Locates cost without weakening checks; reversible | Small enabled overhead; representative workloads still required | Implement |
| Reuse hashes across write/event rechecks | Avoids repeated I/O | Can miss bytes changed at the protected boundary | Reject |
| Positive size/mtime or scan cache | Low read cost | Not byte identity or current scope authority | Defer |
| Bounded parallel or per-read grouped verification | Potential throughput improvement | Needs measured benefit, owned drainage and current-state proof | Evaluate only after measurement |

Recommended stack: existing guarded transaction → fresh receipt verification →
actual-byte counters/monotonic phases → bounded final diagnostic record → measured
optimization decision. No schema, public endpoint, new worker or rendered UI change.

## Proof and limits

Prove disabled mode avoids telemetry clocks/sinks, counts actual chunks, reports
failed/missing/refused checks accurately, clips only diagnostics, preserves original
Error/null and survives throwing/rejecting sinks. Native PostgreSQL/media proof
owns current-byte refusal, rollback, replay and observed recheck multiplicity.
Nested phase totals overlap and must not be summed as command wall time. Generated
local media is a controlled profile, not all real libraries or a CI speedup.
Freeze reviewed source for fast and affected serial validation. Main only; no release.

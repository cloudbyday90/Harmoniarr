# Wanted receipt verification outcome

October 12, 2026. Baseline main `a7c48b1`. The
[design](WANTED_RECEIPT_VERIFICATION_DESIGN.md) and
[official research](WANTED_RECEIPT_VERIFICATION_RESEARCH_2026_10.md) own the
boundaries and tradeoffs; this document records implementation and observed proof.

## Delivered behavior

Receipt verification is a small ESM service preserving current private-root,
owner, receipt and byte checks. The reader retains serial owning-client queries;
every existing write/event gate still performs a fresh projection. Optional
`HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS=1` emits one private JSON summary per
valid attempted reconciliation after success/failure. Invalid operation context
is rejected before diagnostics are constructed.

Fixed counters include projection/receipt/fingerprint work, actual hashed bytes,
missing/mismatched/refused checks and unexpected failures. Fixed phase aggregates
use process-relative timing, clip diagnostic overflow and indicate unavailable
timing. An opaque diagnostic UUID grants no domain authority. Records exclude
paths, hashes, domain identities, SQL, provider content and raw errors. Disabled
mode does not call telemetry clocks/sinks or add byte callbacks. Sink rejection,
clock failure and diagnostic construction failure preserve domain values and
original Error/null; required database events retain their existing atomicity.

## Controlled measurements

The initial native run uses real PostgreSQL, saved two-owner scopes, actual tagged
FLAC generation and the real apply worker. Both scenarios pass. The 44-case
initial focused run passes; later source review fixes indentation and adds the
exact production flag control before the final freeze. Those are not counted
as a matched performance comparison.

Each of three healthy reconciliations per profile reads the projection **seven
times**, sees fourteen eligible receipts and performs fourteen complete hashes.
No missing/mismatched/refused/unexpected failures occur in these measured healthy
calls. Exact actual file sizes and work from the final frozen cohort:

| Generated profile | Actual delivered sizes (bytes) | Bytes hashed per reconciliation | Reconciliation durations (ms) | Fingerprint totals (ms) |
| --- | --- | --- | --- | --- |
| 44.1 kHz stereo tonal FLAC, two seconds | 34,085 / 34,093 | 477,246 | 203.110 / 180.407 / 200.020 | 26.635 / 24.231 / 26.648 |
| 192 kHz stereo noise FLAC, two seconds, fixed seed | 1,218,284 / 1,218,292 | 17,056,032 | 231.104 / 235.143 / 218.288 | 45.891 / 51.151 / 48.848 |

The larger profile hashes about 35.7 times more bytes. Initial whole-reconciliation
samples were 234.661–267.189ms tonal versus 185.052–217.198ms noise; the final
samples reverse that ordering. That is evidence of warm/order/host measurement
limits, not an optimization or portable size-cost relationship. Fingerprint/root/
projection/replacement/source phases overlap and cannot be summed as wall time.
There is no disabled/enabled overhead benchmark, cold-cache control, alternating
profile order, real-library scaling or CI speedup claim. Synthetic two-second
signals are controlled media profiles, not representative musical compression.

Native adverse controls replace a file after the first projection and refuse
stale publication with rollback. A required source-event trigger failure also
rolls back Wanted/source changes while the diagnostic sink throws null. Later
valid reconciliation reopens only the affected owner once; replay stays idempotent.
Disabled diagnostics produce the same healthy domain result.

## Validation and retained scope

The frozen fast gate passes **10,016 tests** (5,078 server, 4,384 client, 554
scripts), all static checks and both builds in 141.418 seconds. It includes the
production opt-in flag control; no failures, cancellations or skips. The existing
107-migration schema snapshot remains current; no schema/migration is changed.
Five skill structure validations and seven maintained/installed SHA-256 matches
pass. `npm audit --json` reports zero vulnerabilities on Node 24.18.1/npm 12.0.2.

The affected serial native gate passes **111/111 tests across seventeen literal
files**, with zero failures, cancellations, skips or todos. Node reports
370.052 seconds. It covers the new media profiles plus scan catalogue/negative
observations/lifetime, historical receipt ledger, delivery recovery, track catalog/
consent, publication authority, Wanted/release reconciliation, metadata/operator
worker lifetime, import apply, scoped recovery and quality fallback. This is the
affected cohort, not the entire integration/browser suite. Nine frozen code files
match their working-tree and staged SHA-256 values through both final gates.

Native failure-probe evidence identifies PostgreSQL 18.3. Generated media uses
`harmoniarr-quality-fallback:local`, image ID
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
ffprobe 8.0.1. The media runner restricts work to owned fixtures with networking
disabled. Controlled expected Error/null failure records are distinct from test
failures and do not identify a historical connection-reset cause.

Source hashes in the ignored
`.tmp/wanted-receipt-verification-2026-10-12/code-freeze.json` bind the nine reviewed
ESM source/test/fixture files. Initial focused/media logs are retained separately
from final gate evidence. The native fixture uses the existing two-
client/ten-second checkout and ninety-second scenario bounds with serial files.
Owned databases/media work are drained; no unrelated services are stopped.

The maintained web-standards skill gains a performance-diagnostics route and
Node/W3C/OWASP/OTel applicability references. The scoped consumer map points to
fresh verification and diagnostic/audit separation. Structure/hash validation
is distinct from a new blind skill trial or full standards/security certification.

## Decision and next item

Keep the measured stack: guarded transaction → fresh modular receipt verifier →
fixed actual-byte counts and monotonic phase aggregates → optional private
summary. It adds bounded visibility with small enabled overhead; it preserves
current-byte security and requires no new dependency, schema or worker.

Next: profile Wanted projection database/root work at increasing receipt counts
and realistic file sizes, with alternating warm-order samples and explicit
query/phase attribution on the same owning client. Then evaluate bounded batched
lookup within each fresh projection. Retain all guard rereads and late-byte/event
rollback controls. The present two-receipt sample does not justify a positive
cache, cross-guard hash reuse or parallel-query promotion.

The [PR applicability outcome](OPEN_PR_APPLICABILITY_WANTED_VERIFICATION_2026_10_OUTCOME.md)
records an empty unreplayed applicable set. Main only; no PR merge or release.

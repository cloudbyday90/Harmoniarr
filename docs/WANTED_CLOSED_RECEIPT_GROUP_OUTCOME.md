# Closed single-binding Wanted receipt group outcome

October 13, 2026. Baseline main `e0236b9`. Separate
[design](WANTED_CLOSED_RECEIPT_GROUP_DESIGN.md) and
[official research](WANTED_CLOSED_RECEIPT_GROUP_RESEARCH_2026_10.md) own source
status, alternatives and recommendation stack.

## Delivered behavior

Modular ESM policy/service files support one exact positive binding per operator/
artist batch of 3–128 historical receipts. Captures are limited to six levels,
128 nodes/16,384 characters per row, 4,096 characters per string, 16 array slots
and 32 object keys. Dense plain JSON/data descriptors are required; sparse,
accessor-backed, cyclic, oversized and unsupported inputs retain serial behavior.
Captured receipts are immutable; each source identity and original ordering stay
in the projection. Mixed scope/path/evidence/owner or unsupported shape is not
partially grouped. Singles/pairs remain serial because two hashes save no work.

Every member resolves its current root before opening and again before closing.
Both full fingerprints must agree with expected evidence and every accepted
receipt must remain unchanged. Changed closing bytes/root/source refuse as stale;
unexpected Error/null remains exact. Opening missing/refused/nonmatching evidence
declines the group and performs ordinary fresh serial verification, preserving
individual outcomes/negative-scan semantics. Negative outcomes are never cached.

Canonical reader wiring enables this narrow default. Custom fingerprint/root
adapters remain serial unless explicitly selected for controlled comparison.
Group state is local to one call, with no cross-owner/artist/guard/invocation reuse.
Every publication recheck, source identity, maintenance/lease boundary, required
event and fingerprint handle/buffer owner remain. No migration/dependency/worker/
public setting/UI change, query parallelism, retry or resource-bound increase.

New fixed counters record grouped rows, closed groups, opening fallback and stale
group refusal separately from actual hashes/bytes and individual receipt results.
Snapshots, private roots, hashes, identities and SQL are not emitted in summaries.
Descriptor and SQL ownership do not promise an immutable host file or prevent a
write after the final observation; existing filesystem atomicity limits remain.

## Initial proof and review corrections

Focused proof passes 25/25, including exact binding/capacity capture, independent
source identities, custom compatibility, unavailable/mismatched fallback, root/
source/byte closure refusal, Error/null and held closing completion. A real
in-place write restores size/mtime while retaining inode/device; metadata markers
match but closing SHA changes, so the group refuses. No metadata cache is shipped.

An initial native case passes 1/1 in 47.122 seconds of Node test time. It compares
full private result/digest sequences on one rollback-owned connection, then proves
actual canonical committed wiring: sixteen receipts retain seven projections,
112 individual available outcomes and fourteen closed groups, using 28 hashes.
Same-marker mutation refuses before publication and a required source-event
failure rolls back Wanted/event rows.

Initial lint caught a getter-return expression in a controlled input test; it was
corrected. Review after the large comparison added a red malformed-array control:
the first policy mistakenly accepted sparse members. Dense data-descriptor array
capture now declines those inputs without evaluating getters. The pre-review
comparison's ten-file hash artifact is retained separately from final reviewed
source hashes and validation; its timings are not claimed for the final revision.

## Controlled comparison

The opt-in command now accepts `--receipt-groups`, comparing serial/reusable-256
with closed/reusable-256, two alternating pairs on each of six profiles. It
completes **24 samples** in 238.515 seconds with identical full results and private
projection digests. Every individual availability result remains; hash/byte work
changes intentionally and current-root query work increases. Synthetic history
uses two distinct private files, not larger distinct-track acquisition coverage.

| Receipts | Projection reads | Available rows | Hashes serial / closed | Queries serial / closed | Root reads serial / closed | Tonal bytes serial / closed | Noise bytes serial / closed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | 7 | 112 | 112 / 28 | 242 / 354 | 112 / 224 | 3,817,968 / 954,492 | 2,033,807,104 / 508,451,776 |
| 48 | 7 | 336 | 336 / 28 | 466 / 802 | 336 / 672 | 11,453,904 / 954,492 | 6,101,421,312 / 508,451,776 |
| 96 | 7 | 672 | 672 / 28 | 802 / 1,474 | 672 / 1,344 | 22,907,808 / 954,492 | 12,202,842,624 / 508,451,776 |

Medians and worst sampled deltas across two samples per variant; serial / closed:

| Profile / receipts | Guarded service median (ms) | Root phase median (ms) | Worst RSS growth (MiB) | Worst heap growth (MiB) |
| --- | --- | --- | --- | --- |
| Tonal / 16 | 533.830 / 564.904 | 180.145 / 334.198 | 2.914 / 6.891 | 12.968 / 12.975 |
| Tonal / 48 | 1,160.227 / 1,029.605 | 454.674 / 797.948 | 7.262 / 3.742 | 24.652 / 28.803 |
| Tonal / 96 | 2,348.321 / 1,958.410 | 999.439 / 1,674.238 | 8.566 / 4.605 | 26.161 / 29.891 |
| Noise / 16 | 2,383.429 / 960.252 | 187.033 / 290.376 | 8.520 / 6.855 | 11.791 / 20.799 |
| Noise / 48 | 6,553.023 / 1,438.064 | 551.492 / 778.694 | 8.926 / 7.500 | 12.389 / 34.519 |
| Noise / 96 | 13,483.798 / 2,546.139 | 1,152.647 / 1,742.221 | 9.816 / 15.074 | 14.956 / 48.907 |

At ninety-six noise receipts, actual hashes/bytes fall by 95.8% and the candidate
median is locally about 81.1% lower. Tonal sixteen is slower; additional root
queries and higher observed heap/RSS are real tradeoffs. Heap growth is not a leak
diagnosis or a strict memory cap. Root resolution dominates the closed large
profile, while fingerprint median falls from 12,097.702 to 571.438 ms.

Memory fields overlap; sampled peaks, explicit GC, process baseline, warm cache,
two pairs, controlled media, private digest work and sampling overhead limit
generalization. Measurement covers direct-mode guarded service work before commit,
excluding setup/BEGIN/ROLLBACK, durable commit, scheduling and HTTP. Nested phases
cannot be added as wall time; prior experiments are not matched speed baselines.
The large experiment stays outside ordinary validation.

## Validation, skills and next work

The final reviewed frozen fast gate passes **10,073 tests** (5,135 server, 4,384
client, 554 scripts), static checks and both builds in 125.966 seconds, with no
test failure/cancellation/skip. The unchanged 107-migration snapshot is current.
Ten reviewed source hashes match staged and working bytes. Five skill structure
checks and seven maintained/installed hashes pass. Dependency audit reports zero
vulnerabilities; runtime/dependencies remain unchanged. This fast timing is not
a matched whole-suite performance comparison.

The final reviewed serial native cohort passes **114/114 tests across twenty
literal files** in 406.945 seconds of Node-reported test time, with no failure,
cancellation or skip. It covers canonical closed-group publication, bounded
profiling, current-byte verification, scan/invalidation/lifetime, receipt ledger,
delivery recovery/catalog/consent, publication/reconciliation, worker lifetimes,
import apply, scoped recovery and quality fallback. Actual same-marker mutation,
late changes, owner/root refusal and required-event rollback pass. All ten final
reviewed code hashes remain unchanged through both gates. This is the affected
cohort, not exhaustive integration/browser coverage or proof that historical
intermittent PostgreSQL failures are eliminated. The large comparison is not
repeated in this gate; its pre-review timings retain their separate scope.

Ignored
`.tmp/wanted-closed-groups-2026-10-13/` retains original/corrected controls, the
comparison and its source freeze, final source hashes and literal gate manifests.
The maintained standards/scoped/testing skills receive this closed-content
contract and its distinction from metadata reuse. Structure/install checks are
separate from runtime proof or standards/security certification.

The [PR outcome](OPEN_PR_APPLICABILITY_CLOSED_GROUPS_2026_10_OUTCOME.md) records
applicability. Main only; no merge/release/deployment.

Recommended stack: bounded exact receipt capture → current roots → opening hash
→ current roots → closing hash/source comparison → individual outcomes → fresh
publication guards and required-event transaction. Adopt this narrow positive
path and retain conservative serial fallback.

Next, profile the additional root-query and heap work before designing bounded
owner/requirement root-read batching. Preserve current authorization and closing
bytes; compare exact results and prove late root/disabled-owner refusal before
any reduction. No root cache or removal of closing content checks is authorized
by the timing result alone.

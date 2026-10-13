# Closed receipt groups: official October 2026 review

Consulted October 13, 2026 through MCP search and primary-page navigation.
Separate [design](WANTED_CLOSED_RECEIPT_GROUP_DESIGN.md) and
[outcome](WANTED_CLOSED_RECEIPT_GROUP_OUTCOME.md) own implementation and proof.
Local Node remains 24.18.1; no dependency/runtime upgrade.

| Primary source / status | Applicable practice | Project decision |
| --- | --- | --- |
| [Node 24 filesystem APIs](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html), vendor runtime documentation | mtime can be updated explicitly; path checks and later operations can race; descriptor stats describe observations | Reject stat/mtime reuse. Opening and closing reads hash actual bytes and own handle close; same-marker in-place mutation must refuse before grouped positives |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Enforce current permission at the owning boundary, without trusting stale earlier grants | One exact operator/requirement/scope/path/evidence binding; independent current-root resolution for every receipt before opening and closing; keep all publication rechecks |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer documentation | Transaction statements belong to one client | Keep root queries and publication work serial on the owning queryable; SQL does not make host file contents immutable |
| [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive fields and isolate diagnostic failures | Fixed grouping/outcome/actual hash counters; no paths, source IDs, hashes, snapshots or SQL in measurement summaries |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1, 2026 Working Draft | Monotonic duration measurement differs from calendar time; precision has privacy implications | Private Node durations with explicit measurement overhead/GC/cache limits. This is application inference, not browser conformance or a final Recommendation |

The closing content check is a project design inferred from these contracts and
verified locally. Two observations do not establish a kernel-atomic snapshot or
prevent external writes after the final observation. A current descriptor, inode
or timestamp is not an immutable byte-generation contract. No HTTP/UI change or
unrelated WCAG/WHATWG/IETF certification follows.

## Recommendations and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Closed exact positive groups, 3–128 rows | Fewer duplicate full reads; preserves every receipt/source and fresh guards; closing bytes detect same-marker mutation | Additional root reads and bounded JSON capture; higher observed heap and some small-file regressions; opening negative probes add work | Adopt only for canonical supported batches with serial fallback |
| Ordinary serial verification | Existing mixed/legacy/negative behavior and independent current reads | Repeats historical positive hash work | Keep for singles/pairs, unsupported/mixed/budget cases and compatibility adapters |
| One hash plus stat/mtime cache | Less work than closed groups | Equal metadata can hide changed bytes | Reject by native counterexample |
| Cross-guard/owner/invocation reuse | Greater apparent savings | Earlier evidence can grant stale or foreign availability | Reject |
| Changed pool/parallelism/deadline | May change local timings | Breaks matched pressure/ownership and can hide failures | Reject |

Recommended stack: bounded exact source capture → per-member current roots →
opening actual hash → per-member roots → closing actual hash/source comparison →
individual availability → unchanged publication guards/required-event transaction.
Consider root-query/heap costs next; do not remove closing reads to improve timing.

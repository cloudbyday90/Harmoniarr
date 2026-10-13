# Wanted distinct binding profile: official research

Consulted 2026-10-13 through MCP search, official navigation and repository
metadata. Local Node is 24.18.1; deployed documentation versions below do not
assert that newer Node versions are installed. This is fixture measurement,
not a browser conformance or application security certification.

| Primary source / status | Applicable practice | Owner / observable proof |
| --- | --- | --- |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer documentation | All statements in a transaction use the same client | Existing borrowed-client profiler; fresh rollback per matched sample |
| [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html), official documentation | Rollback discards transactional changes | Native before/after Wanted and required-event rows; no commit-performance claim |
| [Node 24.20 performance APIs](https://nodejs.org/download/release/v24.20.0/docs/api/perf_hooks.html), stable runtime documentation | Process-relative monotonic performance timestamps | Existing guarded service timer, setup/GC excluded; independent local samples |
| [Node 24.20 process memory](https://nodejs.org/download/release/v24.20.0/docs/api/process.html), stable runtime documentation | RSS, heap, external and ArrayBuffers describe different memory; ArrayBuffers are included in external; sampling has cost | Reuse bounded sampler; separate fields, no summed memory or allocation ownership claim |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September Working Draft | Monotonic durations avoid clock-adjustment ambiguity; timing exposes privacy-sensitive information | Fixed private timing records; identify draft status rather than claim a Recommendation |
| [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Exclude sensitive data; bound and isolate diagnostics | Emit cardinalities/bytes/times only after exact-work comparison; retain original failures |

The project-specific inference is that growing actual distinct bindings must
also state how saved context and receipt history vary. A repeated-receipt
benchmark cannot establish distinct-file scaling. None of these sources grants
permission to reuse historical availability, skip current authorization, share
transaction clients across concurrent queries, or relax hash/guard evidence.

Recommendation: explicit canonical distinct-delivery measurement first; optimize
only the observed owning cost with separate correctness proof. Detailed tradeoffs
and the final stack are in the [design](WANTED_DISTINCT_BINDING_PROFILE_DESIGN.md).

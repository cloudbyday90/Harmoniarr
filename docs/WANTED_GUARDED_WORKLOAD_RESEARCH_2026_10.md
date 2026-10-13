# Guarded Wanted workload: official October 2026 review

Consulted October 13, 2026 using MCP search and official-page navigation.
Separate [design](WANTED_GUARDED_WORKLOAD_DESIGN.md) and
[outcome](WANTED_GUARDED_WORKLOAD_OUTCOME.md) own implementation and measured
results. Local Node remains 24.18.1; no runtime/dependency migration.

| Primary source / status | Applicable practice | Project decision |
| --- | --- | --- |
| [node-postgres transactions](https://node-postgres.com/features/transactions), maintainer documentation | Transaction statements belong to one client, with explicit ownership and rollback | Borrow one native connection per pair; each variant gets a separate rollback-owned transaction, with uncertain rollback causing discard |
| [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html), PostgreSQL 18 vendor documentation | Commit and rollback have different durable effects | Run actual guarded write/event paths, then roll back to an identical baseline; exclude transaction setup/rollback and never claim commit latency or durable publication from timing |
| [PostgreSQL transaction settings](https://www.postgresql.org/docs/18/runtime-config-client.html), PostgreSQL 18 vendor documentation | Isolation is an explicit transaction property | Preserve the service's READ COMMITTED and fresh guarded reads; performance work does not change isolation or authority |
| [Node process memory](https://nodejs.org/download/release/v24.20.0/docs/api/process.html), vendor runtime documentation | RSS, heap, external and ArrayBuffers describe different observations; ArrayBuffers overlap external and sampling costs work | Report baseline/peak/delta separately in the app process, with timer/byte/end sampling and explicit pre-sample GC; qualify peaks and overhead |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1, 2026 Working Draft | Monotonic durations differ from wall time and exposed precision has privacy implications | Use private Node process-relative timings; an application inference, not browser conformance or a final W3C Recommendation |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude sensitive identities/connection data and preserve behavior through logging failures | Fixed profile/count/timing/memory fields; compare complete DTOs/digests privately, omit paths/IDs/hashes/SQL/messages from saved measurements |

## Recommendations and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Opt-in matched guarded benchmark | Measures repeated real guards, exact work and app-process memory; normal validation stays bounded | Synthetic duplicate receipts, warm cache, two pairs and measurement overhead limit generalization; excludes commit | Implement and run |
| Current reusable reader / 256 KiB | Existing byte/identity/cleanup proof with low isolated allocation | Still repeats full reads for duplicate historical bindings | Keep |
| Per-projection grouping | Potential reduction in repeated identical bindings | Needs independent current-root/path/evidence and late-change proof; grouping is not automatic availability authority | Design next if measured work supports it |
| Positive cross-guard/owner/run cache | Less repeated I/O | Stale evidence can grant incorrect availability or consent | Reject |
| Larger global pools/concurrency or relaxed deadlines | May improve a local timing sample | Changes test pressure, hides failures and does not preserve matched authority evidence | Reject |

Recommended stack: existing guarded service → same-client rollback measurement →
fresh private root/byte evidence → fixed query/phase/path-work/memory observations
→ matched private result comparison → evidence-backed bounded follow-up design.
Retain current publication checks and conservative refusals. WCAG/WHATWG/IETF
UI/HTTP practices remain relevant when those flows change; this server measurement
does not establish their conformance or call for unrelated interface changes.

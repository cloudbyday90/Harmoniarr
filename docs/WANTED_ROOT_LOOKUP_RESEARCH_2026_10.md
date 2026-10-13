# Wanted root lookup: October 2026 official practice review

Consulted October 2026 through MCP search, primary-page navigation and GitHub
repository metadata. Scope is transaction-owned root reads and performance
measurement. The separate [design](WANTED_ROOT_LOOKUP_DESIGN.md) and
[outcome](WANTED_ROOT_LOOKUP_OUTCOME.md) distinguish decisions from actual proof.

## Practices applied

| Primary source / status | Applicable guidance | Project decision and proof |
| --- | --- | --- |
| [node-postgres transactions](https://node-postgres.com/features/transactions), driver documentation | Transaction statements use one physical client | All default stores receive the owning queryable; the fixture adapter forwards with the real receiver and rejects overlapping queries. No extra checkout or pool patch |
| [node-postgres queries](https://node-postgres.com/features/queries), driver documentation | Bind data separately from SQL; prepared statements are not an automatic performance improvement | Exact owner uses a UUID parameter; fixed setting keys remain literal SQL. Compare round-trip reduction before adding prepared plans or parallelism |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html), vendor SQL documentation | A left join retains an unmatched left row with null right values | The existing unique settings key supports a zero/one-row join. An explicit presence flag distinguishes absent setting/default from stored JSON null/refusal |
| [PostgreSQL 18 Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html), vendor performance guidance | Instrumentation adds overhead; server plan timing omits network delivery and small-table observations do not generalize | Report same-client application/query/phase samples with alternating order and actual media work. No forced planner/index or portable elapsed-time threshold |
| [Node 24.21 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html), runtime documentation | Process-relative high-resolution duration measurement | Fixed reader phases and fixture query timings use `performance.now()`; nested phases overlap and are not added as wall time |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic duration measurement differs from user-visible wall time; precision has privacy implications | Keep timings in optional private summaries. Node provides the runtime contract; this application inference does not establish browser conformance or a final W3C Recommendation |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive fields and preserve application operation through logging failures | Fixed dimensions and counts only; exclude paths, hashes, SQL, owner/provider identities and raw errors. Existing throwing/rejecting sink and original Error/null controls remain |
| [Node 24.20 filesystem](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html) and [streams](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html), runtime documentation | Read-stream buffering is configurable; a high-water mark is a threshold rather than a strict memory limit | Follow-up should measure bounded buffer settings and peak memory while retaining fresh file/root evidence. The local Node 24.18.1 read stream reports 65,536 bytes; no buffer setting changes in this commit |

The documented Node minor is newer than the local 24.18.1 runtime; the used APIs
predate that version and this work performs no runtime upgrade. SQL/driver
guidance does not grant current owner consent: the existing service, private-root,
file, lease/maintenance and write/event rechecks still own those decisions.
WCAG/WHATWG/IETF interaction rules remain relevant when UI or HTTP flows change;
they do not add evidence to this server-only lookup experiment.

## Recommendations, costs and stack

| Recommendation | Benefit | Cost / limit |
| --- | --- | --- |
| Consolidate the current owner/root setting into one bounded statement if proof passes | Removes a round trip per root check and unrelated settings rows; same-statement context | Explicit missing/null mapping and default/custom-loader compatibility need tests |
| Keep per-receipt root and hash checks | Retains changed-root/account/file refusal at every existing guard | Repeated I/O remains deliberate until a different authority contract is proved |
| Attribute fixed reader phases and actual query/byte work | Identifies the next bottleneck without raw SQL logging | Enabled timing overhead and synthetic warm-cache/scaling limits |
| Defer multi-owner batching, caches and pipelining | Avoids unsupported capture-order/drain/authorization changes | Leaves additional optimization opportunities for measured follow-up |

Final recommended stack: same-client guarded transaction → parameterized fresh
root-context store → existing defaults and private-root policy → current bytes →
fixed private metrics → measured next decision. This recommendation is a project
inference from the cited contracts and must be adopted only with actual result,
resource and rollback evidence.

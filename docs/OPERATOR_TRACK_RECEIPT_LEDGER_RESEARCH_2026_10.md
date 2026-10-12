# Receipt ledger official research

Consulted October 12, 2026 through connected MCP search and official navigation.
Source status/version is distinct from consultation date. The separate
[design](OPERATOR_TRACK_RECEIPT_LEDGER_DESIGN.md) owns project decisions and
[outcome](OPERATOR_TRACK_RECEIPT_LEDGER_OUTCOME.md) owns actual measurements.

| Official source | Status and applicable boundary | Project decision |
| --- | --- | --- |
| [PostgreSQL 18 multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html) | Server reference; leading equality columns narrow B-tree lookup. | Index owner, release and candidate; measure actual planner selection. |
| [PostgreSQL 18 Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) | Server reference; analyze executes work and instrumentation/statistics affect observations. | Compare identical selected results and actual plans/buffers without forced index flags or time thresholds. |
| [PostgreSQL 18 trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html) and [PL/pgSQL trigger functions](https://www.postgresql.org/docs/18/plpgsql-trigger.html) | Server reference; trigger writes participate in the source transaction. | Maintain only the derived historical projection; required-event failure rolls it back with source publication. No elevated function privileges. |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative security guidance; current object/relationship decisions and default denial. | Indexing historical evidence grants no current consent, private-root access or file availability. Preserve every owner and independent current verification. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Working Draft September 1, 2026; monotonic measurement guidance. | Label SQL-only timings, warm/cache/order limits and instrumentation scope; timing cannot authorize lease ownership or prove UI accessibility. |
| [Node 24 performance measurement](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html) | Official v24.21.0 reference; installed v24.18.1 supports the long-established `performance.now()` API. | Measure process-side lookup duration separately from PostgreSQL EXPLAIN execution time. |

Native validation uses PostgreSQL 18.3 and Node 24.18.1; the current documentation
may describe later minor releases. This implementation uses ordinary triggers,
JSONB extraction and B-tree indexes available on the project's supported runtime.
The ledger, conservative envelope extraction and synchronous backfill are project
inferences, not W3C/OWASP mandates. A synthetic local SQL improvement is not a
whole-application or CI speedup. Current scans' size/mtime observations cannot
establish cryptographic equality with a stored delivery receipt.

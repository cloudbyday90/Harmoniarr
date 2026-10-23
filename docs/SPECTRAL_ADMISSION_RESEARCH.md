# Spectral admission: official practice review

Consulted October 23, 2026 through GitHub and web-search MCP tools. Search results
identified these URLs; the actual official pages were opened. This is a scoped
backend concurrency review, not certification of the entire application.

## Applicable practices

- PostgreSQL 18 implementation documentation: READ COMMITTED obtains a new
  snapshot for each command. A lock and admission read combined in one statement
  can still use a pre-wait snapshot. Our inference is to acquire admission first,
  then run the guarded INSERT separately, explicitly at READ COMMITTED.
  [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html).
- PostgreSQL advisory locks are application-defined; transaction locks release
  on transaction completion. Our inference is one shared, fixed queue key across
  both producers, held through row commit, with worker/native work outside it.
  [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).
- PostgreSQL's lock timeout applies to individual acquisition attempts, not
  elapsed transaction time. The local five-second value is a project policy;
  it is not a PostgreSQL recommendation or whole-request deadline.
  [Client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html).
- OWASP API Security Top 10 2023 is security guidance. Resource limits include
  execution time, memory, processes and batch work. A durable queue cap is one
  layer alongside existing command/memory admission; it is not an RSS bound or
  complete DoS defense. Bound lock waits and preserve refusal semantics.
  [API4 resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).
- W3C Privacy Principles is a W3C Statement, not a SQL or WCAG conformance
  specification. Minimize retained diagnostics: report counts and fixed outcomes,
  keeping real usernames, paths, connection details and credentials out of
  committed evidence. No UI changed, so no new accessibility claim follows.
  [Privacy Principles](https://www.w3.org/TR/privacy-principles/).

## Recommendation stack

1. Existing PostgreSQL queue and transaction runner; ESM admission store with
   explicit isolation, bounded lock wait and both producer paths participating.
2. Keep existing claim generations, atomic cache/job publication, shared native
   command limits and memory controls as distinct defenses.
3. Gate correctness with deterministic real database contenders and cheap focused
   unit tests. Use one stable fast gate and affected packaged checks; retain
   failed evidence and actual cleanup separately from successful outcomes.
4. Extend the repository standards skill with a focused admission workflow,
   source discovery and stale-snapshot counterexamples. Reuse it for later queue
   work rather than creating an overlapping general standards skill.

The [design alternatives](SPECTRAL_ADMISSION_DESIGN.md) record pros and cons.
Recommend the shared lock now; a future unique index would add duplicate defense
for nonparticipating writers but cannot replace capacity admission. No open PRs
were returned by GitHub MCP at selection, so random PR implementation was
inapplicable. Recheck before publication and record the result in the outcome.

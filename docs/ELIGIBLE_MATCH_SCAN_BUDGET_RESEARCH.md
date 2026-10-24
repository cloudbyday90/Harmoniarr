# Detail scan budget: official research and recommendation

Sources discovered/opened through Search MCP on October 24, 2026.

[OWASP API4 resource-consumption guidance](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
identifies per-request operation and returned-record limits alongside memory,
timeouts and rate limiting. Our inference: a twelve-choice response cap does not
limit eligibility work. Add a separate server-owned 200-fact/four-query budget to
detail reads; retain existing request authorization and rate limits.

[PostgreSQL 18 LIMIT/OFFSET guidance](https://www.postgresql.org/docs/18/queries-limit.html)
requires unique ordering for predictable limited results and notes the cost of
skipped OFFSET rows. Retain UUID keysets. A returned-row limit is not a physical
query-work or execution-time guarantee; qualify the access plan separately before
making latency or database resource claims.

[PostgreSQL 18 EXPLAIN guidance](https://www.postgresql.org/docs/18/using-explain.html)
distinguishes rows emitted from rows scanned and describes filter rejection and
actual execution evidence. Next, qualify the candidate query on large mixed search
histories and evaluate a search/status/UUID access path from those observations;
an index change needs measured plan evidence rather than a returned-row count.

[W3C's status-message search example](https://www.w3.org/WAI/WCAG22/working-examples/aria-role-status-searchresults/)
demonstrates programmatic result feedback. Keep a persistent polite status region,
native focusable controls and explicit continuation. Empty partial results must
explain that checking remains incomplete; screen-reader/device acceptance remains
a separate manual check.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Fixed read budget with explicit continuation | Bounded candidate materialization/evaluation; no background churn | Short/empty windows; more deliberate navigation | Adopt |
| Silent cutoff treated as empty | Small patch | False exhaustion and unsafe restart inference | Reject |
| Automatically chase every continuation | Convenient | Restores unbounded aggregate work and status churn | Reject |
| Timeout alone | Limits some elapsed work | No truthful progress/EOF contract; statement scope differs from request scope | Supplemental future qualification |
| Persist indexed candidate revisions and exhaustion certificates | Could support bounded command-side qualification | Migration, every-writer coordination, retention and contention costs | Separate architectural follow-up |

## Recommended stack

Existing Vue disclosure and detail request gate; small ESM scanner/page factories;
existing signed context-bound cursor policy; narrow parameterized PostgreSQL
keyset store; independent fresh transactional restart/selection guards.

The 200-fact default is a conservative application policy, not a standards-mandated
number or a measured latency optimum. Test structural query/fact bounds rather
than claiming whole-platform speedup. Preserve the complete command guard while
evaluating indexed access and revision-backed command qualification separately.

# Candidate keyset access-path qualification

Use for quality-review candidate SQL/index changes. Read the active repository's
docs/CANDIDATE_QUERY_PLANS_DESIGN.md, research and outcome.

1. Measure the actual store projection on deterministic mixed history before
   changing SQL. Include dense/sparse sources, first/range/inclusive/EOF boundaries,
   both directions and the command's FOR UPDATE form. Compare exact ordered IDs.
2. Separate value-specific custom plans from forced-generic stress profiles.
   Use transaction-local cache settings and EXPLAIN ANALYZE EXECUTE; GENERIC_PLAN
   cannot be combined with ANALYZE. Do not change production cache mode or force
   scan types to obtain a desired result.
3. For a scoped B-tree, use the search equality followed by the UUID range. Keep
   the partial status predicate literal and separate first-page/range SQL shapes.
   Bind values; never interpolate actor/provider/cursor data into production SQL.
4. Count emitted/rejected heap/scan rows without duplicating bitmap index tuples.
   Use root buffer totals, not sums of overlapping parent and child counters.
   Cache deterministic expected IDs rather than rebuilding the corpus per profile.
5. Keep current authorization, quality policy, read budget and complete command
   guard independent of plan evidence. An index does not certify exhaustion or
   impose a wall-time/RSS/physical-row limit. Preserve W3C focus/status contracts.
6. Scaffold an additive migration, regenerate the snapshot through the maintained
   command and add an index anchor. Prove populated upgrade, fresh definition,
   status/delete maintenance, rollback and missing-anchor detection. Record normal
   index-build startup/write-lock costs; concurrent DDL needs separate ownership.
7. Run the shared matrix on host PostgreSQL and the packaged runtime. Native tests
   must pass the existing explicit disposable-profile guard before acquiring a pool
   or dropping an index. Keep row locks/cache controls scoped; retire statements,
   transactions, pools and containers, preserving first Error/null failures.

Use official MCP-discovered PostgreSQL sources. Retain custom dense/small-range
planner freedom and distinguish measured corpus improvements from universal plans
or whole-platform speedups. No production EXPLAIN ANALYZE mutation is authorized
by a read-only plan review.

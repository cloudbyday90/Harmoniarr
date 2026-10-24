# Quality-review candidate access paths

Designed October 24, 2026 after measuring the existing query on an owned disposable
PostgreSQL 18.3 database. See the [official research and tradeoffs](CANDIDATE_QUERY_PLANS_RESEARCH.md).

## Evidence and selected change

The baseline uses a nullable anchor OR and indexes ordered for other consumers.
A 100,000-row mixed history with dense and sparse current searches reproduces
custom-plan filtering and generic-plan late-anchor scans. The candidate partial
index alone still leaves the generic anchor as a residual filter. Select both:

- Add a transactional partial B-tree on `(source_search_id, id)` for the literal
  `status IN ('pending','held')` predicate. Keep existing indexes for their owners.
- Render separate parameterized first-page and anchored SQL shapes. Anchored
  queries use a direct UUID inequality; first pages omit the anchor parameter.
- Reuse the production query builder for measurement, including inclusive EOF,
  reverse traversal and the transaction-owned `FOR UPDATE` form.

No planner hints, global settings, named production statements, covering JSON
payload index or eligibility duplication are introduced. The planner may retain
a cheaper primary-key or bitmap path for custom dense/small ranges. The index
makes the scoped ordered range available; it is not a universal plan guarantee.

## Migration and authority

Use the repository migration scaffold and snapshot workflow. Add an index schema
anchor and qualify both fresh snapshot creation and upgrading the previous schema.
A normal transactional index build fits current startup migration ownership. It
can delay startup and block concurrent writers while building; no concurrent DDL
is added to the transaction runner. Existing candidate insert/status/delete paths
maintain the partial index automatically.

Current session/recipient/policy validation, signed cursor, 200-fact/four-query
read budget, complete fresh restart check, selection locks and audit remain intact.
Only the store's access path changes. Choice fields and HTTP/UI contracts do not.

## Qualification

Use deterministic generated history, explicit ANALYZE, custom and forced-generic
prepared plans, read and locking modes, first/exclusive/inclusive/EOF boundaries.
Capture rows emitted/rejected at scan nodes and root buffer totals without summing
parent/child counters. Verify exact ordered IDs independently of plan shape and
across legacy/index-only/index-plus-query variants. Generic profiles are stress
coverage; current unnamed application queries normally use value-specific plans.

Keep planning controls transaction-local in disposable fixtures. Do not disable
scan types or assert wall-clock speedups under shared host load. Add a reusable
plan-evidence helper/corpus and a real migration/index-membership regression.
Run focused checks before the stable fast gate and affected SQL/browser lanes,
then rebuild the preserved walkthrough without cache and qualify the packaged
PostgreSQL/runtime. Retain unrelated native memory evidence only after exact
source/runtime comparison.

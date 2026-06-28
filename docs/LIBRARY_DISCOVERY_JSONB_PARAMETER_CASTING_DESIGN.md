# Library Discovery JSONB Parameter Casting Design

Status: Implemented
Date: 2026-06-27

## Purpose

The Background Jobs screenshot showed repeated Library discovery failures with:

```text
could not determine data type of parameter $1
```

The failures occurred quickly during discovery dispatch, before normal provider
search or import-review evidence could complete. The root cause was PostgreSQL
type inference for parameterized placeholders inside `jsonb_build_object` calls
in the Library discovery request store.

## Research Summary

- PostgreSQL prepared statements infer parameter types from SQL context, but
  parameters can remain unresolved when used in polymorphic functions without a
  concrete type.
- PostgreSQL JSON construction functions such as `jsonb_build_object` accept
  polymorphic values, so placeholders inside those functions should be cast
  explicitly when the surrounding SQL does not otherwise constrain the type.
- node-postgres recommends parameterized queries for safe value binding. This
  fix keeps parameterization and adds explicit database-side casts rather than
  interpolating strings.
- OWASP SQL injection guidance recommends prepared statements and typed binding
  instead of dynamic SQL string construction.

Sources:

- PostgreSQL `PREPARE`: https://www.postgresql.org/docs/current/sql-prepare.html
- PostgreSQL JSON functions: https://www.postgresql.org/docs/current/functions-json.html
- node-postgres parameterized queries: https://node-postgres.com/features/queries
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html

## Options Considered

### Option A: Ignore the failed operation and rely on retry

Pros:

- No code change.
- Existing operation history already exposes retry.

Cons:

- Every retry can hit the same PostgreSQL type inference error.
- Operators see noisy failed Library discovery runs without useful remediation.
- Discovery evidence is never persisted, so downstream Import Review and
  Downloader handoffs cannot progress.

### Option B: Convert JSON evidence to JavaScript strings before binding

Pros:

- Could avoid some ambiguous `jsonb_build_object` placeholders.

Cons:

- Pushes JSON shaping out of SQL inconsistently.
- Still needs casts when optional values are bound elsewhere in polymorphic SQL.
- Increases risk of inconsistent evidence shape across success, failure, and
  exhaustion paths.

### Option C: Keep parameterized SQL and cast placeholders at JSON boundaries

Pros:

- Preserves safe parameterized queries.
- Keeps evidence updates in the existing store boundary.
- Fixes success, failure, and exhaustion evidence writes consistently.
- Matches PostgreSQL's explicit typing model for polymorphic functions.

Cons:

- Requires SQL contract tests to prevent future untyped evidence placeholders.
- Does not address unrelated PostgreSQL inference risks outside this store.

## Final Recommendation

Use Option C.

Library discovery request evidence writes should cast placeholders passed into
`jsonb_build_object` when those placeholders are not otherwise constrained by a
typed column, comparison, or explicit SQL cast.

The implemented casts cover:

- `recordDiscoverySearchFailure`
- `recordDiscoverySearchSuccess`
- `markDiscoveryRequestExhausted`

## Security Notes

- No dynamic SQL string interpolation was added.
- All values remain bound as PostgreSQL parameters.
- The patch does not expose provider credentials, raw slskd payloads, hidden
  filesystem paths, or Import Review planning snapshots.
- The change is scoped to evidence persistence in the existing Library discovery
  request store.

## Implementation Outcome

- `library-discovery-request-store.js` now casts JSON evidence placeholders as
  `text` or `integer` before passing them into `jsonb_build_object`.
- Store tests now assert the casts for failure, success, and exhaustion paths.
- A disposable Docker PostgreSQL proof executed the casted JSON expressions with
  nullable values to verify the database accepts the corrected statements.

## Validation

Focused validation:

- `node --test test/server/library-discovery-request-store.test.js test/server/library-discovery-dispatch-service.test.js test/server/library-discovery-dispatch-settings.test.js`
- `npm run lint:server`
- `npm run lint:test`
- Disposable Docker PostgreSQL JSON parameter-cast proof using
  `withDockerizedPostgresDatabase`

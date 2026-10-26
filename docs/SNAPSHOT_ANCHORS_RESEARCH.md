# Snapshot anchor research — October 26, 2026

## Official evidence and applicability

URLs were discovered through the connected search MCP service, opened, and where
needed followed to the PostgreSQL 18 version. These are current implementation
recommendations, not a claim that a schema fingerprint authenticates its image.

- PostgreSQL exposes constraint definitions, validation and enforcement separately
  in [pg_constraint](https://www.postgresql.org/docs/18/catalog-pg-constraint.html).
  Inference: checking a constraint name/type alone cannot establish its predicate
  or that PostgreSQL enforces it.
- [pg_index](https://www.postgresql.org/docs/18/catalog-pg-index.html) distinguishes
  valid, ready and live indexes. Inference: a same-name index definition also
  needs these state checks before bootstrap publication.
- PostgreSQL's [object reconstruction functions](https://www.postgresql.org/docs/18/functions-info.html)
  expose constraint, index, trigger and function definitions. Its non-pretty
  format is preferable for reproducible output. Preserve literal whitespace;
  broad whitespace normalization can hide a changed function message or literal.
- [Schema search paths](https://www.postgresql.org/docs/18/ddl-schemas.html)
  affect object resolution and unqualified creation. Inference: canonicalize the
  metadata-reading context after DDL, restore it locally, and qualify catalog
  reads explicitly; changing the path before historical CREATE is inappropriate.
- [Identifier limits](https://www.postgresql.org/docs/18/sql-syntax-lexical.html)
  explain the two historical 64-byte reconciliation index names stored at 63
  bytes. Correct anchor identities; retain historical migration bytes/checksums.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  require one client throughout a transaction. Anchor inspection belongs between
  ledger verification and COMMIT on the existing preparation owner's client.
- [OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
  recommends least privilege. This change adds parameterized catalog reads and
  no new grants, exposed endpoint or service. The existing trusted SQL and
  deployment permissions remain separate security boundaries.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  concern programmatic announcement of markup status changes. This backend change
  adds no markup or notification UI. Future operator-facing anchor diagnostics
  should retain accessible status/focus behavior; no new AT acceptance is claimed.

## Options and recommendation stack

| Option | Advantages | Costs / limitations | Decision |
| --- | --- | --- | --- |
| Names and ledger only | Small, portable | Same-name weakened objects can pass | Insufficient |
| Build another reference database during startup | Fresh independent comparison | More startup infrastructure, privileges and work | Development validation only |
| Reviewed contract generated from fresh migrations, checked in the owned transaction | Independent expected facts; rollback before publication; no extra runtime service | Regenerate when lineage/specifications change; PostgreSQL deparser compatibility must be qualified | Adopt |
| Compare every catalog property | Broad coverage | OID/owner/environment noise; large maintenance surface; still not semantic equivalence | Defer |

Final stack: existing preparation owner → fresh-schema guard → immutable SQL and
contract provenance → compiled snapshot → one transaction → complete ledger →
164 critical anchor facts → acknowledged COMMIT. Keep native interruption and
unknown-COMMIT recovery checks. Fail closed on stale contracts or unsupported
PostgreSQL major versions rather than regenerating expected facts at startup.

The contract covers selected structural facts, not all DDL, object privileges,
function dependencies, arbitrary external SQL effects or hostile packaged code.
Minor-version deparser changes may require reviewed regeneration and qualification.

# Atomic snapshot bootstrap research

Researched October 26, 2026 using connected search MCP discovery and official
sources for PostgreSQL 18 and node-postgres 8.23.1. See separate
[design](ATOMIC_SNAPSHOT_DESIGN.md) and [outcome](ATOMIC_SNAPSHOT_OUTCOME.md).

PostgreSQL BEGIN does not nest an existing transaction. Our inference is that
wrapping the old snapshot, which contains 42 transaction pairs, cannot establish
one owner without handling those embedded controls. Source:
[BEGIN](https://www.postgresql.org/docs/18/sql-begin.html).

PostgreSQL's restore utility offers a single transaction so commands succeed
together or leave no changes, while warning about lock-table space for large
transactions. We apply that principle to application SQL bootstrap; we are not
introducing pg_restore. Source:
[pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

Use one checked-out client through body, verification and COMMIT. The application
discards an uncertain connection and requires independent inspection after a lost
acknowledgement; no reply does not establish rollback. Sources:
[transactions](https://node-postgres.com/features/transactions),
[client API](https://node-postgres.com/apis/client) and
[pool disposal](https://node-postgres.com/apis/pool).

The existing lexical policy respects strings, identifiers, comments and procedural
dollar bodies. Compile recognized framing per migration, then validate the
combined body; do not replace transaction words across arbitrary SQL. Source:
[lexical structure](https://www.postgresql.org/docs/18/sql-syntax-lexical.html).
Local synchronous_commit=on does not override disabled fsync or faulty storage.
Source: [WAL settings](https://www.postgresql.org/docs/18/runtime-config-wal.html).

The snapshot is trusted application code. Exact renderer equality rejects a
stale/tampered artifact relative to its packaged manifest; it is not an external
signature or SQL sandbox, nor protection against alteration of the entire image.
Preserve least privilege and maintenance boundaries. Sources: pg_restore's
trusted-source warning above and
[OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html).
No web markup changes are needed; existing focus/error/status expectations and
deferred manual speech/device acceptance remain separate. Source:
[W3C WCAG 2.2](https://www.w3.org/TR/wcag/).

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Wrap raw snapshot | Small change | Embedded commits still split it | Reject |
| Rewrite historical SQL | Simpler generated body | Breaks installed lineage/checksums | Reject |
| Regenerate an unframed artifact | Direct executable artifact | Changes established snapshot bytes/contract | Unnecessary now |
| Verify raw provenance and compile recognized frames in memory | Preserves artifacts; atomic DDL/receipts; shared renderer | Extra compilation and larger transaction | Implement |
| Automatically delete partial schema | Apparent convenient recovery | Destructive; cannot establish intent | Reject |

Recommended stack: preparation owner → fresh guard/captured manifest → exact
provenance → in-memory compilation → one transaction → full receipt identity
verification → acknowledged COMMIT. Discard and inspect on uncertainty; no
automatic replay or outside failed receipt. Next add pre-commit schema-anchor
checks to complement receipt identity, with native rollback proof.

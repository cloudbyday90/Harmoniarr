# Spectral reputation: official practice review

Consulted October 23, 2026 through GitHub and search MCP tools. Search identified
the URLs; the official pages were opened. These sources guide a scoped backend
change and do not certify the entire platform.

- AWS Prescriptive Guidance describes outboxes for database/event dual writes
  and requires duplicate-safe consumers. Project inference: because our durable
  destinations share one database, use one transaction first; retain an outbox
  as an option for a future required external destination.
  [Transactional outbox pattern](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
- PostgreSQL 18 documents INSERT, unique conflict behavior and RETURNING.
  Project inference: use the existing event primary key for the job's stable
  identity, fail on conflicting replay, and commit ledger plus snapshot with the
  claimed job. A unique event by itself does not make a separately updated
  counter atomic.
  [INSERT](https://www.postgresql.org/docs/18/sql-insert.html).
- PostgreSQL 18 transaction and lock documentation supports fresh READ COMMITTED
  statements after transaction-scoped admission. Project inference: every
  read/modify/replace snapshot writer must participate before reading; a lock
  acquired only at replacement time cannot repair a previously stale payload.
  [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html),
  [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).
- W3C Privacy Principles is a W3C Statement, not a SQL conformance requirement.
  Keep only the necessary stable job/event identity in durable evidence; avoid
  a second payload queue and avoid recording real peers, paths or credentials
  in committed diagnostics. No UI change implies no new WCAG acceptance claim.
  [Privacy Principles](https://www.w3.org/TR/privacy-principles/).

The [design](SPECTRAL_REPUTATION_DESIGN.md) compares costs and alternatives. Final
recommendation: atomic same-database publication with shared snapshot ownership,
and advisory effects after commit. Avoid a second app or service. Keep existing
bounded queue/native/memory controls and qualify process exit separately from
returned callback completion. GitHub MCP returned no open PRs at selection;
publication recheck belongs in the outcome.

# Backup I/O drainage research

Official sources discovered/retrieved through MCP on October 25, 2026. The project
baseline remains Node 24.22.1 and PostgreSQL 18.6.

- [Node.js 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  documents filesystem concurrency hazards and best-effort `writeFile` cancellation:
  aborting its buffering does not cancel individual OS requests. `link`/`unlink`
  are promise-returning pathname operations, without an AbortSignal cancellation
  contract. Project inference: loss of database authority must not be treated as
  proof that previously admitted file work has retired; await returned work.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  specifies cooperative advisory locks and release of session locks at session
  end. The database cannot own unrelated filesystem callback settlement. Retain
  the pinned client and balanced unlock/eviction protocol; supplement it with
  local lifetime coordination for the current process.
- [Node.js 24 ESM documentation](https://r2.nodejs.org/docs/latest-v24.x/api/esm.html)
  describes URL-based module loading and distinct instances for differing query
  strings/fragments. Default facades import one canonical relative module URL.
  This is process-local coordination, not shared state for arbitrary module
  instances, worker isolates or multiple application processes.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains programmatically available status feedback without changing focus.
  Preserve truthful busy versus completed outcomes. The backend busy response
  must not invent recovered/deferred counts. No new UI or manual assistive-device
  conformance claim is made; this informative guidance does not mandate a mutex.

Vendor API contracts support the lifetime limits above. The local gate, refusal
policy and supported-topology decision are project choices, supported by the
controlled reproduction and native qualification described in the
[design](BACKUP_IO_DRAIN_DESIGN.md) and outcome. No general security audit or
distributed-lock correctness claim is implied.

# Backup process-crash qualification research

Primary sources discovered/retrieved through MCP on October 26, 2026.

- [Node.js 24 child-process documentation](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
  separates signal requests, process exit and close after stdio retirement.
  Observe the actual child's close and signal outcome; a true kill return is
  insufficient. Use direct spawn without a shell, bounded IPC/output and deliberate
  inherited environment. The fixture supplies no unrelated Node options or
  provider credentials. Runtime qualification uses Node 24.22.1.
- The maintained [Linux signal manual](https://www.man7.org/linux/man-pages/man7/signal.7.html)
  documents SIGKILL as uncatchable/unblockable. It exercises abrupt process loss
  instead of allowing cooperative JavaScript cleanup. It does not remove storage
  caches or establish behavior during arbitrary in-flight I/O.
- [PostgreSQL 18 advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html)
  document session-lock release at session end, including ungraceful disconnect.
  Observe the original backend and its locks after process close before replacement
  recovery; a successful new connection cannot prove original-session retirement.
- [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
  explains implicit statement transactions. Pause after returned store calls and
  inspect committed rows through an independent connection. These selected
  acknowledged boundaries do not qualify a lost SQL response, server crash or
  cross-resource SQL/filesystem atomicity.
- W3C's informative [WCAG 2.2 Understanding index](https://www.w3.org/WAI/WCAG22/Understanding/)
  includes status-message guidance. By project inference, report completed,
  deferred, abandoned and confirmation states from observed recovery rather than
  treating termination requests as outcomes. No UI or manual AT proof changes.

The finite matrix, IPC validation, private profile, checkpoint interception and
fresh default recovery composition are project decisions. The partial-write case
deliberately writes a prefix before the real kill. Selected post-call boundaries,
process loss and namespace/catalog recovery remain distinct from power-loss
durability. See [design/tradeoffs](BACKUP_PROCESS_CRASH_DESIGN.md).

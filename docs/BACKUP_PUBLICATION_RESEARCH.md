# Backup publication research

Official sources discovered/retrieved through MCP on October 25, 2026. Runtime
baseline: Node 24.22.1, PostgreSQL 18.6; packaged checks verify actual versions.

- [Node.js 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  documents hard links and `lstat`, replacement by rename, and the absence of a
  copy atomicity guarantee. Choose complete-file exclusive publication, verify
  final bytes and check inode identity before temporary-name cleanup. Unsupported
  links must not trigger a destructive fallback.
- The Node API links to the maintained [Linux `link(2)` manual](https://man7.org/linux/man-pages/man2/link.2.html).
  It specifies preservation of an existing destination, shared inode/permissions,
  and failures for unsupported or cross-mount links. This is the Linux publication
  boundary qualified here; it does not make later cleanup and SQL atomic. The
  Open Group search result was available, but direct retrieval returned HTTP 403;
  no unverified newer POSIX function URL is assumed.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  documents cooperative session/transaction advisory locks, session lifetime and
  balanced unlock requirements. Pin one client, keep phase writes autocommit,
  release explicitly and evict clients whose lock/connection state is uncertain.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
  discusses overwrite risks and protected storage. Backups are not uploads, but
  preserving existing content and refusing ambiguous mutation are applicable
  design inferences. This is not a general upload-hardening or security audit.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains truthful status delivery without changing focus. Keep busy, held,
  deferred and completed states distinct; an exclusive link is not proof that
  metadata publication or recovery finished. No new UI or device acceptance claim.

Vendor APIs are implementation contracts; OWASP/WCAG Understanding pages provide
guidance. The coarse-lock choice and protocol are project decisions. See the
design document for pros/cons, limits and the final recommendation stack.

# Backup directory synchronization research

Primary sources discovered/retrieved through MCP on October 26, 2026.

- The maintained [Linux fsync manual](https://www.man7.org/linux/man-pages/man2/fsync.2.html)
  distinguishes file data/metadata flush from containing-directory entry persistence.
  The workflow therefore requests directory sync after link and unlink, before
  reporting completion. Its unsupported/error paths must remain failures. This
  operating-system contract does not prove hardware or virtual-storage behavior.
- [Node.js 24.22.1 filesystem documentation](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  supplies FileHandle stat/sync/close and read-only/directory/no-follow flags.
  Await the open handle's sync and cleanup explicitly; flags and support vary by
  platform. Qualify packaged Linux and the actual bind instead of inferring
  support from Windows unit fixtures or successful ordinary file writes.
- The maintained [Linux close manual](https://man7.org/linux/man-pages/man2/close.2.html)
  explains late close errors and descriptor reuse when retrying. Keep one awaited
  close and preserve an earlier Error/null failure through the existing utility.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  informs bounded operational diagnostics and exclusion of secrets/raw internals.
  Reuse the current error-only journal projection rather than logging filesystem
  objects, paths, content or raw secondary errors.
- W3C's informative [WCAG 2.2 Understanding index](https://www.w3.org/WAI/WCAG22/Understanding/)
  includes status-message guidance. Completion must follow the owned result;
  a failed checkpoint stays failed/deferred. This is a project inference for the
  existing caller contract, not a W3C filesystem rule or new UI/AT acceptance.

The actual backup bind accepted directory open/sync/close in a private disposable
probe before implementation. The ordered final-name → temporary-name checkpoints,
identity checks and fail-closed compatibility policy are project decisions. They
do not establish ancestor-directory creation persistence, cross-resource atomicity,
distributed fencing or power-loss safety. See [design/tradeoffs](BACKUP_DIRECTORY_SYNC_DESIGN.md).

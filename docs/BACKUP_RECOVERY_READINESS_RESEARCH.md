# Backup recovery file readiness research

Primary sources discovered/retrieved through MCP on October 26, 2026.

- [Node.js 24.22.1 filesystem documentation](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  documents FileHandle stat/read/sync/close and platform-specific filesystem flags.
  Sync requests flushing the open descriptor to storage; guarantees depend on the
  OS/device. Use an existing non-truncating handle, explicit awaits and no-follow
  protection where available. These are runtime API contracts, not crash tests.
- The maintained [Linux fsync manual](https://man7.org/linux/man-pages/man2/fsync.2.html)
  distinguishes flushing file data/metadata from the containing directory entry.
  A fresh successful file sync improves this recovery boundary but cannot establish
  durable link/unlink publication. The [close manual](https://man7.org/linux/man-pages/man2/close.2.html)
  explains late errors and descriptor-reuse risks from retrying close. Await one
  close and preserve the original failure through cleanup.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends operational failure logging with deliberate data exclusion. Keep the
  existing finite journal projection; do not serialize raw errors, paths, file
  contents or handles into diagnostics.
- W3C's informative [WCAG 2.2 Status Messages guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  informs truthful completion/deferred/confirmation
  outcomes remain relevant to callers; no new UI or assistive-technology acceptance
  is claimed. W3C guidance does not define filesystem durability.

The same-handle verification, identity comparisons and recovery-only placement
are project decisions inferred from these contracts and current code. Before/after
file facts detect ordinary replacement/mutation during an attempt; they do not
provide an atomic namespace lock against an adversarial local writer. Preserve
trusted private directories and existing single-process ownership assumptions.
See [design/tradeoffs](BACKUP_RECOVERY_READINESS_DESIGN.md).

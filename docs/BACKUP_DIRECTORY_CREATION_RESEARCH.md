# Backup directory creation research

Primary sources discovered/retrieved through MCP on October 26, 2026.

- [Node.js 24.22.1 filesystem documentation](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  says recursive mkdir returns the first created directory, or undefined when
  none was created. That return value cannot describe uncertain creation from an
  earlier attempt/restart. Use bounded explicit mkdir and repeat all accepted
  directory checkpoints instead of treating EEXIST as durable readiness. Node's
  lstat inspects the link itself; reject symlink components and use the existing
  explicit handle sync/close service.
- The maintained [Linux mkdir manual](https://www.man7.org/linux/man-pages/man2/mkdir.2.html)
  documents parent requirements, creation mode subject to umask and EEXIST. Create
  new private directories with 0700, retain existing permissions and inspect the
  existing object rather than accepting EEXIST as proof of directory identity.
- The maintained [Linux fsync manual](https://www.man7.org/linux/man-pages/man2/fsync.2.html)
  distinguishes file data/metadata from containing-directory entry persistence.
  The project therefore checkpoints each accepted directory and its parent chain
  through a provisioned anchor. Successful API calls are not power-loss tests or
  atomic PostgreSQL/filesystem commit.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports failure diagnostics with deliberate data exclusion. Keep finite
  error-only journal projection and original failure identity; do not serialize
  directory paths, file contents or raw secondary errors.
- W3C's informative [WCAG 2.2 Understanding index](https://www.w3.org/WAI/WCAG22/Understanding/)
  includes status-message guidance. By project inference, existing callers must
  keep incomplete directory preparation separate from completed publication.
  No markup or manual assistive-technology acceptance changes are claimed.

The trusted parent anchor, two-path/32-level bounds, full-chain retry policy and
recovery-without-mkdir are project decisions. They bound authority and I/O; they
do not provide hostile-namespace atomicity. The deployment provisions the anchor
and its durability. Historical publication paths outside the configured root stay
deferred for inspection, rather than authorizing traversal of another tree. See
[design/tradeoffs](BACKUP_DIRECTORY_CREATION_DESIGN.md).

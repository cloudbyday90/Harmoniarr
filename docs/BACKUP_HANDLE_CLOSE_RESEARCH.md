# Backup file-handle cleanup research

Official sources discovered/retrieved through MCP on October 26, 2026.

- [Node.js 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html)
  documents awaited FileHandle operations and close, which waits for pending handle
  operations. Keep explicit ownership and close after returned write/sync work;
  garbage collection is not the cleanup protocol.
- [ECMAScript 2026 statement evaluation](https://tc39.es/ecma262/2026/multipage/ecmascript-language-statements-and-declarations.html)
  defines abrupt completion from a finally block taking precedence over an earlier
  completion. The source's unconditional finally-close therefore explains the
  observed masking. Preserve an explicit original-failure flag, including null,
  through the existing shared cleanup utility.
- The maintained [Linux close manual](https://man7.org/linux/man-pages/man2/close.2.html)
  explains late close errors and descriptor-reuse risks from retrying. This supports
  a conservative one-close policy; it does not establish identical behavior on
  every platform or prove a failed Node close retired its descriptor.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports keeping operational failures bounded and avoiding disclosure. Keep the
  existing journal/error projection; do not attach raw secondary close errors to
  the returned Error or dump handle/path details.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  informs truthful asynchronous outcomes. A rejected writer is not normal backup
  publication, and a later verified recovery is a separate result. No markup or
  manual assistive-device acceptance is changed or claimed.
- [music-metadata releases](https://github.com/Borewit/music-metadata/releases) and
  [PR #55](https://github.com/cloudbyday90/Harmoniarr/pull/55) identify 12.2.2/12.2.3
  tokenizer bounded-view, allocation and container/tag boundary changes, including
  WAV/ASF/MP4/ID3 handling. The exact PR patch also selects strtok3 10.6.2. Apply
  and test those versions rather than inferring compatibility from a patch label.

The shared cleanup choice and qualification stack are project decisions. The
media probe confirms tag projection for supported fixtures, not general malformed
media rejection. A header-only FLAC yields empty extracted metadata; unsupported
bytes exercise the adapter's failed result. Audio playability belongs to separate
inspection. See the [design](BACKUP_HANDLE_CLOSE_DESIGN.md) for pros/cons and limits.

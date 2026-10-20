# Native file-transfer qualification

Use `validate:native-slskd-files` for actual binary completion and published-file
evidence. Read docs/NATIVE_FILE_TRANSFER_DESIGN.md and its outcome. Keep normal
queue admission and the long timeout lane separate from this explicit mode.

- Resolve the provider's linked library release before implementing transport.
  PeerInit is framed; the transfer token and offset are raw. Test every split,
  coalescing, bad identity/token/offset, suffix and incomplete EOF. A generic
  message decoder cannot continue across this protocol transition.
- Bind each transfer capability to one declared file; reject unknown/replayed
  tokens. Stream bounded chunks with backpressure. Close socket admission and
  await both native sockets and admitted sends before fixture completion.
- Require actual direct/lost-response receipts through the current client and
  service, exact bytes and no second POST. Completed-response loss is a controlled
  client-side failure after the native body, not simulated packet loss.
- The released provider saves terminal state before moving the file. Observe
  publication separately through an inspected read-only mount of the same
  bounded project-owned tmpfs volume. Verify driver/options/access and actual
  absence after down before removing owned files.
- Hash only declared paths using bounded reads, descriptor/path identity checks
  and awaited close. Compare all expected files and refuse extra entries. Never
  infer inode stability or file publication from receipt status alone.
- Synthetic .bin payloads prove transport, size/hash and filesystem identity.
  They do not prove music decoding, active-transfer cancellation, resume, library
  import or general path mapping. Select extra native modes only when their
  owners changed; do not automatically repeat the three-minute guard or unrelated
  PostgreSQL inventory for fixture-only byte work.
- Attribute immutable source, images and failed/intermediate/final runs. W3C
  provenance guidance informs this evidence design; Node/Docker/OWASP and IETF
  guidance own distinct implementation boundaries, not blanket certification.

# Native EOF and reset qualification

Use `validate:native-slskd-partial` with the reviewed provider image. Read
docs/NATIVE_PARTIAL_TRANSFER_DESIGN.md and its outcome. Keep full completion,
queue admission and the long enqueue-timeout lane separate.

- Inspect the released retry loop before choosing the fault profile. The current
  lane uses one total attempt to isolate EOF/RST; it does not qualify product
  default retry or nonzero-offset resume.
- Use an actual successful control, a one-byte-short EOF and an explicit reset.
  Require a real incomplete-file checkpoint before RST. Local write callbacks
  cannot prove remote file receipt; buffered data can be discarded by reset.
- Cancel checkpoint admission and drain already-admitted reads before returning.
  Preserve original Error/null, then await sends and actual socket close. Invalid
  fixture plans must refuse before filesystem or network work.
- Assert exact native receipt identity and actual application failure
  classification. Confirmed admission is not successful completion. Failed
  terminal evidence must not grant progressed-success GET recovery or a second
  POST after controlled completed-response loss.
- Observe the native client's empty download list, acknowledge provider stop,
  then inspect final completed/incomplete trees through independent read-only
  mounts. Terminal status alone does not prove retirement or prevent late writes.
- Check both volume identities/access/limits and actual tmpfs capacity. Hash
  bounded actual prefixes with descriptor/path rechecks; never accept a partial
  prefix through the full-file adapter. Keep the failed files solely under the
  incomplete root and verify no extra entries after producer retirement.
- Native evidence does not establish music decoding, library publication or
  default retry/resume. Select affected native modes and one frozen fast gate;
  do not automatically repeat unrelated database or three-minute workloads.

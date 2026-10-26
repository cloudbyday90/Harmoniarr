# Backup recovery file readiness design

October 26, 2026. Follows [handle cleanup](BACKUP_HANDLE_CLOSE_OUTCOME.md).

Recovery can currently adopt complete prepared bytes after a writer failed,
without a fresh file sync. Content verification establishes identity, not a
successful storage flush. Require a new readiness attempt for every recovered
publish operation, whether the verified file is temporary or already final.
Normal publication retains its existing write/sync/close sequence.

Use a small ESM readiness service, composed with current ownership in the existing
production facade. It opens an existing regular file read/write without creation
or truncation, verifies raw checksum/size and semantic manifest through that same
handle, awaits sync and one close, and compares file identity and change facts
before/after the attempt. Reject non-regular paths; use no-follow/nonblocking open
flags where available and compare path/handle identity. Parent directories remain
trusted private storage, not an adversarial cross-process namespace.

The workflow retains final verification after linking, exclusive publication and
same-inode temporary cleanup. Readiness failures cannot advance phase or inventory.
The existing recorder writes bounded error-only diagnostics and recovery defers;
a content/identity mismatch follows existing confirmation handling. Ownership is
checked before open/sync and before accepting readiness. Cleanup always drains,
even after ownership loss, through the existing original-failure cleanup utility.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Read/checksum only | No extra flush | Can adopt after failed writer with no successful fresh sync | Replace for recovery |
| Repeat full writer | Familiar flow | Risks truncation/collision and changes saved intent | Reject |
| Open, verify, sync, close, compare | Fresh successful file readiness; same-handle bytes; existing ownership | Extra recovery I/O; requires writable file; no directory durability guarantee | Adopt |
| Retry uncertain close | Appears to recover | Descriptor state/reuse can be unsafe | Reject |
| New journal checkpoint/schema | Can record more history | More states, migration and crash windows; a saved flag cannot replace current verification | Defer |

Recommended stack: owned recovery → regular existing file → same-handle raw and
semantic verification → awaited file sync → one awaited close → current path
identity check → existing exclusive link/reverification/catalog protocol.

Focused checks cover order, primary Error/null precedence, open/sync/close failure,
delayed close, changed paths/files, non-regular inputs, ownership loss and missing
or mismatched bytes. A guarded native entry uses actual handles/files/PostgreSQL
and the production facade, with explicitly controlled callback failures and held
cleanup. Run affected backup regressions, one frozen bounded fast gate and the
no-cache walkthrough rebuild. Retain unrelated exact-runtime evidence explicitly.

File sync does not make directory updates or SQL/filesystem changes atomic. No
power-loss, distributed fencing or hostile-directory guarantee follows. No new
application process, schema, application version, branch or release is needed.

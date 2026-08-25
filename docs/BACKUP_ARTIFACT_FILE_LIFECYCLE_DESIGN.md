# Backup Artifact File Lifecycle Design

## Decision

Harmoniarr publishes logical backup artifacts through a durable local lifecycle:

1. record the intended publication or deletion in PostgreSQL;
2. write a private, same-directory temporary file for a publication;
3. flush and verify the exact bytes, decoded payload, and manifest;
4. promote the verified temporary file with a same-filesystem rename;
5. verify the final path before creating or removing inventory metadata; and
6. reconcile incomplete intents from evidence on the next backup mutation.

The lifecycle applies to both export publication and the existing operator-initiated
backup deletion. It does not introduce automatic retention deletion: an explicit,
reviewable retention policy must exist before Harmoniarr prunes viable backups.

## Evidence

- Node's current filesystem documentation describes `fs/promises` as asynchronous,
  cautions that concurrent file modifications are not synchronized, and notes that
  `rename` overwrites an existing destination. Harmoniarr therefore serializes each
  operation through a durable intent, uses a random final filename, keeps the
  temporary file in the destination directory, and verifies both pre- and
  post-promotion content.
- PostgreSQL provides transactional durability only for its own records. It cannot
  make a local filesystem write part of the same transaction, so the operation
  record is written before the filesystem call and recovery derives its action from
  observed paths rather than replaying blindly.
- CISA recommends encrypted backups, integrity/restore testing, and protection
  from unauthorized deletion. The implementation verifies every artifact before
  publishing or retrying deletion, creates files with owner-only permissions, and
  leaves ambiguous filesystem state untouched for an operator.

Sources consulted 2026-08-25:

- <https://nodejs.org/api/fs.html>
- <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- <https://www.cisa.gov/stopransomware/ransomware-guide>

## Lifecycle States

`backup_artifact_file_operations` is a narrow recovery ledger, not backup
inventory. Each row contains an immutable artifact snapshot, its expected file
size and SHA-256, and the managed final and temporary paths.

| State | Meaning | Recovery action |
| --- | --- | --- |
| `prepared` | Intent is durable; no verified temporary file has been recorded. | Inspect final and temporary paths. |
| `temporary_ready` | Temporary file was written and verified. | Verify and promote it only when the final path is absent. |
| `finalized` | Final file was verified; inventory update may be incomplete. | Idempotently create or remove inventory metadata. |
| `awaiting_confirmation` | Paths or content do not prove a safe next step. | Do not change files; preserve evidence for operator inspection. |
| `completed` | File and inventory postconditions were reached. | No action. |
| `abandoned` | Neither expected path exists after an interrupted publication. | Preserve the record; a new export creates a new artifact. |

## Options Considered

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Write directly to final path, then insert metadata | Small implementation | Partial files, orphaned files, and retry ambiguity | Reject |
| Blindly retry any interrupted file action | Minimal database state | Can overwrite, delete changed data, or create duplicate inventory | Reject |
| Temporary file + rename only | Prevents readers seeing partial writes | Cannot reconcile a crash between rename and metadata update | Reject alone |
| Durable intent + temporary file + verified rename | Clear recovery evidence; minimal local operational cost; works without cloud services | Adds a small ledger and recovery code | Adopt |
| Remote/object-store coordinator or distributed transaction | Can coordinate external storage | Credentials, network availability, operator burden, and a much wider attack surface for a local app | Reject |
| Automatic backup-retention pruning now | Reclaims disk automatically | No operator-approved retention policy or safety floor exists; risks deleting the only recovery copy | Defer |

## Security Properties

- The operation record is written before a filesystem mutation.
- Temporary files are created exclusively with owner-only permissions and stay in
  the final directory so promotion does not cross filesystems.
- The verifier checks raw file size and SHA-256, decrypts when applicable, checks
  the plaintext checksum, and compares the manifest's immutable identity fields.
- An encrypted artifact cannot be automatically published or deleted after a
  restart without its configured encryption key.
- Path containment remains enforced for all reads, publication paths, and delete
  paths; no recovery record can authorize paths outside the configured backup
  directory.
- Recovery never removes an unverified temporary file and never deletes a backup
  whose current contents differ from its durable snapshot.

## Recommendation Stack

1. Adopt the durable local publication/deletion ledger and verified, same-directory
   promotion in this change.
2. Keep backup retention operator-driven until Settings exposes a reviewed policy
   with a minimum viable-backup floor and clear deletion preview.
3. Keep a separate offline or immutable host-level copy; Harmoniarr's logical
   backup directory is not a substitute for host disaster recovery.
4. Add an explicit retention-policy workflow next, including preview, minimum
   survivor verification, audit evidence, and a dedicated confirmation action.

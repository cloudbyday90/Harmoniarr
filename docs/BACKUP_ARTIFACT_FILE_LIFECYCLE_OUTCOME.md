# Backup Artifact File Lifecycle Outcome

## Delivered

Harmoniarr now makes logical backup export publication and operator-initiated
backup deletion recoverable across a process interruption.

- New exports create a durable `backup_artifact_file_operations` record before
  writing any artifact data.
- A publisher writes a `0600`, exclusively-created temporary file in the final
  backup directory, flushes it, verifies its raw checksum, plaintext checksum,
  and manifest, then renames it to the unique final filename.
- The inventory row is created only after the final file is verified. A restart
  can finish the inventory write without creating a duplicate artifact.
- Delete records intent before removing a file. Recovery deletes metadata only
  after the file is known absent, or removes the file only after it still matches
  the durable artifact snapshot.
- Mismatched content, an unavailable encryption key, or conflicting inventory
  metadata moves the operation to `awaiting_confirmation`; Harmoniarr makes no
  automatic filesystem change.
- Encrypted envelopes are now identified before decryption. A missing key can no
  longer cause an encrypted backup to be treated as plaintext.

## Deliberately Deferred

Automatic backup retention is not implemented. There is no approved operator
policy, retention window, minimum surviving-backup floor, or deletion preview.
Adding automatic deletion before those controls would make the only recovery copy
less safe. The existing explicit delete control is protected by fresh admin
session, CSRF, idempotency, and now durable filesystem verification.

## Validation

Focused server coverage verifies:

- intent persistence precedes file writing;
- verified temporary publication and post-restart recovery;
- no final file appears when artifact content differs from its durable record;
- interrupted deletion converges only from verified or absent state;
- raw file, plaintext payload, manifest, and encryption-key checks; and
- repository/store persistence contracts and existing export, preview, restore,
  and system composition contracts.

Schema validation regenerated `src/server/schema-snapshot.sql` from 92 migrations
and passed the migration, schema, ESM, server-lint, test-lint, and copyright
checks. `npm run validate` also passed, including the real-database recovery
export, preview, and restore integration path.

## Next Recommended Item

Design an explicit backup-retention policy before adding automation. It should
preview candidates, require at least one recently verified viable artifact to
survive, prefer oldest-first deletion, preserve operation/audit evidence, and
require a distinct operator confirmation for any retention run.

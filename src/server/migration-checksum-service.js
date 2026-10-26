/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { readMigrationFile } from './migration-manifest.js';
import { getAppliedMigrationChecksums } from './schema-migration-store.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Verify prepared ledger rows without creating or replacing database objects. */
export async function verifyAppliedMigrationChecksums({ getPoolFn = getPool } = {}) {
  const client = await getPoolFn().connect();
  return withWorkerTaskCleanup(async () => {
    const applied = await getAppliedMigrationChecksums(client);
    const violations = [];
    for (const { filename, storedChecksum } of applied) {
      let currentChecksum;
      try {
        currentChecksum = (await readMigrationFile(filename)).checksum;
      } catch {
        violations.push({ currentChecksum: null, filename, status: 'file_missing', storedChecksum });
        continue;
      }
      if (currentChecksum !== storedChecksum) violations.push({ currentChecksum, filename, status: 'checksum_mismatch', storedChecksum });
    }
    return { checkedCount: applied.length, clean: violations.length === 0, violations };
  }, () => client.release());
}

export async function assertNoMigrationChecksumDrift({ getPoolFn = getPool } = {}) {
  const result = await verifyAppliedMigrationChecksums({ getPoolFn });
  if (!result.clean) {
    const descriptions = result.violations.map(({ filename, status }) => `${filename} (${status})`).join(', ');
    throw new Error(`Migration checksum drift detected: ${descriptions}`);
  }
  return result;
}

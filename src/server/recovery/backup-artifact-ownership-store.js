/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';
import { createApiError } from '../api-error.js';
import { createBackupArtifactBusyError } from './backup-artifact-drain-gate.js';

const lockKey = 'harmoniarr.backup-artifact-filesystem';
const ownerLost = () => createApiError(503, 'backup_artifact_owner_lost', 'Backup operation ownership was lost. Inspect the journal before trying again.');

export function createBackupArtifactOwnershipStore({ getPoolFn = getPool } = {}) {
  async function withOwnership(work, { onBusy } = {}) {
    const client = await getPoolFn().connect();
    let acquired = false;
    let lost = false;
    let failed = false;
    let failure;
    let result;
    let releaseError;
    const markLost = () => {
      lost = true;
      releaseError ??= ownerLost();
    };
    client.on('error', markLost);
    client.on('end', markLost);
    async function assertOwnership() {
      if (lost) throw ownerLost();
      try {
        await client.query('SELECT 1 AS backup_owner_alive');
      } catch {
        markLost();
      }
      if (lost) throw ownerLost();
    }
    try {
      try {
        acquired = (await client.query(
          'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired', [lockKey],
        )).rows[0]?.acquired === true;
      } catch (error) {
        // An interrupted response cannot establish whether PostgreSQL acquired
        // the session lock. Never return that uncertain session to the pool.
        markLost();
        throw error;
      }
      if (!acquired) {
        if (!onBusy) throw createBackupArtifactBusyError();
        result = await onBusy();
      } else {
        await assertOwnership();
        result = await work({ queryable: client, assertOwnership });
        await assertOwnership();
      }
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      if (acquired && !lost) {
        try {
          const unlocked = await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked', [lockKey]);
          if (unlocked.rows[0]?.unlocked !== true) releaseError = ownerLost();
        } catch (error) {
          releaseError = error;
        }
        if (releaseError && !failed) {
          failed = true;
          failure = releaseError;
        }
      }
      client.off('error', markLost);
      client.off('end', markLost);
      try {
        client.release(releaseError);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    if (failed) throw failure;
    return result;
  }
  return { withOwnership };
}

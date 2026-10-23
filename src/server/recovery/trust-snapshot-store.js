/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { assertDatabasePublicationScope } from '../database-publication-scope.js';
import { throwIfMediaCancelled } from '../media/media-cancellation.js';

const normalizeRows = rows => Array.isArray(rows)
  ? rows.filter(row => row && typeof row === 'object').map(row => ({ ...row })) : [];

export function createTrustSnapshotStore({ getPoolFn = getPool } = {}) {
  const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
  async function read(queryable) {
    const result = await queryable.query('SELECT payload FROM recovery_trust_snapshots ORDER BY snapshot_order ASC');
    return normalizeRows(result.rows.map(row => row.payload));
  }
  async function write(queryable, rows) {
    await queryable.query('DELETE FROM recovery_trust_snapshots');
    for (const [index, payload] of normalizeRows(rows).entries()) {
      await queryable.query(`INSERT INTO recovery_trust_snapshots (snapshot_order, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())`, [index, JSON.stringify(payload)]);
    }
  }
  async function admit(queryable) {
    await queryable.query("SET LOCAL lock_timeout = '5s'");
    await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.trust-snapshot-mutation', 0))");
  }
  async function own(work) {
    return withTransaction(async queryable => {
      await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await admit(queryable);
      return work(queryable);
    });
  }
  async function mutateTrustSnapshot(update, { queryable = null, signal, publicationKind = 'spectral_job' } = {}) {
    throwIfMediaCancelled(signal);
    const run = async client => {
      throwIfMediaCancelled(signal);
      const rows = await read(client);
      const result = await update(rows, client);
      throwIfMediaCancelled(signal);
      await write(client, rows);
      throwIfMediaCancelled(signal);
      return result;
    };
    if (queryable) {
      if (!['spectral_job', 'import_candidate_event'].includes(publicationKind)) throw new TypeError('Unknown trust publication kind');
      assertDatabasePublicationScope(queryable, { kind: publicationKind });
      await admit(queryable);
      return run(queryable);
    }
    return own(run);
  }
  return {
    listTrustSnapshot: () => read(getPoolFn()),
    replaceTrustSnapshot: ({ sourceUsers = [] } = {}) => own(client => write(client, sourceUsers)),
    mutateTrustSnapshot,
  };
}

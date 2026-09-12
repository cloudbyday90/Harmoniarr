/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0. See LICENSE for details.
 */

import { getPool } from '../database.js';
import { recordAuditEvent } from '../audit.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { createOperatorArtistSaveStateStore } from './operator-artist-save-state-store.js';
import { createOperatorArtistReconciliationRunStore } from './operator-artist-reconciliation-run-store.js';

const operationType = operationRunRegistry.operatorArtistReconciliation.operationType;
const candidateSql = `
  SELECT failed.id, users.id AS app_user_id, artist.id AS metadata_artist_id, artist.name AS artist_name
  FROM operation_runs failed
  JOIN app_users users ON users.id = CASE
    WHEN pg_input_is_valid(failed.summary->>'appUserId', 'uuid')
      THEN (failed.summary->>'appUserId')::uuid END
  JOIN metadata_artists artist ON artist.id = CASE
    WHEN pg_input_is_valid(failed.summary->>'metadataArtistId', 'uuid')
      THEN (failed.summary->>'metadataArtistId')::uuid END
  WHERE failed.operation_type = $1 AND failed.status = 'failed'
    AND users.is_disabled = FALSE
    AND failed.cancel_requested_at IS NULL AND failed.cancelled_at IS NULL
    AND COALESCE(failed.summary->>'triggerSource', '') <> 'failure_recovery'
    AND failed.finished_at <= NOW() - INTERVAL '60 seconds'
    AND EXISTS (SELECT 1 FROM operator_artist_reconciliation_snapshot snapshot
      WHERE snapshot.app_user_id = users.id AND snapshot.metadata_artist_id = artist.id)
    AND NOT EXISTS (SELECT 1 FROM operation_runs other
      WHERE other.operation_type = failed.operation_type
        AND users.id = CASE
          WHEN pg_input_is_valid(other.summary->>'appUserId', 'uuid')
            THEN (other.summary->>'appUserId')::uuid END
        AND artist.id = CASE
          WHEN pg_input_is_valid(other.summary->>'metadataArtistId', 'uuid')
            THEN (other.summary->>'metadataArtistId')::uuid END
        AND (other.status IN ('pending', 'running')
          OR (other.created_at, other.id) > (failed.created_at, failed.id)))
`;

export function createOperatorArtistReconciliationRecoveryStore({
  getPoolFn = getPool,
  saveStateStore = createOperatorArtistSaveStateStore(),
  runStore = createOperatorArtistReconciliationRunStore({ getPoolFn }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function listCandidates({ limit = 10 } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) throw new Error('Recovery batch limit must be between 1 and 25');
    const { rows } = await getPoolFn().query(`${candidateSql}
      ORDER BY failed.finished_at ASC, failed.id ASC LIMIT $2`, [operationType, limit]);
    return rows.map((row) => ({ runId: row.id, appUserId: row.app_user_id, metadataArtistId: row.metadata_artist_id }));
  }

  async function recoverCandidate({ runId, appUserId, metadataArtistId }) {
    const client = await getPoolFn().connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '250ms'");
      await saveStateStore.lockOperatorArtistSave({ appUserId, metadataArtistId, client });
      const { rows } = await client.query(`${candidateSql}
        AND failed.id = $2 AND users.id = $3 AND artist.id = $4
        FOR UPDATE OF failed`, [operationType, runId, appUserId, metadataArtistId]);
      if (!rows.length) {
        await client.query('COMMIT');
        return { recovered: false };
      }
      const snapshotResult = await client.query(`
        SELECT id, snapshot_revision FROM operator_artist_reconciliation_snapshot
        WHERE app_user_id = $1 AND metadata_artist_id = $2 ORDER BY snapshot_revision DESC LIMIT 1
      `, [appUserId, metadataArtistId]);
      const snapshot = snapshotResult.rows[0];
      const snapshotRevision = Number(snapshot?.snapshot_revision);
      if (!snapshot?.id || !Number.isSafeInteger(snapshotRevision) || snapshotRevision < 1) {
        throw new Error('Recovery requires a valid persisted snapshot revision');
      }
      const run = await runStore.insertRecoverySnapshotRun({
        appUserId, metadataArtistId, artistName: rows[0].artist_name, client,
        snapshotId: snapshot.id, snapshotRevision,
      });
      await recordAuditEventFn({
        actorType: 'system', actorUserId: null,
        eventType: operationRunRegistry.operatorArtistReconciliation.startedEventType,
        entityId: run.id, entityType: 'operation_run',
        summary: 'Artist reconciliation recovery queued',
        details: { appUserId, metadataArtistId, artistName: rows[0].artist_name,
          runId: run.id, recoveredFromRunId: runId, snapshotId: snapshot.id,
          snapshotRevision, triggerSource: 'failure_recovery' },
      }, client);
      await client.query('COMMIT');
      return { recovered: true, run };
    } catch (error) {
      await client.query('ROLLBACK');
      // A competing generic operation control can still win the pending-run
      // constraint. Never replace its request or retry that conflict in a loop.
      if (error?.code === '23505') return { recovered: false };
      if (error?.code === '55P03') return { recovered: false, reason: 'lock_busy' };
      throw error;
    } finally {
      client.release();
    }
  }
  return { listCandidates, recoverCandidate };
}

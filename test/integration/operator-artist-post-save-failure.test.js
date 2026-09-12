/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationSnapshotStore } from '../../src/server/metadata/operator-artist-reconciliation-snapshot-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('committed artist save and Activity stay durable and singular when external follow-ups and projection fail', { timeout: 120_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const users = (await pool.query(`INSERT INTO app_users (username, password_hash, role, must_change_password)
      VALUES ('save-beneficiary', 'test-only-hash', 'operator', FALSE), ('save-actor', 'test-only-hash', 'admin', FALSE) RETURNING id`)).rows;
    const [appUserId, triggeredByUserId] = users.map(({ id }) => id);
    const transactionCommands = [];
    let releases = 0;
    const transactionPool = () => ({ connect: async () => {
      const client = await pool.connect();
      return { query: async (sql, values) => {
        const result = await client.query(sql, values);
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) transactionCommands.push(sql);
        return result;
      }, release: () => { releases += 1; client.release(); } };
    } });
    const observed = [];
    const warnings = [];
    const observe = (phase, payload) => observed.push({ phase, payload, committed: transactionCommands.includes('COMMIT') });
    const uniqueFailure = () => Object.assign(new Error('private sql token=secret'), { code: '23505' });
    const service = createOperatorArtistSaveService({
      getPoolFn: transactionPool,
      operatorArtistMonitoringStore: createOperatorArtistMonitoringStore({ getPoolFn }),
      operatorArtistReconciliationRunStore: createOperatorArtistReconciliationRunStore({ getPoolFn }),
      operatorArtistReconciliationSnapshotStore: createOperatorArtistReconciliationSnapshotStore({ getPoolFn }),
      operatorReleaseGroupSelectionStore: createOperatorReleaseGroupSelectionStore({ getPoolFn }),
      operatorTrackOverrideStore: createOperatorTrackOverrideStore({ getPoolFn }),
      getOperatorArtistProjection: async (payload) => { observe('projection', payload); throw uniqueFailure(); },
      startMetadataArtistRefresh: async (payload) => { observe('refresh', payload); throw uniqueFailure(); },
      onArtistMonitoredFn: async (payload) => { observe('notification', payload); return { failed: 1, sent: 0 }; },
      postSaveReporter: { writeWarning: (line) => { warnings.push(JSON.parse(line)); throw uniqueFailure(); } },
    });
    const draft = { monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true,
      selectionSourceMode: 'policy_plus_overrides', acquisitionProfileKey: 'storage_saver' },
    releaseGroupSelections: [{ metadataReleaseGroupId: metadata.metadataReleaseGroupId,
      resolvedMetadataReleaseId: metadata.metadataReleaseId, selectionSource: 'manual', selectionState: 'partial' }], trackOverrides: [] };
    const result = await service.saveOperatorArtist({ appUserId, triggeredByUserId, metadataArtistId: metadata.metadataArtistId,
      expectedSnapshotRevision: 0, draft });
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.deepEqual(transactionCommands, ['BEGIN', 'COMMIT'], 'Post-commit unique errors must never trigger rollback or save retry');
    assert.equal(releases, 1);
    assert.equal(result.projection, null);
    assert.equal(result.operator, null);
    assert.equal(result.snapshot.snapshotRevision, 1);
    assert.equal(result.reconciliation.run.status, 'pending');
    const snapshots = (await pool.query('SELECT id, app_user_id, metadata_artist_id, snapshot_revision, snapshot_payload FROM operator_artist_reconciliation_snapshot')).rows;
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].app_user_id, appUserId);
    assert.equal(snapshots[0].metadata_artist_id, metadata.metadataArtistId);
    assert.equal(Number(snapshots[0].snapshot_revision), 1);
    assert.equal(snapshots[0].snapshot_payload.monitoring.acquisitionProfileKey, 'storage_saver');
    assert.equal(snapshots[0].snapshot_payload.releaseGroupSelections[0].selectionState, 'partial');
    const runs = (await pool.query('SELECT id, status, summary, triggered_by_user_id FROM operation_runs')).rows;
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'pending');
    assert.equal(runs[0].summary.snapshotId, snapshots[0].id);
    assert.equal(runs[0].summary.appUserId, appUserId);
    assert.equal(runs[0].summary.metadataArtistId, metadata.metadataArtistId);
    assert.equal(runs[0].triggered_by_user_id, triggeredByUserId);
    assert.equal(runs[0].id, result.reconciliation.run.id);
    const savedMonitoring = (await pool.query('SELECT app_user_id, is_monitored, acquisition_profile_key FROM operator_artist_monitoring')).rows;
    assert.deepEqual(savedMonitoring, [{ app_user_id: appUserId, is_monitored: true, acquisition_profile_key: 'storage_saver' }]);
    const savedSelections = (await pool.query('SELECT app_user_id, selection_state, resolved_metadata_release_id FROM operator_release_group_selection')).rows;
    assert.deepEqual(savedSelections, [{ app_user_id: appUserId, selection_state: 'partial', resolved_metadata_release_id: metadata.metadataReleaseId }]);
    const activity = (await pool.query(`SELECT event_type, actor_user_id, entity_type, entity_id, extra_payload
      FROM activity_events ORDER BY event_type`)).rows;
    assert.deepEqual(activity.map(({ event_type }) => event_type), ['artist_monitored', 'artist_policy_saved'],
      'The required default Activity store must persist both events on the save transaction');
    assert.ok(activity.every((event) => event.actor_user_id === triggeredByUserId
      && event.entity_type === 'artist' && event.entity_id === metadata.metadataArtistId));
    assert.equal(activity[0].extra_payload, null);
    assert.deepEqual(activity[1].extra_payload.snapshot, { id: snapshots[0].id, snapshotRevision: 1 });
    assert.equal(activity[1].extra_payload.reconciliation.runId, runs[0].id);
    assert.equal(activity[1].extra_payload.hasChanges, true);
    assert.deepEqual(observed.map(({ phase }) => phase).sort(), ['notification', 'projection', 'refresh']);
    assert.ok(observed.every(({ committed }) => committed));
    assert.equal(observed.find(({ phase }) => phase === 'notification').payload.actorUserId, triggeredByUserId);
    assert.equal(observed.find(({ phase }) => phase === 'projection').payload.appUserId, appUserId);
    assert.equal(observed.find(({ phase }) => phase === 'refresh').payload.triggeredByUserId, triggeredByUserId);
    assert.deepEqual(warnings.map(({ phase }) => phase).sort(), ['metadata_refresh', 'notification', 'projection']);
    assert.ok(warnings.every((warning) => warning.saveCommitted === true && warning.snapshotId === snapshots[0].id && warning.snapshotRevision === 1));
    assert.doesNotMatch(JSON.stringify(warnings), /private|secret|token|sql/u);
  } });
});

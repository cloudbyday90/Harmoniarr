/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createOperatorArtistActivityService } from '../../src/server/metadata/operator-artist-activity-service.js';
import { createActivityEventStore } from '../../src/server/activity/activity-event-store.js';
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

function createSaveService(getPoolFn, options = {}) {
  return createOperatorArtistSaveService({
    getPoolFn,
    ...options,
    operatorArtistMonitoringStore: createOperatorArtistMonitoringStore({ getPoolFn }),
    operatorArtistReconciliationRunStore: createOperatorArtistReconciliationRunStore({ getPoolFn }),
    operatorArtistReconciliationSnapshotStore: createOperatorArtistReconciliationSnapshotStore({ getPoolFn }),
    operatorReleaseGroupSelectionStore: createOperatorReleaseGroupSelectionStore({ getPoolFn }),
    operatorTrackOverrideStore: createOperatorTrackOverrideStore({ getPoolFn }),
    // The post-commit display projection is outside this persistence contract.
    operatorArtistProjectionService: { getOperatorArtistProjection: async () => null },
  });
}

test('required artist Activity commits atomically, rejects stale replay and rolls back partial event writes', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const { rows: users } = await pool.query(
      "INSERT INTO app_users (username, password_hash, role, must_change_password) VALUES ('activity-operator', 'test-only-hash', 'admin', FALSE) RETURNING id",
    );
    const appUserId = users[0].id;
    const input = { appUserId, metadataArtistId: metadata.metadataArtistId, expectedSnapshotRevision: 0,
      draft: { monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true }, releaseGroupSelections: [], trackOverrides: [] } };
    const realStore = createActivityEventStore({ getPoolFn });
    let writes = 0;
    let externalCalls = 0;
    const failingService = createSaveService(getPoolFn, {
      onArtistMonitoredFn: async () => { externalCalls += 1; },
      startMetadataArtistRefresh: async () => { externalCalls += 1; },
      operatorArtistActivityService: createOperatorArtistActivityService({ activityEventStore: {
        insertActivityEvent: async (event) => {
          writes += 1;
          if (writes === 2) throw new Error('simulated required Activity storage failure');
          return realStore.insertActivityEvent(event);
        },
      } }),
    });
    await assert.rejects(() => failingService.saveOperatorArtist(input), /required Activity storage failure/);
    assert.equal(writes, 2, 'Exercise rollback after the first Activity row was inserted');
    assert.equal(externalCalls, 0);
    for (const table of ['activity_events', 'operator_artist_monitoring', 'operator_artist_reconciliation_snapshot', 'operation_runs']) {
      assert.equal((await pool.query(`SELECT COUNT(*)::integer AS count FROM ${table}`)).rows[0].count, 0);
    }

    const service = createSaveService(getPoolFn);
    const saved = await service.saveOperatorArtist(input);
    const readEvents = async () => (await pool.query('SELECT event_type, actor_user_id, entity_id, extra_payload FROM activity_events ORDER BY occurred_at, id')).rows;
    const events = await readEvents();
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((row) => row.event_type).sort(), ['artist_monitored', 'artist_policy_saved']);
    assert.ok(events.every((row) => row.actor_user_id === appUserId && row.entity_id === metadata.metadataArtistId));
    const policyEvent = events.find((row) => row.event_type === 'artist_policy_saved');
    assert.equal(policyEvent.extra_payload.snapshot.id, saved.snapshot.id);
    assert.equal(policyEvent.extra_payload.snapshot.snapshotRevision, 1);
    assert.equal(policyEvent.extra_payload.reconciliation.runId, saved.reconciliation.run.id);
    await assert.rejects(() => service.saveOperatorArtist(input), { status: 409, code: 'operator_artist_snapshot_conflict' });
    assert.deepEqual(await readEvents(), events, 'A replay of a committed revision cannot duplicate Activity');
    await service.saveOperatorArtist({ ...input, expectedSnapshotRevision: 1 });
    assert.deepEqual(await readEvents(), events, 'An unchanged intent does not repeat transition or policy Activity');

    const otherMetadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: 'Retried Artist' });
    let attemptedWrites = 0;
    const retrying = createSaveService(getPoolFn, {
      operatorArtistActivityService: createOperatorArtistActivityService({ activityEventStore: {
        insertActivityEvent: async (event) => {
          attemptedWrites += 1;
          if (attemptedWrites === 2) throw Object.assign(new Error('simulated pre-commit uniqueness failure'), { code: '23505' });
          return realStore.insertActivityEvent(event);
        },
      } }),
    });
    const retried = await retrying.saveOperatorArtist({ ...input, metadataArtistId: otherMetadata.metadataArtistId });
    assert.equal(retried.snapshot.snapshotRevision, 1);
    assert.equal(attemptedWrites, 4);
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM activity_events WHERE entity_id = $1', [otherMetadata.metadataArtistId])).rows[0].count, 2);
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM operator_artist_reconciliation_snapshot WHERE metadata_artist_id = $1', [otherMetadata.metadataArtistId])).rows[0].count, 1);
  } });
});

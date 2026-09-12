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
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

function createSaveService(getPoolFn, transactionPool = getPoolFn) {
  return createOperatorArtistSaveService({
    getPoolFn: transactionPool,
    operatorArtistMonitoringStore: createOperatorArtistMonitoringStore({ getPoolFn }),
    operatorArtistReconciliationRunStore: createOperatorArtistReconciliationRunStore({ getPoolFn }),
    operatorArtistReconciliationSnapshotStore: createOperatorArtistReconciliationSnapshotStore({ getPoolFn }),
    operatorReleaseGroupSelectionStore: createOperatorReleaseGroupSelectionStore({ getPoolFn }),
    operatorTrackOverrideStore: createOperatorTrackOverrideStore({ getPoolFn }),
    // The post-commit display projection is outside this persistence contract.
    operatorArtistProjectionService: { getOperatorArtistProjection: async () => null },
  });
}

function createConcurrentTransactionPool(pool) {
  let beginCount = 0;
  let releaseBegins;
  const bothTransactionsStarted = new Promise((resolve) => { releaseBegins = resolve; });
  return () => ({
    async connect() {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        async query(sql, parameters) {
          const result = await client.query(sql, parameters);
          if (sql === 'BEGIN' && beginCount < 2) {
            beginCount += 1;
            if (beginCount === 2) releaseBegins();
            await bothTransactionsStarted;
          }
          return result;
        },
      };
    },
  });
}

function buildDraft(metadata, profile, selectionState) {
  return {
    monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true,
      selectionSourceMode: 'policy_plus_overrides', acquisitionProfileKey: profile },
    releaseGroupSelections: [{ metadataReleaseGroupId: metadata.metadataReleaseGroupId,
      resolvedMetadataReleaseId: metadata.metadataReleaseId, selectionSource: 'manual', selectionState }],
    trackOverrides: [],
  };
}

async function assertPersistedWinner(pool, appUserId, metadata, draft, revision) {
  const { rows: monitoring } = await pool.query(
    'SELECT acquisition_profile_key FROM operator_artist_monitoring WHERE app_user_id = $1 AND metadata_artist_id = $2',
    [appUserId, metadata.metadataArtistId],
  );
  assert.deepEqual(monitoring, [{ acquisition_profile_key: draft.monitoring.acquisitionProfileKey }]);
  const { rows: selections } = await pool.query(
    'SELECT selection_state FROM operator_release_group_selection WHERE app_user_id = $1 AND metadata_artist_id = $2',
    [appUserId, metadata.metadataArtistId],
  );
  assert.deepEqual(selections, [{ selection_state: draft.releaseGroupSelections[0].selectionState }]);
  const { rows: snapshots } = await pool.query(
    'SELECT snapshot_revision, snapshot_payload FROM operator_artist_reconciliation_snapshot WHERE app_user_id = $1 AND metadata_artist_id = $2 ORDER BY snapshot_revision',
    [appUserId, metadata.metadataArtistId],
  );
  assert.equal(snapshots.length, revision, 'A rejected save must not create a snapshot');
  assert.equal(Number(snapshots.at(-1).snapshot_revision), revision);
  assert.equal(snapshots.at(-1).snapshot_payload.monitoring.acquisitionProfileKey, draft.monitoring.acquisitionProfileKey);
  assert.equal(snapshots.at(-1).snapshot_payload.releaseGroupSelections[0].selectionState,
    draft.releaseGroupSelections[0].selectionState);
  const { rows: runs } = await pool.query(
    `SELECT summary FROM operation_runs WHERE status = 'pending'
     AND summary->>'appUserId' = $1 AND summary->>'metadataArtistId' = $2`,
    [appUserId, metadata.metadataArtistId],
  );
  assert.equal(runs.length, 1, 'Only the winning saved snapshot is queued');
  assert.equal(runs[0].summary.snapshotRevision, revision);
}

test('artist saves require revisions and atomically reject stale PostgreSQL transactions', { timeout: 90_000 }, async (t) => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const { rows: users } = await pool.query(
      "INSERT INTO app_users (username, password_hash, role, must_change_password) VALUES ('revision-operator', 'test-only-hash', 'admin', FALSE) RETURNING id",
    );
    const appUserId = users[0].id;
    const base = { appUserId, metadataArtistId: metadata.metadataArtistId };
    const drafts = [buildDraft(metadata, 'lossless_archive', 'selected'), buildDraft(metadata, 'storage_saver', 'unselected')];
    const service = createSaveService(getPoolFn);

    await t.test('the HTTP route rejects missing and null revisions before creating operator state', async () => {
      const app = createJsonTestApp((server) => registerMetadataRoutes(server, {
        saveOperatorArtist: service.saveOperatorArtist,
        // Authentication has separate route coverage; exercise this adapter with
        // a known authenticated actor and the actual PostgreSQL save service.
        requireFreshSession: async () => ({ appUserId }),
        requireCsrf: (request) => assert.equal(request.headers['x-csrf-token'], 'revision-test-csrf'),
      }));
      await withServer(app, async (baseUrl) => {
        for (const extra of [{}, { expectedSnapshotRevision: null }]) {
          const response = await fetch(`${baseUrl}/api/v1/metadata/artists/${metadata.metadataArtistId}/operator`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'revision-test-csrf' },
            body: JSON.stringify({ ...drafts[0], ...extra }),
          });
          assert.equal(response.status, 400);
          assert.equal((await response.json()).error.code, 'validation_error');
        }
      });
      const { rows } = await pool.query('SELECT COUNT(*)::integer AS count FROM operator_artist_monitoring');
      assert.equal(rows[0].count, 0);
    });

    for (const revision of [0, 1]) {
      await t.test(`two concurrent saves at revision ${revision} commit exactly one complete draft`, async () => {
        const concurrent = createSaveService(getPoolFn, createConcurrentTransactionPool(pool));
        const results = await Promise.allSettled(drafts.map((draft) => concurrent.saveOperatorArtist({
          ...base, draft, expectedSnapshotRevision: revision,
        })));
        const winner = results.findIndex((result) => result.status === 'fulfilled');
        assert.notEqual(winner, -1);
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
        const loser = results.find((result) => result.status === 'rejected');
        assert.equal(loser.reason.status, 409);
        assert.equal(loser.reason.code, 'operator_artist_snapshot_conflict');
        assert.equal(results[winner].value.snapshot.snapshotRevision, revision + 1);
        await assertPersistedWinner(pool, appUserId, metadata, drafts[winner], revision + 1);
      });
    }

    await t.test('a refreshed revision permits the next complete save', async () => {
      const result = await service.saveOperatorArtist({ ...base, draft: drafts[1], expectedSnapshotRevision: 2 });
      assert.equal(result.snapshot.snapshotRevision, 3);
      await assertPersistedWinner(pool, appUserId, metadata, drafts[1], 3);
    });

    await t.test('equivalent UUID spellings share the first-save lock', async () => {
      const otherMetadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: 'UUID Case Artist' });
      const concurrent = createSaveService(getPoolFn, createConcurrentTransactionPool(pool));
      const draft = { ...drafts[0], releaseGroupSelections: [] };
      const results = await Promise.allSettled([
        otherMetadata.metadataArtistId,
        otherMetadata.metadataArtistId.toUpperCase(),
      ].map((metadataArtistId) => concurrent.saveOperatorArtist({
        appUserId, metadataArtistId, draft, expectedSnapshotRevision: 0,
      })));
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const rejected = results.find((result) => result.status === 'rejected');
      assert.equal(rejected.reason.status, 409);
      assert.equal(rejected.reason.code, 'operator_artist_snapshot_conflict');
      const { rows } = await pool.query(
        'SELECT snapshot_revision FROM operator_artist_reconciliation_snapshot WHERE app_user_id = $1 AND metadata_artist_id = $2',
        [appUserId, otherMetadata.metadataArtistId],
      );
      assert.deepEqual(rows.map((row) => Number(row.snapshot_revision)), [1]);
    });
  } });
});

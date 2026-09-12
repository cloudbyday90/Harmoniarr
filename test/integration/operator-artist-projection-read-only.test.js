/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistProjectionService } from '../../src/server/metadata/operator-artist-projection-service.js';
import { createOperatorArtistReconciliationService } from '../../src/server/metadata/operator-artist-reconciliation-service.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationSnapshotStore } from '../../src/server/metadata/operator-artist-reconciliation-snapshot-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('artist projection GET never queues PostgreSQL recovery work; explicit protected POST still does', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const { rows: users } = await pool.query(
      "INSERT INTO app_users (username, password_hash, role, must_change_password) VALUES ('projection-reader', 'test-only-hash', 'admin', FALSE) RETURNING id",
    );
    const appUserId = users[0].id;
    const scope = { appUserId, metadataArtistId: metadata.metadataArtistId };
    const snapshots = createOperatorArtistReconciliationSnapshotStore({ getPoolFn });
    const runs = createOperatorArtistReconciliationRunStore({ getPoolFn });
    const snapshot = await snapshots.createOperatorArtistReconciliationSnapshot({ ...scope, snapshotPayload: {} });
    const metadataPayload = { artist: { id: metadata.metadataArtistId, name: 'Test Artist' }, aliases: [], releaseGroups: [], releases: [] };
    const getMetadataArtist = async () => metadataPayload;
    const audits = [];
    const reconciliation = createOperatorArtistReconciliationService({
      getMetadataArtist, runStore: runs, snapshotService: snapshots,
      recordAuditEventFn: async (event) => { audits.push(event); },
    });
    const queued = await runs.queueLatestSnapshotRun({ ...scope, artistName: 'Test Artist', snapshotId: snapshot.id,
      snapshotRevision: snapshot.snapshotRevision, triggerSource: 'save' });
    await pool.query("UPDATE operation_runs SET status = 'failed', finished_at = NOW(), error_message = 'Test failure' WHERE id = $1", [queued.run.id]);
    const projection = createOperatorArtistProjectionService({
      getMetadataArtist,
      getOperatorArtistMonitoring: async () => ({ isMonitored: true }),
      getLatestOperatorArtistReconciliationSnapshot: snapshots.getLatestOperatorArtistReconciliationSnapshot,
      operatorArtistReconciliationRunStore: runs,
      listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
      listOperatorReleaseGroupSelections: async () => [],
      listOperatorTrackOverrides: async () => [],
      // A configured real queue must never be reached by projection reads.
      operatorArtistReconciliationRecoveryService: {
        recoverFailedOperatorArtistReconciliation: () => { throw new Error('GET must not invoke recovery'); },
      },
    });
    // Verify the actual route adapters with a known actor and a CSRF guard;
    // authentication/session persistence is covered by the separate route suite.
    const session = async () => ({ appUserId });
    const app = createJsonTestApp((server) => registerMetadataRoutes(server, {
      getOperatorArtistProjection: projection.getOperatorArtistProjection,
      queueOperatorArtistReconciliation: reconciliation.queueOperatorArtistReconciliation,
      requireSession: session, requireFreshSession: session,
      requireCsrf: (request) => {
        if (request.headers['x-csrf-token'] !== 'projection-test-csrf') {
          throw Object.assign(new Error('CSRF required'), { status: 403 });
        }
      },
    }));
    const readRuns = async () => (await pool.query(
      "SELECT id, status, summary, error_message FROM operation_runs WHERE summary->>'appUserId' = $1 AND summary->>'metadataArtistId' = $2 ORDER BY id",
      [appUserId, metadata.metadataArtistId],
    )).rows;
    const before = await readRuns();
    await withServer(app, async (baseUrl) => {
      const endpoint = `${baseUrl}/api/v1/metadata/artists/${metadata.metadataArtistId}/operator`;
      const read = async () => {
        const response = await fetch(endpoint);
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.operator.reconciliation.status, 'failed');
        assert.equal(payload.operator.reconciliation.pendingRun, null);
        assert.equal(payload.operator.reconciliation.recovery, null);
      };
      await read();
      await read();
      await Promise.all(Array.from({ length: 5 }, read));
      assert.deepEqual(await readRuns(), before);
      assert.equal(audits.length, 0);
      const denied = await fetch(`${endpoint}/reconciliation`, { method: 'POST' });
      assert.equal(denied.status, 403);
      assert.deepEqual(await readRuns(), before);
      const accepted = await fetch(`${endpoint}/reconciliation`, { method: 'POST', headers: { 'x-csrf-token': 'projection-test-csrf' } });
      assert.equal(accepted.status, 202);
      const after = await readRuns();
      assert.equal(after.length, 2);
      const pending = after.find((run) => run.status === 'pending');
      assert.equal(pending.summary.triggerSource, 'manual_retry');
      assert.equal(pending.summary.snapshotId, snapshot.id);
      assert.equal(pending.summary.appUserId, appUserId);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].actorUserId, appUserId);
    });
  } });
});

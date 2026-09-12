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

function createSaveService(getPoolFn) {
  return createOperatorArtistSaveService({
    getPoolFn,
    operatorArtistMonitoringStore: createOperatorArtistMonitoringStore({ getPoolFn }),
    operatorArtistReconciliationRunStore: createOperatorArtistReconciliationRunStore({ getPoolFn }),
    operatorArtistReconciliationSnapshotStore: createOperatorArtistReconciliationSnapshotStore({ getPoolFn }),
    operatorReleaseGroupSelectionStore: createOperatorReleaseGroupSelectionStore({ getPoolFn }),
    operatorTrackOverrideStore: createOperatorTrackOverrideStore({ getPoolFn }),
    // The post-commit display projection is outside this persistence contract.
    operatorArtistProjectionService: { getOperatorArtistProjection: async () => null },
  });
}

function draftFor(overrides) {
  return { monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true, selectionSourceMode: 'policy_plus_overrides' }, releaseGroupSelections: [], trackOverrides: overrides };
}

test('malformed track override identities return 400 without changing PostgreSQL artist state', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const { rows: users } = await pool.query("INSERT INTO app_users (username, password_hash, role, must_change_password) VALUES ('override-validation', 'test-only-hash', 'admin', FALSE) RETURNING id");
    const appUserId = users[0].id;
    const { rows: recordings } = await pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id = $1', [metadata.metadataRecordingId]);
    const trackMbid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const track = { metadataReleaseGroupId: metadata.metadataReleaseGroupId,
      trackMbid: ` ${trackMbid.toUpperCase()} `, metadataReleaseId: ` ${metadata.metadataReleaseId.toUpperCase()} `,
      mediumPosition: 1, trackPosition: 1, trackLengthMsSnapshot: 0, isDesired: true };
    const fallback = { metadataReleaseGroupId: metadata.metadataReleaseGroupId,
      recordingMbid: recordings[0].musicbrainz_recording_id, metadataReleaseId: metadata.metadataReleaseId,
      mediumPosition: 1, trackPosition: 1, trackLengthMsSnapshot: 322000, isDesired: false };
    const service = createSaveService(getPoolFn);
    const app = createJsonTestApp((server) => registerMetadataRoutes(server, {
      saveOperatorArtist: service.saveOperatorArtist,
      requireFreshSession: async () => ({ appUserId }),
      requireCsrf: (request) => assert.equal(request.headers['x-csrf-token'], 'override-test-csrf'),
    }));
    const readState = async () => {
      const tables = ['operator_artist_monitoring', 'operator_track_override', 'operator_artist_reconciliation_snapshot', 'operation_runs'];
      return Promise.all(tables.map(async (table) => (await pool.query(`SELECT to_jsonb(item) AS value FROM ${table} AS item ORDER BY id`)).rows));
    };
    await withServer(app, async (baseUrl) => {
      const save = async (draft, expectedSnapshotRevision) => fetch(`${baseUrl}/api/v1/metadata/artists/${metadata.metadataArtistId}/operator`, {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': 'override-test-csrf' },
        body: JSON.stringify({ ...draft, expectedSnapshotRevision }),
      });
      const valid = await save(draftFor([track, fallback]), 0);
      assert.equal(valid.status, 200, await valid.text());
      const { rows: saved } = await pool.query('SELECT track_mbid, recording_mbid, metadata_release_id, medium_position, track_position, track_length_ms_snapshot FROM operator_track_override ORDER BY track_mbid NULLS LAST');
      assert.equal(saved.length, 2);
      assert.equal(saved[0].track_mbid, trackMbid);
      assert.equal(saved[0].metadata_release_id, metadata.metadataReleaseId);
      assert.equal(saved[0].track_length_ms_snapshot, 0);
      assert.equal(saved[1].recording_mbid, fallback.recordingMbid);
      assert.equal(saved[1].medium_position, 1);
      assert.equal(saved[1].track_position, 1);
      const { rows: snapshots } = await pool.query('SELECT snapshot_payload FROM operator_artist_reconciliation_snapshot');
      const trackSnapshot = snapshots[0].snapshot_payload.trackOverrides.find((override) => override.trackMbid);
      assert.equal(trackSnapshot.trackMbid, trackMbid);
      assert.equal(trackSnapshot.metadataReleaseId, metadata.metadataReleaseId);
      const before = await readState();
      const malformed = [
        { mediumPosition: '1' }, { mediumPosition: 1.5 }, { mediumPosition: 0 }, { mediumPosition: 2147483648 },
        { trackPosition: '2x' }, { trackPosition: -1 }, { trackPosition: 2147483648 }, { trackPosition: Number.MAX_SAFE_INTEGER + 1 },
        { trackLengthMsSnapshot: '10' }, { trackLengthMsSnapshot: -1 }, { trackLengthMsSnapshot: 0.5 }, { trackLengthMsSnapshot: 2147483648 },
        { trackMbid: false }, { trackMbid: 'not-a-uuid' }, { trackMbid: '' },
        { recordingMbid: {} }, { recordingMbid: 'malformed' },
        { metadataReleaseId: 123 }, { metadataReleaseId: 'malformed' },
      ];
      for (const patch of malformed) {
        const draft = draftFor([{ ...fallback, ...patch }]);
        draft.monitoring.acquisitionProfileKey = 'storage_saver';
        const response = await save(draft, 1);
        assert.equal(response.status, 400, JSON.stringify(patch));
        assert.equal((await response.json()).error.code, 'validation_error');
        assert.deepEqual(await readState(), before, `Rejected payload changed persistence: ${JSON.stringify(patch)}`);
      }
    });
  } });
});

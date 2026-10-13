/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { getPool } from '../../src/server/database.js';
import assert from 'node:assert/strict';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { seedOperatorReconciliationLifetimeRun } from './operator-reconciliation-lifetime-fixture.js';
import { executeOperatorReconciliationFixtureRun } from './operator-reconciliation-execution-fixture.js';

export async function seedOperatorTrackUnionFixture({ durationSeconds = 2 } = {}) {
  if (![2, 30].includes(durationSeconds)) throw new TypeError('Unknown controlled track duration');
  const fixture = await seedOperatorReconciliationLifetimeRun();
  const pool = getPool();
  await pool.query('UPDATE metadata_tracks SET length_ms=$2 WHERE id=$1', [fixture.metadata.metadataTrackId, durationSeconds * 1000]);
  await pool.query(`INSERT INTO metadata_tracks(metadata_medium_id,metadata_recording_id,position,title,length_ms)
    VALUES($1,$2,2,'Second track',$3),($1,$2,3,'Unrequested third',$3)`, [fixture.metadata.metadataMediumId, fixture.metadata.metadataRecordingId, durationSeconds * 1000]);
  await pool.query('UPDATE metadata_releases SET track_count=3 WHERE id=$1', [fixture.metadata.metadataReleaseId]);
  const recording = (await pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id=$1', [fixture.metadata.metadataRecordingId])).rows[0].musicbrainz_recording_id;
  const saves = createOperatorArtistSaveService({ getOperatorArtistProjection: async () => null,
    startMetadataArtistRefresh: async () => ({ accepted: true }) });
  const owners = [fixture.user, fixture.other];
  for (const [index, owner] of owners.entries()) {
    await pool.query('UPDATE app_users SET managed_library_relative_root=$2 WHERE id=$1', [owner.id, `union-owner-${index + 1}`]);
    const saved = await saves.saveOperatorArtist({ appUserId: owner.id, metadataArtistId: fixture.metadata.metadataArtistId,
      expectedSnapshotRevision: index === 0 ? 1 : 0, draft: {
        monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true, monitoredReleaseGroupTypes: ['album'],
          releaseScope: 'track_only', wantedAutomationMode: 'manual_only', selectionSourceMode: 'policy_plus_overrides' },
        releaseGroupSelections: [], trackOverrides: [{ metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId,
          metadataReleaseId: fixture.metadata.metadataReleaseId, recordingMbid: recording, mediumPosition: 1,
          trackPosition: index + 1, isDesired: true, remapStatus: 'resolved' }] } });
    await executeOperatorReconciliationFixtureRun(saved.reconciliation.run);
  }
  await createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {} }).reconcileWantedReleases();
  const wanted = (await pool.query('SELECT id,app_user_id,evidence FROM library_wanted_releases ORDER BY app_user_id')).rows;
  const requests = (await pool.query('SELECT * FROM media_requests ORDER BY created_at DESC,id DESC')).rows;
  assert.equal(requests.length, 2, JSON.stringify(requests.map(request => ({ ownerId: request.requested_for_user_id,
    scope: request.evidence?.operatorArtistReconciliation?.operatorTrackScope }))));
  assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM library_discovery_requests')).rows[0].count, 1);
  const primary = requests.find(request => request.requested_for_user_id === fixture.user.id);
  return { ...fixture, wanted, requests, primary };
}

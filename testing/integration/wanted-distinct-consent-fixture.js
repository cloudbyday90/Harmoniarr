/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { executeOperatorReconciliationFixtureRun } from './operator-reconciliation-execution-fixture.js';

/** A new context for the same two owners, with canonical saved typed consent. */
export async function seedWantedDistinctConsent({ pool, owners, context, durationSeconds, signal }) {
  signal?.throwIfAborted();
  const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: `Binding artist ${context}`,
    releaseTitle: `Binding release ${context}`, trackTitle: 'First track', trackLengthMs: durationSeconds * 1000,
    releaseDate: '2099-10-01', firstReleaseDate: '2099-10-01' });
  await pool.query(`INSERT INTO metadata_tracks(metadata_medium_id,metadata_recording_id,position,title,length_ms)
    VALUES($1,$2,2,'Second track',$3),($1,$2,3,'Unrequested third',$3)`,
  [metadata.metadataMediumId, metadata.metadataRecordingId, durationSeconds * 1000]);
  await pool.query('UPDATE metadata_releases SET track_count=3 WHERE id=$1', [metadata.metadataReleaseId]);
  await pool.query('UPDATE metadata_media SET track_count=3 WHERE id=$1', [metadata.metadataMediumId]);
  const recording = (await pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id=$1',
    [metadata.metadataRecordingId])).rows[0].musicbrainz_recording_id;
  const saves = createOperatorArtistSaveService({ getOperatorArtistProjection: async () => null,
    startMetadataArtistRefresh: async () => ({ accepted: true }) });
  for (const [index, owner] of owners.entries()) {
    signal?.throwIfAborted();
    const saved = await saves.saveOperatorArtist({ appUserId: owner.id, metadataArtistId: metadata.metadataArtistId,
      expectedSnapshotRevision: 0, draft: {
        monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true, monitoredReleaseGroupTypes: ['album'],
          releaseScope: 'track_only', wantedAutomationMode: 'manual_only', selectionSourceMode: 'policy_plus_overrides' },
        releaseGroupSelections: [], trackOverrides: [{ metadataReleaseGroupId: metadata.metadataReleaseGroupId,
          metadataReleaseId: metadata.metadataReleaseId, recordingMbid: recording, mediumPosition: 1,
          trackPosition: index + 1, isDesired: true, remapStatus: 'resolved' }] } });
    await executeOperatorReconciliationFixtureRun(saved.reconciliation.run);
    signal?.throwIfAborted();
  }
  await createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {} }).reconcileWantedReleases();
  const wanted = (await pool.query('SELECT id,app_user_id,evidence FROM library_wanted_releases WHERE metadata_release_id=$1',
    [metadata.metadataReleaseId])).rows;
  const requests = (await pool.query('SELECT * FROM media_requests WHERE matched_metadata_release_id=$1',
    [metadata.metadataReleaseId])).rows;
  assert.equal(wanted.length, 2); assert.equal(requests.length, 2);
  const primary = requests.find(request => request.requested_for_user_id === owners[0].id);
  assert.ok(primary);
  return { metadata, wanted, requests, primary, user: owners[0], other: owners[1] };
}

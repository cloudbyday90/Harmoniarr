/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../../src/server/database.js';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { randomUUID } from 'node:crypto';

export function saveNewOperatorPolicy(fixture, options = {}) {
  return createOperatorArtistSaveService({ operatorArtistProjectionService: { getOperatorArtistProjection: async () => null },
    startMetadataArtistRefresh: async () => ({ accepted: true }), ...options }).saveOperatorArtist({
    appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId, expectedSnapshotRevision: fixture.snapshot.snapshotRevision,
    draft: { monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: false, monitoredReleaseGroupTypes: ['album'] }, releaseGroupSelections: [], trackOverrides: [] },
  });
}

export async function mutateReconciliationAuthority(kind, fixture) {
  const appUserId = fixture.user.id; const metadataArtistId = fixture.metadata.metadataArtistId;
  if (kind === 'save') return saveNewOperatorPolicy(fixture);
  if (kind === 'monitoring') return createOperatorArtistMonitoringStore().upsertOperatorArtistMonitoring({ ...defaultOperatorArtistMonitoringPolicy, appUserId, metadataArtistId, isMonitored: false });
  if (kind === 'selection') return createOperatorReleaseGroupSelectionStore().upsertOperatorReleaseGroupSelection({ appUserId, metadataArtistId,
    metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId, selectionSource: 'manual', selectionState: 'unselected' });
  if (kind === 'override') return createOperatorTrackOverrideStore().upsertOperatorTrackOverride({ appUserId, metadataArtistId,
    metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId, metadataReleaseId: fixture.metadata.metadataReleaseId, trackMbid: randomUUID(), isDesired: false, remapStatus: 'resolved' });
  if (kind === 'catalog') return getPool().query("UPDATE metadata_releases SET title='Changed edition' WHERE id=$1", [fixture.metadata.metadataReleaseId]);
  if (kind === 'cancelled') return getPool().query('UPDATE operation_runs SET cancel_requested_at=clock_timestamp() WHERE id=$1', [fixture.run.id]);
  if (kind === 'disabled') return getPool().query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [appUserId]);
  if (kind === 'scope') return getPool().query("UPDATE operation_runs SET summary=summary || jsonb_build_object('appUserId',$2::text) WHERE id=$1", [fixture.run.id, fixture.other.id]);
  await getPool().query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`operator_artist_reconciliation:${fixture.run.id}`]);
  if (kind === 'replacement') return createJobLeaseStore().acquireLease({ jobType: 'operator_artist_reconciliation', leaseKey: `operator_artist_reconciliation:${fixture.run.id}` });
  if (kind !== 'expired') throw new Error('Unknown controlled authority mutation');
}

export async function seedSecondReconciliationRelease(fixture) {
  const group = (await getPool().query(`INSERT INTO metadata_release_groups(metadata_artist_id,source_provider,source_release_group_id,musicbrainz_release_group_id,title,primary_type,first_release_date)
    VALUES($1,'musicbrainz',$2,$3,'Second album','Album','2099-10-02') RETURNING id`, [fixture.metadata.metadataArtistId, randomUUID(), randomUUID()])).rows[0];
  return (await getPool().query(`INSERT INTO metadata_releases(metadata_release_group_id,source_provider,source_release_id,musicbrainz_release_id,title,status,release_date,track_count,medium_count,is_canonical)
    VALUES($1,'musicbrainz',$2,$3,'Second album','Official','2099-10-02',1,1,TRUE) RETURNING id`, [group.id, randomUUID(), randomUUID()])).rows[0];
}

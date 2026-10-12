/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { lockJobLeaseKey } from '../job-lease-lock-store.js';
import { normalizeJobLease } from '../job-lease-store.js';
import { createOperatorArtistSaveStateStore } from './operator-artist-save-state-store.js';
import { createMetadataReadService } from './metadata-read-service.js';
import { createOperatorArtistMonitoringStore } from './operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';
import { captureReconciliationPublicationSource, reconciliationOperationType } from './operator-reconciliation-publication-policy.js';

export function createOperatorReconciliationPublicationStore() {
  async function lockContext({ prepared, queryable }) {
    await createOperatorArtistSaveStateStore().lockOperatorArtistSave({ ...prepared, client: queryable });
    await queryable.query('SELECT id FROM operation_runs WHERE id=$1::uuid AND operation_type=$2 FOR UPDATE', [prepared.runId, reconciliationOperationType]);
    await lockJobLeaseKey({ leaseKey: prepared.expectedLease.leaseKey, queryable });
    await queryable.query('SELECT id FROM app_users WHERE id=$1::uuid FOR SHARE', [prepared.appUserId]);
    // Scope lock fences canonical save inserts; row locks also fence existing standalone updates.
    for (const table of ['operator_artist_monitoring', 'operator_release_group_selection', 'operator_track_override']) {
      await queryable.query(`SELECT id FROM ${table} WHERE app_user_id=$1::uuid AND metadata_artist_id=$2::uuid ORDER BY id FOR SHARE`, [prepared.appUserId, prepared.metadataArtistId]);
    }
    await queryable.query('SELECT id FROM operator_artist_reconciliation_snapshot WHERE id=$1::uuid FOR SHARE', [prepared.snapshotId]);
    await queryable.query('SELECT id FROM metadata_artists WHERE id=$1::uuid FOR SHARE', [prepared.metadataArtistId]);
    await queryable.query('SELECT id FROM metadata_release_groups WHERE metadata_artist_id=$1::uuid ORDER BY id FOR SHARE', [prepared.metadataArtistId]);
    await queryable.query(`SELECT release.id FROM metadata_releases release JOIN metadata_release_groups release_group ON release_group.id=release.metadata_release_group_id
      WHERE release_group.metadata_artist_id=$1::uuid ORDER BY release.id FOR SHARE OF release`, [prepared.metadataArtistId]);
  }

  async function readAuthority({ prepared, queryable }) {
    const run = (await queryable.query('SELECT * FROM operation_runs WHERE id=$1::uuid', [prepared.runId])).rows[0] ?? null;
    const lease = normalizeJobLease((await queryable.query('SELECT * FROM job_leases WHERE lease_key=$1', [prepared.expectedLease.leaseKey])).rows[0]);
    const actor = (await queryable.query('SELECT id,is_disabled FROM app_users WHERE id=$1::uuid', [prepared.appUserId])).rows[0] ?? null;
    const clock = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
    return { run, lease, actor, now: clock instanceof Date ? clock.getTime() : Date.parse(clock) };
  }

  async function readSource({ prepared, queryable }) {
    const row = (await queryable.query(`SELECT id,snapshot_revision,snapshot_payload FROM operator_artist_reconciliation_snapshot
      WHERE app_user_id=$1::uuid AND metadata_artist_id=$2::uuid ORDER BY snapshot_revision DESC LIMIT 1`, [prepared.appUserId, prepared.metadataArtistId])).rows[0];
    if (!row) return null;
    const snapshot = { id: row.id, snapshotRevision: Number(row.snapshot_revision), snapshotPayload: row.snapshot_payload };
    const artistPayload = await createMetadataReadService({ pool: queryable }).getArtistWantedProjection({ artistId: prepared.metadataArtistId, queryable });
    const monitoring = await createOperatorArtistMonitoringStore().getOperatorArtistMonitoring({ ...prepared, queryable });
    const releaseGroupSelections = await createOperatorReleaseGroupSelectionStore().listOperatorReleaseGroupSelections({ ...prepared, queryable });
    const trackOverrides = await createOperatorTrackOverrideStore().listOperatorTrackOverrides({ ...prepared, queryable });
    return captureReconciliationPublicationSource({ artistPayload, monitoring, releaseGroupSelections, trackOverrides, snapshot });
  }
  return { lockContext, readAuthority, readSource };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../../src/server/database.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createOperatorArtistReconciliationSnapshotService } from '../../src/server/metadata/operator-artist-reconciliation-snapshot-service.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';

export async function seedOperatorReconciliationLifetimeRun() {
  const metadata = await seedMetadataReleaseFixture({ queryable: getPool(), releaseDate: '2099-10-01', firstReleaseDate: '2099-10-01' });
  const users = (await getPool().query("INSERT INTO app_users(username,password_hash,role) VALUES ('reconciliation-owner','synthetic-unused-password','admin'),('other-owner','synthetic-unused-password','admin') RETURNING id,username")).rows;
  const user = users.find(entry => entry.username === 'reconciliation-owner'); const other = users.find(entry => entry.username === 'other-owner');
  const policy = { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true, monitoredReleaseGroupTypes: ['album'] };
  await createOperatorArtistMonitoringStore().upsertOperatorArtistMonitoring({ ...policy, appUserId: user.id, metadataArtistId: metadata.metadataArtistId });
  const snapshot = await createOperatorArtistReconciliationSnapshotService().saveOperatorArtistReconciliationSnapshot({
    appUserId: user.id, metadataArtistId: metadata.metadataArtistId, snapshotPayload: { monitoring: policy, releaseGroupSelections: [], trackOverrides: [] },
  });
  const { run } = await createOperatorArtistReconciliationRunStore().queueLatestSnapshotRun({ appUserId: user.id, artistName: 'Autechre',
    metadataArtistId: metadata.metadataArtistId, snapshotId: snapshot.id, snapshotRevision: snapshot.snapshotRevision, triggeredByUserId: user.id });
  return { metadata, user, other, snapshot, run };
}

export async function readOperatorReconciliationLifetimeState(runId) {
  const operation = (await getPool().query('SELECT status,summary,error_message FROM operation_runs WHERE id=$1', [runId])).rows[0];
  const requests = (await getPool().query('SELECT id,requested_by_user_id,requested_for_user_id,matched_metadata_release_id,evidence FROM media_requests ORDER BY id')).rows;
  const events = (await getPool().query('SELECT media_request_id,event_type,actor_user_id,details FROM media_request_events ORDER BY id')).rows;
  const discovery = (await getPool().query('SELECT metadata_release_id,evidence FROM library_discovery_requests ORDER BY id')).rows;
  return { operation, requests, events, discovery };
}

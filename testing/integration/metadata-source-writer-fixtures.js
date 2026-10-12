/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { getPool } from '../../src/server/database.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { createOperatorArtistReconciliationSnapshotStore } from '../../src/server/metadata/operator-artist-reconciliation-snapshot-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { createMetadataService } from '../../src/server/metadata/metadata-service.js';
import { upsertMetadataRelease, upsertMetadataReleaseGroup } from '../../src/server/metadata/metadata-repository.js';
import { forceCanonicalRelease } from '../../src/server/metadata/canonical-release-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';

export function selectionWriterInput(fixture) {
  return { appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId,
    metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId, resolvedMetadataReleaseId: null,
    selectionOrigin: null, selectionSource: 'manual', selectionState: 'unselected' };
}

export async function buildMetadataSourceWriter(kind, fixture) {
  const scope = { appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId };
  const selection = selectionWriterInput(fixture);
  const override = { ...scope, metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId, metadataReleaseId: fixture.metadata.metadataReleaseId,
    isDesired: false, remapStatus: 'resolved', trackMbid: randomUUID() };
  const monitoring = { ...defaultOperatorArtistMonitoringPolicy, ...scope, isMonitored: false, monitoredReleaseGroupTypes: ['album'] };
  const group = { metadataArtistId: scope.metadataArtistId, sourceProvider: 'musicbrainz', sourceReleaseGroupId: randomUUID(), musicbrainzReleaseGroupId: randomUUID(),
    title: 'New admitted group', primaryType: 'Album', firstReleaseDate: '2099-10-02' };
  const release = { metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId, sourceProvider: 'musicbrainz', sourceReleaseId: randomUUID(), musicbrainzReleaseId: randomUUID(),
    title: 'New admitted edition', status: 'Official', releaseDate: '2099-10-02', trackCount: 1, mediumCount: 1 };
  switch (kind) {
    case 'selection': return () => createOperatorReleaseGroupSelectionStore().upsertOperatorReleaseGroupSelection(selection);
    case 'selection_replace': return () => createOperatorReleaseGroupSelectionStore().replaceOperatorArtistReleaseGroupSelections({ ...scope, operatorReleaseGroupSelections: [selection] });
    case 'override': return () => createOperatorTrackOverrideStore().upsertOperatorTrackOverride(override);
    case 'override_replace': return () => createOperatorTrackOverrideStore().replaceOperatorArtistTrackOverrides({ ...scope, operatorTrackOverrides: [override] });
    case 'snapshot': return () => createOperatorArtistReconciliationSnapshotStore().createOperatorArtistReconciliationSnapshot({ ...scope, snapshotPayload: { newConsent: true } });
    case 'monitoring': return () => createOperatorArtistMonitoringStore().upsertOperatorArtistMonitoring(monitoring);
    case 'catalog_group': return () => upsertMetadataReleaseGroup(group);
    case 'catalog_release': return () => upsertMetadataRelease(release);
    case 'metadata_service': {
      const row = (await getPool().query('SELECT * FROM metadata_artists WHERE id=$1', [scope.metadataArtistId])).rows[0];
      const artist = { sourceProvider: row.source_provider, sourceArtistId: row.source_artist_id, musicbrainzArtistId: row.musicbrainz_artist_id, name: row.name, sortName: row.sort_name };
      return () => createMetadataService().storeReleaseGraph({ artist, releaseGroup: group, release: { ...release, isCanonical: true } });
    }
    case 'canonical': {
      const edition = await upsertMetadataRelease(release); return () => forceCanonicalRelease(edition.id);
    }
    case 'bulk_monitoring': return () => createOperatorArtistMonitoringStore().replaceOperatorArtistMonitoringSnapshot({ operatorArtistMonitoring: [monitoring] });
    case 'bulk_selection': return () => createOperatorReleaseGroupSelectionStore().replaceOperatorReleaseGroupSelectionsSnapshot({ operatorReleaseGroupSelections: [selection] });
    case 'bulk_override': return () => createOperatorTrackOverrideStore().replaceOperatorTrackOverridesSnapshot({ operatorTrackOverrides: [override] });
    default: throw new Error('Unknown controlled metadata source writer');
  }
}

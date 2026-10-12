/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { captureReconciliationPublicationSource } from '../src/server/metadata/operator-reconciliation-publication-policy.js';
import { buildOperatorArtistEffectiveReleaseGroups } from '../src/server/metadata/operator-artist-effective-state.js';
import { createOperatorArtistDesiredStateService } from '../src/server/metadata/operator-artist-desired-state-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../src/server/metadata/operator-artist-monitoring-policy.js';
import { createOperationRunLeaseFixture } from './operation-run-lease-fixtures.js';

export function createReconciliationPublicationFixture() {
  const ids = [1, 2, 3, 4, 5, 6].map(n => `20000000-0000-4000-8000-00000000000${n}`);
  const [appUserId, metadataArtistId, snapshotId, runId, groupId, releaseId] = ids;
  const artistPayload = { artist: { id: metadataArtistId, name: 'Artist' }, releaseGroups: [{ id: groupId, primaryType: 'Album', title: 'Album' }],
    releases: [{ id: releaseId, releaseGroupId: groupId, title: 'Album', isCanonical: true, releaseDate: '2099-10-01', musicbrainzReleaseId: null }] };
  const monitoring = { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true, monitoredReleaseGroupTypes: ['album'] };
  const publicationSource = captureReconciliationPublicationSource({ artistPayload, monitoring, releaseGroupSelections: [], trackOverrides: [],
    snapshot: { id: snapshotId, snapshotRevision: 1, snapshotPayload: { consent: null } } });
  const effective = buildOperatorArtistEffectiveReleaseGroups({ ...artistPayload, monitoredReleaseGroupTypes: monitoring.monitoredReleaseGroupTypes });
  const desiredRelease = createOperatorArtistDesiredStateService().buildDesiredStatePlan({ metadataArtistId, monitoring, releaseGroups: effective.effectiveReleaseGroups }).desiredReleases[0];
  const expectedLease = createOperationRunLeaseFixture({ runId, jobType: 'operator_artist_reconciliation' });
  const input = { appUserId, metadataArtistId, artistName: 'Artist', snapshotId, snapshotRevision: 1,
    workerContext: { operationType: 'operator_artist_reconciliation', runId, expectedLease }, publicationSource, desiredReleases: [desiredRelease] };
  const authority = { run: { id: runId, operation_type: 'operator_artist_reconciliation', status: 'running', summary: { appUserId, metadataArtistId, snapshotId, snapshotRevision: 1 } },
    lease: expectedLease, actor: { id: appUserId, is_disabled: false }, now: Date.parse('2026-10-12T00:00:00.000Z') };
  return { input, authority, desiredRelease, artistPayload, monitoring };
}

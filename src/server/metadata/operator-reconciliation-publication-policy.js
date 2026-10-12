/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { normalizeExpectedJobLease } from '../job-lease-policy.js';
import { defaultOperatorArtistMonitoringPolicy } from './operator-artist-monitoring-policy.js';

export const reconciliationOperationType = 'operator_artist_reconciliation';
export const invalidPublication = () => createApiError(409, 'operator_artist_reconciliation_publication_invalid', 'Artist reconciliation publication authority could not be verified');
export const stalePublication = () => createApiError(409, 'operator_artist_reconciliation_publication_stale', 'Saved artist policy or catalog changed before request publication');

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function uuid(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^\{(.*)\}$/u, '$1');
  if (!/^[a-f0-9]{4}(?:-?[a-f0-9]{4}){7}$/iu.test(text)) return null;
  const hex = text.replaceAll('-', '').toLowerCase();
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
const stableRow = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['updatedAt', 'fetchedAt'].includes(key)));
const sorted = rows => rows.map(stableRow).sort((a, b) => String(a.id).localeCompare(String(b.id)));

/** Preserve normalized fields and nullable values; never use lossy JSON coercion. */
export function captureReconciliationPublicationSource({ artistPayload, monitoring, releaseGroupSelections, trackOverrides, snapshot }) {
  const policy = { ...defaultOperatorArtistMonitoringPolicy, ...monitoring };
  return freeze(structuredClone({
    artist: { id: artistPayload?.artist?.id, name: artistPayload?.artist?.name },
    // Catalog query order also owns per-release progress; preserve it when capturing the plan.
    releaseGroups: artistPayload.releaseGroups.map(stableRow), releases: artistPayload.releases.map(stableRow),
    trackCatalog: (artistPayload.trackCatalog ?? []).map(stableRow),
    monitoring: Object.fromEntries(['acquisitionProfileKey', 'isMonitored', 'monitoredReleaseGroupTypes', 'releaseScope',
      'searchOnAddMode', 'selectionSourceMode', 'wantedAutomationMode'].map(key => [key, policy[key]])),
    releaseGroupSelections: sorted(releaseGroupSelections), trackOverrides: sorted(trackOverrides),
    snapshot: { id: snapshot.id, snapshotRevision: snapshot.snapshotRevision, snapshotPayload: snapshot.snapshotPayload },
  }));
}

export function captureReconciliationPublication({ appUserId, metadataArtistId, snapshotId, snapshotRevision, workerContext, publicationSource }) {
  try {
    const actor = uuid(appUserId); const artist = uuid(metadataArtistId); const snapshot = uuid(snapshotId); const runId = uuid(workerContext?.runId);
    if (!actor || !artist || !snapshot || !runId || workerContext?.operationType !== reconciliationOperationType
      || !Number.isSafeInteger(snapshotRevision) || snapshotRevision < 1) throw invalidPublication();
    const expectedLease = normalizeExpectedJobLease(workerContext.expectedLease, { leaseKey: `${reconciliationOperationType}:${runId}` });
    const source = structuredClone(publicationSource);
    if (!expectedLease || uuid(source?.artist?.id) !== artist || uuid(source?.snapshot?.id) !== snapshot
      || source.snapshot.snapshotRevision !== snapshotRevision || !source.monitoring
      || !Array.isArray(source.releaseGroups) || !Array.isArray(source.releases)
      || !Array.isArray(source.releaseGroupSelections) || !Array.isArray(source.trackOverrides)) throw invalidPublication();
    return freeze({ appUserId: actor, metadataArtistId: artist, snapshotId: snapshot, snapshotRevision, runId, expectedLease, source });
  } catch { throw invalidPublication(); }
}

export function isPublicationRunScope(run, prepared) {
  return run?.id === prepared.runId && run.operation_type === reconciliationOperationType
    && uuid(run.summary?.appUserId) === prepared.appUserId && uuid(run.summary?.metadataArtistId) === prepared.metadataArtistId
    && uuid(run.summary?.snapshotId) === prepared.snapshotId && run.summary?.snapshotRevision === prepared.snapshotRevision;
}

export function capturePublicationTarget(target) {
  return Object.fromEntries(['metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId', 'musicbrainzReleaseId',
    'releaseDate', 'releaseGroupTitle', 'releaseTitle', 'isExplicitSelection', 'selectionOrigin', 'selectionState', 'operatorTrackScope'].map(key => [key,
    ['metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId'].includes(key) ? uuid(target[key]) : target[key]]));
}

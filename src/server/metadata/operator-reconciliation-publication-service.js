/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { isCurrentJobLeaseAcquisition } from '../job-lease-policy.js';
import { createOperationRunCancellationError } from '../operation-run-cancellation.js';
import { buildOperatorArtistEffectiveReleaseGroups } from './operator-artist-effective-state.js';
import { createOperatorArtistDesiredStateService } from './operator-artist-desired-state-service.js';
import { createOperatorReconciliationPublicationStore } from './operator-reconciliation-publication-store.js';
import { capturePublicationTarget, captureReconciliationPublication, isPublicationRunScope, stalePublication } from './operator-reconciliation-publication-policy.js';

export function createOperatorReconciliationPublicationService({ store = createOperatorReconciliationPublicationStore() } = {}) {
  async function assertCurrent({ prepared, desiredRelease, artistName, queryable }) {
    const { run, lease, actor, now } = await store.readAuthority({ prepared, queryable });
    if (!isPublicationRunScope(run, prepared) || run.status !== 'running'
      || !isCurrentJobLeaseAcquisition(lease, prepared.expectedLease, { now })) {
      throw createApiError(409, 'operation_run_lease_lost', 'Artist reconciliation no longer owns request publication');
    }
    if (run.cancel_requested_at != null || run.cancelled_at != null) throw createOperationRunCancellationError({ runId: prepared.runId });
    if (!actor || actor.is_disabled !== false) throw stalePublication();
    const source = await store.readSource({ prepared, queryable });
    if (!isDeepStrictEqual(source, prepared.source) || artistName !== source?.artist.name) throw stalePublication();
    const { effectiveReleaseGroups } = buildOperatorArtistEffectiveReleaseGroups({ releaseGroups: source.releaseGroups, releases: source.releases,
      monitoredReleaseGroupTypes: source.monitoring.monitoredReleaseGroupTypes, releaseGroupSelections: source.releaseGroupSelections,
      trackOverrides: source.trackOverrides, trackCatalog: source.trackCatalog });
    const current = createOperatorArtistDesiredStateService({ getNow: () => new Date(now) }).buildDesiredStatePlan({
      metadataArtistId: prepared.metadataArtistId, monitoring: source.monitoring, releaseGroups: effectiveReleaseGroups,
    }).desiredReleases.find(target => target.metadataReleaseId === desiredRelease.metadataReleaseId);
    if (!current?.eligibleForDownstreamWork || !isDeepStrictEqual(capturePublicationTarget(current), capturePublicationTarget(desiredRelease))) throw stalePublication();
    // Source reads may have waited; expiry is checked with a fresh database clock at this boundary.
    const final = await store.readAuthority({ prepared, queryable });
    if (!isCurrentJobLeaseAcquisition(final.lease, prepared.expectedLease, { now: final.now }) || !isPublicationRunScope(final.run, prepared)
      || final.run.status !== 'running') throw createApiError(409, 'operation_run_lease_lost', 'Artist reconciliation no longer owns request publication');
    if (final.run.cancel_requested_at != null || final.run.cancelled_at != null) throw createOperationRunCancellationError({ runId: prepared.runId });
  }
  return { capture: captureReconciliationPublication, lockContext: store.lockContext, assertCurrent };
}

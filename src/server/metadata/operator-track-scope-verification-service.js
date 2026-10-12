/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { getPool } from '../database.js';
import { createOperatorTrackCatalogStore } from './operator-track-catalog-store.js';
import { lockMetadataSourceRead } from './metadata-source-lock-store.js';
import { buildOperatorTrackScope, isSupportedOperatorTrackScope, OPERATOR_TRACK_SCOPE_BLOCKER } from './operator-track-scope-policy.js';
import { createOperatorTrackAcquisitionStore } from './operator-track-acquisition-store.js';
import { assertOperatorTrackManifest, assertOperatorTrackMedia, getOperatorTrackRequirements, selectOperatorTrackFiles } from './operator-track-file-policy.js';
import { createOperatorTrackParticipantService } from './operator-track-participant-service.js';
import { createOperatorTrackDeliveryPlanService } from './operator-track-delivery-plan-service.js';

const refused = () => createApiError(409, OPERATOR_TRACK_SCOPE_BLOCKER, 'Selected tracks need catalog and file verification before acquisition');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value);

export function createOperatorTrackScopeVerificationService({ getPoolFn = getPool,
  acquisitionStore = createOperatorTrackAcquisitionStore({ getPoolFn }),
  participantService = createOperatorTrackParticipantService({ store: acquisitionStore }),
  deliveryPlanService = createOperatorTrackDeliveryPlanService({ getPoolFn, store: acquisitionStore }),
  catalogStore = createOperatorTrackCatalogStore({ getPoolFn }) } = {}) {
  async function assertScopesCurrent(scopes, { queryable = null } = {}) {
    if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some(entry => !isSupportedOperatorTrackScope(entry?.scope))) throw refused();
    if (scopes.some(entry => entry.scope.mode === 'tracks')) getOperatorTrackRequirements(scopes);
    if (queryable) await lockMetadataSourceRead({ queryable });
    const tracks = await catalogStore.listTrackCatalog({ metadataReleaseIds: [...new Set(scopes.map(entry => entry.scope.metadataReleaseId))], queryable });
    for (const { scope } of scopes) {
      const catalog = tracks.filter(track => track.metadataReleaseId === scope.metadataReleaseId);
      const required = scope.mode === 'release' ? catalog : catalog.filter(track => scope.tracks.some(selected => selected.metadataTrackId === track.metadataTrackId));
      if (!isDeepStrictEqual(required, scope.tracks) || (scope.mode === 'tracks' && catalog.length <= scope.tracks.length)) throw refused();
    }
    return tracks;
  }
  async function assertCandidateCurrent(candidate, { queryable = null, requestedFiles, applyPreview, resolveParticipantsOnly = false } = {}) {
    const context = candidate?.normalizedPayload?.musicQueue ?? candidate?.normalizedPayload?.musicQueueContext;
    const ids = [...new Set([context?.wantedReleaseId, ...(Array.isArray(context?.wantedReleaseIds) ? context.wantedReleaseIds : [])])].filter(uuid);
    const scopes = []; const participants = [];
    if (ids.length > 0) {
      const rows = await acquisitionStore.readWanted({ ids, queryable });
      participants.push(...rows.map(row => ({ ownerId: row.app_user_id, wantedReleaseId: row.id, scope: row.evidence?.operatorTrackScope })));
      for (const row of rows) if (Object.hasOwn(row.evidence ?? {}, 'operatorTrackScope')) {
        if (row.evidence.operatorTrackScope?.metadataReleaseId !== row.metadata_release_id) throw refused();
        scopes.push({ wantedReleaseId: row.id, scope: row.evidence.operatorTrackScope });
      }
    }
    const requestId = candidate?.normalizedPayload?.requestOwnership?.sourceMediaRequestId;
    if (Array.isArray(context?.operatorTrackScopes) && context.operatorTrackScopes.some(entry => entry.scope?.mode === 'tracks') && !uuid(requestId)) throw refused();
    if (uuid(requestId)) {
      const rows = await acquisitionStore.readRequest({ requestId, queryable });
      for (const row of rows) if (Object.hasOwn(row.evidence?.operatorArtistReconciliation ?? {}, 'operatorTrackScope')) {
        if (row.evidence.operatorArtistReconciliation.operatorTrackScope?.metadataReleaseId !== row.matched_metadata_release_id) throw refused();
        const scope = row.evidence.operatorArtistReconciliation.operatorTrackScope;
        if (scope?.mode === 'tracks' && !Object.hasOwn(context ?? {}, 'operatorTrackScopes')) throw refused();
        if (scope?.mode === 'tracks' && row.requested_for_user_id !== candidate.normalizedPayload.requestOwnership.sourceRequestedForUserId) throw refused();
        participants.push({ ownerId: row.requested_for_user_id, scope });
        scopes.push({ mediaRequestId: requestId, scope });
        if (scope?.mode === 'tracks' && ids.length === 0) {
          const wanted = await acquisitionStore.readWanted({ metadataReleaseId: scope.metadataReleaseId, queryable });
          for (const entry of wanted) {
            participants.push({ ownerId: entry.app_user_id, wantedReleaseId: entry.id, scope: entry.evidence?.operatorTrackScope });
            if (Object.hasOwn(entry.evidence ?? {}, 'operatorTrackScope')) scopes.push({ wantedReleaseId: entry.id, scope: entry.evidence.operatorTrackScope });
          }
        }
      }
    }
    if (Object.hasOwn(context ?? {}, 'operatorTrackScopes')) {
      if (!Array.isArray(context.operatorTrackScopes) || context.operatorTrackScopes.length === 0 || scopes.length === 0) throw refused();
      if (context.operatorTrackScopes.some(entry => !scopes.some(current =>
        (entry.wantedReleaseId ? current.wantedReleaseId === entry.wantedReleaseId : current.mediaRequestId === entry.mediaRequestId)
        && isDeepStrictEqual(current.scope, entry.scope)))) throw refused();
      scopes.push(...context.operatorTrackScopes);
    }
    if (scopes.length === 0) return null;
    const catalog = await assertScopesCurrent(scopes, { queryable });
    if (!scopes.some(entry => entry.scope.mode === 'tracks')) return null;
    if (!Object.hasOwn(context ?? {}, 'operatorTrackScopes') || participants.some(entry => !entry.ownerId || !entry.scope)) throw refused();
    for (const participant of participants) {
      const current = await acquisitionStore.readCurrentConsent({ ownerId: participant.ownerId,
        metadataReleaseId: participant.scope.metadataReleaseId, queryable });
      if (current?.isMonitored !== true || current.isDisabled === true || !isDeepStrictEqual(participant.scope,
        buildOperatorTrackScope({ metadataReleaseId: participant.scope.metadataReleaseId, trackCatalog: catalog, trackOverrides: current.overrides }))) throw refused();
    }
    const requiredTracks = getOperatorTrackRequirements(scopes);
    let deliveryParticipants = null;
    if (requiredTracks.length === 2) {
      deliveryParticipants = await participantService.resolveParticipants({ participants, sourceRequestId: requestId,
        metadataReleaseId: requiredTracks[0].metadataReleaseId, queryable });
      await deliveryPlanService.assertRecipientsCurrent({ selection: { participants: deliveryParticipants }, queryable });
      if (Object.hasOwn(context, 'operatorTrackParticipants')
        && !isDeepStrictEqual(context.operatorTrackParticipants, deliveryParticipants)) throw refused();
      if (resolveParticipantsOnly) return deliveryParticipants;
      if (!isDeepStrictEqual(context.operatorTrackParticipants, deliveryParticipants)) throw refused();
    } else if (Object.hasOwn(context, 'operatorTrackParticipants')) throw refused();
    const files = candidate.files ?? await acquisitionStore.readFiles({ importCandidateId: candidate.id, queryable });
    const selection = selectOperatorTrackFiles({ ...candidate, files });
    if (!selection) throw refused();
    if (!isDeepStrictEqual(selection.scope.tracks, requiredTracks)) throw refused();
    if (deliveryParticipants) selection.participants = deliveryParticipants;
    selection.releaseMbid = await acquisitionStore.readReleaseMbid({ metadataReleaseId: selection.scope.metadataReleaseId, queryable });
    if (!selection.releaseMbid) throw refused();
    if (requestedFiles !== undefined) assertOperatorTrackManifest(selection, requestedFiles);
    if (applyPreview !== undefined) {
      if (applyPreview.files?.length !== selection.bindings.length) throw refused();
      for (const binding of selection.bindings) {
        const file = applyPreview.files.find(entry => entry.fileId === binding.fileId);
        if (!file || file.status?.code !== 'ready') throw refused();
        assertOperatorTrackMedia({ track: binding.track, inspection: file.inspection, releaseMbid: selection.releaseMbid });
      }
      if (selection.sharedDelivery) await deliveryPlanService.assertPreviewCurrent({ selection, files: applyPreview.files, queryable });
    }
    return selection;
  }
  async function resolveDiscoveryParticipants(claimedRequest, { queryable = null } = {}) {
    const links = claimedRequest.operatorLinks ?? [];
    return assertCandidateCurrent({ normalizedPayload: { requestOwnership: {
      sourceMediaRequestId: claimedRequest.evidence?.sourceMediaRequestId,
      sourceRequestedForUserId: claimedRequest.evidence?.sourceRequestedForUserId }, musicQueue: {
      wantedReleaseIds: links.map(link => link.wantedReleaseId),
      operatorTrackScopes: links.map(link => ({ wantedReleaseId: link.wantedReleaseId, scope: link.operatorTrackScope })),
      ...(Object.hasOwn(claimedRequest.evidence ?? {}, 'operatorTrackParticipants')
        ? { operatorTrackParticipants: claimedRequest.evidence.operatorTrackParticipants } : {}) } } }, { queryable, resolveParticipantsOnly: true });
  }
  async function assertCandidateIdCurrent(importCandidateId, options = {}) {
    const { queryable = null } = options;
    if (!uuid(importCandidateId)) return;
    const candidate = await acquisitionStore.readCandidate({ importCandidateId, queryable });
    if (!candidate) throw refused();
    return assertCandidateCurrent(candidate, options);
  }
  return { assertScopesCurrent, assertCandidateCurrent, assertCandidateIdCurrent, resolveDiscoveryParticipants };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createOperatorTrackAcquisitionStore } from './operator-track-acquisition-store.js';
import { refuseOperatorTrackFiles } from './operator-track-file-policy.js';

export function createOperatorTrackParticipantService({ store = createOperatorTrackAcquisitionStore() } = {}) {
  async function resolveParticipants({ participants, sourceRequestId, metadataReleaseId, queryable }) {
    const owners = new Map();
    for (const participant of participants) {
      const existing = owners.get(participant.ownerId);
      if (existing && !isDeepStrictEqual(existing.scope, participant.scope)) throw refuseOperatorTrackFiles();
      owners.set(participant.ownerId, { ...existing, ...participant,
        wantedReleaseId: participant.wantedReleaseId ?? existing?.wantedReleaseId });
    }
    if (owners.size !== 2 || [...owners.values()].some(owner => !owner.wantedReleaseId)
      || new Set([...owners.values()].map(owner => owner.scope.tracks[0].metadataTrackId)).size !== 2) throw refuseOperatorTrackFiles();
    const requests = await store.readParticipantRequests({ ownerIds: [...owners.keys()], metadataReleaseId, queryable });
    const result = [...owners.values()].map(owner => {
      const request = requests.find(row => row.requested_for_user_id === owner.ownerId
        && isDeepStrictEqual(row.evidence?.operatorArtistReconciliation?.operatorTrackScope, owner.scope));
      if (!request) throw refuseOperatorTrackFiles();
      return { ownerId: owner.ownerId, wantedReleaseId: owner.wantedReleaseId, mediaRequestId: request.id, scope: structuredClone(owner.scope) };
    }).sort((a, b) => a.ownerId.localeCompare(b.ownerId));
    if (!result.some(owner => owner.mediaRequestId === sourceRequestId)) throw refuseOperatorTrackFiles();
    return result;
  }
  return { resolveParticipants };
}

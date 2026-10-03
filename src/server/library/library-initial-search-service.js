/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { projectMusicQueueRelease } from '../acquisition/acquisition-pipeline-service.js';
import { canFindInitialMusicMatches, hasQueuedAutomaticSearch, hasRecordedInitialSearchIntent } from '../acquisition/acquisition-initial-search-policy.js';
import { createLibraryMusicQueueRediscoveryStore } from './library-music-queue-rediscovery-store.js';
import { createLibraryInitialSearchStore } from './library-initial-search-store.js';

export function createLibraryInitialSearchService({ assertMaintenanceWriteAllowed, getAppUserById, listWantedReleasesWithMetadata,
  initialSearchStore = createLibraryInitialSearchStore(), ownedReleaseStore = createLibraryMusicQueueRediscoveryStore(),
  lockAppUserEligibilityFn = lockAppUserEligibility, projectMusicQueueReleaseFn = projectMusicQueueRelease,
  recordAuditEventFn = recordAuditEvent, getNow = () => new Date(), withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, dependency] of Object.entries({ assertMaintenanceWriteAllowed, getAppUserById, listWantedReleasesWithMetadata,
    lockAppUserEligibilityFn, projectMusicQueueReleaseFn, recordAuditEventFn, getNow, withTransaction,
    recordInitialSearchIntent: initialSearchStore?.recordInitialSearchIntent, lockOwnedWantedRelease: ownedReleaseStore?.lockOwnedWantedRelease })) {
    if (typeof dependency !== 'function') throw new TypeError(`createLibraryInitialSearchService requires ${name}`);
  }
  async function requestInitialMusicSearch({ appUserId, metadataReleaseId, wantedReleaseId, requestedByUserId, requestMetadata = null }) {
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAppUserEligibilityFn({ userIds: [appUserId], queryable });
      const targetUser = await getAppUserById({ userId: appUserId, queryable });
      if (!targetUser || targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
      if (!await ownedReleaseStore.lockOwnedWantedRelease({ appUserId, metadataReleaseId, wantedReleaseId, queryable })) {
        throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
      }
      const [release] = await listWantedReleasesWithMetadata({ appUserId, wantedReleaseId, limit: 1, queryable });
      if (!release) throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
      if (hasRecordedInitialSearchIntent(release)) return { intentAlreadyRecorded: true, searchAlreadyQueued: hasQueuedAutomaticSearch(release) };
      const now = getNow();
      if (!canFindInitialMusicMatches({ release, targetUser, now, projectedRelease: projectMusicQueueReleaseFn(release) })) {
        throw createApiError(409, 'missing_music_initial_search_not_available', 'This release is not ready for an initial search');
      }
      if (!await initialSearchStore.recordInitialSearchIntent({ queryable, wantedReleaseId, requestedAt: now.toISOString(), requestedByUserId })) {
        throw createApiError(409, 'missing_music_initial_search_not_available', 'This release is not ready for an initial search');
      }
      await recordAuditEventFn({ actorType: 'user', actorUserId: requestedByUserId, eventType: 'missing_music_initial_search_requested',
        entityType: 'library_wanted_release', entityId: wantedReleaseId, summary: 'Initial search requested for a wanted release',
        details: { metadataReleaseId, requestedForUserId: appUserId }, ipAddress: requestMetadata?.ipAddress ?? null,
        userAgent: requestMetadata?.userAgent ?? null }, queryable);
      return { intentAlreadyRecorded: false, searchAlreadyQueued: true };
    });
  }
  return { requestInitialMusicSearch };
}

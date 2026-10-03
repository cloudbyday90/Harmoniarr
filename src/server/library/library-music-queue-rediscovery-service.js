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
import { canRequestMusicQueueRediscovery, isMusicQueueRediscoveryInProgress } from '../acquisition/acquisition-rediscovery-policy.js';
import { createLibraryMusicQueueRediscoveryStore } from './library-music-queue-rediscovery-store.js';

export function createLibraryMusicQueueRediscoveryService({
  assertMaintenanceWriteAllowed,
  getAppUserById,
  listWantedReleasesWithMetadata,
  lockAppUserEligibilityFn = lockAppUserEligibility,
  projectMusicQueueReleaseFn = projectMusicQueueRelease,
  recordAuditEventFn = recordAuditEvent,
  rediscoveryStore = createLibraryMusicQueueRediscoveryStore(),
  requestMusicQueueRediscovery,
  withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, dependency] of Object.entries({ assertMaintenanceWriteAllowed, getAppUserById,
    listWantedReleasesWithMetadata, lockAppUserEligibilityFn, projectMusicQueueReleaseFn,
    recordAuditEventFn, requestMusicQueueRediscovery, withTransaction,
    lockOwnedWantedRelease: rediscoveryStore?.lockOwnedWantedRelease,
    recordCoalescedTargetIntent: rediscoveryStore?.recordCoalescedTargetIntent })) {
    if (typeof dependency !== 'function') throw new TypeError(`createLibraryMusicQueueRediscoveryService requires ${name}`);
  }
  async function requestGuardedMusicQueueRediscovery({ appUserId, metadataReleaseId, requestMetadata = null, ...intent }) {
    return withTransaction(async (queryable) => {
      // Maintenance must precede account and domain locks throughout the app.
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAppUserEligibilityFn({ userIds: [appUserId], queryable });
      const target = await getAppUserById({ userId: appUserId, queryable });
      if (!target || target.isDisabled) {
        throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
      }
      const owned = await rediscoveryStore.lockOwnedWantedRelease({
        appUserId, metadataReleaseId, queryable, wantedReleaseId: intent.wantedReleaseId,
      });
      if (!owned) throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');

      const [release] = await listWantedReleasesWithMetadata({ appUserId, limit: 1, queryable, wantedReleaseId: intent.wantedReleaseId });
      if (!release) throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
      const alreadyQueued = isMusicQueueRediscoveryInProgress(release.discoveryRequest);
      if (!alreadyQueued && !canRequestMusicQueueRediscovery(projectMusicQueueReleaseFn(release)?.status?.code)) {
        throw createApiError(409, 'music_queue_retry_not_available', 'This release is not stopped in a state that can be searched again');
      }

      const result = await requestMusicQueueRediscovery({ metadataReleaseId, ...intent, queryable });
      if (!result) throw createApiError(409, 'music_queue_retry_not_available', 'This release could not be queued for another search');
      const recordedTargetIntent = result.restartDisposition === 'already_queued'
        ? await rediscoveryStore.recordCoalescedTargetIntent({
          ...intent, queryable, requestedAt: result.discoveryRequest.evidence.musicQueueRediscovery.requestedAt,
        })
        : true;
      if (recordedTargetIntent) {
        await recordAuditEventFn({
          actorType: intent.requestedByUserId ? 'user' : 'system',
          actorUserId: intent.requestedByUserId,
          eventType: 'missing_music_search_again_requested',
          entityType: 'library_wanted_release',
          entityId: intent.wantedReleaseId,
          summary: 'Another search requested for a wanted release',
          details: { metadataReleaseId, requestedForUserId: appUserId, restartAlreadyQueued: result.restartDisposition === 'already_queued' },
          ipAddress: requestMetadata?.ipAddress ?? null,
          userAgent: requestMetadata?.userAgent ?? null,
        }, queryable);
      }
      return result;
    });
  }

  return { requestGuardedMusicQueueRediscovery };
}

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
import { canAllowAcquisitionFallbackQuality, isScopedQualityFallbackOverride } from '../acquisition/acquisition-quality-evidence-policy.js';
import { isMusicQueueRediscoveryInProgress } from '../acquisition/acquisition-rediscovery-policy.js';
import { createLibraryMusicQueueRediscoveryStore } from './library-music-queue-rediscovery-store.js';

export function createLibraryFallbackQualityService({ allowMusicQueueFallbackQuality,
  assertMaintenanceWriteAllowed, getAppUserById, listWantedReleasesWithMetadata,
  lockAppUserEligibilityFn = lockAppUserEligibility, ownedReleaseStore = createLibraryMusicQueueRediscoveryStore(),
  projectMusicQueueReleaseFn = projectMusicQueueRelease, recordAuditEventFn = recordAuditEvent,
  withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, dependency] of Object.entries({ allowMusicQueueFallbackQuality, assertMaintenanceWriteAllowed,
    getAppUserById, listWantedReleasesWithMetadata, lockAppUserEligibilityFn, projectMusicQueueReleaseFn,
    recordAuditEventFn, withTransaction, lockOwnedWantedRelease: ownedReleaseStore?.lockOwnedWantedRelease })) {
    if (typeof dependency !== 'function') throw new TypeError(`createLibraryFallbackQualityService requires ${name}`);
  }
  async function allowGuardedMusicQueueFallbackQuality({ appUserId, metadataReleaseId, requestMetadata = null, ...intent }) {
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAppUserEligibilityFn({ userIds: [appUserId], queryable });
      const target = await getAppUserById({ userId: appUserId, queryable });
      if (!target || target.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
      if (!await ownedReleaseStore.lockOwnedWantedRelease({ appUserId, metadataReleaseId, queryable, wantedReleaseId: intent.wantedReleaseId })) {
        throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
      }
      const [release] = await listWantedReleasesWithMetadata({ appUserId, limit: 1, queryable, wantedReleaseId: intent.wantedReleaseId });
      if (!release) throw createApiError(404, 'missing_music_decision_not_found', 'Missing Music release was not found');
      if (isScopedQualityFallbackOverride(release.discoveryQualityOverride, intent.wantedReleaseId)) {
        return { discoveryRequest: release.discoveryRequest, overrideAlreadyAllowed: true,
          restartAlreadyQueued: isMusicQueueRediscoveryInProgress(release.discoveryRequest) };
      }
      const projected = projectMusicQueueReleaseFn(release);
      if (!canAllowAcquisitionFallbackQuality(projected)) {
        throw createApiError(409, 'music_queue_fallback_not_available', 'This release is not waiting for an eligible fallback quality choice');
      }
      const result = await allowMusicQueueFallbackQuality({ metadataReleaseId, ...intent,
        priorQualityProfile: projected.quality.profile.code, queryable });
      if (!result) throw createApiError(409, 'music_queue_fallback_not_available', 'Fallback quality could not be saved for this release');
      await recordAuditEventFn({ actorType: intent.allowedByUserId ? 'user' : 'system', actorUserId: intent.allowedByUserId,
        eventType: 'missing_music_fallback_quality_allowed', entityType: 'library_wanted_release', entityId: intent.wantedReleaseId,
        summary: 'Fallback quality allowed for a wanted release',
        details: { metadataReleaseId, requestedForUserId: appUserId, priorQualityProfile: projected.quality.profile.code },
        ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null,
      }, queryable);
      return { discoveryRequest: result, overrideAlreadyAllowed: false, restartAlreadyQueued: false };
    });
  }
  return { allowGuardedMusicQueueFallbackQuality };
}

/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createArtworkCleanupRunStore } from './artwork-cleanup-run-store.js';
import { calculateArtworkCleanupCutoff } from './artwork-cleanup-service.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { getArtworkCleanupSnapshot } from './artwork-repository.js';

function buildSummary({ latestRun, snapshot }) {
  if (latestRun?.status === 'running') {
    return {
      status: 'running',
      message: 'An artwork cleanup run is currently removing retention-eligible assets.',
    };
  }

  if (latestRun?.status === 'pending') {
    return {
      status: 'pending',
      message: 'An artwork cleanup run has been queued but has not started yet.',
    };
  }

  if (snapshot.eligibleAssetCount > 0) {
    return {
      status: 'ready',
      message: `${snapshot.eligibleAssetCount} unassigned artwork asset${snapshot.eligibleAssetCount === 1 ? ' is' : 's are'} eligible for retention cleanup now.`,
    };
  }

  if (snapshot.unassignedAssetCount > 0) {
    return {
      status: 'waiting',
      message: `${snapshot.unassignedAssetCount} unassigned artwork asset${snapshot.unassignedAssetCount === 1 ? ' is' : 's are'} being retained until the cleanup cutoff is reached.`,
    };
  }

  if (!latestRun) {
    return {
      status: 'empty',
      message: 'No unassigned artwork assets are currently waiting for cleanup.',
    };
  }

  if (latestRun.status === 'completed') {
    return {
      status: 'completed',
      message: latestRun.deletedAssetCount == null
        ? 'The latest artwork cleanup run completed successfully.'
        : `The latest artwork cleanup run deleted ${latestRun.deletedAssetCount} asset${latestRun.deletedAssetCount === 1 ? '' : 's'}.`,
    };
  }

  return {
    status: 'failed',
    message: latestRun.errorMessage
      ? `The latest artwork cleanup run failed: ${latestRun.errorMessage}`
      : 'The latest artwork cleanup run did not complete successfully.',
  };
}

export function createArtworkSummaryService({
  artworkCleanupRunStore = createArtworkCleanupRunStore(),
  artworkPolicyService = createArtworkPolicyService(),
  getArtworkCleanupSnapshotFn = getArtworkCleanupSnapshot,
  nowFn = () => new Date(),
} = {}) {
  async function buildArtworkSummary() {
    const checkedAt = nowFn().toISOString();
    const policy = await artworkPolicyService.getArtworkRuntimePolicy();
    const retentionDays = policy.cleanup?.unassignedRetentionDays ?? 90;
    const retentionCutoff = calculateArtworkCleanupCutoff({
      now: nowFn(),
      retentionDays,
    });
    const [latestRun, snapshot] = await Promise.all([
      artworkCleanupRunStore.getLatestRun(),
      getArtworkCleanupSnapshotFn({ unassignedBefore: retentionCutoff }),
    ]);

    return {
      checkedAt,
      cleanup: {
        retentionCutoff,
        unassignedRetentionDays: retentionDays,
      },
      inventory: snapshot,
      latestRun,
      summary: buildSummary({ latestRun, snapshot }),
    };
  }

  return {
    buildArtworkSummary,
  };
}
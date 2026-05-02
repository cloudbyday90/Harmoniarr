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

import { createMetadataMonitoringStore } from './metadata-monitoring-store.js';
import { createMetadataRefreshSchedulingPolicyService } from './metadata-refresh-scheduling-policy-service.js';

export function createMetadataRefreshSchedulerService({
  getMetadataArtist = async () => null,
  metadataMonitoringStore = createMetadataMonitoringStore(),
  metadataRefreshSchedulingPolicyService = createMetadataRefreshSchedulingPolicyService(),
} = {}) {
  async function ensureArtistRefreshScheduled({ metadataArtistId, now } = {}) {
    const schedule = metadataRefreshSchedulingPolicyService.buildInitialSchedule({ now });
    await metadataMonitoringStore.scheduleArtistRefresh({
      metadataArtistId,
      nextRefreshAt: schedule.nextRefreshAt,
    });

    return schedule;
  }

  async function clearArtistRefreshSchedule({ metadataArtistId } = {}) {
    await metadataMonitoringStore.clearArtistRefreshSchedule({ metadataArtistId });
  }

  async function getNextDueArtist({ limit = 1, now } = {}) {
    const artists = await metadataMonitoringStore.listArtistsDueForRefresh({ limit, now });
    return artists[0] ?? null;
  }

  async function recordArtistRefreshCompleted({ metadataArtistId, refreshedAt } = {}) {
    const monitoring = await metadataMonitoringStore.getArtistMonitoring(metadataArtistId);
    if (!monitoring?.isMonitored) {
      await metadataMonitoringStore.clearArtistRefreshSchedule({ metadataArtistId });
      return null;
    }

    const artist = await getMetadataArtist({ artistId: metadataArtistId });

    const schedule = metadataRefreshSchedulingPolicyService.buildNextSchedule({
      monitoredReleaseGroupTypes: monitoring.monitoredReleaseGroupTypes,
      refreshedAt,
      releaseGroups: artist?.releaseGroups ?? [],
    });
    await metadataMonitoringStore.recordArtistRefresh({
      lastRefreshedAt: schedule.lastRefreshedAt,
      metadataArtistId,
      nextRefreshAt: schedule.nextRefreshAt,
    });

    return schedule;
  }

  return {
    clearArtistRefreshSchedule,
    ensureArtistRefreshScheduled,
    getNextDueArtist,
    recordArtistRefreshCompleted,
  };
}
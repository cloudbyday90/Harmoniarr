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

import { createMetadataReleaseDetectionStore } from './metadata-release-detection-store.js';

const defaultRetentionDays = 180;
const defaultRetainedEventsPerArtist = 250;

export function createMetadataReleaseDetectionRetentionService({
  metadataReleaseDetectionStore = createMetadataReleaseDetectionStore(),
  nowFn = () => new Date(),
  retainedEventsPerArtist = defaultRetainedEventsPerArtist,
  retentionDays = defaultRetentionDays,
} = {}) {
  async function applyRetentionPolicy({ metadataArtistId } = {}) {
    const cutoffDate = new Date(nowFn());
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays);
    const deleteEventsOlderThan = metadataReleaseDetectionStore?.deleteEventsOlderThan;
    const trimEventsForArtist = metadataReleaseDetectionStore?.trimEventsForArtist;

    const [deletedOlderThanCount, trimmedArtistCount] = await Promise.all([
      retentionDays > 0 && typeof deleteEventsOlderThan === 'function'
        ? deleteEventsOlderThan({ olderThan: cutoffDate.toISOString() })
        : Promise.resolve(0),
      retainedEventsPerArtist > 0 && metadataArtistId && typeof trimEventsForArtist === 'function'
        ? trimEventsForArtist({
          metadataArtistId,
          retainCount: retainedEventsPerArtist,
        })
        : Promise.resolve(0),
    ]);

    return {
      deletedOlderThanCount,
      trimmedArtistCount,
    };
  }

  return {
    applyRetentionPolicy,
  };
}
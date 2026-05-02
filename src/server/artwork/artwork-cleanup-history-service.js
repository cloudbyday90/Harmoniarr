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

function normalizeHistoryLimit(limit) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 5;
  }

  return Math.min(parsed, 10);
}

export function createArtworkCleanupHistoryService({
  artworkCleanupRunStore = createArtworkCleanupRunStore(),
  nowFn = () => new Date(),
} = {}) {
  async function buildArtworkCleanupHistory({ limit } = {}) {
    return {
      checkedAt: nowFn().toISOString(),
      runs: await artworkCleanupRunStore.listRecentRuns({
        limit: normalizeHistoryLimit(limit),
      }),
    };
  }

  return {
    buildArtworkCleanupHistory,
  };
}
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

import { createApiError } from '../auth.js';
import { createArtworkCleanupRunStore } from './artwork-cleanup-run-store.js';

export function createArtworkCleanupDetailService({
  artworkCleanupRunStore = createArtworkCleanupRunStore(),
  nowFn = () => new Date(),
} = {}) {
  async function buildArtworkCleanupRunDetail({ runId }) {
    const run = await artworkCleanupRunStore.getRunById(runId);

    if (!run) {
      throw createApiError(404, 'artwork_cleanup_run_not_found', 'Artwork cleanup run not found');
    }

    return {
      checkedAt: nowFn().toISOString(),
      run,
    };
  }

  return {
    buildArtworkCleanupRunDetail,
  };
}
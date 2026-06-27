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

import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';

export function createLibraryReleasesService({
  libraryReleaseReconciliationStore = createLibraryReleaseReconciliationStore(),
} = {}) {
  async function buildLibraryReleases({
    appUserId = null,
    reconciliationStatus = null,
    limit = 500,
    visibilityState = 'visible',
  } = {}) {
    const checkedAt = new Date().toISOString();
    const releases = await libraryReleaseReconciliationStore.listLibraryReleasesWithMetadata({
      appUserId,
      reconciliationStatus,
      limit,
      visibilityState,
    });

    return {
      checkedAt,
      total: releases.length,
      releases,
    };
  }

  async function buildLibraryFilterOptions() {
    return libraryReleaseReconciliationStore.getFilterOptions();
  }

  return {
    buildLibraryFilterOptions,
    buildLibraryReleases,
  };
}

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

import { createLibraryWantedSummaryStore } from './library-wanted-summary-store.js';
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';

function buildSummary({ monitoredArtistCount, releaseCounts }) {
  if (monitoredArtistCount === 0) {
    return {
      message: 'No monitored artists are contributing to wanted reconciliation yet.',
      status: 'empty',
    };
  }

  if (releaseCounts.totalWanted === 0) {
    return {
      message: 'All monitored album and EP releases are currently satisfied by the library.',
      status: 'complete',
    };
  }

  if (releaseCounts.missing > 0 && releaseCounts.partial > 0) {
    return {
      message: `${releaseCounts.totalWanted} monitored release${releaseCounts.totalWanted === 1 ? '' : 's'} still need files, including fully missing and partially satisfied releases.`,
      status: 'wanted',
    };
  }

  if (releaseCounts.missing > 0) {
    return {
      message: `${releaseCounts.missing} monitored release${releaseCounts.missing === 1 ? '' : 's'} are fully missing from the current library.`,
      status: 'wanted',
    };
  }

  return {
    message: `${releaseCounts.partial} monitored release${releaseCounts.partial === 1 ? '' : 's'} are only partially satisfied by the current library.`,
    status: 'partial',
  };
}

export function createLibraryWantedSummaryService({
  libraryWantedReleaseStore = createLibraryWantedReleaseStore(),
  libraryWantedSummaryStore = createLibraryWantedSummaryStore(),
} = {}) {
  async function buildLibraryWantedReleases({
    includeDiscoveryRequestDetails = false,
    limit = 500,
    wantedStatus = null,
  } = {}) {
    const checkedAt = new Date().toISOString();
    const releases = await libraryWantedReleaseStore.listWantedReleasesWithMetadata({ limit, wantedStatus });

    return {
      checkedAt,
      total: releases.length,
      wantedReleases: includeDiscoveryRequestDetails
        ? releases
        : releases.map((release) => {
            const publicRelease = { ...release };
            delete publicRelease.discoveryRequest;
            return publicRelease;
          }),
    };
  }

  async function buildLibraryWantedSummary() {
    const checkedAt = new Date().toISOString();
    const snapshot = await libraryWantedSummaryStore.getLibraryWantedSnapshot();

    return {
      checkedAt,
      lastReconciledAt: snapshot.lastReconciledAt,
      monitoredArtistCount: snapshot.monitoredArtistCount,
      releaseCounts: snapshot.releaseCounts,
      summary: buildSummary(snapshot),
    };
  }

  return {
    buildLibraryWantedReleases,
    buildLibraryWantedSummary,
  };
}

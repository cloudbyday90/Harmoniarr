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

import { createLibraryDiscoverySummaryStore } from './library-discovery-summary-store.js';
import { createLibraryDiscoveryRunStore } from './library-discovery-run-store.js';
import { resolveLibraryDiscoveryHeartbeatConfig } from './library-discovery-heartbeat-config.js';
import { createLibraryDiscoveryHeartbeatState } from './library-discovery-heartbeat-state.js';

function buildSummary({ requestCounts }) {
  if (requestCounts.totalRequests === 0) {
    return {
      message: 'No discovery requests are queued from current wanted releases yet.',
      status: 'empty',
    };
  }

  if (requestCounts.ready > 0) {
    return {
      message: `${requestCounts.ready} discovery request${requestCounts.ready === 1 ? '' : 's'} are ready to search now.`,
      status: 'ready',
    };
  }

  if (requestCounts.cooldown > 0) {
    return {
      message: `${requestCounts.cooldown} discovery request${requestCounts.cooldown === 1 ? ' is' : 's are'} waiting for automatic cooldown expiry.`,
      status: 'cooldown',
    };
  }

  return {
    message: `${requestCounts.blocked} discovery request${requestCounts.blocked === 1 ? ' is' : 's are'} blocked by release-date policy.`,
    status: 'blocked',
  };
}

export function createLibraryDiscoverySummaryService({
  libraryDiscoveryHeartbeatConfig = resolveLibraryDiscoveryHeartbeatConfig(),
  libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState(),
  libraryDiscoveryRunStore = createLibraryDiscoveryRunStore(),
  libraryDiscoverySummaryStore = createLibraryDiscoverySummaryStore(),
} = {}) {
  async function buildLibraryDiscoverySummary() {
    const checkedAt = new Date().toISOString();
    const [snapshot, latestRun] = await Promise.all([
      libraryDiscoverySummaryStore.getLibraryDiscoverySnapshot(),
      libraryDiscoveryRunStore.getLatestRun(),
    ]);

    return {
      checkedAt,
      heartbeat: {
        ...libraryDiscoveryHeartbeatConfig,
        state: libraryDiscoveryHeartbeatState.getHeartbeatState(),
      },
      lastEvaluatedAt: snapshot.lastEvaluatedAt,
      latestRun,
      nextEligibleAt: snapshot.nextEligibleAt,
      requestCounts: snapshot.requestCounts,
      summary: buildSummary(snapshot),
    };
  }

  return {
    buildLibraryDiscoverySummary,
  };
}
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

import { getPool } from '../database.js';
import { createMetadataArtistDiscographyService } from './metadata-artist-discography-service.js';
import { createOperatorArtistDiscographyStore } from './operator-artist-discography-store.js';
import { buildOperatorArtistEffectiveReleaseGroups } from './operator-artist-effective-state.js';
import { defaultOperatorArtistMonitoringPolicy } from './operator-artist-monitoring-policy.js';

export function createOperatorArtistDiscographyService({
  getPoolFn = getPool,
  catalogService = createMetadataArtistDiscographyService({ getPoolFn }),
  store = createOperatorArtistDiscographyStore({ getPoolFn }),
} = {}) {
  async function getOperatorArtistDiscography({ appUserId, ...pageOptions } = {}) {
    if (typeof appUserId !== 'string' || !appUserId.trim()) {
      throw Object.assign(new Error('An authenticated operator is required'), { status: 401, code: 'unauthorized' });
    }
    const page = await catalogService.getArtistDiscography(pageOptions);
    if (page.releaseGroups.length === 0) return page;
    const state = await store.readPageState({
      appUserId, metadataArtistId: pageOptions.metadataArtistId,
      releaseGroupIds: page.releaseGroups.map(({ id }) => id),
    });
    const { effectiveReleaseGroups } = buildOperatorArtistEffectiveReleaseGroups({
      ...state,
      monitoredReleaseGroupTypes: state.monitoredReleaseGroupTypes ?? defaultOperatorArtistMonitoringPolicy.monitoredReleaseGroupTypes,
      releaseGroups: page.releaseGroups,
    });
    // A page cannot determine artist-wide orphans, coverage, or saved draft state.
    return { releaseGroups: effectiveReleaseGroups, pageInfo: page.pageInfo };
  }
  return { getOperatorArtistDiscography };
}

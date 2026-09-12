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

import { createActivityEventStore } from '../activity/activity-event-store.js';

/** Required artist Activity shares the caller's save transaction and must not swallow failures. */
export function createOperatorArtistActivityService({ activityEventStore = createActivityEventStore() } = {}) {
  async function recordSaveActivity({ client, actorUserId, artist, becameMonitored, policyChangeSummary, triggerSource }) {
    if (!client || typeof client.query !== 'function') throw new TypeError('Artist Activity requires a transaction client');
    const common = {
      actorUserId,
      entityId: artist.id,
      entityTitle: artist.name ?? null,
      entityType: 'artist',
      queryable: client,
    };
    if (policyChangeSummary.hasChanges) {
      await activityEventStore.insertActivityEvent({
        ...common,
        eventType: 'artist_policy_saved',
        extraPayload: {
          ...policyChangeSummary,
          artistMusicBrainzId: artist.musicBrainzArtistId,
          triggerSource,
        },
      });
    }
    if (becameMonitored) {
      await activityEventStore.insertActivityEvent({ ...common, eventType: 'artist_monitored' });
    }
  }
  return { recordSaveActivity };
}

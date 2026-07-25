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

import { normalizeReleaseActivityPresentation } from '../../shared/release-activity-presentation.js';
import { getArtistPolicyActivityRouteTarget } from './artist-policy-activity-presentation.js';
import { buildOperationRunLinkTargetFromReleasePresentation } from './operation-run-link-targets.js';

export function buildActivityEventLinkTarget(event = {}) {
  if (event.eventType === 'artist_policy_saved') {
    return getArtistPolicyActivityRouteTarget(event.extraPayload ?? {});
  }

  if ([
    'music_queue_quality_blocked',
    'quality_fallback_allowed',
    'music_queue_search_queued',
    'music_queue_download_retrying',
    'music_queue_match_retrying',
    'music_queue_no_matches_left',
    'music_queue_download_failed',
  ].includes(event.eventType)) {
    const wantedReleaseId = event.extraPayload?.wantedReleaseId
      ?? (event.entityType === 'wanted_release' ? event.entityId : null);
    return wantedReleaseId
      ? {
          label: event.eventType === 'music_queue_quality_blocked'
            ? 'Review quality choice'
            : 'Open Music Queue',
          to: {
            name: 'music-queue-release',
            params: { wantedReleaseId },
          },
        }
      : null;
  }

  if (event.eventType !== 'release_added') {
    return null;
  }

  return buildOperationRunLinkTargetFromReleasePresentation(
    event.releasePresentation
    ?? normalizeReleaseActivityPresentation({
      entityArtist: event.entityArtist ?? null,
      entityTitle: event.entityTitle ?? null,
      extraPayload: event.extraPayload ?? null,
    }),
  );
}

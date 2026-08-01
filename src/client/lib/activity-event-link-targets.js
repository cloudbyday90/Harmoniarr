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

import { getArtistPolicyActivityRouteTarget } from './artist-policy-activity-presentation.js';
import {
  SETTINGS_RECOVERY_CONTEXT,
  buildSettingsRecoveryHandoffLocation,
  createSettingsRecoveryContext,
} from './settings-recovery-handoff.js';

export function buildActivityEventLinkTarget(event = {}) {
  if (event.eventType === 'artist_policy_saved') {
    return getArtistPolicyActivityRouteTarget(event.extraPayload ?? {});
  }

  if ([
    'music_queue_quality_blocked',
    'quality_fallback_allowed',
    'music_queue_match_selected',
    'music_queue_download_started',
    'music_queue_audio_checked',
    'music_queue_audio_warning',
    'music_queue_search_queued',
    'music_queue_search_started',
    'music_queue_download_retrying',
    'music_queue_match_retrying',
    'music_queue_no_matches_left',
    'music_queue_download_failed',
    'music_queue_import_blocked',
    'download_completed',
  ].includes(event.eventType)) {
    const wantedReleaseId = event.extraPayload?.wantedReleaseId
      ?? (event.entityType === 'wanted_release' ? event.entityId : null);
    return wantedReleaseId
      ? {
          label: event.eventType === 'music_queue_quality_blocked'
            || event.eventType === 'music_queue_audio_warning'
            ? 'Review quality choice'
            : event.eventType === 'music_queue_import_blocked'
              ? 'Review what needs fixing'
            : 'Open Music Queue',
          to: {
            name: 'music-queue-release',
            params: { wantedReleaseId },
          },
        }
      : null;
  }

  if (event.eventType === 'music_queue_audio_check_failed') {
    const wantedReleaseId = event.extraPayload?.wantedReleaseId
      ?? (event.entityType === 'wanted_release' ? event.entityId : null);
    return {
      label: 'Check connections',
      to: buildSettingsRecoveryHandoffLocation({
        recoveryContext: createSettingsRecoveryContext({
          context: wantedReleaseId
            ? SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE
            : SETTINGS_RECOVERY_CONTEXT.ACTIVITY_TIMELINE,
          wantedReleaseId,
        }),
        routeName: 'settings-connections',
      }),
    };
  }

  if (event.eventType === 'release_added') {
    return {
      label: 'Open Library',
      to: { name: 'library' },
    };
  }

  const requestId = event.extraPayload?.sourceMediaRequestId
    ?? (event.entityType === 'media_request' ? event.entityId : null);
  if (event.eventType === 'request_fulfilled' && typeof requestId === 'string' && requestId.trim()) {
    return {
      label: 'Open request',
      to: {
        name: 'request-detail',
        params: { id: requestId.trim() },
      },
    };
  }

  return null;
}

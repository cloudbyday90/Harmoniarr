-- forward-only migration
BEGIN;

-- Use DEFAULT harmoniarr_generate_uuid() for UUID surrogate primary keys.

COMMIT;
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

ALTER TABLE activity_events
  DROP CONSTRAINT IF EXISTS activity_events_event_type_check;

ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_event_type_check
  CHECK (event_type IN (
    'request_created',
    'download_completed',
    'release_added',
    'request_fulfilled',
    'artist_monitored',
    'artist_policy_saved',
    'quality_fallback_allowed',
    'music_queue_quality_blocked',
    'music_queue_search_queued',
    'music_queue_download_retrying',
    'music_queue_match_retrying',
    'music_queue_no_matches_left',
    'music_queue_download_failed',
    'music_queue_match_selected',
    'music_queue_download_started',
    'music_queue_audio_checked',
    'music_queue_audio_warning',
    'music_queue_audio_check_failed'
  ));

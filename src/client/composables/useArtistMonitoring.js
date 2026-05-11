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

import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  importMusicBrainzArtist,
  updateMetadataArtistMonitoring,
} from '../lib/metadata-api.js';
import { useToast } from './useToast.js';

/**
 * Reusable composable for the artist import + monitor workflow.
 *
 * Tracks which artists are currently being monitored (in-progress) and which
 * have been successfully monitored (complete). Uses reactive Sets so that
 * multiple screens can share the same monitoring pattern without duplicating
 * the import/monitor API sequence or toast feedback.
 *
 * @param {object} [options]
 * @param {string[]} [options.initialMonitoredIds] - MusicBrainz artist IDs to
 *   treat as already monitored at construction time. Must be MusicBrainz IDs
 *   (not local metadata artist IDs), matching the IDs used by `monitorArtist`.
 * @param {boolean} [options.showToasts] - When true (default), success/error
 *   toasts are shown automatically.
 * @param {function} [options.importArtist] - Override for testing.
 * @param {function} [options.updateMonitoring] - Override for testing.
 * @param {object} [options.toast] - Override for testing.
 */
export function useArtistMonitoring({
  initialMonitoredIds = [],
  showToasts = true,
  importArtist = importMusicBrainzArtist,
  updateMonitoring = updateMetadataArtistMonitoring,
  toast = useToast(),
} = {}) {

  /**
   * Set of MusicBrainz artist IDs that have been successfully monitored.
   * Reassigned (not mutated) on each update to ensure Vue reactivity.
   */
  const monitoredIds = ref(new Set(initialMonitoredIds));

  /**
   * Set of MusicBrainz artist IDs for which a monitor operation is currently
   * in progress. Reassigned (not mutated) on each update.
   */
  const monitoringIds = ref(new Set());

  /** Whether at least one artist has been successfully monitored. */
  const hasMonitored = computed(() => monitoredIds.value.size > 0);

  /**
   * Returns true if the given MusicBrainz artist ID is monitored.
   * @param {string} artistId
   */
  function isMonitored(artistId) {
    return monitoredIds.value.has(artistId);
  }

  /**
   * Returns true if a monitor operation is currently in progress for the given
   * MusicBrainz artist ID.
   * @param {string} artistId
   */
  function isMonitoring(artistId) {
    return monitoringIds.value.has(artistId);
  }

  /**
   * Import then monitor a MusicBrainz artist.
   *
   * 1. Adds the artist ID to `monitoringIds`.
   * 2. Calls `importArtist(mbid)` to upsert the artist locally.
   * 3. Calls `updateMonitoring(localId, { isMonitored: true })`.
   * 4. Moves the ID from `monitoringIds` to `monitoredIds`.
   * 5. Optionally shows a success/error toast.
   *
   * Returns `{ success: true }` or `{ success: false, error }`.
   *
   * @param {{ id: string, name: string }} artist
   */
  async function monitorArtist(artist) {
    const { id, name } = artist;

    // Prevent duplicate or redundant calls.
    if (monitoringIds.value.has(id) || monitoredIds.value.has(id)) {
      return { success: false, error: new Error('Already monitoring or monitored.') };
    }

    // Mark as in-progress (reassign to trigger reactivity).
    monitoringIds.value = new Set([...monitoringIds.value, id]);

    try {
      const importResult = await importArtist(id);
      const localArtistId = importResult?.imported?.artistId ?? null;

      if (!localArtistId) {
        throw new Error(`Could not resolve local ID for ${name} after import.`);
      }

      await updateMonitoring(localArtistId, { isMonitored: true });

      // Move from in-progress to complete (reassign both for reactivity).
      const nextMonitoring = new Set(monitoringIds.value);
      nextMonitoring.delete(id);
      monitoringIds.value = nextMonitoring;

      monitoredIds.value = new Set([...monitoredIds.value, id]);

      if (showToasts) {
        toast.success(`Monitoring ${name}.`);
      }

      return { success: true };
    } catch (error) {
      const nextMonitoring = new Set(monitoringIds.value);
      nextMonitoring.delete(id);
      monitoringIds.value = nextMonitoring;

      if (showToasts) {
        toast.error(getErrorMessage(error, `Could not monitor ${name}. Please try again.`));
      }

      return { success: false, error };
    }
  }

  return {
    monitoredIds,
    monitoringIds,
    hasMonitored,
    isMonitored,
    isMonitoring,
    monitorArtist,
  };
}

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
  buildOperatorArtistDraftFromAddPolicy,
  defaultAddArtistPolicyForm,
  normalizeAddArtistPolicyForm,
} from '../lib/add-artist-policy.js';
import {
  importMusicBrainzArtist,
  saveOperatorArtistDraft,
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
 * Monitoring is consolidated onto the canonical operator-scoped save surface
 * (`addArtistWithPolicy`): import the MusicBrainz artist, then save an
 * operator draft with the chosen policy.
 *
 * @param {object} [options]
 * @param {string[]} [options.initialMonitoredIds] - MusicBrainz artist IDs to
 *   treat as already monitored at construction time. Must be MusicBrainz IDs
 *   (not local metadata artist IDs), matching the IDs used by `addArtistWithPolicy`.
 * @param {boolean} [options.showToasts] - When true (default), success/error
 *   toasts are shown automatically.
 * @param {function} [options.importArtist] - Override for testing.
 * @param {function} [options.saveOperatorArtist] - Override for testing.
 * @param {object} [options.toast] - Override for testing.
 */
export function useArtistMonitoring({
  initialMonitoredIds = [],
  showToasts = true,
  importArtist = importMusicBrainzArtist,
  saveOperatorArtist = saveOperatorArtistDraft,
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
   * Import a MusicBrainz artist then save an operator-scoped monitoring draft
   * with the chosen policy.
   *
   * 1. Adds the artist ID to `monitoringIds`.
   * 2. Calls `importArtist(mbid)` to upsert the artist locally.
   * 3. Builds an operator draft from the normalized policy and calls
   *    `saveOperatorArtist(localId, draft)`.
   * 4. Moves the ID from `monitoringIds` to `monitoredIds`.
   * 5. Optionally shows a success/error toast.
   *
   * Returns `{ success: true, ... }` or `{ success: false, error }`.
   *
   * @param {{ id: string, name: string }} artist
   * @param {object} [policyForm]
   * @returns {Promise<object>}
   */
  async function addArtistWithPolicy(artist, policyForm = defaultAddArtistPolicyForm) {
    const { id, name } = artist;

    if (monitoringIds.value.has(id) || monitoredIds.value.has(id)) {
      return { success: false, error: new Error('Already adding or monitored.') };
    }

    monitoringIds.value = new Set([...monitoringIds.value, id]);

    try {
      const normalizedPolicy = normalizeAddArtistPolicyForm(policyForm);
      const importResult = await importArtist(id);
      const localArtistId = importResult?.imported?.artistId ?? null;

      if (!localArtistId) {
        throw new Error(`Could not resolve local ID for ${name} after import.`);
      }

      const draft = buildOperatorArtistDraftFromAddPolicy(normalizedPolicy);
      const saveResult = await saveOperatorArtist(localArtistId, draft);

      const nextMonitoring = new Set(monitoringIds.value);
      nextMonitoring.delete(id);
      monitoringIds.value = nextMonitoring;

      monitoredIds.value = new Set([...monitoredIds.value, id]);

      if (showToasts) {
        toast.success(`Added ${name} to monitored artists.`);
      }

      return {
        draft,
        localArtistId,
        policy: normalizedPolicy,
        saveResult,
        success: true,
      };
    } catch (error) {
      const nextMonitoring = new Set(monitoringIds.value);
      nextMonitoring.delete(id);
      monitoringIds.value = nextMonitoring;

      if (showToasts) {
        toast.error(getErrorMessage(error, `Could not add ${name}. Please try again.`));
      }

      return { success: false, error };
    }
  }

  return {
    addArtistWithPolicy,
    monitoredIds,
    monitoringIds,
    hasMonitored,
    isMonitored,
    isMonitoring,
  };
}

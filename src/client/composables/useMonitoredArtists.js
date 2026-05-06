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

import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchMonitoredArtists as defaultFetchMonitoredArtists } from '../lib/metadata-api.js';

/**
 * Composable that loads the current user's monitored artists from the local
 * metadata store.
 *
 * Returns an artwork-ready artist list suitable for rendering with ArtistCard.
 * All artists in the result are already monitored (`monitored: true`).
 *
 * @param {object} [options]
 * @param {number} [options.limit=25] - Maximum number of artists to load.
 * @param {function} [options.fetchArtists] - Override for testing.
 */
export function useMonitoredArtists({
  limit = 25,
  fetchArtists = defaultFetchMonitoredArtists,
} = {}) {
  const artists = ref([]);
  const errorMessage = ref('');
  const isLoading = ref(true);

  async function loadMonitoredArtists() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchArtists({ limit });
      artists.value = Array.isArray(payload?.results) ? payload.results : [];
    } catch (error) {
      artists.value = [];
      errorMessage.value = getErrorMessage(error, 'Could not load your monitored artists.');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    artists,
    errorMessage,
    isLoading,
    loadMonitoredArtists,
  };
}

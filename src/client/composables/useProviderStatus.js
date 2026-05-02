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
import { fetchProviderStatus } from '../lib/provider-api.js';

export function useProviderStatus({
  fetchStatus = fetchProviderStatus,
} = {}) {
  const status = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);

  const spotify = computed(() => status.value?.spotify ?? null);
  const youtube = computed(() => status.value?.youtube ?? null);
  const appleMusic = computed(() => status.value?.appleMusic ?? null);

  const spotifyLinked = computed(() => spotify.value?.linked === true);
  const youtubeLinked = computed(() => youtube.value?.linked === true);
  const appleMusicConfigured = computed(() => appleMusic.value?.configured === true);

  async function loadStatus() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      status.value = await fetchStatus();
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Provider status failed');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    appleMusic,
    appleMusicConfigured,
    errorMessage,
    isLoading,
    loadStatus,
    spotify,
    spotifyLinked,
    status,
    youtube,
    youtubeLinked,
  };
}

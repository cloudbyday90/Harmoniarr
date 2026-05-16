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
  searchMusicBrainzArtists as defaultSearchArtists,
  searchMusicBrainzReleases as defaultSearchReleases,
} from '../lib/metadata-api.js';
import { buildReleaseArtworkRequests } from '../lib/release-artwork-resolve.js';

export function useSearchMusicWorkflow({
  resolveArtworkFn = async () => {},
  searchArtists = defaultSearchArtists,
  searchReleases = defaultSearchReleases,
  toErrorMessage = getErrorMessage,
} = {}) {
  const musicQuery = ref('');
  const musicArtistResults = ref([]);
  const musicReleaseResults = ref([]);
  const isMusicSearching = ref(false);
  const musicSearchError = ref('');
  const hasMusicSearched = ref(false);

  const musicResultCount = computed(() =>
    musicArtistResults.value.length + musicReleaseResults.value.length,
  );

  const hasMusicResults = computed(() => musicResultCount.value > 0);

  async function runMusicSearch() {
    const trimmed = musicQuery.value.trim();
    if (!trimmed || isMusicSearching.value) {
      return;
    }

    musicSearchError.value = '';
    musicArtistResults.value = [];
    musicReleaseResults.value = [];
    isMusicSearching.value = true;
    hasMusicSearched.value = true;

    try {
      const [artistPayload, releasePayload] = await Promise.all([
        searchArtists({ query: trimmed, limit: 10 }),
        searchReleases({ artist: trimmed, release: trimmed, limit: 20 }),
      ]);

      musicArtistResults.value = artistPayload?.search?.results ?? [];
      musicReleaseResults.value = releasePayload?.search?.results ?? [];

      const artworkRequests = [];
      for (const artist of musicArtistResults.value) {
        if (artist?.id) {
          artworkRequests.push({
            artworkRole: 'artist_thumbnail',
            ownerId: artist.id,
            ownerType: 'musicbrainz_artist',
          });
        }
      }
      artworkRequests.push(...buildReleaseArtworkRequests(musicReleaseResults.value));

      if (artworkRequests.length > 0) {
        void resolveArtworkFn(artworkRequests);
      }
    } catch (error) {
      musicSearchError.value = toErrorMessage(error, 'Search failed. Please try again.');
    } finally {
      isMusicSearching.value = false;
    }
  }

  return {
    hasMusicResults,
    hasMusicSearched,
    isMusicSearching,
    musicArtistResults,
    musicQuery,
    musicReleaseResults,
    musicResultCount,
    musicSearchError,
    runMusicSearch,
  };
}

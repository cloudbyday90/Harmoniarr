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

import { computed, readonly, ref, toValue, watch } from 'vue';
import { useAsyncResource } from './useAsyncResource.js';
import {
  allowMusicQueueFallbackQuality as defaultAllowMusicQueueFallbackQuality,
  fetchMusicQueueReleases as defaultFetchMusicQueueReleases,
  rejectMusicQueueMatch as defaultRejectMusicQueueMatch,
  searchMusicQueueReleaseAgain as defaultSearchMusicQueueReleaseAgain,
  useMusicQueueMatch as defaultUseMusicQueueMatch,
} from '../lib/acquisition-api.js';
import { buildMusicQueueSummaryCards, normalizeMusicQueueRelease } from '../lib/acquisition-pipeline-presentation.js';
import { getErrorMessage } from '../lib/error-utils.js';

export function useMusicQueue({
  allowMusicQueueFallbackQuality = defaultAllowMusicQueueFallbackQuality,
  fetchMusicQueueReleases = defaultFetchMusicQueueReleases,
  immediate = true,
  limit = 100,
  metadataArtistId = null,
  pollIntervalMs = 30000,
  rejectMusicQueueMatch = defaultRejectMusicQueueMatch,
  searchMusicQueueReleaseAgain = defaultSearchMusicQueueReleaseAgain,
  useMusicQueueMatch = defaultUseMusicQueueMatch,
} = {}) {
  const actionErrorMessage = ref('');
  const actionMessage = ref('');
  const activeMatchActionKey = ref('');
  const activeReleaseActionKey = ref('');
  const hasArtistScope = metadataArtistId !== null;

  function getMetadataArtistId() {
    const value = toValue(metadataArtistId);
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  const resource = useAsyncResource({
    fallbackErrorMessage: 'Music Queue failed to load',
    fetcher: () => fetchMusicQueueReleases({
      limit,
      metadataArtistId: getMetadataArtistId(),
    }),
    immediate: hasArtistScope ? false : immediate,
    initialData: { pagination: { total: 0 }, releases: [], summary: { counts: {}, total: 0 } },
    pollIntervalMs,
    pollWhile: () => !hasArtistScope || Boolean(getMetadataArtistId()),
    project: (payload) => ({
      checkedAt: payload?.checkedAt ?? null,
      pagination: payload?.pagination ?? { total: 0 },
      releases: Array.isArray(payload?.releases) ? payload.releases.map(normalizeMusicQueueRelease) : [],
      summary: payload?.summary ?? { counts: {}, total: 0 },
    }),
    revalidateOnFocus: true,
  });

  if (hasArtistScope) {
    watch(getMetadataArtistId, (nextMetadataArtistId, previousMetadataArtistId) => {
      if (nextMetadataArtistId === previousMetadataArtistId && previousMetadataArtistId !== undefined) {
        return;
      }

      resource.reset();
      if (nextMetadataArtistId) {
        void resource.load();
      }
    }, { immediate: true });
  }

  const releases = computed(() => resource.data.value.releases ?? []);
  const summaryCards = computed(() => buildMusicQueueSummaryCards(resource.data.value.summary));
  const totalCount = computed(() => resource.data.value.pagination?.total ?? releases.value.length);

  async function runMatchAction({
    actionKey,
    apiFn,
    matchId,
    successMessage,
    wantedReleaseId,
  }) {
    if (!wantedReleaseId || !matchId) {
      actionErrorMessage.value = 'This match is missing the release context needed to update it.';
      return null;
    }

    activeMatchActionKey.value = actionKey;
    actionErrorMessage.value = '';
    actionMessage.value = '';

    try {
      const payload = await apiFn({ matchId, wantedReleaseId });
      actionMessage.value = successMessage;
      await resource.load();
      return payload;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Music Queue match action failed.');
      return null;
    } finally {
      activeMatchActionKey.value = '';
    }
  }

  function useMatch({ matchId, wantedReleaseId } = {}) {
    return runMatchAction({
      actionKey: `${wantedReleaseId}:${matchId}:use`,
      apiFn: useMusicQueueMatch,
      matchId,
      successMessage: 'Match selected. Harmoniarr will use it for the next download step.',
      wantedReleaseId,
    });
  }

  function rejectMatch({ matchId, wantedReleaseId } = {}) {
    return runMatchAction({
      actionKey: `${wantedReleaseId}:${matchId}:reject`,
      apiFn: rejectMusicQueueMatch,
      matchId,
      successMessage: 'Match rejected. Harmoniarr will not choose it for this release.',
      wantedReleaseId,
    });
  }

  async function searchAgain({ wantedReleaseId } = {}) {
    if (!wantedReleaseId) {
      actionErrorMessage.value = 'This release is missing the context needed to search again.';
      return null;
    }

    activeReleaseActionKey.value = `${wantedReleaseId}:search-again`;
    actionErrorMessage.value = '';
    actionMessage.value = '';

    try {
      const payload = await searchMusicQueueReleaseAgain({ wantedReleaseId });
      actionMessage.value = payload?.action?.dispatchAlreadyActive
        ? 'Search queued. Discovery is already running and will pick this up.'
        : 'Search queued. Harmoniarr will look for this release again.';
      await resource.load();
      return payload;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Music Queue search retry failed.');
      return null;
    } finally {
      activeReleaseActionKey.value = '';
    }
  }

  async function allowFallbackQuality({ wantedReleaseId } = {}) {
    if (!wantedReleaseId) {
      actionErrorMessage.value = 'This release is missing the context needed to allow fallback quality.';
      return null;
    }

    activeReleaseActionKey.value = `${wantedReleaseId}:allow-fallback-quality`;
    actionErrorMessage.value = '';
    actionMessage.value = '';

    try {
      const payload = await allowMusicQueueFallbackQuality({ wantedReleaseId });
      actionMessage.value = payload?.action?.dispatchAlreadyActive
        ? 'Fallback quality allowed. Discovery is already running and will pick this up.'
        : 'Fallback quality allowed. Harmoniarr will look for an acceptable match.';
      await resource.load();
      return payload;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Music Queue fallback quality update failed.');
      return null;
    } finally {
      activeReleaseActionKey.value = '';
    }
  }

  return {
    ...resource,
    actionErrorMessage: readonly(actionErrorMessage),
    actionMessage: readonly(actionMessage),
    activeMatchActionKey: readonly(activeMatchActionKey),
    activeReleaseActionKey: readonly(activeReleaseActionKey),
    allowFallbackQuality,
    rejectMatch,
    releases,
    searchAgain,
    summaryCards,
    totalCount,
    useMatch,
  };
}
